const express = require('express');
const router = express.Router();
const reviewRepliesController = require('../controllers/review_replies.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Ответы на отзывы
router.get('/:id/reviews/:reviewId/replies', reviewRepliesController.getRepliesByReview);
router.post('/:id/reviews/:reviewId/replies', authMiddleware, reviewRepliesController.createReply);
router.put('/:id/reviews/:reviewId/replies/:replyId', authMiddleware, reviewRepliesController.updateReply);
router.delete('/:id/reviews/:reviewId/replies/:replyId', authMiddleware, reviewRepliesController.deleteReply);

module.exports = router;
