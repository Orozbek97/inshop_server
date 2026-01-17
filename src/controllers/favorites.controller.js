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
    const favorites = await favoritesService.getUserFavorites(userId);
    res.json(favorites);
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

