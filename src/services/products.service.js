const pool = require('../db');

/**
 * Парсит JSON поля товара при чтении из БД
 * @param {Object} product - товар из БД
 * @returns {Object} - товар с распарсенными JSON полями
 */
function parseProductJsonFields(product) {
  if (!product) return product;
  
  // Парсим images
  if (product.images) {
    try {
      if (typeof product.images === 'string') {
        product.images = JSON.parse(product.images);
      }
    } catch (e) {
      product.images = [];
    }
  } else {
    product.images = [];
  }
  
  // Парсим sizes
  if (product.sizes) {
    try {
      if (typeof product.sizes === 'string') {
        product.sizes = JSON.parse(product.sizes);
      }
    } catch (e) {
      product.sizes = [];
    }
  } else {
    product.sizes = [];
  }
  
  return product;
}

/**
 * Создание товара с проверкой лимита тарифа для магазина.
 *
 * @param {Object} productData
 * @param {number} productData.shop_id
 * @param {number|null} productData.section_id
 * @param {string} productData.title
 * @param {number} productData.price
 * @param {string|null} productData.description
 * @param {string|null} productData.image
 * @param {'in_stock'|'out_of_stock'} productData.status
 * @returns {Promise<Object>}
 */
async function createProduct(productData) {
  const {
    shop_id,
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
  } = productData;

  // Получаем тариф магазина и текущее количество активных товаров
  const shopQuery = `
    SELECT tariff
    FROM shops
    WHERE id = $1
  `;
  const shopResult = await pool.query(shopQuery, [shop_id]);

  if (shopResult.rows.length === 0) {
    const error = new Error('Shop not found');
    error.statusCode = 404;
    throw error;
  }

  const { tariff } = shopResult.rows[0];

  // Определяем лимит на основе тарифа
  const tariffLimits = {
    start: 15,
    standard: 30,
    pro: 100,
  };
  const productLimit = tariffLimits[tariff] || 15;
  
  // Проверяем, что подписка активна
  const subscriptionCheckQuery = `
    SELECT subscription_expires_at, is_active
    FROM shops
    WHERE id = $1
  `;
  const subscriptionResult = await pool.query(subscriptionCheckQuery, [shop_id]);
  if (subscriptionResult.rows.length > 0) {
    const shop = subscriptionResult.rows[0];
    const isSubscriptionActive = shop.subscription_expires_at 
      ? new Date(shop.subscription_expires_at) > new Date() 
      : false;
    
    if (!isSubscriptionActive || !shop.is_active) {
      const error = new Error('Shop subscription expired or inactive');
      error.statusCode = 403;
      error.code = 'SUBSCRIPTION_EXPIRED';
      throw error;
    }
  }

  const countQuery = `
    SELECT COUNT(*)::int AS active_count
    FROM products
    WHERE shop_id = $1 AND is_active = true
  `;
  const countResult = await pool.query(countQuery, [shop_id]);
  const activeCount = countResult.rows[0]?.active_count || 0;

  if (productLimit !== null && productLimit !== undefined && activeCount >= productLimit) {
    const error = new Error('Product limit reached');
    error.statusCode = 400;
    error.code = 'PRODUCT_LIMIT_REACHED';
    throw error;
  }

  // Обработка изображений: если есть массив images, используем его, иначе используем image
  const finalImages = images && Array.isArray(images) && images.length > 0 
    ? JSON.stringify(images) 
    : (image ? JSON.stringify([image]) : null);
  
  // Обработка размеров: если есть массив sizes, используем его
  const finalSizes = sizes && Array.isArray(sizes) && sizes.length > 0 
    ? JSON.stringify(sizes) 
    : null;

  const insertQuery = `
    INSERT INTO products (
      shop_id,
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
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
    RETURNING *
  `;

  const values = [
    shop_id,
    section_id,
    category_id,
    title,
    price,
    old_price,
    description,
    image, // Для обратной совместимости
    finalImages,
    finalSizes,
    status,
    stock_quantity,
    color,
    brand,
  ];

  const result = await pool.query(insertQuery, values);
  return parseProductJsonFields(result.rows[0]);
}

/**
 * Обновление товара. Лимит по количеству товаров при обновлении не проверяется,
 * так как он касается только создания новых товаров.
 *
 * @param {number} id
 * @param {Object} updateData
 * @returns {Promise<Object|null>}
 */
