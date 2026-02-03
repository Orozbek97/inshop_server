const pool = require('../db');

// Получаем ответы на отзыв
async function getRepliesByReviewId(reviewId) {
  const query = `
    SELECT 
      r.id,
      r.review_id,
      r.shop_id,
      r.reply_text,
      r.created_at,
      r.updated_at,
      u.id as user_id,
      u.name as user_name
    FROM shop_review_replies r
    INNER JOIN users u ON r.user_id = u.id
    WHERE r.review_id = $1
    ORDER BY r.created_at ASC
  `;
  const result = await pool.query(query, [reviewId]);
  return result.rows;
}

// Получаем все ответы для магазина
async function getRepliesByShopId(shopId) {
  const query = `
    SELECT 
      r.id,
      r.review_id,
      r.shop_id,
      r.reply_text,
      r.created_at,
      r.updated_at,
      u.id as user_id,
      u.name as user_name
    FROM shop_review_replies r
    INNER JOIN users u ON r.user_id = u.id
    WHERE r.shop_id = $1
    ORDER BY r.created_at ASC
  `;
  const result = await pool.query(query, [shopId]);
  return result.rows;
}

// Создание ответа на отзыв
async function createReply(reviewId, shopId, userId, replyText) {
  if (!replyText || !replyText.trim()) {
    throw new Error('Reply text is required');
  }
  
  const query = `
    INSERT INTO shop_review_replies (review_id, shop_id, user_id, reply_text, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const result = await pool.query(query, [reviewId, shopId, userId, replyText.trim()]);
  return result.rows[0];
}

// Обновление ответа
async function updateReply(replyId, userId, replyText) {
  if (!replyText || !replyText.trim()) {
    throw new Error('Reply text is required');
  }
  
  const query = `
    UPDATE shop_review_replies
    SET reply_text = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND user_id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [replyText.trim(), replyId, userId]);
  return result.rows[0] || null;
}

// Удаление ответа
async function deleteReply(replyId, userId) {
  const query = `
    DELETE FROM shop_review_replies
    WHERE id = $1 AND user_id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [replyId, userId]);
  return result.rows[0] || null;
}

// Получаем ответ по ID
async function getReplyById(replyId) {
  const query = `
    SELECT * FROM shop_review_replies
    WHERE id = $1
  `;
  const result = await pool.query(query, [replyId]);
  return result.rows[0] || null;
}

module.exports = {
  getRepliesByReviewId,
  getRepliesByShopId,
  createReply,
  updateReply,
  deleteReply,
  getReplyById,
};
