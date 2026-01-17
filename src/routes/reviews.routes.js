const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviews.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { createOrUpdateReviewValidator } = require('../validators/reviews.validator');

router.get('/user/reviews', authMiddleware, reviewsController.getUserReviews);
router.get('/user/rated-shops', authMiddleware, reviewsController.getUserRatedShops);
router.get('/:id/reviews', reviewsController.getShopReviews);
router.post('/:id/reviews', authMiddleware, createOrUpdateReviewValidator, reviewsController.createOrUpdateReview);
router.delete('/:id/reviews', authMiddleware, reviewsController.deleteUserReview);

module.exports = router;

