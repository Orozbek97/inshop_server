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
    .optional({ nullable: true, checkFalsy: false })
    .custom((value) => {
      // Разрешаем null, undefined, 1 или -1
      // Если поле отсутствует или null - это нормально
      if (value === null || value === undefined) {
        return true;
      }
      // Если значение передано, оно должно быть 1 или -1
      if (value === 1 || value === -1) {
        return true;
      }
      throw new Error('Rating must be 1, -1, or null');
    })
    .withMessage('Rating must be 1, -1, or null'),
  body('comment')
    .notEmpty().withMessage('Comment is required')
    .trim()
    .isLength({ min: 1, max: 500 }).withMessage('Comment must be between 1 and 500 characters'),
  handleValidationErrors,
];

module.exports = {
  createOrUpdateReviewValidator,
};

