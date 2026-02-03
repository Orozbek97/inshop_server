const pool = require('../db');
const authMiddleware = require('./auth.middleware');
const logger = require('../utils/logger');

function checkShopOwnership(req, res, next) {
  authMiddleware(req, res, async () => {
    try {
      const shopId = req.params.id || req.params.slug || req.params.shopId;
      
      if (!shopId) {
        return res.status(400).json({ error: 'Shop ID or slug required' });
      }
      
      let query;
      let params;
      
      if (shopId && !isNaN(parseInt(shopId))) {
        query = 'SELECT user_id FROM shops WHERE id = $1';
        params = [parseInt(shopId, 10)];
      } else {
        query = 'SELECT user_id FROM shops WHERE slug = $1';
        params = [shopId];
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      const shop = result.rows[0];

      if (shop.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: You do not own this shop' });
      }

      req.shop = shop;
      next();
    } catch (error) {
      logger.error('Error in checkShopOwnership', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

module.exports = checkShopOwnership;

