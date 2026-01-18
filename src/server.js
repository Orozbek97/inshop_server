require('dotenv').config();

const logger = require('./utils/logger');
const { validateEnvVars } = require('./utils/envCheck');

try {
  validateEnvVars();
} catch (error) {
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

try {
  require('./services/telegram.service');
} catch (error) {
  logger.error('Error loading telegram service', { error });
}

let app;
try {
  app = require('./app');
} catch (error) {
  logger.error('Failed to load app', { error });
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`Server is running on http://${HOST}:${PORT}`);
}).on('error', (error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

