const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  logger.warn('Telegram bot token or chat ID not configured. Telegram notifications will be disabled.');
} else {
  logger.info('Telegram bot configured');
}

let bot = null;

if (BOT_TOKEN && CHAT_ID) {
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat?.id?.toString();
    
    if (chatId !== CHAT_ID) {
      return;
    }
    
    const data = callbackQuery.data;
    if (!data) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Ошибка: нет данных',
        show_alert: false
      });
      return;
    }
    
    const parts = data.split(':');
    const action = parts[0];
    const id = parts[1];
    
    if (!action || !id) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Ошибка: неверный формат',
        show_alert: false
      });
      return;
    }
    
    const shopsService = require('./shops.service');
    const paymentRequestsService = require('./payment_requests.service');
    
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Обработка...',
        show_alert: false
      });
      
      // Обработка действий модерации магазинов
      if (action === 'approve_shop' || action === 'reject_shop') {
        const shopId = parseInt(id);
        const shop = await shopsService.getShopById(shopId);
        if (!shop) {
          await bot.sendMessage(chatId, '❌ Ошибка: магазин не найден');
          return;
        }
        
        if (action === 'approve_shop') {
          await shopsService.updateModerationStatus(shopId, 'approved');
          
          const originalText = callbackQuery.message.text || '';
          const newText = `✅ Одобрено\n\n${originalText}`;
          
          try {
            await bot.editMessageText(newText, {
              chat_id: chatId,
              message_id: callbackQuery.message.message_id
            });
          } catch (editError) {
            logger.error('Error editing message:', editError);
          }
        } else if (action === 'reject_shop') {
          await shopsService.updateModerationStatus(shopId, 'rejected');
          
          const originalText = callbackQuery.message.text || '';
          const newText = `❌ Отклонено\n\n${originalText}`;
          
          try {
            await bot.editMessageText(newText, {
              chat_id: chatId,
              message_id: callbackQuery.message.message_id
            });
          } catch (editError) {
            logger.error('Error editing message:', editError);
          }
        }
      }
      // Обработка действий с платежами
      else if (action === 'approve_payment' || action === 'reject_payment') {
        const paymentRequestId = parseInt(id);
        const paymentRequest = await paymentRequestsService.getPaymentRequestById(paymentRequestId);
        
        if (!paymentRequest) {
          await bot.sendMessage(chatId, '❌ Ошибка: запрос на оплату не найден');
          return;
        }
        
        if (action === 'approve_payment') {
          // Обновляем статус запроса
          await paymentRequestsService.updatePaymentRequestStatus(paymentRequestId, 'approved');
          
          // Продлеваем подписку
          await shopsService.extendSubscription(paymentRequest.shop_id, 30);
          
          const originalText = callbackQuery.message.text || '';
          const newText = `✅ Подтверждено\n\n${originalText}`;
          
          try {
            await bot.editMessageText(newText, {
              chat_id: chatId,
              message_id: callbackQuery.message.message_id
            });
          } catch (editError) {
            logger.error('Error editing message:', editError);
          }
          
          // Получаем обновленный магазин для отображения новой даты
          const shop = await shopsService.getShopById(paymentRequest.shop_id);
          await bot.sendMessage(chatId, `✅ Подписка продлена до ${new Date(shop.subscription_expires_at).toLocaleDateString('ru-RU')}`);
        } else if (action === 'reject_payment') {
          // Обновляем статус запроса
          await paymentRequestsService.updatePaymentRequestStatus(paymentRequestId, 'rejected');
          
          const originalText = callbackQuery.message.text || '';
          const newText = `❌ Отклонено\n\n${originalText}`;
          
          try {
            await bot.editMessageText(newText, {
              chat_id: chatId,
              message_id: callbackQuery.message.message_id
            });
          } catch (editError) {
            logger.error('Error editing message:', editError);
          }
        }
      }
    } catch (error) {
      logger.error('Error handling callback query:', error);
      try {
        await bot.sendMessage(chatId, `❌ Произошла ошибка: ${error.message}`);
      } catch (sendError) {
        logger.error('Error sending error message:', sendError);
      }
    }
  });
  
  logger.info('Telegram bot polling started');
}

