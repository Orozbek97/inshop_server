const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categories.controller');
const shopsController = require('../controllers/shops.controller');

router.get('/', categoriesController.getAllCategories);
router.get('/:slug/shops', shopsController.getShopsByCategory);

module.exports = router;

