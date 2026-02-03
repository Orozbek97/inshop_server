const pool = require('../db');
const { extractInstagramUsername } = require('../utils/instagram');

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function checkInstagramUnique(instagramUrl, excludeShopId = null) {
  const username = extractInstagramUsername(instagramUrl);
  if (!username) {
    return { unique: false, error: 'Неверный формат Instagram URL' };
  }

  const normalizedUsername = username.toLowerCase().trim();

  let query = `
    SELECT id, instagram_url 
    FROM shops 
    WHERE (
      LOWER(instagram_url) LIKE $1 
      OR LOWER(instagram_url) = $2
      OR LOWER(instagram_url) LIKE $3
      OR LOWER(instagram_url) LIKE $4
    )
  `;
  
  let params = [
    `%instagram.com/${normalizedUsername}%`,
    normalizedUsername,
    `%@${normalizedUsername}%`,
    `%/${normalizedUsername}%`
  ];

  if (excludeShopId) {
    query += ' AND id != $5';
    params.push(excludeShopId);
  }

  const result = await pool.query(query, params);
  
  if (result.rows.length > 0) {
    for (const row of result.rows) {
      const existingUsername = extractInstagramUsername(row.instagram_url || '');
      if (existingUsername && existingUsername.toLowerCase() === normalizedUsername) {
        return { unique: false, error: 'Instagram аккаунт уже используется другим магазином' };
      }
    }
  }

  return { unique: true };
}

async function getAllShops() {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      s.is_paid DESC, 
      s.created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function getShopsByCategorySlug(categorySlug, options = {}) {
  const { search, sortBy = 'popularity', page = 1, limit = 20 } = options;
  
  let whereConditions = [
    'c.slug = $1',
    "(s.moderation_status = 'approved' OR s.moderation_status IS NULL)",
    "(s.is_active = true OR s.is_active IS NULL)",
    "(s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)"
  ];
  
  const params = [categorySlug];
  let paramIndex = 2;
  
  // Добавляем поиск
  if (search && search.trim()) {
    whereConditions.push(`(s.name ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`);
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }
  
  const whereClause = whereConditions.join(' AND ');
  
  // Определяем сортировку
  let orderBy = `
    CASE 
      WHEN s.tariff = 'pro' THEN 1
      WHEN s.tariff = 'standard' THEN 2
      WHEN s.tariff = 'start' THEN 3
      ELSE 3
    END,
    s.is_paid DESC,
    s.created_at DESC
  `;
  
  switch (sortBy) {
    case 'newest':
      orderBy = `
        CASE 
          WHEN s.tariff = 'pro' THEN 1
          WHEN s.tariff = 'standard' THEN 2
          WHEN s.tariff = 'start' THEN 3
          ELSE 3
        END,
        s.created_at DESC
      `;
      break;
    case 'popularity':
      orderBy = `
        CASE 
          WHEN s.tariff = 'pro' THEN 1
          WHEN s.tariff = 'standard' THEN 2
          WHEN s.tariff = 'start' THEN 3
          ELSE 3
        END,
        COALESCE(s.views, 0) DESC,
        s.created_at DESC
      `;
      break;
    case 'rating':
      orderBy = `
        CASE 
          WHEN s.tariff = 'pro' THEN 1
          WHEN s.tariff = 'standard' THEN 2
          WHEN s.tariff = 'start' THEN 3
          ELSE 3
        END,
        (SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1) DESC,
        s.created_at DESC
      `;
      break;
    case 'name':
      orderBy = `
        CASE 
          WHEN s.tariff = 'pro' THEN 1
          WHEN s.tariff = 'standard' THEN 2
          WHEN s.tariff = 'start' THEN 3
          ELSE 3
        END,
        s.name ASC
      `;
      break;
    default:
      break;
  }
  
  // Подсчет общего количества
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM shops s
    INNER JOIN categories c ON s.category_id = c.id
    WHERE ${whereClause}
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;
  
  // Получение данных с пагинацией
  const offset = (page - 1) * limit;
  const dataQuery = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    INNER JOIN categories c ON s.category_id = c.id
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);
  const result = await pool.query(dataQuery, params);
  
  return {
    data: result.rows,
    meta: {
      page,
      limit,
      total,
      has_more: offset + result.rows.length < total,
    },
  };
}

