const shopsService = require('../services/shops.service');
const telegramService = require('../services/telegram.service');
const r2Service = require('../services/r2.service');
const pool = require('../db');
const logger = require('../utils/logger');
const path = require('path');

async function getAllShops(req, res) {
  try {
    const shops = await shopsService.getAllShops();
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error fetching shops', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getShopsByCategory(req, res) {
  try {
    const { slug } = req.params;
    const search = req.query.search ? req.query.search.trim() : null;
    const sortBy = req.query.sort_by || 'popularity';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    
    const result = await shopsService.getShopsByCategorySlug(slug, {
      search,
      sortBy,
      page,
      limit,
    });
    
    const formattedShops = result.data.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    
    res.json({
      data: formattedShops,
      meta: result.meta,
    });
  } catch (error) {
    logger.error('Error fetching shops by category', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getShopBySlug(req, res) {
  try {
    const { slug } = req.params;
    const shop = await shopsService.getShopBySlug(slug);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const formattedShop = {
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    };
    
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error fetching shop', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

function generateFilename(shopName, originalname) {
  // Нормализуем название магазина для использования в имени файла
  let normalizedName = 'shop';
  if (shopName && typeof shopName === 'string' && shopName.trim()) {
    normalizedName = shopName
      .toLowerCase()
      .trim()
      .replace(/[^a-zа-яё0-9]+/g, '-') // Заменяем спецсимволы на дефисы
      .replace(/^-+|-+$/g, '') // Убираем дефисы в начале и конце
      .substring(0, 50); // Ограничиваем длину
    
    // Если после нормализации название пустое, используем дефолтное
    if (!normalizedName) {
      normalizedName = 'shop';
    }
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
  const ext = path.extname(originalname) || '.jpg';
  
  return `${normalizedName}-${timestamp}${ext}`;
}

async function createShop(req, res) {
  try {
    const { name, instagram_url, phone, category_id, district, description } = req.body;
    
    if (!name || !instagram_url || !phone || !category_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    let cover_image_url = null;
    
    try {
      if (req.files) {
        if (req.files.coverImage && req.files.coverImage[0]) {
          const file = req.files.coverImage[0];
          if (!file.buffer) {
            return res.status(400).json({ error: 'Invalid file upload' });
          }
          const filename = generateFilename(name, file.originalname);
          cover_image_url = await r2Service.uploadFile(file.buffer, filename, 'shops');
        }
      }
      
      if (req.file) {
        if (!req.file.buffer) {
          return res.status(400).json({ error: 'Invalid file upload' });
        }
        const filename = generateFilename(name, req.file.originalname);
        cover_image_url = await r2Service.uploadFile(req.file.buffer, filename, 'shops');
      }
    } catch (uploadError) {
      logger.error('Error uploading file to R2', { error: uploadError });
      return res.status(500).json({ error: 'Failed to upload image' });
    }
    
    const user_id = parseInt(req.user.id);
    
    const shop = await shopsService.createShop({
      name,
      instagram_url,
      phone,
      category_id,
      district: district || null,
      description: description || null,
      cover_image_url: cover_image_url,
      original_image_url: cover_image_url, // Сохраняем то же изображение для обратной совместимости
      user_id,
    });

    const shopWithCategory = await shopsService.getShopById(shop.id);
    
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [user_id]);
    const userEmail = userResult.rows[0]?.email || null;
    
    await telegramService.sendModerationNotification(shopWithCategory, userEmail);
    
    res.status(201).json(shop);
  } catch (error) {
    logger.error('Error creating shop', { error });
    if (error.code === 'DUPLICATE_INSTAGRAM') {
      return res.status(409).json({ error: error.message });
    }
    if (error.code === 'SHOP_LIMIT_REACHED') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserShops(req, res) {
  try {
    const userId = parseInt(req.user.id);
    const shops = await shopsService.getUserShops(userId);
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error fetching user shops', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getShopById(req, res) {
  try {
    const { id } = req.params;
    const shop = await shopsService.getShopById(parseInt(id));
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const formattedShop = {
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    };
    
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error fetching shop', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateShop(req, res) {
  try {
    const { id } = req.params;
    const { name, instagram_url, phone, category_id, district, description, delivery } = req.body;
    
    if (!name || !name.trim() || !instagram_url || !instagram_url.trim() || !category_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingShop = await shopsService.getShopById(parseInt(id));
    if (!existingShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const parsedCategoryId = parseInt(category_id);
    if (isNaN(parsedCategoryId)) {
      return res.status(400).json({ error: 'Invalid category_id' });
    }
    
    const deleteImageFile = async (imageUrl) => {
      if (!imageUrl) return;
      try {
        const key = r2Service.getKeyFromUrl(imageUrl);
        if (key) {
          await r2Service.deleteFile(key);
        }
      } catch (error) {
        logger.error(`Error deleting image file from R2: ${imageUrl}`, { error });
      }
    };
    
    let cover_image_url = existingShop.cover_image_url;
    
    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        // Удаляем старые изображения
        if (existingShop.cover_image_url) await deleteImageFile(existingShop.cover_image_url);
        if (existingShop.original_image_url && existingShop.original_image_url !== existingShop.cover_image_url) {
          await deleteImageFile(existingShop.original_image_url);
        }
        if (existingShop.image_url && existingShop.image_url !== existingShop.cover_image_url && existingShop.image_url !== existingShop.original_image_url) {
          await deleteImageFile(existingShop.image_url);
        }
        
        const file = req.files.coverImage[0];
        const shopName = name || existingShop.name;
        const filename = generateFilename(shopName, file.originalname);
        cover_image_url = await r2Service.uploadFile(file.buffer, filename, 'shops');
      }
    }
    
    if (req.file) {
      // Удаляем старые изображения
      if (existingShop.cover_image_url) await deleteImageFile(existingShop.cover_image_url);
      if (existingShop.original_image_url && existingShop.original_image_url !== existingShop.cover_image_url) {
        await deleteImageFile(existingShop.original_image_url);
      }
      if (existingShop.image_url && existingShop.image_url !== existingShop.cover_image_url && existingShop.image_url !== existingShop.original_image_url) {
        await deleteImageFile(existingShop.image_url);
      }
      
      const shopName = name || existingShop.name;
      const filename = generateFilename(shopName, req.file.originalname);
      cover_image_url = await r2Service.uploadFile(req.file.buffer, filename, 'shops');
    }
    
    const deliveryValue = delivery === 'true' || delivery === true || delivery === '1' || delivery === 1;
    
    const isRejected = existingShop.moderation_status === 'rejected';
    const shouldResubmit = isRejected && req.body.resubmit === 'true';
    
    if (shouldResubmit) {
      await shopsService.updateModerationStatus(parseInt(id), 'pending');
    }
    
    const finalCoverImageUrl = cover_image_url !== undefined ? cover_image_url : existingShop.cover_image_url;
    
    const shop = await shopsService.updateShop(parseInt(id), {
      name: name.trim(),
      instagram_url: instagram_url.trim(),
      phone: phone && phone.trim() ? phone.trim() : existingShop.phone,
      category_id: parsedCategoryId,
      district: district && district.trim() ? district.trim() : null,
      description: description && description.trim() ? description.trim() : null,
      cover_image_url: finalCoverImageUrl,
      original_image_url: finalCoverImageUrl, // Используем то же изображение для обратной совместимости
      delivery: deliveryValue,
    });
    
    const updatedShop = await shopsService.getShopById(parseInt(id));
    if (!updatedShop) {
      return res.status(404).json({ error: 'Shop not found after update' });
    }
    
    if (shouldResubmit) {
      const shopWithCategory = await shopsService.getShopById(parseInt(id));
      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      const userEmail = userResult.rows[0]?.email || null;
      await telegramService.sendModerationNotification(shopWithCategory, userEmail);
    }
    
    const formattedShop = {
      ...updatedShop,
      reviews_summary: typeof updatedShop.reviews_summary === 'string' 
        ? JSON.parse(updatedShop.reviews_summary) 
        : updatedShop.reviews_summary
    };
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error updating shop', { error });
    if (error.code === 'DUPLICATE_INSTAGRAM') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleShopActive(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }
    
    const existingShop = await shopsService.getShopById(parseInt(id));
    if (!existingShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    // Проверка владельца уже выполнена в middleware checkShopOwnership
    const updatedShop = await shopsService.toggleShopActive(parseInt(id), is_active);
    
    if (!updatedShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const formattedShop = {
      ...updatedShop,
      reviews_summary: typeof updatedShop.reviews_summary === 'string' 
        ? JSON.parse(updatedShop.reviews_summary) 
        : updatedShop.reviews_summary
    };
    
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error toggling shop active status', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteShop(req, res) {
  try {
    const { id } = req.params;
    
    const shop = await shopsService.getShopById(parseInt(id));
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    if (shop.cover_image_url) {
      const key = r2Service.getKeyFromUrl(shop.cover_image_url);
      if (key) {
        await r2Service.deleteFile(key);
      }
    }
    if (shop.original_image_url && shop.original_image_url !== shop.cover_image_url) {
      const key = r2Service.getKeyFromUrl(shop.original_image_url);
      if (key) {
        await r2Service.deleteFile(key);
      }
    }
    
    await shopsService.deleteShop(parseInt(id));
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting shop', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPopularShops(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const shops = await shopsService.getPopularShops(limit);
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error getting popular shops:', error);
    res.status(500).json({ error: 'Failed to get popular shops' });
  }
}

async function getNewShops(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const shops = await shopsService.getNewShops(limit);
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error getting new shops:', error);
    res.status(500).json({ error: 'Failed to get new shops' });
  }
}

async function getRecommendedShops(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
    const shops = await shopsService.getRecommendedShops(limit);
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error getting recommended shops:', error);
    res.status(500).json({ error: 'Failed to get recommended shops' });
  }
}

module.exports = {
  getAllShops,
  getShopsByCategory,
  getShopBySlug,
  getUserShops,
  getShopById,
  createShop,
  updateShop,
  toggleShopActive,
  deleteShop,
  getPopularShops,
  getNewShops,
  getRecommendedShops,
};

