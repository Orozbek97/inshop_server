const { Pool } = require('pg');
require('dotenv').config();
const logger = require('../utils/logger');

console.log('Initializing database connection pool...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Настройки пула соединений для оптимизации
  max: 20, // Максимальное количество клиентов в пуле
  min: 2, // Минимальное количество клиентов в пуле
  idleTimeoutMillis: 30000, // Закрывать неиспользуемые соединения через 30 секунд
  connectionTimeoutMillis: 2000, // Таймаут подключения 2 секунды
});

pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
  logger.error('Unexpected error on idle client', { error: err });
});

// Логируем только важные события, не каждое подключение/отключение
pool.on('connect', (client) => {
  // Логируем только в режиме разработки и только при первом подключении
  if (process.env.NODE_ENV === 'development' && pool.totalCount === 1) {
    logger.info('Database connection pool initialized');
  }
});

// Убрали логирование каждого отключения - это нормальное поведение пула
// pool.on('remove', () => {
//   console.log('Database connection removed');
// });

module.exports = pool;

