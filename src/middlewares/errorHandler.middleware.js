const logger = require('../utils/logger');

const isProduction = process.env.NODE_ENV === 'production';

const errorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }

  logger.error('Unhandled error', {
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      name: err.name,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    },
  });

  if (isProduction) {
    res.status(err.status || 500).json({
      error: err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404
        ? err.message || 'Bad request'
        : 'Internal server error'
    });
  } else {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      stack: err.stack,
    });
  }
};

module.exports = errorHandler;

