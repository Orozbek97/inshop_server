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
          'likes', COUNT(*) FILTER (WHERE r.rating = 1),
          'dislikes', COUNT(*) FILTER (WHERE r.rating = -1),
          'reviews_count', COUNT(*)
        )
        FROM reviews r
        WHERE r.shop_id = s.id
      ), '{"likes": 0, "dislikes": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY s.is_paid DESC, s.created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function getShopsByCategorySlug(categorySlug) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COUNT(*) FILTER (WHERE r.rating = 1),
          'dislikes', COUNT(*) FILTER (WHERE r.rating = -1),
          'reviews_count', COUNT(*)
        )
        FROM reviews r
        WHERE r.shop_id = s.id
      ), '{"likes": 0, "dislikes": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    INNER JOIN categories c ON s.category_id = c.id
    WHERE c.slug = $1 
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
      AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    ORDER BY s.is_paid DESC, s.created_at DESC
  `;
  const result = await pool.query(query, [categorySlug]);
  return result.rows;
}

async function getShopBySlug(slug) {
  const query = `
    SELECT 
      s.*,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COUNT(*) FILTER (WHERE r.rating = 1),
          'dislikes', COUNT(*) FILTER (WHERE r.rating = -1),
          'reviews_count', COUNT(*)
        )
        FROM reviews r
        WHERE r.shop_id = s.id
      ), '{"likes": 0, "dislikes": 0, "reviews_count": 0}'::json) as reviews_summary
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
          'likes', COUNT(*) FILTER (WHERE r.rating = 1),
          'dislikes', COUNT(*) FILTER (WHERE r.rating = -1),
          'reviews_count', COUNT(*)
        )
        FROM reviews r
        WHERE r.shop_id = s.id
      ), '{"likes": 0, "dislikes": 0, "reviews_count": 0}'::json) as reviews_summary
    FROM shops s
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE s.id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function createShop(shopData) {
  const { name, instagram_url, phone, category_id, district, description, cover_image_url, original_image_url, user_id } = shopData;
  
  const uniquenessCheck = await checkInstagramUnique(instagram_url);
  if (!uniquenessCheck.unique) {
    const error = new Error(uniquenessCheck.error);
    error.code = 'DUPLICATE_INSTAGRAM';
    throw error;
  }
  
  const slug = generateSlug(name);
  
  const image_url = cover_image_url || original_image_url;
  
  // Устанавливаем subscription_expires_at = now() + 45 days
  const query = `
    INSERT INTO shops (name, slug, instagram_url, phone, category_id, district, description, image_url, cover_image_url, original_image_url, user_id, is_paid, is_verified, moderation_status, is_active, subscription_expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW() + INTERVAL '45 days')
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
          'likes', COUNT(*) FILTER (WHERE r.rating = 1),
          'dislikes', COUNT(*) FILTER (WHERE r.rating = -1),
          'reviews_count', COUNT(*)
        )
        FROM reviews r
        WHERE r.shop_id = s.id
      ), '{"likes": 0, "dislikes": 0, "reviews_count": 0}'::json) as reviews_summary
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

async function deleteShop(id) {
  const query = 'DELETE FROM shops WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
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
  deleteShop,
};

