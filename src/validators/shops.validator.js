const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const shopBaseValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 200 }).withMessage('Name must be between 2 and 200 characters'),
  body('instagram_url')
    .trim()
    .notEmpty().withMessage('Instagram URL is required')
    .custom((value) => {
      const instagramPattern = /^(https?:\/\/)?(www\.)?(instagram\.com\/|@)?[a-zA-Z0-9_.]+$/;
      if (!instagramPattern.test(value)) {
        throw new Error('Invalid Instagram URL format. Use @username, instagram.com/username, or full URL');
      }
      return true;
    }),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[\d\s-()]+$/).withMessage('Invalid phone format'),
  body('category_id')
    .notEmpty().withMessage('Category ID is required')
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
  body('district')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('District must not exceed 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('delivery')
    .optional()
    .isBoolean().withMessage('Delivery must be a boolean'),
];

const createShopValidator = [
  ...shopBaseValidator,
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone is required')
    .matches(/^[+]?[\d\s-()]+$/).withMessage('Invalid phone format'),
  handleValidationErrors,
];

const updateShopValidator = [
  ...shopBaseValidator,
  handleValidationErrors,
];

module.exports = {
  createShopValidator,
  updateShopValidator,
};

