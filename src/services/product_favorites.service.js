const pool = require('../db');

async function addToFavorites(userId, productId) {
  const query = `
    INSERT INTO product_favorites (user_id, product_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, product_id) DO NOTHING
    RETURNING *
  `;
  const result = await pool.query(query, [userId, productId]);
  return result.rows[0] || null;
}

async function removeFromFavorites(userId, productId) {
  const query = `
    DELETE FROM product_favorites
    WHERE user_id = $1 AND product_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [userId, productId]);
  return result.rows[0] || null;
}

async function isFavorite(userId, productId) {
  const query = `
    SELECT * FROM product_favorites
    WHERE user_id = $1 AND product_id = $2
  `;
  const result = await pool.query(query, [userId, productId]);
  return result.rows.length > 0;
}

async function getUserFavorites(userId, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  
  // Получаем общее количество
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM product_favorites pf
    INNER JOIN products p ON pf.product_id = p.id
    INNER JOIN shops s ON p.shop_id = s.id
    WHERE pf.user_id = $1
      AND p.is_active = true
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
  `;
  const countResult = await pool.query(countQuery, [userId]);
  const total = countResult.rows[0]?.total || 0;
  
  const query = `
    SELECT 
      p.id,
      p.title,
      p.price,
      p.old_price,
      p.image,
      p.images,
      p.sizes,
      p.status,
      p.created_at,
      json_build_object(
        'id', s.id,
        'title', s.name,
        'slug', s.slug
      ) AS shop,
      json_build_object(
        'id', pc.id,
        'title', pc.title,
        'slug', pc.slug
      ) AS category,
      pf.created_at as favorited_at
    FROM product_favorites pf
    INNER JOIN products p ON pf.product_id = p.id
    INNER JOIN shops s ON p.shop_id = s.id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    WHERE pf.user_id = $1
      AND p.is_active = true
      AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
      AND (s.is_active = true OR s.is_active IS NULL)
    ORDER BY pf.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await pool.query(query, [userId, limit, offset]);
  
  const hasMore = offset + result.rows.length < total;
  
  // Парсим JSON поля
  const parsedRows = result.rows.map(row => {
    // Парсим images
    if (row.images && typeof row.images === 'string') {
      try {
        row.images = JSON.parse(row.images);
      } catch (e) {
        row.images = row.image ? [row.image] : [];
      }
    } else if (!row.images) {
      row.images = row.image ? [row.image] : [];
    }
    
    // Парсим sizes
    if (row.sizes && typeof row.sizes === 'string') {
      try {
        row.sizes = JSON.parse(row.sizes);
      } catch (e) {
        row.sizes = [];
      }
    } else if (!row.sizes) {
      row.sizes = [];
    }
    
    return row;
  });
  
  return {
    data: parsedRows,
    meta: {
      page,
      limit,
      total,
      has_more: hasMore,
    },
  };
}

async function getProductFavoritesCount(productId) {
  const query = `
    SELECT COUNT(*)::int AS count
    FROM product_favorites
    WHERE product_id = $1
  `;
  const result = await pool.query(query, [productId]);
  return result.rows[0]?.count || 0;
}

module.exports = {
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  getUserFavorites,
  getProductFavoritesCount,
};
