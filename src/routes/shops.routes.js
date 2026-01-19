const express = require('express');
const router = express.Router();
const shopsController = require('../controllers/shops.controller');
const upload = require('../middleware/upload');
const authMiddleware = require('../middlewares/auth.middleware');
const checkShopOwnership = require('../middlewares/ownership.middleware');
const { createShopValidator, updateShopValidator } = require('../validators/shops.validator');

router.get('/', shopsController.getAllShops);
router.get('/my-shops', authMiddleware, shopsController.getUserShops);
router.get('/id/:id', authMiddleware, shopsController.getShopById);
router.post('/', authMiddleware, upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'originalImage', maxCount: 1 }]), createShopValidator, shopsController.createShop);
router.put('/:id', authMiddleware, checkShopOwnership, updateShopValidator, upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'originalImage', maxCount: 1 }]), shopsController.updateShop);
router.patch('/:id/toggle-active', authMiddleware, checkShopOwnership, shopsController.toggleShopActive);
router.delete('/:id', authMiddleware, checkShopOwnership, shopsController.deleteShop);
router.get('/:slug', shopsController.getShopBySlug);

module.exports = router;

