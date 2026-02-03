const reviewRepliesService = require('../services/review_replies.service');
const reviewsService = require('../services/reviews.service');
const shopsService = require('../services/shops.service');
const pool = require('../db');
const logger = require('../utils/logger');

// Получаем ответы на отзыв
async function getRepliesByReview(req, res) {
  try {
    const { id, reviewId } = req.params;
    const shopId = parseInt(id);
    const reviewIdInt = parseInt(reviewId);
    
    const replies = await reviewRepliesService.getRepliesByReviewId(reviewIdInt);
    
    const formattedReplies = replies.map(reply => ({
      id: reply.id,
      review_id: reply.review_id,
      shop_id: reply.shop_id,
      reply_text: reply.reply_text,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
      user: {
        id: reply.user_id,
        name: reply.user_name,
      },
    }));
    
    res.json({ replies: formattedReplies });
  } catch (error) {
    logger.error('Error fetching replies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Создание ответа на отзыв
async function createReply(req, res) {
  try {
    const { id, reviewId } = req.params;
    const { reply_text } = req.body;
    const userId = req.user.id;
    const shopId = parseInt(id);
    const reviewIdInt = parseInt(reviewId);
    
    // Проверяем существование магазина
    const shop = await shopsService.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    // Проверяем, что пользователь является владельцем магазина
    if (shop.user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Only shop owner can reply to reviews' });
    }
    
    // Проверяем существование отзыва
    const reviewQuery = await pool.query('SELECT * FROM shop_reviews WHERE id = $1 AND shop_id = $2', [reviewIdInt, shopId]);
    if (reviewQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    const reply = await reviewRepliesService.createReply(reviewIdInt, shopId, userId, reply_text);
    
    // Получаем полную информацию об ответе с данными пользователя
    const fullReplies = await reviewRepliesService.getRepliesByReviewId(reviewIdInt);
    const newReply = fullReplies.find(r => r.id === reply.id);
    
    if (!newReply) {
      return res.status(500).json({ error: 'Failed to retrieve created reply' });
    }
    
    res.status(201).json({
      id: newReply.id,
      review_id: newReply.review_id,
      shop_id: newReply.shop_id,
      reply_text: newReply.reply_text,
      created_at: newReply.created_at,
      updated_at: newReply.updated_at,
      user: {
        id: newReply.user_id,
        name: newReply.user_name,
      },
    });
  } catch (error) {
    logger.error('Error creating reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Обновление ответа
async function updateReply(req, res) {
  try {
    const { id, reviewId, replyId } = req.params;
    const { reply_text } = req.body;
    const userId = req.user.id;
    const replyIdInt = parseInt(replyId);
    
    const shop = await shopsService.getShopById(parseInt(id));
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    // Проверяем, что пользователь является владельцем магазина
    if (shop.user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Only shop owner can update replies' });
    }
    
    const reply = await reviewRepliesService.updateReply(replyIdInt, userId, reply_text);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }
    
    res.json(reply);
  } catch (error) {
    logger.error('Error updating reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Удаление ответа
async function deleteReply(req, res) {
  try {
    const { id, reviewId, replyId } = req.params;
    const userId = req.user.id;
    const replyIdInt = parseInt(replyId);
    
    const shop = await shopsService.getShopById(parseInt(id));
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    // Проверяем, что пользователь является владельцем магазина
    if (shop.user_id !== parseInt(userId)) {
      return res.status(403).json({ error: 'Only shop owner can delete replies' });
    }
    
    const reply = await reviewRepliesService.deleteReply(replyIdInt, userId);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting reply:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getRepliesByReview,
  createReply,
  updateReply,
  deleteReply,
};
