const pool = require('../db');

async function getShopReviews(shopId) {
  const query = `
    SELECT 
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      u.id as user_id,
      u.name as user_name
    FROM reviews r
    INNER JOIN users u ON r.user_id = u.id
    WHERE r.shop_id = $1
    ORDER BY r.created_at DESC
  `;
  const result = await pool.query(query, [shopId]);
  return result.rows;
}

async function getReviewSummary(shopId) {
  const query = `
    SELECT 
      COUNT(*) FILTER (WHERE rating = 1) as likes,
      COUNT(*) FILTER (WHERE rating = -1) as dislikes,
      COUNT(*) as reviews_count
    FROM reviews
    WHERE shop_id = $1
  `;
  const result = await pool.query(query, [shopId]);
  const { likes, dislikes, reviews_count } = result.rows[0];
  return {
    likes: parseInt(likes) || 0,
    dislikes: parseInt(dislikes) || 0,
    reviews_count: parseInt(reviews_count) || 0,
    score: (parseInt(likes) || 0) - (parseInt(dislikes) || 0),
  };
}

async function getUserReview(shopId, userId) {
  const query = `
    SELECT * FROM reviews
    WHERE shop_id = $1 AND user_id = $2
  `;
  const result = await pool.query(query, [shopId, userId]);
  return result.rows[0] || null;
}

async function createOrUpdateReview(shopId, userId, rating, comment) {
  const existingReview = await getUserReview(shopId, userId);
  
  if (existingReview) {
    const finalRating = rating !== undefined && rating !== null ? rating : existingReview.rating;
    let finalComment;
    if (comment === '') {
      finalComment = null;
    } else if (comment !== undefined && comment !== null) {
      finalComment = comment;
    } else {
      finalComment = existingReview.comment;
    }
    
    const query = `
      UPDATE reviews
      SET rating = $1, comment = $2
      WHERE shop_id = $3 AND user_id = $4
      RETURNING *
    `;
    const result = await pool.query(query, [finalRating, finalComment, shopId, userId]);
    return result.rows[0];
  } else {
    const query = `
      INSERT INTO reviews (shop_id, user_id, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [shopId, userId, rating, comment || null]);
    return result.rows[0];
  }
}

async function deleteUserReview(shopId, userId) {
  const query = `
    DELETE FROM reviews
    WHERE shop_id = $1 AND user_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [shopId, userId]);
  return result.rows[0] || null;
}

async function getUserReviews(userId) {
  const query = `
    SELECT 
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      r.shop_id,
      s.name as shop_name,
      s.slug as shop_slug,
      s.cover_image_url,
      s.image_url,
      c.name as category_name,
      c.slug as category_slug
    FROM reviews r
    INNER JOIN shops s ON r.shop_id = s.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE r.user_id = $1 AND r.comment IS NOT NULL AND r.comment != ''
    ORDER BY r.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

async function getUserRatedShops(userId) {
  const query = `
    SELECT DISTINCT
      s.id,
      s.name,
      s.slug,
      s.cover_image_url,
      s.image_url,
      c.name as category_name,
      c.slug as category_slug,
      r.rating,
      r.created_at as rated_at
    FROM reviews r
    INNER JOIN shops s ON r.shop_id = s.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE r.user_id = $1
    ORDER BY r.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

module.exports = {
  getShopReviews,
  getReviewSummary,
  getUserReview,
  createOrUpdateReview,
  deleteUserReview,
  getUserReviews,
  getUserRatedShops,
};