async function updateProduct(id, updateData) {
  const fields = [];
  const values = [];
  let index = 1;

  const allowedFields = [
    'section_id',
    'category_id',
    'title',
    'price',
    'old_price',
    'description',
    'image',
    'images',
    'sizes',
    'status',
    'stock_quantity',
    'color',
    'brand',
    'is_active',
  ];

  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(updateData, key)) {
      let value = updateData[key];
      
      // Обработка JSON полей
      if (key === 'images' && value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value = value.length > 0 ? JSON.stringify(value) : null;
        } else if (typeof value === 'string') {
          // Уже JSON строка
        } else {
          value = null;
        }
      }
      
      if (key === 'sizes' && value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value = value.length > 0 ? JSON.stringify(value) : null;
        } else if (typeof value === 'string') {
          // Уже JSON строка
        } else {
          value = null;
        }
      }
      
      fields.push(`${key} = $${index}`);
      values.push(value);
      index += 1;
    }
  }

  if (fields.length === 0) {
    const selectQuery = 'SELECT * FROM products WHERE id = $1';
    const selectResult = await pool.query(selectQuery, [id]);
    return parseProductJsonFields(selectResult.rows[0] || null);
  }

  const query = `
    UPDATE products
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING *
  `;

  values.push(id);

  const result = await pool.query(query, values);
  return parseProductJsonFields(result.rows[0] || null);
}

/**
 * Удаление товара.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function deleteProduct(id) {
  const query = `
    DELETE FROM products
    WHERE id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Список товаров магазина для владельца.
 *
 * @param {number} shopId
 * @returns {Promise<Object[]>}
 */
async function getProductsByShopForOwner(shopId) {
  const query = `
    SELECT 
      p.*,
      COALESCE((
        SELECT COUNT(*)::int
        FROM product_favorites pf
        WHERE pf.product_id = p.id
      ), 0) AS favorites_count
    FROM products p
    WHERE p.shop_id = $1
    ORDER BY p.created_at DESC
  `;
  const result = await pool.query(query, [shopId]);
  return result.rows.map(parseProductJsonFields);
}

/**
 * Список активных товаров магазина для покупателей.
 *
 * @param {number} shopId
 * @returns {Promise<Object[]>}
 */
async function getActiveProductsByShop(shopId) {
  const query = `
    SELECT *
    FROM products
    WHERE shop_id = $1
      AND is_active = true
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [shopId]);
  return result.rows.map(parseProductJsonFields);
}

/**
 * Получение товара по id.
 *
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getProductById(id) {
  const query = `
    SELECT *
    FROM products
    WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return parseProductJsonFields(result.rows[0] || null);
}

/**
 * Получение популярных товаров (по просмотрам)
 */
async function getPopularProducts(limit = 12) {
  const query = `
    SELECT 
      p.*,
      json_build_object(
        'id', s.id,
        'title', s.name,
        'slug', s.slug
      ) AS shop
    FROM products p
    INNER JOIN shops s ON p.shop_id = s.id
    WHERE p.is_active = true
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      COALESCE(p.views, 0) DESC, 
      p.created_at DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows.map(parseProductJsonFields).map(product => {
    // Используем первое изображение из массива images, если есть, иначе image
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      product.image = product.images[0];
    }
    return product;
  });
}

/**
 * Получение новинок (недавно добавленные)
 */
async function getNewProducts(limit = 12) {
  const query = `
    SELECT 
      p.*,
      json_build_object(
        'id', s.id,
        'title', s.name,
        'slug', s.slug
      ) AS shop
    FROM products p
    INNER JOIN shops s ON p.shop_id = s.id
    WHERE p.is_active = true
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      p.created_at DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows.map(parseProductJsonFields).map(product => {
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      product.image = product.images[0];
    }
    return product;
  });
}

/**
 * Получение товаров со скидкой
 */
async function getDiscountedProducts(limit = 12) {
  const query = `
    SELECT 
      p.*,
      json_build_object(
        'id', s.id,
        'title', s.name,
        'slug', s.slug
      ) AS shop
    FROM products p
    INNER JOIN shops s ON p.shop_id = s.id
    WHERE p.is_active = true
      AND p.old_price IS NOT NULL
      AND p.old_price > p.price
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      ((p.old_price - p.price) / p.old_price * 100) DESC, 
      p.created_at DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows.map(parseProductJsonFields).map(product => {
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      product.image = product.images[0];
    }
    return product;
  });
}

/**
 * Получение рекомендуемых товаров (по количеству избранных)
 */
async function getRecommendedProducts(limit = 12) {
  const query = `
    SELECT 
      p.*,
      json_build_object(
        'id', s.id,
        'title', s.name,
        'slug', s.slug
      ) AS shop,
      COALESCE((SELECT COUNT(*)::int FROM product_favorites WHERE product_id = p.id), 0) AS favorites_count
    FROM products p
    INNER JOIN shops s ON p.shop_id = s.id
    WHERE p.is_active = true
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      favorites_count DESC, 
      p.created_at DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows.map(parseProductJsonFields).map(product => {
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      product.image = product.images[0];
    }
    return product;
  });
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByShopForOwner,
  getActiveProductsByShop,
  getProductById,
  getPopularProducts,
  getNewProducts,
  getDiscountedProducts,
  getRecommendedProducts,
};


