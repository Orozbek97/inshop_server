const express = require('express');
const router = express.Router();
const productCategoriesController = require('../controllers/product_categories.controller');

router.get('/', productCategoriesController.getProductCategories);
router.get('/:slug', productCategoriesController.getProductCategoryBySlug);

module.exports = router;

