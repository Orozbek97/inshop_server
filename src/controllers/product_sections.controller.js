const productSectionsService = require('../services/product_sections.service');
const pool = require('../db');
const logger = require('../utils/logger');

async function ensureShopExists(shopId) {
  const result = await pool.query('SELECT id FROM shops WHERE id = $1', [shopId]);
  return result.rows[0] || null;
}

async function listSectionsByShop(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);

    if (Number.isNaN(shopId)) {
      return res.status(400).json({ error: 'Invalid shop id' });
    }

    const shop = await ensureShopExists(shopId);
    if (!shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const sections = await productSectionsService.getSectionsByShop(shopId);
    res.json(sections);
  } catch (error) {
    logger.error('Error listing sections', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createSection(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);

    if (Number.isNaN(shopId)) {
      return res.status(400).json({ error: 'Invalid shop id' });
    }

    const { title, sort_order } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 1 || trimmedTitle.length > 100) {
      return res.status(400).json({ error: 'Title must be between 1 and 100 characters' });
    }

    let numericSortOrder = 0;
    if (sort_order !== undefined) {
      const parsed = Number(sort_order);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'sort_order must be a number' });
      }
      numericSortOrder = parsed;
    }

    const sectionData = {
      shop_id: shopId,
      title: trimmedTitle,
      sort_order: numericSortOrder,
    };

    const section = await productSectionsService.createSection(sectionData);
    res.status(201).json(section);
  } catch (error) {
    logger.error('Error creating section', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateSection(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    const sectionId = parseInt(req.params.sectionId, 10);

    if (Number.isNaN(shopId) || Number.isNaN(sectionId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const section = await productSectionsService.getSectionById(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    if (section.shop_id !== shopId) {
      return res.status(403).json({ error: 'Forbidden: section does not belong to this shop' });
    }

    const { title, sort_order } = req.body;
    const updateData = {};

    if (title !== undefined) {
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title must be a non-empty string' });
      }
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < 1 || trimmedTitle.length > 100) {
        return res.status(400).json({ error: 'Title must be between 1 and 100 characters' });
      }
      updateData.title = trimmedTitle;
    }

    if (sort_order !== undefined) {
      const parsed = Number(sort_order);
      if (Number.isNaN(parsed)) {
        return res.status(400).json({ error: 'sort_order must be a number' });
      }
      updateData.sort_order = parsed;
    }

    const updated = await productSectionsService.updateSection(sectionId, updateData);

    if (!updated) {
      return res.status(404).json({ error: 'Section not found' });
    }

    res.json(updated);
  } catch (error) {
    logger.error('Error updating section', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteSection(req, res) {
  try {
    const shopId = parseInt(req.params.shopId, 10);
    const sectionId = parseInt(req.params.sectionId, 10);

    if (Number.isNaN(shopId) || Number.isNaN(sectionId)) {
      return res.status(400).json({ error: 'Invalid ids' });
    }

    const section = await productSectionsService.getSectionById(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    if (section.shop_id !== shopId) {
      return res.status(403).json({ error: 'Forbidden: section does not belong to this shop' });
    }

    const deleted = await productSectionsService.deleteSection(sectionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Section not found' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Error deleting section', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listSectionsByShop,
  createSection,
  updateSection,
  deleteSection,
};


