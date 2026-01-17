require('dotenv').config();
const { validateEnvVars } = require('./utils/envCheck');
const logger = require('./utils/logger');

try {
  validateEnvVars();
} catch (error) {
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

require('./services/telegram.service');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`Server is running on http://${HOST}:${PORT}`);
});

