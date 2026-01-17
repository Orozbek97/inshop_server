const { verifyToken } = require('../utils/jwt');
const pool = require('../db');
const logger = require('../utils/logger');

async function authMiddleware(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    logger.error('Error in auth middleware', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = authMiddleware;

