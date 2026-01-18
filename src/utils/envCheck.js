const logger = require('./logger');

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
];

const requiredInProduction = [
  'ALLOWED_ORIGINS',
];

const validateEnvVars = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing = [];
  const warnings = [];

  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (isProduction) {
    requiredInProduction.forEach(varName => {
      if (!process.env[varName]) {
        warnings.push(varName);
      }
    });
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables:', { missing });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (warnings.length > 0) {
    warnings.forEach(varName => {
      logger.warn(`Missing recommended environment variable for production: ${varName}`);
    });
  }

  if (isProduction && !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logger.warn('JWT_SECRET should be at least 32 characters long for production security');
  }

  logger.info('Environment variables validation passed');
};

module.exports = { validateEnvVars };

