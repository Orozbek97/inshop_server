const shopsService = require('../services/shops.service');
const telegramService = require('../services/telegram.service');
const pool = require('../db');
const logger = require('../utils/logger');

async function getAllShops(req, res) {
  try {
    const shops = await shopsService.getAllShops();
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error fetching shops', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getShopsByCategory(req, res) {
  try {
    const { slug } = req.params;
    const shops = await shopsService.getShopsByCategorySlug(slug);
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error fetching shops by category', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getShopBySlug(req, res) {
  try {
    const { slug } = req.params;
    const shop = await shopsService.getShopBySlug(slug);
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const formattedShop = {
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    };
    
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error fetching shop', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createShop(req, res) {
  try {
    const { name, instagram_url, phone, category_id, district, description } = req.body;
    
    if (!name || !instagram_url || !phone || !category_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    let cover_image_url = null;
    let original_image_url = null;
    
    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        cover_image_url = `/uploads/shops/${req.files.coverImage[0].filename}`;
      }
      if (req.files.originalImage && req.files.originalImage[0]) {
        original_image_url = `/uploads/shops/${req.files.originalImage[0].filename}`;
      }
    }
    
    if (req.file) {
      cover_image_url = `/uploads/shops/${req.file.filename}`;
      original_image_url = cover_image_url;
    }
    
    const user_id = parseInt(req.user.id);
    
    const shop = await shopsService.createShop({
      name,
      instagram_url,
      phone,
      category_id,
      district: district || null,
      description: description || null,
      cover_image_url: cover_image_url || original_image_url,
      original_image_url: original_image_url || cover_image_url,
      user_id,
    });

    const shopWithCategory = await shopsService.getShopById(shop.id);
    
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [user_id]);
    const userEmail = userResult.rows[0]?.email || null;
    
    await telegramService.sendModerationNotification(shopWithCategory, userEmail);
    
    res.status(201).json(shop);
  } catch (error) {
    logger.error('Error creating shop', { error });
    if (error.code === 'DUPLICATE_INSTAGRAM') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getUserShops(req, res) {
  try {
    const userId = parseInt(req.user.id);
    const shops = await shopsService.getUserShops(userId);
    const formattedShops = shops.map(shop => ({
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    }));
    res.json(formattedShops);
  } catch (error) {
    logger.error('Error fetching user shops', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getShopById(req, res) {
  try {
    const { id } = req.params;
    const shop = await shopsService.getShopById(parseInt(id));
    
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const formattedShop = {
      ...shop,
      reviews_summary: typeof shop.reviews_summary === 'string' 
        ? JSON.parse(shop.reviews_summary) 
        : shop.reviews_summary
    };
    
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error fetching shop', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateShop(req, res) {
  try {
    const { id } = req.params;
    const { name, instagram_url, phone, category_id, district, description, delivery } = req.body;
    
    if (!name || !name.trim() || !instagram_url || !instagram_url.trim() || !category_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingShop = await shopsService.getShopById(parseInt(id));
    if (!existingShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const parsedCategoryId = parseInt(category_id);
    if (isNaN(parsedCategoryId)) {
      return res.status(400).json({ error: 'Invalid category_id' });
    }
    
    const fs = require('fs');
    const path = require('path');
    const uploadsBasePath = path.join(__dirname, '../../uploads');
    
    // Функция для безопасного удаления файла
    const deleteImageFile = (imagePath) => {
      if (!imagePath) return;
      try {
        // Путь в БД: /uploads/shops/filename
        // Физический путь: server/uploads/shops/filename
        let cleanPath = imagePath;
        if (cleanPath.startsWith('/uploads/')) {
          cleanPath = cleanPath.substring('/uploads/'.length); // убираем /uploads/
        } else if (cleanPath.startsWith('uploads/')) {
          cleanPath = cleanPath.substring('uploads/'.length); // убираем uploads/
        }
        const fullPath = path.join(uploadsBasePath, cleanPath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          logger.info(`Deleted old image: ${fullPath}`);
        }
        // Не логируем, если файл уже не существует - это нормальная ситуация
      } catch (error) {
        // Логируем только реальные ошибки (например, проблемы с правами доступа)
        logger.error(`Error deleting image file ${imagePath}`, { error });
      }
    };
    
    let cover_image_url = existingShop.cover_image_url;
    let original_image_url = existingShop.original_image_url;
    
    // Если загружается новое изображение, удаляем все старые
    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        // Удаляем все старые изображения
        if (existingShop.cover_image_url) deleteImageFile(existingShop.cover_image_url);
        if (existingShop.original_image_url && existingShop.original_image_url !== existingShop.cover_image_url) {
          deleteImageFile(existingShop.original_image_url);
        }
        if (existingShop.image_url && existingShop.image_url !== existingShop.cover_image_url && existingShop.image_url !== existingShop.original_image_url) {
          deleteImageFile(existingShop.image_url);
        }
        cover_image_url = `/uploads/shops/${req.files.coverImage[0].filename}`;
        original_image_url = cover_image_url;
      }
      
      if (req.files.originalImage && req.files.originalImage[0]) {
        // Если originalImage загружается отдельно
        if (existingShop.original_image_url) deleteImageFile(existingShop.original_image_url);
        original_image_url = `/uploads/shops/${req.files.originalImage[0].filename}`;
        if (!cover_image_url) {
          cover_image_url = original_image_url;
        }
      }
    }
    
    if (req.file) {
      // Удаляем все старые изображения
      if (existingShop.cover_image_url) deleteImageFile(existingShop.cover_image_url);
      if (existingShop.original_image_url && existingShop.original_image_url !== existingShop.cover_image_url) {
        deleteImageFile(existingShop.original_image_url);
      }
      if (existingShop.image_url && existingShop.image_url !== existingShop.cover_image_url && existingShop.image_url !== existingShop.original_image_url) {
        deleteImageFile(existingShop.image_url);
      }
      
      cover_image_url = `/uploads/shops/${req.file.filename}`;
      original_image_url = cover_image_url;
    }
    
    const deliveryValue = delivery === 'true' || delivery === true || delivery === '1' || delivery === 1;
    
    const isRejected = existingShop.moderation_status === 'rejected';
    const shouldResubmit = isRejected && req.body.resubmit === 'true';
    
    if (shouldResubmit) {
      await shopsService.updateModerationStatus(parseInt(id), 'pending');
    }
    
    const finalCoverImageUrl = cover_image_url !== undefined ? cover_image_url : existingShop.cover_image_url;
    const finalOriginalImageUrl = original_image_url !== undefined ? original_image_url : existingShop.original_image_url;
    
    const shop = await shopsService.updateShop(parseInt(id), {
      name: name.trim(),
      instagram_url: instagram_url.trim(),
      phone: phone && phone.trim() ? phone.trim() : existingShop.phone,
      category_id: parsedCategoryId,
      district: district && district.trim() ? district.trim() : null,
      description: description && description.trim() ? description.trim() : null,
      cover_image_url: finalCoverImageUrl,
      original_image_url: finalOriginalImageUrl,
      delivery: deliveryValue,
    });
    
    const updatedShop = await shopsService.getShopById(parseInt(id));
    if (!updatedShop) {
      return res.status(404).json({ error: 'Shop not found after update' });
    }
    
    if (shouldResubmit) {
      const shopWithCategory = await shopsService.getShopById(parseInt(id));
      const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
      const userEmail = userResult.rows[0]?.email || null;
      await telegramService.sendModerationNotification(shopWithCategory, userEmail);
    }
    
    const formattedShop = {
      ...updatedShop,
      reviews_summary: typeof updatedShop.reviews_summary === 'string' 
        ? JSON.parse(updatedShop.reviews_summary) 
        : updatedShop.reviews_summary
    };
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error updating shop', { error });
    if (error.code === 'DUPLICATE_INSTAGRAM') {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function toggleShopActive(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }
    
    const existingShop = await shopsService.getShopById(parseInt(id));
    if (!existingShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    // Проверка владельца уже выполнена в middleware checkShopOwnership
    const updatedShop = await shopsService.toggleShopActive(parseInt(id), is_active);
    
    if (!updatedShop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    const formattedShop = {
      ...updatedShop,
      reviews_summary: typeof updatedShop.reviews_summary === 'string' 
        ? JSON.parse(updatedShop.reviews_summary) 
        : updatedShop.reviews_summary
    };
    
    res.json(formattedShop);
  } catch (error) {
    logger.error('Error toggling shop active status', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteShop(req, res) {
  try {
    const { id } = req.params;
    
    const shop = await shopsService.getShopById(parseInt(id));
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }
    
    if (shop.image_url) {
      const fs = require('fs');
      const path = require('path');
      const imagePath = path.join(__dirname, '../../uploads', shop.image_url);
      
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch (fileError) {
          logger.error('Error deleting image file:', fileError);
        }
      }
    }
    
    await shopsService.deleteShop(parseInt(id));
    
    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting shop', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getAllShops,
  getShopsByCategory,
  getShopBySlug,
  getUserShops,
  getShopById,
  createShop,
  updateShop,
  toggleShopActive,
  deleteShop,
};

