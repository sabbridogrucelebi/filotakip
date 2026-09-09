// FiloTakip PRO - JWT Authentication Module
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'filotakip-super-secret-key-2026';
const JWT_EXPIRES_IN = '24h';
const REFRESH_EXPIRES_IN = '30d';

function createAuthRoutes(app, pool) {

  // =================== LOGIN ===================
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
      }

      const [users] = await pool.execute(
        'SELECT id, username, password_hash, email, full_name, role, avatar_url FROM users WHERE username = ? AND is_active = 1',
        [username]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
      }

      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Şifre yanlış' });
      }

      // Generate tokens
      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
      );

      // Save refresh token to sessions
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await pool.execute(
        'INSERT INTO sessions (user_id, refresh_token, ip_address, expires_at) VALUES (?, ?, ?, ?)',
        [user.id, refreshToken, req.ip, expiresAt]
      );

      // Update last login
      await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          avatar: user.avatar_url
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  });

  // =================== REGISTER ===================
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, email, fullName, phone, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
      }

      // Check if user exists
      const [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      const [result] = await pool.execute(
        'INSERT INTO users (username, password_hash, email, full_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hash, email || null, fullName || null, phone || null, role || 'user']
      );

      res.status(201).json({ 
        success: true,
        message: 'Kullanıcı başarıyla oluşturuldu',
        userId: result.insertId 
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  });

  // =================== REFRESH TOKEN ===================
  app.post('/api/auth/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) return res.status(400).json({ error: 'Refresh token gerekli' });

      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      
      const [sessions] = await pool.execute(
        'SELECT * FROM sessions WHERE refresh_token = ? AND user_id = ? AND expires_at > NOW()',
        [refreshToken, decoded.id]
      );
      
      if (sessions.length === 0) {
        return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
      }

      const [users] = await pool.execute(
        'SELECT id, username, role FROM users WHERE id = ? AND is_active = 1',
        [decoded.id]
      );
      
      if (users.length === 0) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

      const user = users[0];
      const newAccessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.json({ accessToken: newAccessToken });
    } catch (err) {
      return res.status(401).json({ error: 'Geçersiz token' });
    }
  });

  // =================== LOGOUT ===================
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await pool.execute('DELETE FROM sessions WHERE refresh_token = ?', [refreshToken]);
      }
      res.json({ success: true, message: 'Çıkış yapıldı' });
    } catch (err) {
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  });

  // =================== GET CURRENT USER ===================
  app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
      const [users] = await pool.execute(
        'SELECT id, username, email, full_name, phone, role, avatar_url, created_at, last_login FROM users WHERE id = ?',
        [req.user.id]
      );
      if (users.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
      
      const u = users[0];
      res.json({
        id: u.id,
        username: u.username,
        email: u.email,
        fullName: u.full_name,
        phone: u.phone,
        role: u.role,
        avatar: u.avatar_url,
        createdAt: u.created_at,
        lastLogin: u.last_login
      });
    } catch (err) {
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  });

  // =================== LIST USERS (Admin only) ===================
  app.get('/api/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
      const [users] = await pool.execute(
        'SELECT id, username, email, full_name, phone, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
      );
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  });

  // =================== CHANGE PASSWORD ===================
  app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
      }

      const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
      if (users.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

      const isMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
      if (!isMatch) return res.status(401).json({ error: 'Mevcut şifre yanlış' });

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

      res.json({ success: true, message: 'Şifre başarıyla değiştirildi' });
    } catch (err) {
      res.status(500).json({ error: 'Sunucu hatası' });
    }
  });
}

// =================== MIDDLEWARE ===================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token gerekli' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

function roleMiddleware(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }
    next();
  };
}

module.exports = { createAuthRoutes, authMiddleware, roleMiddleware, JWT_SECRET };
