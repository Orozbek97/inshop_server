const paymentRequestsService = require('../services/payment_requests.service');
const shopsService = require('../services/shops.service');
const telegramService = require('../services/telegram.service');
const r2Service = require('../services/r2.service');
const pool = require('../db');
const logger = require('../utils/logger');
const path = require('path');

async function createPaymentRequest(req, res) {
  try {
    const { shop_id, amount, tariff } = req.body;
    const user_id = parseInt(req.user.id);
    
    if (!shop_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Проверяем тариф, если указан
    if (tariff && !['start', 'standard', 'pro'].includes(tariff)) {
      return res.status(400).json({ error: 'Invalid tariff' });
    }
    
    // Проверяем, что магазин принадлежит пользователю
    const shop = await shopsService.getShopById(parseInt(shop_id));
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    if (parseInt(shop.user_id) !== user_id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this shop' });
    }
    
    let receipt_url = null;
    if (req.file) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const ext = path.extname(req.file.originalname);
      const filename = `${timestamp}-${random}${ext}`;
      receipt_url = await r2Service.uploadFile(req.file.buffer, filename, 'payment_requests');
    }
    
    const paymentRequest = await paymentRequestsService.createPaymentRequest({
      shop_id: parseInt(shop_id),
      user_id,
      amount: parseFloat(amount),
      receipt_url,
      tariff: tariff || null,
    });
    
    // Получаем полную информацию о запросе для Telegram
    const paymentRequestFull = await paymentRequestsService.getPaymentRequestById(paymentRequest.id);
    
    // Отправляем уведомление в Telegram
    await telegramService.sendPaymentNotification(paymentRequestFull, shop);
    
    res.status(201).json(paymentRequest);
  } catch (error) {
    logger.error('Error creating payment request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPaymentRequestsByShop(req, res) {
  try {
    const { shopId } = req.params;
    const user_id = parseInt(req.user.id);
    
    // Проверяем, что магазин принадлежит пользователю
    const shop = await shopsService.getShopById(parseInt(shopId));
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    if (parseInt(shop.user_id) !== user_id) {
      return res.status(403).json({ error: 'Forbidden: You do not own this shop' });
    }
    
    const paymentRequests = await paymentRequestsService.getPaymentRequestsByShopId(parseInt(shopId));
    res.json(paymentRequests);
  } catch (error) {
    logger.error('Error fetching payment requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPaymentRequestById(req, res) {
  try {
    const { id } = req.params;
    const user_id = parseInt(req.user.id);
    
    const paymentRequest = await paymentRequestsService.getPaymentRequestById(parseInt(id));
    if (!paymentRequest) {
      return res.status(404).json({ error: 'Payment request not found' });
    }
    
    // Проверяем, что запрос принадлежит пользователю
    if (parseInt(paymentRequest.user_id) !== user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    res.json(paymentRequest);
  } catch (error) {
    logger.error('Error fetching payment request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserPaymentRequests(req, res) {
  try {
    const user_id = parseInt(req.user.id);
    const paymentRequests = await paymentRequestsService.getPaymentRequestsByUserId(user_id);
    res.json(paymentRequests);
  } catch (error) {
    logger.error('Error fetching user payment requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createPaymentRequest,
  getPaymentRequestsByShop,
  getPaymentRequestById,
  getUserPaymentRequests,
};

