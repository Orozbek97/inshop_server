const express = require('express');
const router = express.Router({ mergeParams: true });

const productsController = require('../controllers/products.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkShopOwnership = require('../middlewares/ownership.middleware');

// Список активных товаров для покупателей (публичный доступ)
router.get('/active', productsController.listActiveProductsByShop);

// Список товаров для владельца магазина
router.get(
  '/',
  authMiddleware,
  checkShopOwnership,
  productsController.listProductsByShopForOwner
);

// Создание товара
router.post(
  '/',
  authMiddleware,
  checkShopOwnership,
  productsController.createProduct
);

// Обновление товара
router.put(
  '/:productId',
  authMiddleware,
  checkShopOwnership,
  productsController.updateProduct
);

// Удаление товара
router.delete(
  '/:productId',
  authMiddleware,
  checkShopOwnership,
  productsController.deleteProduct
);

module.exports = router;