async function getShopBySlug(slug) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.slug = $1 
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
  `;
  const result = await pool.query(query, [slug]);
  return result.rows[0] || null;
}

async function getShopById(id) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function createShop(shopData) {
  const { name, instagram_url, phone, category_id, district, description, cover_image_url, original_image_url, user_id } = shopData;
  
  // Проверяем лимит магазинов для пользователя
  const userShopsQuery = `
    SELECT tariff
    FROM shops
    WHERE user_id = $1
  `;
  const userShopsResult = await pool.query(userShopsQuery, [user_id]);
  const userShops = userShopsResult.rows;
  
  // Определяем максимальный тариф среди всех магазинов пользователя
  let maxTariff = 'start';
  const tariffPriority = { pro: 3, standard: 2, start: 1 };
  for (const shop of userShops) {
    const shopTariff = shop.tariff || 'start';
    if (tariffPriority[shopTariff] > tariffPriority[maxTariff]) {
      maxTariff = shopTariff;
    }
  }
  
  // Определяем лимит на основе максимального тарифа
  const tariffLimits = {
    start: 1,
    standard: 1,
    pro: 2,
  };
  const shopsLimit = tariffLimits[maxTariff] || 1;
  
  // Проверяем, не превышен ли лимит
  if (userShops.length >= shopsLimit) {
    const tariffNames = {
      start: 'Start',
      standard: 'Standard',
      pro: 'Pro',
    };
    const tariffName = tariffNames[maxTariff] || maxTariff;
    const shopWord = shopsLimit === 1 ? 'магазин' : shopsLimit === 2 ? 'магазина' : 'магазинов';
    const error = new Error(`Достигнут лимит магазинов. Ваш текущий тариф "${tariffName}" позволяет создать до ${shopsLimit} ${shopWord}.`);
    error.statusCode = 400;
    error.code = 'SHOP_LIMIT_REACHED';
    throw error;
  }
  
  const uniquenessCheck = await checkInstagramUnique(instagram_url);
  if (!uniquenessCheck.unique) {
    const error = new Error(uniquenessCheck.error);
    error.code = 'DUPLICATE_INSTAGRAM';
    throw error;
  }
  
  const slug = generateSlug(name);
  
  const image_url = cover_image_url || original_image_url;
  
  // Устанавливаем subscription_expires_at = now() + 30 days и тариф 'start' (бесплатный пробный период)
  const query = `
    INSERT INTO shops (name, slug, instagram_url, phone, category_id, district, description, image_url, cover_image_url, original_image_url, user_id, is_paid, is_verified, moderation_status, is_active, subscription_expires_at, tariff)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW() + INTERVAL '30 days', 'start')
    RETURNING *
  `;
  
  const values = [name, slug, instagram_url, phone, category_id, district || null, description || null, image_url || null, cover_image_url || null, original_image_url || null, user_id || null, false, false, 'pending', true];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function updateModerationStatus(id, status) {
  const query = `
    UPDATE shops 
    SET moderation_status = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [status, id]);
  return result.rows[0] || null;
}

async function updateShop(id, shopData) {
  const { name, instagram_url, phone, category_id, district, description, cover_image_url, original_image_url, delivery } = shopData;
  
  const existingShop = await getShopById(id);
  if (existingShop && existingShop.instagram_url !== instagram_url) {
    const uniquenessCheck = await checkInstagramUnique(instagram_url, id);
    if (!uniquenessCheck.unique) {
      const error = new Error(uniquenessCheck.error);
      error.code = 'DUPLICATE_INSTAGRAM';
      throw error;
    }
  }
  
  const image_url = cover_image_url || original_image_url || null;
  
  const query = `
    UPDATE shops 
    SET name = $1, instagram_url = $2, phone = $3, category_id = $4, district = $5, description = $6, image_url = $7, cover_image_url = $8, original_image_url = $9, delivery = $10
    WHERE id = $11
    RETURNING *
  `;
  
  const values = [
    name,
    instagram_url,
    phone || null,
    category_id,
    district || null,
    description || null,
    image_url,
    cover_image_url || null,
    original_image_url || null,
    delivery !== undefined && delivery !== null ? delivery : null,
    id,
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function getUserShops(userId) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

async function toggleShopActive(id, isActive) {
  const query = `
    UPDATE shops 
    SET is_active = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [isActive, id]);
  return result.rows[0] || null;
}

async function extendSubscription(id, days) {
  const query = `
    UPDATE shops 
    SET subscription_expires_at = CASE 
      WHEN subscription_expires_at > NOW() THEN subscription_expires_at + INTERVAL '${days} days'
      ELSE NOW() + INTERVAL '${days} days'
    END
    WHERE id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function updateShopTariff(id, tariff) {
  if (!['start', 'standard', 'pro'].includes(tariff)) {
    throw new Error('Invalid tariff');
  }
  
  const query = `
    UPDATE shops 
    SET tariff = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [tariff, id]);
  return result.rows[0] || null;
}

async function updateShopTariffAndExtend(id, tariff, days) {
  if (!['start', 'standard', 'pro'].includes(tariff)) {
    throw new Error('Invalid tariff');
  }
  
  const query = `
    UPDATE shops 
    SET tariff = $1,
        subscription_expires_at = CASE 
          WHEN subscription_expires_at > NOW() THEN subscription_expires_at + INTERVAL '${days} days'
          ELSE NOW() + INTERVAL '${days} days'
        END
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [tariff, id]);
  return result.rows[0] || null;
}

async function deleteShop(id) {
  const query = 'DELETE FROM shops WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

/**
 * Получение популярных магазинов (по просмотрам и рейтингу)
 */
async function getPopularShops(limit = 8) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      COALESCE(s.views, 0) DESC, 
      s.created_at DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

/**
 * Получение новых магазинов
 */
async function getNewShops(limit = 8) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      s.created_at DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

/**
 * Получение рекомендуемых магазинов (с высоким рейтингом)
 */
async function getRecommendedShops(limit = 8) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1), 0),
          'dislikes', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = -1), 0),
          'reactions_count', COALESCE((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0),
          'reviews_count', COALESCE((SELECT COUNT(*) FROM shop_reviews WHERE shop_id = s.id), 0)
        )
      ), '{"likes": 0, "dislikes": 0, "reactions_count": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
      AND (SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id AND rating = 1) > 0
    ORDER BY 
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
      (SELECT COUNT(*)::float / NULLIF((SELECT COUNT(*) FROM shop_reactions WHERE shop_id = s.id), 0) * 5 
       FROM shop_reactions WHERE shop_id = s.id AND rating = 1) DESC,
      s.created_at DESC
    LIMIT $1
  `;
  const result = await pool.query(query, [limit]);
  return result.rows;
}

module.exports = {
  getAllShops,
  getShopsByCategorySlug,
  getShopBySlug,
  getShopById,
  getUserShops,
  createShop,
  updateShop,
  updateModerationStatus,
  toggleShopActive,
  extendSubscription,
  updateShopTariff,
  updateShopTariffAndExtend,
  deleteShop,
  getPopularShops,
  getNewShops,
  getRecommendedShops,
};

