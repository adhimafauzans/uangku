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
  if (!user) return; // Unauthorized response already sent by middleware

  const { userId } = user;

  try {
    switch (req.method) {
      case 'GET':
        const transactions = await dbAdapter.getTransactions(userId);
        return res.status(200).json(transactions);

      case 'POST':
        const { type, amount, category, date, note } = req.body || {};
        if (!type || !amount || !category || !date) {
          return res.status(400).json({ error: 'Missing required transaction fields' });
        }
        
        const newTx = await dbAdapter.createTransaction(userId, {
          type,
          amount,
          category,
          date,
          note
        });
        return res.status(201).json(newTx);

      case 'PUT':
        const { id, type: uType, amount: uAmount, category: uCategory, date: uDate, note: uNote } = req.body || {};
        if (!id || !uType || !uAmount || !uCategory || !uDate) {
          return res.status(400).json({ error: 'Missing update transaction parameters' });
        }

        const updatedTx = await dbAdapter.updateTransaction(userId, id, {
          type: uType,
          amount: uAmount,
          category: uCategory,
          date: uDate,
          note: uNote
        });
        
        if (!updatedTx) {
          return res.status(404).json({ error: 'Transaction not found or unauthorized' });
        }
        return res.status(200).json(updatedTx);

      case 'DELETE':
        const txId = req.query.id;
        if (!txId) {
          return res.status(400).json({ error: 'Transaction ID is required' });
        }

        const deleted = await dbAdapter.deleteTransaction(userId, txId);
        if (!deleted) {
          return res.status(404).json({ error: 'Transaction not found or unauthorized' });
        }
        return res.status(200).json({ message: 'Transaction deleted successfully', id: txId });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Transactions handler error:', error);
    return res.status(500).json({ error: 'Server database error' });
  }
}
