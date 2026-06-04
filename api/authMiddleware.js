import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'sakukita-secret-fallback-key-12345';

export async function authenticateToken(req, res) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded; // returns { userId, username }
  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(403).json({ error: 'Token kedaluwarsa atau tidak valid.' });
    return null;
  }
}
