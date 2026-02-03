const express = require('express');
const router = express.Router();
const publicProductsController = require('../controllers/public_products.controller');

router.get('/', publicProductsController.getProducts);
router.get('/popular', publicProductsController.getPopularProducts);
router.get('/new', publicProductsController.getNewProducts);
router.get('/discounted', publicProductsController.getDiscountedProducts);
router.get('/recommended', publicProductsController.getRecommendedProducts);
router.get('/:id', publicProductsController.getProductById);

module.exports = router;

