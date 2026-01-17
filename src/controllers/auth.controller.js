const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../db');
const { generateToken } = require('../utils/jwt');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, normalizedEmail, passwordHash, 'user']
    );

    const user = result.rows[0];
    const token = generateToken({ userId: user.id });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(201).json(user);
  } catch (error) {
    logger.error('Error in register', { error });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    logger.debug('Login attempt', { email: normalizedEmail });
    const result = await pool.query('SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = $1', [normalizedEmail]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = generateToken({ userId: user.id });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    logger.error('Error in login', { error });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error in getMe', { error });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

async function logout(req, res) {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    path: '/',
  });
  res.json({ message: 'Выход выполнен успешно' });
}

// Запрос на сброс пароля
async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email обязателен' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userResult = await pool.query('SELECT id, email FROM users WHERE LOWER(email) = $1', [normalizedEmail]);

    // Для безопасности всегда возвращаем успешный ответ, даже если email не найден
    if (userResult.rows.length === 0) {
      return res.json({ message: 'Если аккаунт с таким email существует, на него отправлена ссылка для сброса пароля.' });
    }

    const user = userResult.rows[0];

    // Генерируем токен
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 час

    // Удаляем старые неиспользованные токены для этого пользователя
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = false',
      [user.id]
    );

    // Сохраняем новый токен
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, resetToken, expiresAt]
    );

    // Отправляем email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (emailError) {
      logger.error('Error sending password reset email', { error: emailError });
      await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [resetToken]);
      return res.status(500).json({ error: 'Не удалось отправить email для сброса пароля' });
    }

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    logger.error('Error in requestPasswordReset', { error });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

// Сброс пароля
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Токен и пароль обязательны' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    // Находим токен
    const tokenResult = await pool.query(
      `SELECT prt.*, u.id as user_id, u.email 
       FROM password_reset_tokens prt
       JOIN users u ON prt.user_id = u.id
       WHERE prt.token = $1 AND prt.used = false AND prt.expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный или истекший токен' });
    }

    const resetToken = tokenResult.rows[0];
    const userId = resetToken.user_id;

    // Хешируем новый пароль
    const passwordHash = await bcrypt.hash(password, 10);

    // Обновляем пароль пользователя
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );

    // Помечаем токен как использованный
    await pool.query(
      'UPDATE password_reset_tokens SET used = true WHERE token = $1',
      [token]
    );

    // Удаляем все неиспользованные токены этого пользователя
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = false',
      [userId]
    );

    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    logger.error('Error in resetPassword', { error });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

module.exports = {
  register,
  login,
  getMe,
  logout,
  requestPasswordReset,
  resetPassword,
};

