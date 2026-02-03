const pool = require('../db');

async function createSection(sectionData) {
  const { shop_id, title, sort_order = 0 } = sectionData;
  const query = `
    INSERT INTO product_sections (shop_id, title, sort_order)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const values = [shop_id, title, sort_order];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function updateSection(id, updateData) {
  const fields = [];
  const values = [];
  let index = 1;

  if (Object.prototype.hasOwnProperty.call(updateData, 'title')) {
    fields.push(`title = $${index}`);
    values.push(updateData.title);
    index += 1;
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'sort_order')) {
    fields.push(`sort_order = $${index}`);
    values.push(updateData.sort_order);
    index += 1;
  }

  if (fields.length === 0) {
    const selectQuery = 'SELECT * FROM product_sections WHERE id = $1';
    const selectResult = await pool.query(selectQuery, [id]);
    return selectResult.rows[0] || null;
  }

  const query = `
    UPDATE product_sections
    SET ${fields.join(', ')}
    WHERE id = $${index}
    RETURNING *
  `;

  values.push(id);

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function deleteSection(id) {
  const query = `
    DELETE FROM product_sections
    WHERE id = $1
    RETURNING *
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function getSectionsByShop(shopId) {
  const query = `
    SELECT *
    FROM product_sections
    WHERE shop_id = $1
    ORDER BY sort_order ASC, created_at ASC
  `;
  const result = await pool.query(query, [shopId]);
  return result.rows;
}

async function getSectionById(id) {
  const query = `
    SELECT *
    FROM product_sections
    WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

module.exports = {
  createSection,
  updateSection,
  deleteSection,
  getSectionsByShop,
  getSectionById,
};


