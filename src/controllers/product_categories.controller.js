const pool = require('../db');
const logger = require('../utils/logger');

function setLeafAndSort(category) {
  category.children.sort((a, b) => a.sort_order - b.sort_order);
  category.is_leaf = category.children.length === 0;
  category.children.forEach(child => setLeafAndSort(child));
}

async function getProductCategories(req, res) {
  try {
    const query = `
      SELECT * 
      FROM product_categories 
      WHERE is_active = true 
      ORDER BY sort_order ASC
    `;
    const result = await pool.query(query);
    const categories = result.rows;

    const categoryMap = new Map();
    const rootCategories = [];

    categories.forEach(category => {
      category.children = [];
      categoryMap.set(category.id, category);
    });

    categories.forEach(category => {
      if (category.parent_id && categoryMap.has(category.parent_id)) {
        categoryMap.get(category.parent_id).children.push(category);
      } else {
        rootCategories.push(category);
      }
    });

    rootCategories.forEach(category => setLeafAndSort(category));

    res.json(rootCategories);
  } catch (error) {
    logger.error('Error fetching product categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Получение всех ID категорий включая подкатегории (рекурсивно)
 * Экспортируем для использования в других контроллерах
 */
async function getAllCategoryIds(categoryId) {
  const query = `
    WITH RECURSIVE category_tree AS (
      SELECT id, parent_id
      FROM product_categories
      WHERE id = $1 AND is_active = true
      UNION ALL
      SELECT pc.id, pc.parent_id
      FROM product_categories pc
      INNER JOIN category_tree ct ON pc.parent_id = ct.id
      WHERE pc.is_active = true
    )
    SELECT id FROM category_tree
  `;
  const result = await pool.query(query, [categoryId]);
  return result.rows.map(row => row.id);
}

/**
 * Получение категории по slug с подкатегориями
 */
async function getProductCategoryBySlug(req, res) {
  try {
    const { slug } = req.params;
    
    // Сначала находим нужную категорию по slug
    const categoryQuery = `
      SELECT * 
      FROM product_categories 
      WHERE slug = $1 AND is_active = true
    `;
    const categoryResult = await pool.query(categoryQuery, [slug]);
    
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    const category = categoryResult.rows[0];
    
    // Получаем только подкатегории этой категории (рекурсивно)
    const childrenQuery = `
      WITH RECURSIVE category_tree AS (
        SELECT * 
        FROM product_categories 
        WHERE parent_id = $1 AND is_active = true
        UNION ALL
        SELECT pc.*
        FROM product_categories pc
        INNER JOIN category_tree ct ON pc.parent_id = ct.id
        WHERE pc.is_active = true
      )
      SELECT * FROM category_tree
      ORDER BY sort_order ASC
    `;
    const childrenResult = await pool.query(childrenQuery, [category.id]);
    const children = childrenResult.rows;

    // Строим дерево подкатегорий
    const categoryMap = new Map();
    children.forEach(cat => {
      cat.children = [];
      categoryMap.set(cat.id, cat);
    });

    children.forEach(cat => {
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id).children.push(cat);
      }
    });

    // Добавляем подкатегории к основной категории
    category.children = children.filter(cat => cat.parent_id === category.id);
    category.children.forEach(child => setLeafAndSort(child));
    category.is_leaf = category.children.length === 0;

    res.json(category);
  } catch (error) {
    logger.error('Error fetching product category by slug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getProductCategories,
  getProductCategoryBySlug,
};

