const reviewsService = require('../services/reviews.service');
const shopsService = require('../services/shops.service');
const logger = require('../utils/logger');

// Получаем отзывы (комментарии) и сводку по реакциям
async function getShopReviews(req, res) {
  try {
    const { id } = req.params;
    const shopId = parseInt(id);
    
    const shop = await shopsService.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const reviews = await reviewsService.getShopReviews(shopId);
    const summary = await reviewsService.getReviewSummary(shopId);
    
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      user: {
        id: review.user_id,
        name: review.user_name,
      },
      replies: review.replies || [],
    }));
    
    res.json({
      reviews: formattedReviews,
      summary,
    });
  } catch (error) {
    logger.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Получаем реакцию пользователя для магазина
async function getUserReaction(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const reaction = await reviewsService.getUserReaction(shopId, userId);
    res.json({ reaction: reaction ? { rating: reaction.rating } : null });
  } catch (error) {
    logger.error('Error fetching user reaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Создание или обновление реакции (лайк/дизлайк)
async function createOrUpdateReaction(req, res) {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const shop = await shopsService.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    if (rating !== 1 && rating !== -1) {
      return res.status(400).json({ error: 'Rating must be 1 or -1' });
    }
    
    const reaction = await reviewsService.createOrUpdateReaction(shopId, userId, rating);
    res.json(reaction);
  } catch (error) {
    logger.error('Error creating/updating reaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Удаление реакции
async function deleteReaction(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const reaction = await reviewsService.deleteReaction(shopId, userId);
    if (!reaction) {
      return res.status(404).json({ error: 'Reaction not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting reaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Создание или обновление отзыва (комментария)
async function createOrUpdateReview(req, res) {
  try {
    const { id } = req.params;
    const { comment, rating } = req.body;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const shop = await shopsService.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment is required' });
    }
    
    // rating опционален для отзыва
    let finalRating = null;
    if (rating !== undefined && rating !== null) {
      if (rating !== 1 && rating !== -1) {
        return res.status(400).json({ error: 'Rating must be 1, -1, or null' });
      }
      finalRating = rating;
    }
    
    const review = await reviewsService.createOrUpdateReview(shopId, userId, comment, finalRating);
    res.json(review);
  } catch (error) {
    logger.error('Error creating/updating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Удаление отзыва (комментария) по ID
async function deleteReview(req, res) {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user.id;
    const reviewIdInt = parseInt(reviewId);
    
    if (!reviewIdInt) {
      return res.status(400).json({ error: 'Review ID is required' });
    }
    
    const review = await reviewsService.deleteReview(reviewIdInt, userId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Получаем отзывы пользователя
async function getUserReviews(req, res) {
  try {
    const userId = req.user.id;
    const reviews = await reviewsService.getUserReviews(userId);
    
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      shop: {
        id: review.shop_id,
        name: review.shop_name,
        slug: review.shop_slug,
        cover_image_url: review.cover_image_url,
        image_url: review.image_url,
        category_name: review.category_name,
      },
    }));
    
    res.json(formattedReviews);
  } catch (error) {
    logger.error('Error fetching user reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Получаем магазины, на которые пользователь поставил реакцию
async function getUserRatedShops(req, res) {
  try {
    const userId = req.user.id;
    const shops = await reviewsService.getUserRatedShops(userId);
    
    const formattedShops = shops.map(shop => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      cover_image_url: shop.cover_image_url,
      image_url: shop.image_url,
      category_name: shop.category_name,
      rating: shop.rating,
      rated_at: shop.rated_at,
    }));
    
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error fetching user rated shops:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getShopReviews,
  getUserReaction,
  createOrUpdateReaction,
  deleteReaction,
  createOrUpdateReview,
  deleteReview,
  getUserReviews,
  getUserRatedShops,
};
