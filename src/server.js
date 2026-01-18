console.log('Starting server initialization...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('HOST:', process.env.HOST);

require('dotenv').config();

console.log('Loading logger...');
const logger = require('./utils/logger');

console.log('Validating environment variables...');
const { validateEnvVars } = require('./utils/envCheck');

try {
  validateEnvVars();
  console.log('Environment validation passed');
} catch (error) {
  console.error('Environment validation failed:', error.message);
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

console.log('Loading telegram service...');
try {
  require('./services/telegram.service');
  console.log('Telegram service loaded');
} catch (error) {
  console.error('Error loading telegram service:', error.message);
  logger.error('Error loading telegram service', { error });
}

console.log('Loading app...');
let app;
try {
  app = require('./app');
  console.log('App loaded successfully');
} catch (error) {
  console.error('❌ Failed to load app:', error.message);
  console.error('Stack:', error.stack);
  logger.error('Failed to load app', { error });
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`Starting server on ${HOST}:${PORT}...`);

app.listen(PORT, HOST, () => {
  console.log(`✅ Server is running on http://${HOST}:${PORT}`);
  logger.info(`Server is running on http://${HOST}:${PORT}`);
}).on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  console.error('Error details:', error);
  logger.error('Failed to start server', { error });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

