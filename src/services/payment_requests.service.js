const pool = require('../db');

async function createPaymentRequest(paymentData) {
  const { shop_id, user_id, amount, receipt_url, tariff } = paymentData;
  
  const query = `
    INSERT INTO payment_requests (shop_id, user_id, amount, receipt_url, tariff, status)
    VALUES ($1, $2, $3, $4, $5, 'waiting')
    RETURNING *
  `;
  
  const values = [shop_id, user_id, amount, receipt_url || null, tariff || null];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getPaymentRequestById(id) {
  const query = `
    SELECT 
      pr.*,
      s.name as shop_name,
      u.name as user_name,
      u.email as user_email
    FROM payment_requests pr
    LEFT JOIN shops s ON pr.shop_id = s.id
    LEFT JOIN users u ON pr.user_id = u.id
    WHERE pr.id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function getPaymentRequestsByShopId(shopId) {
  const query = `
    SELECT *
    FROM payment_requests
    WHERE shop_id = $1
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [shopId]);
  return result.rows;
}

async function getPaymentRequestsByUserId(userId) {
  const query = `
    SELECT 
      pr.*,
      s.name as shop_name
    FROM payment_requests pr
    LEFT JOIN shops s ON pr.shop_id = s.id
    WHERE pr.user_id = $1
    ORDER BY pr.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

async function getPendingPaymentRequests() {
  const query = `
    SELECT 
      pr.*,
      s.name as shop_name,
      u.name as user_name,
      u.email as user_email
    FROM payment_requests pr
    LEFT JOIN shops s ON pr.shop_id = s.id
    LEFT JOIN users u ON pr.user_id = u.id
    WHERE pr.status = 'waiting'
    ORDER BY pr.created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function updatePaymentRequestStatus(id, status) {
  const query = `
    UPDATE payment_requests 
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [status, id]);
  return result.rows[0] || null;
}

module.exports = {
  createPaymentRequest,
  getPaymentRequestById,
  getPaymentRequestsByShopId,
  getPaymentRequestsByUserId,
  getPendingPaymentRequests,
  updatePaymentRequestStatus,
};

