const express = require('express');
const router = express.Router();
const paymentRequestsController = require('../controllers/payment_requests.controller');
const uploadReceipt = require('../middleware/uploadReceipt');
const authMiddleware = require('../middlewares/auth.middleware');
const { createPaymentRequestValidator } = require('../validators/payment_requests.validator');

router.post('/', authMiddleware, uploadReceipt.single('receipt'), createPaymentRequestValidator, paymentRequestsController.createPaymentRequest);

// Получение запросов по магазину
router.get('/shop/:shopId', authMiddleware, paymentRequestsController.getPaymentRequestsByShop);

// Получение запроса по ID
router.get('/:id', authMiddleware, paymentRequestsController.getPaymentRequestById);

// Получение всех запросов пользователя
router.get('/', authMiddleware, paymentRequestsController.getUserPaymentRequests);

module.exports = router;

