const favoritesService = require('../services/favorites.service');
const shopsService = require('../services/shops.service');
const logger = require('../utils/logger');

async function toggleFavorite(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const shop = await shopsService.getShopById(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const isFav = await favoritesService.isFavorite(userId, shopId);
    
    if (isFav) {
      await favoritesService.removeFromFavorites(userId, shopId);
      res.json({ isFavorite: false });
    } else {
      await favoritesService.addToFavorites(userId, shopId);
      res.json({ isFavorite: true });
    }
  } catch (error) {
    logger.error('Error toggling favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function checkFavorite(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const shopId = parseInt(id);
    
    const isFav = await favoritesService.isFavorite(userId, shopId);
    res.json({ isFavorite: isFav });
  } catch (error) {
    logger.error('Error checking favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserFavorites(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const result = await favoritesService.getUserFavorites(userId, page, limit);
    
    // Форматируем reviews_summary для каждого магазина
    const formattedData = result.data.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    
    res.json({
      data: formattedData,
      meta: result.meta
    });
  } catch (error) {
    logger.error('Error fetching user favorites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  toggleFavorite,
  checkFavorite,
  getUserFavorites,
};

