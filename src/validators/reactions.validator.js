const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createOrUpdateReactionValidator = [
  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isIn([1, -1]).withMessage('Rating must be 1 or -1'),
  handleValidationErrors,
];

module.exports = {
  createOrUpdateReactionValidator,
};
