const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createOrUpdateReviewValidator = [
  body('rating')
    .optional()
    .isIn([1, -1]).withMessage('Rating must be 1 or -1'),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Comment must not exceed 500 characters'),
  handleValidationErrors,
];

module.exports = {
  createOrUpdateReviewValidator,
};

