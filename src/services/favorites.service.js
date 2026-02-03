const pool = require('../db');

async function addToFavorites(userId, shopId) {
  const query = `
    INSERT INTO favorites (user_id, shop_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, shop_id) DO NOTHING
    RETURNING *
  `;
  const result = await pool.query(query, [userId, shopId]);
  return result.rows[0] || null;
}

async function removeFromFavorites(userId, shopId) {
  const query = `
    DELETE FROM favorites
    WHERE user_id = $1 AND shop_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [userId, shopId]);
  return result.rows[0] || null;
}

async function isFavorite(userId, shopId) {
  const query = `
    SELECT * FROM favorites
    WHERE user_id = $1 AND shop_id = $2
  `;
  const result = await pool.query(query, [userId, shopId]);
  return result.rows.length > 0;
}

async function getUserFavorites(userId, page = 1, limit = 15) {
  const offset = (page - 1) * limit;
  
  // Получаем общее количество
  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM favorites f
    INNER JOIN shops s ON f.shop_id = s.id
    WHERE f.user_id = $1
  `;
  const countResult = await pool.query(countQuery, [userId]);
  const total = countResult.rows[0]?.total || 0;
  
  const query = `
    SELECT 
      s.id,
      s.name,
      s.slug,
      s.cover_image_url,
      s.image_url,
      s.category_id,
      s.district,
      c.name as category_name,
      c.slug as category_slug,
      COALESCE((
        SELECT json_build_object(
          'likes', COUNT(*) FILTER (WHERE r.rating = 1),
          'dislikes', COUNT(*) FILTER (WHERE r.rating = -1),
          'reviews_count', COUNT(*) FILTER (WHERE r.comment IS NOT NULL AND TRIM(r.comment) != '')
        )
        FROM reviews r
        WHERE r.shop_id = s.id
      ), '{"likes": 0, "dislikes": 0, "reviews_count": 0}'::json) as reviews_summary,
      f.created_at as favorited_at
    FROM favorites f
    INNER JOIN shops s ON f.shop_id = s.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const result = await pool.query(query, [userId, limit, offset]);
  
  const hasMore = offset + result.rows.length < total;
  
  return {
    data: result.rows,
    meta: {
      page,
      limit,
      total,
      has_more: hasMore,
    },
  };
}

module.exports = {
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  getUserFavorites,
};

