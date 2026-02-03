const productFavoritesService = require('../services/product_favorites.service');
const productsService = require('../services/products.service');
const logger = require('../utils/logger');

async function toggleFavorite(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const productId = parseInt(id);
    
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    
    const product = await productsService.getProductById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const isFav = await productFavoritesService.isFavorite(userId, productId);
    
    if (isFav) {
      await productFavoritesService.removeFromFavorites(userId, productId);
      res.json({ isFavorite: false });
    } else {
      await productFavoritesService.addToFavorites(userId, productId);
      res.json({ isFavorite: true });
    }
  } catch (error) {
    logger.error('Error toggling product favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function checkFavorite(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const productId = parseInt(id);
    
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    
    const isFav = await productFavoritesService.isFavorite(userId, productId);
    res.json({ isFavorite: isFav });
  } catch (error) {
    logger.error('Error checking product favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserFavorites(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = await productFavoritesService.getUserFavorites(userId, page, limit);
    res.json(result);
  } catch (error) {
    logger.error('Error getting user product favorites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  toggleFavorite,
  checkFavorite,
  getUserFavorites,
};
