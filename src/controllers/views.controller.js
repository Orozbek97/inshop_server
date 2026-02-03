const productViewsService = require('../services/product_views.service');
const shopViewsService = require('../services/shop_views.service');
const logger = require('../utils/logger');

/**
 * Получает IP адрес из запроса
 */
function getClientIp(req) {
  // Проверяем различные заголовки для определения реального IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Берем первый IP из списка (клиентский IP)
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0] || 'unknown';
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback на connection remoteAddress
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
  if (remoteAddress) {
    // Убираем IPv6 префикс если есть
    return remoteAddress.replace(/^::ffff:/, '');
  }
  
  return 'unknown';
}

/**
 * Регистрирует просмотр продукта
 */
async function recordProductView(req, res) {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    
    const userId = req.user?.id || null;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    
    const result = await productViewsService.recordProductView(
      productId,
      userId,
      ipAddress,
      userAgent
    );
    
    res.json(result);
  } catch (error) {
    logger.error('Error recording product view:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Регистрирует просмотр магазина
 */
async function recordShopView(req, res) {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (Number.isNaN(shopId)) {
      return res.status(400).json({ error: 'Invalid shop id' });
    }
    
    const userId = req.user?.id || null;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    
    const result = await shopViewsService.recordShopView(
      shopId,
      userId,
      ipAddress,
      userAgent
    );
    
    res.json(result);
  } catch (error) {
    logger.error('Error recording shop view:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Получает статистику просмотров продукта (для владельца или админа)
 */
async function getProductViewsStats(req, res) {
  try {
    const { id } = req.params;
    const productId = parseInt(id, 10);
    
    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    
    const stats = await productViewsService.getProductViewsStats(productId);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting product views stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Получает статистику просмотров магазина (для владельца или админа)
 */
async function getShopViewsStats(req, res) {
  try {
    const { id } = req.params;
    const shopId = parseInt(id, 10);
    
    if (Number.isNaN(shopId)) {
      return res.status(400).json({ error: 'Invalid shop id' });
    }
    
    const stats = await shopViewsService.getShopViewsStats(shopId);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting shop views stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  recordProductView,
  recordShopView,
  getProductViewsStats,
  getShopViewsStats,
};
