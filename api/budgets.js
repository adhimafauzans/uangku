import { dbAdapter } from './db.js';
import { authenticateToken } from './authMiddleware.js';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Authenticate user
  const user = await authenticateToken(req, res);
  if (!user) return;

  const { userId } = user;

  try {
    switch (req.method) {
      case 'GET':
        const budgets = await dbAdapter.getBudgets(userId);
        return res.status(200).json(budgets);

      case 'POST':
      case 'PUT':
        const budgetsObj = req.body || {};
        const saved = await dbAdapter.saveBudgets(userId, budgetsObj);
        return res.status(200).json(saved);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Budgets handler error:', error);
    return res.status(500).json({ error: 'Server database error' });
  }
}
