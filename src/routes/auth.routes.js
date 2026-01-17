const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator } = require('../validators/auth.validator');
const { authLimiter, registerLimiter, passwordResetLimiter } = require('../middlewares/rateLimiter.middleware');

router.post('/register', registerLimiter, registerValidator, authController.register);
router.post('/login', authLimiter, loginValidator, authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.post('/logout', authController.logout);
router.post('/forgot-password', passwordResetLimiter, forgotPasswordValidator, authController.requestPasswordReset);
router.post('/reset-password', passwordResetLimiter, resetPasswordValidator, authController.resetPassword);

module.exports = router;

