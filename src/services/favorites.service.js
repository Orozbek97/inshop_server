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

async function getUserFavorites(userId) {
  const query = `
    SELECT 
      s.id,
      s.name,
      s.slug,
      s.cover_image_url,
      s.image_url,
      s.category_id,
      c.name as category_name,
      c.slug as category_slug,
      f.created_at as favorited_at
    FROM favorites f
    INNER JOIN shops s ON f.shop_id = s.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE f.user_id = $1
    ORDER BY f.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

module.exports = {
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  getUserFavorites,
};

