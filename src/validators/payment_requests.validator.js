const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createPaymentRequestValidator = [
  body('shop_id')
    .notEmpty().withMessage('Shop ID is required')
    .isInt({ min: 1 }).withMessage('Shop ID must be a positive integer'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  handleValidationErrors,
];

module.exports = {
  createPaymentRequestValidator,
};

