const pool = require('../db');
const logger = require('../utils/logger');

/**
 * Получение всех ID категорий включая подкатегории (рекурсивно)
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

async function getProducts(req, res) {
  try {
    const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    const search = req.query.search ? req.query.search.trim() : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
    
    // Фильтры
    const minPrice = req.query.min_price ? parseFloat(req.query.min_price) : null;
    const maxPrice = req.query.max_price ? parseFloat(req.query.max_price) : null;
    const hasDiscount = req.query.has_discount === 'true' || req.query.has_discount === '1';
    
    // Сортировка
    const sortBy = req.query.sort_by || 'newest'; // newest, price_asc, price_desc, popularity, rating
    const sortOrder = req.query.sort_order || 'desc'; // asc, desc

    if (categoryId && Number.isNaN(categoryId)) {
      return res.status(400).json({ error: 'Invalid category_id' });
    }

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    conditions.push('p.is_active = true');
    conditions.push(`(s.moderation_status = 'approved' OR s.moderation_status IS NULL)`);
    conditions.push(`(s.is_active = true OR s.is_active IS NULL)`);
    conditions.push(`(s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)`);

    if (categoryId) {
      // Получаем все ID категорий включая подкатегории
      const allCategoryIds = await getAllCategoryIds(categoryId);
      if (allCategoryIds.length > 0) {
        conditions.push(`p.category_id = ANY($${paramIndex}::int[])`);
        params.push(allCategoryIds);
        paramIndex++;
      } else {
        // Если категория не найдена, возвращаем пустой результат
        return res.json({
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            has_more: false,
          },
        });
      }
    }

    if (search) {
      conditions.push(`p.title ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Фильтр по цене
    if (minPrice !== null && !Number.isNaN(minPrice)) {
      conditions.push(`p.price >= $${paramIndex}`);
      params.push(minPrice);
      paramIndex++;
    }

    if (maxPrice !== null && !Number.isNaN(maxPrice)) {
      conditions.push(`p.price <= $${paramIndex}`);
      params.push(maxPrice);
      paramIndex++;
    }

    // Фильтр по наличию скидки
    if (hasDiscount) {
      conditions.push(`p.old_price IS NOT NULL AND p.old_price > p.price`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Определяем сортировку
    let orderBy = 'p.created_at DESC';
    switch (sortBy) {
      case 'price_asc':
        orderBy = 'p.price ASC';
        break;
      case 'price_desc':
        orderBy = 'p.price DESC';
        break;
      case 'popularity':
        orderBy = 'p.views DESC, p.created_at DESC';
        break;
      case 'rating':
        // Сортировка по рейтингу (пока используем views как proxy, можно добавить отдельную таблицу рейтингов)
        orderBy = 'p.views DESC, p.created_at DESC';
        break;
      case 'newest':
      default:
        orderBy = 'p.created_at DESC';
        break;
    }
    
    // Добавляем приоритет по тарифу магазина в начало сортировки
    const tariffPriority = `
      CASE 
        WHEN s.tariff = 'pro' THEN 1
        WHEN s.tariff = 'standard' THEN 2
        WHEN s.tariff = 'start' THEN 3
        ELSE 3
      END,
    `;
    orderBy = tariffPriority + orderBy;

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM products p
      INNER JOIN shops s ON p.shop_id = s.id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    const offset = (page - 1) * limit;

    const dataQuery = `
      SELECT 
        p.id,
        p.title,
        p.price,
        p.old_price,
        p.image,
        p.status,
        p.views,
        p.created_at,
        json_build_object(
          'id', pc.id,
          'title', pc.title,
          'slug', pc.slug
        ) AS category,
        json_build_object(
          'id', s.id,
          'title', s.name,
          'slug', s.slug
        ) AS shop
      FROM products p
      INNER JOIN shops s ON p.shop_id = s.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const dataResult = await pool.query(dataQuery, params);

    const hasMore = offset + dataResult.rows.length < total;

    res.json({
      data: dataResult.rows,
      meta: {
        page,
        limit,
        total,
        has_more: hasMore,
      },
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getProductById(req, res) {
  try {
    const productId = parseInt(req.params.id, 10);

    if (Number.isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const query = `
      SELECT 
        p.id,
        p.title,
        p.price,
        p.old_price,
        p.description,
        p.image,
        p.images,
        p.sizes,
        p.status,
        p.views,
        p.created_at,
        json_build_object(
          'id', pc.id,
          'title', pc.title
        ) AS category,
        json_build_object(
          'id', s.id,
          'title', s.name,
          'slug', s.slug,
          'instagram', s.instagram_url,
          'whatsapp', s.phone
        ) AS shop
      FROM products p
      INNER JOIN shops s ON p.shop_id = s.id
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.id = $1
        AND p.is_active = true
        AND (s.moderation_status = 'approved' OR s.moderation_status IS NULL)
        AND (s.is_active = true OR s.is_active IS NULL)
        AND (s.subscription_expires_at > NOW() OR s.subscription_expires_at IS NULL)
    `;

    const result = await pool.query(query, [productId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = result.rows[0];
    
    // Парсим JSON поля
    if (product.images && typeof product.images === 'string') {
      try {
        product.images = JSON.parse(product.images);
      } catch (e) {
        product.images = product.image ? [product.image] : [];
      }
    } else if (!product.images) {
      product.images = product.image ? [product.image] : [];
    }
    
    if (product.sizes && typeof product.sizes === 'string') {
      try {
        product.sizes = JSON.parse(product.sizes);
      } catch (e) {
        product.sizes = [];
      }
    } else if (!product.sizes) {
      product.sizes = [];
    }
    
    const reviewsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE rating = 1) as likes,
        COUNT(*) FILTER (WHERE rating = -1) as dislikes,
        COUNT(*) FILTER (WHERE comment IS NOT NULL AND TRIM(comment) != '') as reviews_count
      FROM reviews
      WHERE shop_id = $1
    `;
    const reviewsResult = await pool.query(reviewsQuery, [product.shop.id]);
    const reviews = reviewsResult.rows[0];
    
    let rating = null;
    if (reviews.reviews_count > 0) {
      rating = Math.round((reviews.likes / reviews.reviews_count) * 5 * 10) / 10;
    }
    
    product.shop.rating = rating;

    res.json(product);
  } catch (error) {
    logger.error('Error fetching product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const productsService = require('../services/products.service');

async function getPopularProducts(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const products = await productsService.getPopularProducts(limit);
    res.json(products);
  } catch (error) {
    logger.error('Error getting popular products:', error);
    res.status(500).json({ error: 'Failed to get popular products' });
  }
}

async function getNewProducts(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const products = await productsService.getNewProducts(limit);
    res.json(products);
  } catch (error) {
    logger.error('Error getting new products:', error);
    res.status(500).json({ error: 'Failed to get new products' });
  }
}

async function getDiscountedProducts(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const products = await productsService.getDiscountedProducts(limit);
    res.json(products);
  } catch (error) {
    logger.error('Error getting discounted products:', error);
    res.status(500).json({ error: 'Failed to get discounted products' });
  }
}

async function getRecommendedProducts(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const products = await productsService.getRecommendedProducts(limit);
    res.json(products);
  } catch (error) {
    logger.error('Error getting recommended products:', error);
    res.status(500).json({ error: 'Failed to get recommended products' });
  }
}

module.exports = {
  getProducts,
  getProductById,
  getPopularProducts,
  getNewProducts,
  getDiscountedProducts,
  getRecommendedProducts,
};