async function sendModerationNotification(shop, userEmail = null) {
  if (!bot || !CHAT_ID) {
    logger.info('Telegram bot not configured. Skipping notification.');
    return;
  }

  try {
    const districtText = shop.district || 'Онлайн';
    const emailText = userEmail ? `\n📧 Email: ${userEmail}` : '';
    
    const message = `🆕 Новый магазин на модерации

🏪 Название: ${shop.name}
📂 Категория: ${shop.category_name || 'Не указана'}
📍 Район: ${districtText}
📸 Instagram: ${shop.instagram_url}
🆔 Shop ID: ${shop.id}${emailText}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Одобрить', callback_data: `approve_shop:${shop.id}` },
          { text: '❌ Отклонить', callback_data: `reject_shop:${shop.id}` }
        ]
      ]
    };

    await bot.sendMessage(CHAT_ID, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  } catch (error) {
    logger.error('Error sending Telegram notification:', error);
  }
}

async function sendModerationResponse(callbackQueryId, text) {
  if (!bot) return;

  try {
    await bot.answerCallbackQuery(callbackQueryId, {
      text: text,
      show_alert: false
    });
  } catch (error) {
    logger.error('Error sending Telegram response:', error);
  }
}

async function editModerationMessage(chatId, messageId, newText) {
  if (!bot) return;

  try {
    await bot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML'
    });
  } catch (error) {
    logger.error('Error editing Telegram message:', error);
  }
}

async function sendPaymentNotification(paymentRequest, shop) {
  if (!bot || !CHAT_ID) {
    logger.info('Telegram bot not configured. Skipping notification.');
    return;
  }

  try {
    const imageBaseUrl = process.env.IMAGE_BASE_URL || 'http://localhost:5000';
    const receiptUrl = paymentRequest.receipt_url 
      ? `${imageBaseUrl}${paymentRequest.receipt_url}`
      : null;
    
    // Получаем Instagram username из URL магазина
    const instagramUsername = shop.instagram_url 
      ? shop.instagram_url.replace(/.*instagram\.com\//, '').replace(/\/.*/, '').replace('@', '')
      : 'не указан';
    
    let message = `💳 Продление подписки

🏪 Магазин: ${shop.name}
🆔 Shop ID: ${shop.id}
👤 Владелец: @${instagramUsername}
💰 Сумма: ${paymentRequest.amount} сом

`;
    
    if (receiptUrl) {
      message += `📎 Чек: ${receiptUrl}`;
      
      // Отправляем сообщение с фото
      try {
        await bot.sendPhoto(CHAT_ID, receiptUrl, {
          caption: message,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Подтвердить', callback_data: `approve_payment:${paymentRequest.id}` },
                { text: '❌ Отклонить', callback_data: `reject_payment:${paymentRequest.id}` }
              ]
            ]
          }
        });
        return;
      } catch (photoError) {
        logger.error('Error sending photo, sending text instead:', photoError);
      }
    }
    
    // Если фото не отправилось, отправляем текстовое сообщение
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Подтвердить', callback_data: `approve_payment:${paymentRequest.id}` },
          { text: '❌ Отклонить', callback_data: `reject_payment:${paymentRequest.id}` }
        ]
      ]
    };

    await bot.sendMessage(CHAT_ID, message, {
      reply_markup: keyboard,
      parse_mode: 'HTML'
    });
  } catch (error) {
    logger.error('Error sending payment notification:', error);
  }
}

function getBot() {
  return bot;
}

module.exports = {
  sendModerationNotification,
  sendModerationResponse,
  editModerationMessage,
  sendPaymentNotification,
  getBot
};

