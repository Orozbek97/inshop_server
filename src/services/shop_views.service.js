const pool = require('../db');

/**
 * Регистрирует просмотр магазина
 * @param {number} shopId - ID магазина
 * @param {number|null} userId - ID пользователя (если авторизован)
 * @param {string} ipAddress - IP адрес
 * @param {string} userAgent - User-Agent
 * @returns {Promise<Object>}
 */
async function recordShopView(shopId, userId = null, ipAddress = null, userAgent = null) {
  // Если IP неизвестен, используем комбинацию user_id + user_agent для защиты
  // Это поможет в случаях, когда IP не определяется правильно
  const useIpCheck = ipAddress && ipAddress !== 'unknown';
  
  // Используем транзакцию для предотвращения race condition
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем, был ли уже просмотр за последний час
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    let checkQuery, checkParams;
    
    if (useIpCheck) {
      // Проверяем по IP
      checkQuery = `
        SELECT id FROM shop_views
        WHERE shop_id = $1
          AND ip_address = $2
          AND viewed_at > $3
        LIMIT 1
        FOR UPDATE
      `;
      checkParams = [shopId, ipAddress, oneHourAgo];
    } else if (userId) {
      // Если IP неизвестен, проверяем по user_id
      checkQuery = `
        SELECT id FROM shop_views
        WHERE shop_id = $1
          AND user_id = $2
          AND viewed_at > $3
        LIMIT 1
        FOR UPDATE
      `;
      checkParams = [shopId, userId, oneHourAgo];
    } else {
      // Если и IP и user_id неизвестны, проверяем по user_agent + время (более строгая проверка - 5 минут)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      checkQuery = `
        SELECT id FROM shop_views
        WHERE shop_id = $1
          AND ip_address = $2
          AND user_agent = $3
          AND viewed_at > $4
        LIMIT 1
        FOR UPDATE
      `;
      checkParams = [shopId, ipAddress || 'unknown', userAgent || 'unknown', fiveMinutesAgo];
    }
    
    const checkResult = await client.query(checkQuery, checkParams);
    
    // Если уже был просмотр за последний час, не считаем повторно
    if (checkResult.rows.length > 0) {
      await client.query('COMMIT');
      const shop = await pool.query('SELECT views FROM shops WHERE id = $1', [shopId]);
      return { 
        views: shop.rows[0]?.views || 0,
        isNew: false 
      };
    }
    
    // Записываем новый просмотр
    const insertQuery = `
      INSERT INTO shop_views (shop_id, user_id, ip_address, user_agent)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    await client.query(insertQuery, [shopId, userId, ipAddress, userAgent]);
    
    // Инкрементируем счетчик в таблице shops
    const updateQuery = `
      UPDATE shops
      SET views = views + 1
      WHERE id = $1
      RETURNING views
    `;
    
    const updateResult = await client.query(updateQuery, [shopId]);
    
    await client.query('COMMIT');
    
    return {
      views: updateResult.rows[0]?.views || 0,
      isNew: true
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Получает количество просмотров магазина
 * @param {number} shopId - ID магазина
 * @returns {Promise<number>}
 */
async function getShopViews(shopId) {
  const query = 'SELECT views FROM shops WHERE id = $1';
  const result = await pool.query(query, [shopId]);
  return result.rows[0]?.views || 0;
}

/**
 * Получает статистику просмотров магазина
 * @param {number} shopId - ID магазина
 * @returns {Promise<Object>}
 */
async function getShopViewsStats(shopId) {
  const query = `
    SELECT 
      COUNT(*)::int AS total_views,
      COUNT(DISTINCT user_id)::int AS unique_users,
      COUNT(DISTINCT ip_address)::int AS unique_ips,
      MAX(viewed_at) AS last_viewed_at
    FROM shop_views
    WHERE shop_id = $1
  `;
  
  const result = await pool.query(query, [shopId]);
  return result.rows[0] || {
    total_views: 0,
    unique_users: 0,
    unique_ips: 0,
    last_viewed_at: null
  };
}

module.exports = {
  recordShopView,
  getShopViews,
  getShopViewsStats,
};
