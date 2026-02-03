const pool = require('../db');

// Получаем отзывы (комментарии) для магазина с ответами
async function getShopReviews(shopId) {
  const query = `
    SELECT 
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      u.id as user_id,
      u.name as user_name
    FROM shop_reviews r
    INNER JOIN users u ON r.user_id = u.id
    WHERE r.shop_id = $1
    ORDER BY r.created_at DESC
  `;
  const result = await pool.query(query, [shopId]);
  
  // Получаем ответы для каждого отзыва
  const reviewsWithReplies = await Promise.all(
    result.rows.map(async (review) => {
      const repliesQuery = `
        SELECT 
          rr.id,
          rr.reply_text,
          rr.created_at,
          rr.updated_at,
          u.id as user_id,
          u.name as user_name
        FROM shop_review_replies rr
        INNER JOIN users u ON rr.user_id = u.id
        WHERE rr.review_id = $1
        ORDER BY rr.created_at ASC
      `;
      const repliesResult = await pool.query(repliesQuery, [review.id]);
      
      return {
        ...review,
        replies: repliesResult.rows.map(reply => ({
          id: reply.id,
          reply_text: reply.reply_text,
          created_at: reply.created_at,
          updated_at: reply.updated_at,
          user: {
            id: reply.user_id,
            name: reply.user_name,
          },
        })),
      };
    })
  );
  
  return reviewsWithReplies;
}

// Получаем сводку по реакциям и отзывам
async function getReviewSummary(shopId) {
  // Подсчитываем реакции (лайки/дизлайки)
  const reactionsQuery = `
    SELECT 
      COUNT(*) FILTER (WHERE rating = 1) as likes,
      COUNT(*) FILTER (WHERE rating = -1) as dislikes,
      COUNT(*)::int as reactions_count
    FROM shop_reactions
    WHERE shop_id = $1
  `;
  const reactionsResult = await pool.query(reactionsQuery, [shopId]);
  const { likes, dislikes, reactions_count } = reactionsResult.rows[0];
  
  // Подсчитываем отзывы (комментарии)
  const reviewsQuery = `
    SELECT COUNT(*)::int as reviews_count
    FROM shop_reviews
    WHERE shop_id = $1
  `;
  const reviewsResult = await pool.query(reviewsQuery, [shopId]);
  const reviews_count = reviewsResult.rows[0]?.reviews_count || 0;
  
  return {
    likes: parseInt(likes) || 0,
    dislikes: parseInt(dislikes) || 0,
    reactions_count: parseInt(reactions_count) || 0,
    reviews_count: reviews_count,
    score: (parseInt(likes) || 0) - (parseInt(dislikes) || 0),
  };
}

// Получаем реакцию пользователя для магазина
async function getUserReaction(shopId, userId) {
  const query = `
    SELECT * FROM shop_reactions
    WHERE shop_id = $1 AND user_id = $2
  `;
  const result = await pool.query(query, [shopId, userId]);
  return result.rows[0] || null;
}

// Получаем отзыв пользователя для магазина
async function getUserReview(shopId, userId) {
  const query = `
    SELECT * FROM shop_reviews
    WHERE shop_id = $1 AND user_id = $2
  `;
  const result = await pool.query(query, [shopId, userId]);
  return result.rows[0] || null;
}

// Создание или обновление реакции (лайк/дизлайк)
async function createOrUpdateReaction(shopId, userId, rating) {
  if (rating !== 1 && rating !== -1) {
    throw new Error('Rating must be 1 or -1');
  }
  
  const query = `
    INSERT INTO shop_reactions (shop_id, user_id, rating, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (shop_id, user_id) 
    DO UPDATE SET rating = $3, updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const result = await pool.query(query, [shopId, userId, rating]);
  return result.rows[0];
}

// Удаление реакции
async function deleteReaction(shopId, userId) {
  const query = `
    DELETE FROM shop_reactions
    WHERE shop_id = $1 AND user_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [shopId, userId]);
  return result.rows[0] || null;
}

// Создание нового отзыва (комментария) - пользователь может оставить до 3
async function createOrUpdateReview(shopId, userId, comment, rating = null) {
  if (!comment || !comment.trim()) {
    throw new Error('Comment is required');
  }
  
  if (rating !== null && rating !== 1 && rating !== -1) {
    throw new Error('Rating must be 1, -1, or null');
  }
  
  // Проверяем количество существующих отзывов пользователя
  const countQuery = `
    SELECT COUNT(*)::int as count
    FROM shop_reviews
    WHERE shop_id = $1 AND user_id = $2
  `;
  const countResult = await pool.query(countQuery, [shopId, userId]);
  const existingCount = countResult.rows[0]?.count || 0;
  
  if (existingCount >= 3) {
    throw new Error('Вы можете оставить максимум 3 отзыва');
  }
  
  // Создаем новый отзыв (без ON CONFLICT, так как убрали UNIQUE)
  const query = `
    INSERT INTO shop_reviews (shop_id, user_id, comment, rating, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const result = await pool.query(query, [shopId, userId, comment.trim(), rating]);
  return result.rows[0];
}

// Удаление отзыва (комментария) по ID
async function deleteReview(reviewId, userId) {
  const query = `
    DELETE FROM shop_reviews
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [reviewId, userId]);
  return result.rows[0] || null;
}

// Получаем отзывы пользователя
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
    FROM shop_reviews r
    INNER JOIN shops s ON r.shop_id = s.id
    LEFT JOIN categories c ON s.category_id = c.id
    WHERE r.user_id = $1
    ORDER BY r.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

// Получаем магазины, на которые пользователь поставил реакцию
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
    FROM shop_reactions r
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
  getUserReaction,
  getUserReview,
  createOrUpdateReaction,
  deleteReaction,
  createOrUpdateReview,
  deleteReview,
  getUserReviews,
  getUserRatedShops,
};
