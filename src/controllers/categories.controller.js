const pool = require('../db');
const logger = require('../utils/logger');

async function getAllCategories(req, res) {
  try {
    const query = 'SELECT * FROM categories ORDER BY name';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getAllCategories,
};

