const productsService = require('../services/products.service');
const pool = require('../db');
const logger = require('../utils/logger');
const r2Service = require('../services/r2.service');
const path = require('path');

async function ensureShopExists(shopId) {
  const result = await pool.query('SELECT id, name FROM shops WHERE id = $1', [shopId]);
  return result.rows[0] || null;
}

function generateProductFilename(productTitle, imageType) {
  // Нормализуем название товара для использования в имени файла
  let normalizedTitle = 'product';
  if (productTitle && typeof productTitle === 'string' && productTitle.trim()) {
    normalizedTitle = productTitle
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-яё0-9]+/g, '-') // Заменяем спецсимволы на дефисы
      .replace(/^-+|-+$/g, '') // Убираем дефисы в начале и конце
      .substring(0, 50); // Ограничиваем длину
    
    // Если после нормализации название пустое, используем дефолтное
    if (!normalizedTitle) {
      normalizedTitle = 'product';
    }
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const ext = imageType === 'jpeg' ? 'jpg' : imageType;
  
  return `${normalizedTitle}_${timestamp}.${ext}`;
}

function normalizeShopName(shopName) {
  if (!shopName || typeof shopName !== 'string' || !shopName.trim()) {
    return 'shop';
  }
  
  const normalized = shopName
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яё0-9]+/g, '-') // Заменяем спецсимволы на дефисы
    .replace(/^-+|-+$/g, '') // Убираем дефисы в начале и конце
    .substring(0, 50); // Ограничиваем длину
  
  return normalized || 'shop';
}

// Создание товара (только владелец магазина)
async function createProduct(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);

    if (Number.isNaN(shopId)) {
      return res.status(400).json({ error: 'Invalid shop id' });
    }

    const shop = await ensureShopExists(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const {
      section_id = null,
      category_id = null,
      title,
      price,
      old_price = null,
      description = null,
      image = null,
      images = null,
      sizes = null,
      status,
      stock_quantity = null,
      color = null,
      brand = null,
    } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: 'Price must be a non-negative number' });
    }

    if (!status || !['in_stock', 'out_of_stock'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Получаем название магазина для создания подпапки
    const shopName = shop.name || 'shop';
    const normalizedShopName = normalizeShopName(shopName);
    const productFolder = `products/${normalizedShopName}`;
    
    // Обработка изображений: конвертируем base64 в файлы и загружаем на R2
    let uploadedImages = null;
    let uploadedImage = null;
    
    try {
      // Функция для конвертации base64 в Buffer и загрузки на R2
      const uploadBase64Image = async (base64String, index = 0) => {
        if (!base64String || typeof base64String !== 'string') return null;
        
        // Проверяем, является ли это base64 data URL
        if (!base64String.startsWith('data:image/')) {
          // Если это уже URL, возвращаем как есть
          if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
            return base64String;
          }
          return null;
        }
        
        try {
          // Извлекаем данные из data URL
          const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) {
            return null;
          }
          
          const imageType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Генерируем имя файла с названием товара и датой-временем
          const filename = generateProductFilename(title, imageType);
          // Если несколько изображений, добавляем индекс
          const finalFilename = index > 0 ? filename.replace(/\.(jpg|jpeg|png|webp)$/, `_${index}.$1`) : filename;
          
          // Загружаем на R2 в подпапку магазина
          const url = await r2Service.uploadFile(buffer, finalFilename, productFolder);
          return url;
        } catch (uploadError) {
          logger.error('Error uploading base64 image to R2', { error: uploadError });
          return null;
        }
      };
      
      // Обрабатываем массив изображений
      if (images && Array.isArray(images) && images.length > 0) {
        const uploaded = await Promise.all(images.map((img, index) => uploadBase64Image(img, index)));
        uploadedImages = uploaded.filter(url => url !== null);
        uploadedImage = uploadedImages.length > 0 ? uploadedImages[0] : null;
      } else if (image) {
        // Обрабатываем одно изображение
        uploadedImage = await uploadBase64Image(image, 0);
        uploadedImages = uploadedImage ? [uploadedImage] : null;
      }
    } catch (uploadError) {
      logger.error('Error processing product images', { error: uploadError });
      // Продолжаем без изображений, если загрузка не удалась
    }

    const productData = {
      shop_id: shopId,
      section_id: section_id ? Number(section_id) : null,
      category_id: category_id ? Number(category_id) : null,
      title: title.trim(),
      price: numericPrice,
      old_price: old_price ? Number(old_price) : null,
      description: description || null,
      image: uploadedImage,
      images: uploadedImages,
      sizes: sizes || null,
      status,
      stock_quantity: stock_quantity ? Number(stock_quantity) : null,
      color: color ? color.trim() : null,
      brand: brand ? brand.trim() : null,
    };

    const product = await productsService.createProduct(productData);
    res.status(201).json(product);
  } catch (error) {
    logger.error('Error creating product', { 
      error: error.message, 
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });

    if (error.code === 'PRODUCT_LIMIT_REACHED' || error.statusCode === 400) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }

    // Возвращаем более детальную информацию об ошибке в режиме разработки
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message || 'Internal server error';
    
    res.status(500).json({ 
      error: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { details: error.detail, hint: error.hint })
    });
  }
}

