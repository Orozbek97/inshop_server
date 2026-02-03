const express = require('express');
const router = express.Router();
const productFavoritesController = require('../controllers/product_favorites.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/products/:id/favorite', authMiddleware, productFavoritesController.toggleFavorite);
router.get('/products/:id/favorite', authMiddleware, productFavoritesController.checkFavorite);
router.get('/user/product-favorites', authMiddleware, productFavoritesController.getUserFavorites);

module.exports = router;
