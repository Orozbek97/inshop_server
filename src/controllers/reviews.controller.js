const reviewsService = require('../services/reviews.service');
const shopsService = require('../services/shops.service');
const logger = require('../utils/logger');

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

async function createOrUpdateReview(req, res) {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const shop = await shopsService.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const existingReview = await reviewsService.getUserReview(shopId, userId);
    const finalRating = rating !== undefined && rating !== null ? rating : (existingReview ? existingReview.rating : 1);
    
    if (finalRating !== 1 && finalRating !== -1) {
      return res.status(400).json({ error: 'Rating must be 1 or -1' });
    }
    
    const review = await reviewsService.createOrUpdateReview(shopId, userId, finalRating, comment);
    
    res.json(review);
  } catch (error) {
    logger.error('Error creating/updating review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteUserReview(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const review = await reviewsService.getUserReview(shopId, userId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    await reviewsService.deleteUserReview(shopId, userId);
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

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
  createOrUpdateReview,
  deleteUserReview,
  getUserReviews,
  getUserRatedShops,
};