// Обновление товара (только владелец магазина)
async function updateProduct(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    const productId = parseInt(req.params.productId, 10);

    if (Number.isNaN(shopId) || Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const product = await productsService.getProductById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.shop_id !== shopId) {
      return res.status(403).json({ error: 'Forbidden: product does not belong to this shop' });
    }

    // Получаем название магазина для создания подпапки
    const shop = await ensureShopExists(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    const shopName = shop.name || 'shop';
    const normalizedShopName = normalizeShopName(shopName);
    const productFolder = `products/${normalizedShopName}`;

    const updateData = {};
    const { 
      section_id, 
      category_id, 
      title, 
      price, 
      old_price,
      description, 
      image, 
      images,
      sizes,
      status, 
      stock_quantity,
      color,
      brand,
      is_active 
    } = req.body;

    if (section_id !== undefined) {
      updateData.section_id = section_id ? Number(section_id) : null;
    }

    if (category_id !== undefined) {
      updateData.category_id = category_id ? Number(category_id) : null;
    }

    if (title !== undefined) {
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title must be a non-empty string' });
      }
      updateData.title = title.trim();
    }

    if (price !== undefined) {
      const numericPrice = Number(price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return res.status(400).json({ error: 'Price must be a non-negative number' });
      }
      updateData.price = numericPrice;
    }

    if (description !== undefined) {
      updateData.description = description || null;
    }

    if (image !== undefined) {
      // Обрабатываем одно изображение: конвертируем base64 в файл и загружаем на R2
      try {
        if (image && typeof image === 'string') {
          // Если это уже URL, оставляем как есть
          if (image.startsWith('http://') || image.startsWith('https://')) {
            updateData.image = image;
          } else if (image.startsWith('data:image/')) {
            // Конвертируем base64 в файл
            const matches = image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const imageType = matches[1];
              const base64Data = matches[2];
              const buffer = Buffer.from(base64Data, 'base64');
              
              // Используем название товара из updateData или из существующего продукта
              const productTitle = updateData.title || product.title;
              const filename = generateProductFilename(productTitle, imageType);
              
              const url = await r2Service.uploadFile(buffer, filename, productFolder);
              updateData.image = url;
            } else {
              updateData.image = null;
            }
          } else {
            updateData.image = image || null;
          }
        } else {
          updateData.image = null;
        }
      } catch (uploadError) {
        logger.error('Error processing product image on update', { error: uploadError });
        updateData.image = image || null;
      }
    }

    if (images !== undefined) {
      // Обрабатываем изображения: конвертируем base64 в файлы и загружаем на R2
      try {
        // Используем название товара из updateData или из существующего продукта
        const productTitle = updateData.title || product.title;
        
        const uploadBase64Image = async (base64String, index = 0) => {
          if (!base64String || typeof base64String !== 'string') return null;
          
          // Если это уже URL, возвращаем как есть
          if (base64String.startsWith('http://') || base64String.startsWith('https://')) {
            return base64String;
          }
          
          // Проверяем, является ли это base64 data URL
          if (!base64String.startsWith('data:image/')) {
            return null;
          }
          
          try {
            const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
              return null;
            }
            
            const imageType = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Генерируем имя файла с названием товара и датой-временем
            const filename = generateProductFilename(productTitle, imageType);
            // Если несколько изображений, добавляем индекс
            const finalFilename = index > 0 ? filename.replace(/\.(jpg|jpeg|png|webp)$/, `_${index}.$1`) : filename;
            
            const url = await r2Service.uploadFile(buffer, finalFilename, productFolder);
            return url;
          } catch (uploadError) {
            logger.error('Error uploading base64 image to R2', { error: uploadError });
            return null;
          }
        };
        
        if (images && Array.isArray(images) && images.length > 0) {
          const uploaded = await Promise.all(images.map((img, index) => uploadBase64Image(img, index)));
          updateData.images = uploaded.filter(url => url !== null);
          // Обновляем также image для обратной совместимости
          if (updateData.images.length > 0) {
            updateData.image = updateData.images[0];
          }
        } else {
          updateData.images = null;
        }
      } catch (uploadError) {
        logger.error('Error processing product images on update', { error: uploadError });
        // Если загрузка не удалась, оставляем как есть
      }
    }

    if (sizes !== undefined) {
      updateData.sizes = sizes || null;
    }

    if (old_price !== undefined) {
      const numericOldPrice = old_price ? Number(old_price) : null;
      if (numericOldPrice !== null && (Number.isNaN(numericOldPrice) || numericOldPrice < 0)) {
        return res.status(400).json({ error: 'Old price must be a non-negative number' });
      }
      updateData.old_price = numericOldPrice;
    }

    if (stock_quantity !== undefined) {
      const numericStock = stock_quantity ? Number(stock_quantity) : null;
      if (numericStock !== null && (Number.isNaN(numericStock) || numericStock < 0)) {
        return res.status(400).json({ error: 'Stock quantity must be a non-negative number' });
      }
      updateData.stock_quantity = numericStock;
    }

    if (color !== undefined) {
      updateData.color = color ? color.trim() : null;
    }

    if (brand !== undefined) {
      updateData.brand = brand ? brand.trim() : null;
    }

    if (status !== undefined) {
      if (!['in_stock', 'out_of_stock'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      updateData.status = status;
    }

    if (is_active !== undefined) {
      updateData.is_active = Boolean(is_active);
    }

    const updated = await productsService.updateProduct(productId, updateData);

    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(updated);
  } catch (error) {
    logger.error('Error updating product', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Удаление товара (только владелец магазина)
async function deleteProduct(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    const productId = parseInt(req.params.productId, 10);

    if (Number.isNaN(shopId) || Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const product = await productsService.getProductById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.shop_id !== shopId) {
      return res.status(403).json({ error: 'Forbidden: product does not belong to this shop' });
    }

    const deleted = await productsService.deleteProduct(productId);

    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting product', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Список товаров магазина для владельца
async function listProductsByShopForOwner(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);

    if (Number.isNaN(shopId)) {
      return res.status(400).json({ error: 'Invalid shop id' });
    }

    const shop = await ensureShopExists(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const products = await productsService.getProductsByShopForOwner(shopId);
    res.json(products);
  } catch (error) {
    logger.error('Error listing products for owner', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Список активных товаров магазина для покупателей
async function listActiveProductsByShop(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);

    if (Number.isNaN(shopId)) {
      return res.status(400).json({ error: 'Invalid shop id' });
    }

    const shop = await ensureShopExists(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const products = await productsService.getActiveProductsByShop(shopId);
    res.json(products);
  } catch (error) {
    logger.error('Error listing active products', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  listProductsByShopForOwner,
  listActiveProductsByShop,
};


