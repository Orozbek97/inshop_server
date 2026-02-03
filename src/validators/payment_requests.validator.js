const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg).join(', ');
    return res.status(400).json({ 
      error: errorMessages,
      errors: errors.array() 
    });
  }
  next();
};

const createPaymentRequestValidator = [
  body('shop_id')
    .notEmpty().withMessage('Shop ID is required')
    .isInt({ min: 1 }).withMessage('Shop ID must be a positive integer')
    .toInt(),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number')
    .toFloat(),
  body('tariff')
    .optional()
    .isIn(['start', 'standard', 'pro']).withMessage('Invalid tariff value'),
  handleValidationErrors,
];

module.exports = {
  createPaymentRequestValidator,
};

