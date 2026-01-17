const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for login from IP: ${req.ip}`);
    res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте через 15 минут.' });
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Слишком много попыток регистрации. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for registration from IP: ${req.ip}`);
    res.status(429).json({ error: 'Слишком много попыток регистрации. Попробуйте через час.' });
  },
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Слишком много запросов на восстановление пароля. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for password reset from IP: ${req.ip}`);
    res.status(429).json({ error: 'Слишком много запросов на восстановление пароля. Попробуйте через час.' });
  },
});

module.exports = {
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
};

