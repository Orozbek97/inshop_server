const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favorites.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/shops/:id/favorite', authMiddleware, favoritesController.toggleFavorite);
router.get('/shops/:id/favorite', authMiddleware, favoritesController.checkFavorite);
router.get('/user/favorites', authMiddleware, favoritesController.getUserFavorites);

module.exports = router;

