const express = require('express');
const router = express.Router();
const viewsController = require('../controllers/views.controller');
// authMiddleware не обязателен для просмотров, но можно использовать для получения userId

// Публичные роуты (не требуют авторизации)
router.post('/products/:id/view', viewsController.recordProductView);
router.post('/shops/:id/view', viewsController.recordShopView);

// Роуты для статистики (можно добавить authMiddleware для владельцев)
router.get('/products/:id/views/stats', viewsController.getProductViewsStats);
router.get('/shops/:id/views/stats', viewsController.getShopViewsStats);

module.exports = router;
