const { Pool } = require('pg');
require('dotenv').config();
const logger = require('../utils/logger');

console.log('Initializing database connection...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
  logger.error('Unexpected error on idle client', { error: err });
});

pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('remove', () => {
  console.log('Database connection removed');
});

module.exports = pool;

