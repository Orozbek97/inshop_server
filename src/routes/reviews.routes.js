const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviews.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { createOrUpdateReviewValidator } = require('../validators/reviews.validator');
const { createOrUpdateReactionValidator } = require('../validators/reactions.validator');

// Отзывы (комментарии)
router.get('/user/reviews', authMiddleware, reviewsController.getUserReviews);
router.get('/:id/reviews', reviewsController.getShopReviews);
router.post('/:id/reviews', authMiddleware, createOrUpdateReviewValidator, reviewsController.createOrUpdateReview);
router.delete('/:id/reviews/:reviewId', authMiddleware, reviewsController.deleteReview);

// Реакции (лайки/дизлайки)
router.get('/:id/reaction', authMiddleware, reviewsController.getUserReaction);
router.post('/:id/reaction', authMiddleware, createOrUpdateReactionValidator, reviewsController.createOrUpdateReaction);
router.delete('/:id/reaction', authMiddleware, reviewsController.deleteReaction);

// Магазины, на которые пользователь поставил реакцию
router.get('/user/rated-shops', authMiddleware, reviewsController.getUserRatedShops);

module.exports = router;
