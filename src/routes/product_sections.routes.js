const express = require('express');
const router = express.Router({ mergeParams: true });

const productSectionsController = require('../controllers/product_sections.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const checkShopOwnership = require('../middlewares/ownership.middleware');

router.get('/', productSectionsController.listSectionsByShop);

router.post(
  '/',
  authMiddleware,
  checkShopOwnership,
  productSectionsController.createSection,
);

router.put(
  '/:sectionId',
  authMiddleware,
  checkShopOwnership,
  productSectionsController.updateSection,
);

router.delete(
  '/:sectionId',
  authMiddleware,
  checkShopOwnership,
  productSectionsController.deleteSection,
);

module.exports = router;


