const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const path = require('path');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler.middleware');
const categoriesRoutes = require('./routes/categories.routes');
const shopsRoutes = require('./routes/shops.routes');
const productsRoutes = require('./routes/products.routes');
const productSectionsRoutes = require('./routes/product_sections.routes');
const authRoutes = require('./routes/auth.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const reviewRepliesRoutes = require('./routes/review_replies.routes');
const favoritesRoutes = require('./routes/favorites.routes');
const productFavoritesRoutes = require('./routes/product_favorites.routes');
const viewsRoutes = require('./routes/views.routes');
const paymentRequestsRoutes = require('./routes/payment_requests.routes');
const productCategoriesRoutes = require('./routes/product_categories.routes');
const publicProductsRoutes = require('./routes/public_products.routes');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {

    const allowedOrigins = process.env.ALLOWED_ORIGINS;
    if (!allowedOrigins) {
      logger.warn('ALLOWED_ORIGINS not set in production!');
      return [];
    }
  
    return allowedOrigins.split(',').map(origin => origin.trim()).filter(Boolean);
  } else {
    return true;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    if (allowedOrigins === true) {
      return callback(null, true);
    }
    
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: process.env.CORS_METHODS 
    ? process.env.CORS_METHODS.split(',').map(m => m.trim())
    : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: process.env.CORS_ALLOWED_HEADERS
    ? process.env.CORS_ALLOWED_HEADERS.split(',').map(h => h.trim())
    : ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(cookieParser());
// Увеличиваем лимит для загрузки изображений в base64 (до 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/shops', shopsRoutes);
app.use('/api/shops/:shopId/products', productsRoutes);
app.use('/api/shops/:shopId/sections', productSectionsRoutes);
app.use('/api/shops', reviewsRoutes);
app.use('/api/shops', reviewRepliesRoutes);
app.use('/api', favoritesRoutes);
app.use('/api', productFavoritesRoutes);
app.use('/api', viewsRoutes);
app.use('/api/payment-requests', paymentRequestsRoutes);
app.use('/api/product-categories', productCategoriesRoutes);
app.use('/api/products', publicProductsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;

