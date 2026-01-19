const shopsService = require('../services/shops.service');
const telegramService = require('../services/telegram.service');
const r2Service = require('../services/r2.service');
const pool = require('../db');
const logger = require('../utils/logger');
const path = require('path');

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

function generateFilename(originalname) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = path.extname(originalname);
  return `${timestamp}-${random}${ext}`;
}

async function createShop(req, res) {
  try {
    const { name, instagram_url, phone, category_id, district, description } = req.body;
    
    if (!name || !instagram_url || !phone || !category_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    let cover_image_url = null;
    let original_image_url = null;
    
    try {
      if (req.files) {
        if (req.files.coverImage && req.files.coverImage[0]) {
          const file = req.files.coverImage[0];
          if (!file.buffer) {
            return res.status(400).json({ error: 'Invalid file upload' });
          }
          const filename = generateFilename(file.originalname);
          cover_image_url = await r2Service.uploadFile(file.buffer, filename, 'shops');
        }
        if (req.files.originalImage && req.files.originalImage[0]) {
          const file = req.files.originalImage[0];
          if (!file.buffer) {
            return res.status(400).json({ error: 'Invalid file upload' });
          }
          const filename = generateFilename(file.originalname);
          original_image_url = await r2Service.uploadFile(file.buffer, filename, 'shops');
        }
      }
      
      if (req.file) {
        if (!req.file.buffer) {
          return res.status(400).json({ error: 'Invalid file upload' });
        }
        const filename = generateFilename(req.file.originalname);
        cover_image_url = await r2Service.uploadFile(req.file.buffer, filename, 'shops');
        original_image_url = cover_image_url;
      }
    } catch (uploadError) {
      logger.error('Error uploading file to R2', { error: uploadError });
      return res.status(500).json({ error: 'Failed to upload image' });
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
    
    const deleteImageFile = async (imageUrl) => {
      if (!imageUrl) return;
      try {
        const key = r2Service.getKeyFromUrl(imageUrl);
        if (key) {
          await r2Service.deleteFile(key);
        }
      } catch (error) {
        logger.error(`Error deleting image file from R2: ${imageUrl}`, { error });
      }
    };
    
    let cover_image_url = existingShop.cover_image_url;
    let original_image_url = existingShop.original_image_url;
    
    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        if (existingShop.cover_image_url) await deleteImageFile(existingShop.cover_image_url);
        if (existingShop.original_image_url && existingShop.original_image_url !== existingShop.cover_image_url) {
          await deleteImageFile(existingShop.original_image_url);
        }
        if (existingShop.image_url && existingShop.image_url !== existingShop.cover_image_url && existingShop.image_url !== existingShop.original_image_url) {
          await deleteImageFile(existingShop.image_url);
        }
        const file = req.files.coverImage[0];
        const filename = generateFilename(file.originalname);
        cover_image_url = await r2Service.uploadFile(file.buffer, filename, 'shops');
        original_image_url = cover_image_url;
      }
      
      if (req.files.originalImage && req.files.originalImage[0]) {
        if (existingShop.original_image_url) await deleteImageFile(existingShop.original_image_url);
        const file = req.files.originalImage[0];
        const filename = generateFilename(file.originalname);
        original_image_url = await r2Service.uploadFile(file.buffer, filename, 'shops');
        if (!cover_image_url) {
          cover_image_url = original_image_url;
        }
      }
    }
    
    if (req.file) {
      if (existingShop.cover_image_url) await deleteImageFile(existingShop.cover_image_url);
      if (existingShop.original_image_url && existingShop.original_image_url !== existingShop.cover_image_url) {
        await deleteImageFile(existingShop.original_image_url);
      }
      if (existingShop.image_url && existingShop.image_url !== existingShop.cover_image_url && existingShop.image_url !== existingShop.original_image_url) {
        await deleteImageFile(existingShop.image_url);
      }
      
      const filename = generateFilename(req.file.originalname);
      cover_image_url = await r2Service.uploadFile(req.file.buffer, filename, 'shops');
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
    
    if (shop.cover_image_url) {
      const key = r2Service.getKeyFromUrl(shop.cover_image_url);
      if (key) {
        await r2Service.deleteFile(key);
      }
    }
    if (shop.original_image_url && shop.original_image_url !== shop.cover_image_url) {
      const key = r2Service.getKeyFromUrl(shop.original_image_url);
      if (key) {
        await r2Service.deleteFile(key);
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

