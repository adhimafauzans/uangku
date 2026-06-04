import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const MONGODB_URI = process.env.MONGODB_URI;
const LOCAL_DB_PATH = path.join(process.cwd(), 'local_db.json');

// --- MONGO DB CONNECTOR ---
let client;
let db;

async function connectToMongo() {
  if (db) return db;
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  db = client.db('sakukita');
  return db;
}

// --- LOCAL FILE DATABASE FALLBACK LOGIC ---
function readLocalDb() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initialDb = { users: [], transactions: [], budgets: [], settings: [] };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
    return initialDb;
  }
  try {
    const content = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Error reading local db, returning blank template', e);
    return { users: [], transactions: [], budgets: [], settings: [] };
  }
}

function writeLocalDb(data) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// --- DATABASE INTERFACES ---

export const dbAdapter = {
  // USER COLLECTION
  async getUserByUsername(username) {
    if (MONGODB_URI) {
      const database = await connectToMongo();
      return await database.collection('users').findOne({ username: username.toLowerCase() });
    } else {
      const data = readLocalDb();
      return data.users.find(u => u.username === username.toLowerCase()) || null;
    }
  },

  async createUser(userObj) {
    const newUser = {
      id: 'usr-' + Math.random().toString(36).substr(2, 9),
      username: userObj.username.toLowerCase(),
      passwordHash: userObj.passwordHash,
      createdAt: new Date().toISOString()
    };

    if (MONGODB_URI) {
      const database = await connectToMongo();
      await database.collection('users').insertOne(newUser);
      return newUser;
    } else {
      const data = readLocalDb();
      data.users.push(newUser);
      writeLocalDb(data);
      return newUser;
    }
  },

  // TRANSACTIONS COLLECTION
  async getTransactions(userId) {
    if (MONGODB_URI) {
      const database = await connectToMongo();
      return await database.collection('transactions').find({ userId }).toArray();
    } else {
      const data = readLocalDb();
      return data.transactions.filter(t => t.userId === userId);
    }
  },

  async createTransaction(userId, tx) {
    const newTx = {
      id: 'tx-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36),
      userId,
      type: tx.type,
      amount: Number(tx.amount),
      category: tx.category,
      date: tx.date,
      note: tx.note || '',
      createdAt: new Date().toISOString()
    };

    if (MONGODB_URI) {
      const database = await connectToMongo();
      await database.collection('transactions').insertOne(newTx);
      return newTx;
    } else {
      const data = readLocalDb();
      data.transactions.push(newTx);
      writeLocalDb(data);
      return newTx;
    }
  },

  async updateTransaction(userId, txId, txUpdate) {
    if (MONGODB_URI) {
      const database = await connectToMongo();
      const result = await database.collection('transactions').findOneAndUpdate(
        { id: txId, userId },
        { 
          $set: { 
            type: txUpdate.type,
            amount: Number(txUpdate.amount),
            category: txUpdate.category,
            date: txUpdate.date,
            note: txUpdate.note || '',
            updatedAt: new Date().toISOString()
          } 
        },
        { returnDocument: 'after' }
      );
      return result;
    } else {
      const data = readLocalDb();
      const idx = data.transactions.findIndex(t => t.id === txId && t.userId === userId);
      if (idx === -1) return null;
      
      data.transactions[idx] = {
        ...data.transactions[idx],
        type: txUpdate.type,
        amount: Number(txUpdate.amount),
        category: txUpdate.category,
        date: txUpdate.date,
        note: txUpdate.note || '',
        updatedAt: new Date().toISOString()
      };
      writeLocalDb(data);
      return data.transactions[idx];
    }
  },

  async deleteTransaction(userId, txId) {
    if (MONGODB_URI) {
      const database = await connectToMongo();
      const result = await database.collection('transactions').deleteOne({ id: txId, userId });
      return result.deletedCount > 0;
    } else {
      const data = readLocalDb();
      const initialLength = data.transactions.length;
      data.transactions = data.transactions.filter(t => !(t.id === txId && t.userId === userId));
      writeLocalDb(data);
      return data.transactions.length < initialLength;
    }
  },

  // BUDGETS CONFIGURATION
  async getBudgets(userId) {
    if (MONGODB_URI) {
      const database = await connectToMongo();
      const doc = await database.collection('budgets').findOne({ userId });
      return doc ? doc.budgets : {};
    } else {
      const data = readLocalDb();
      const doc = data.budgets.find(b => b.userId === userId);
      return doc ? doc.budgets : {};
    }
  },

  async saveBudgets(userId, budgetsObj) {
    if (MONGODB_URI) {
      const database = await connectToMongo();
      await database.collection('budgets').updateOne(
        { userId },
        { $set: { budgets: budgetsObj, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return budgetsObj;
    } else {
      const data = readLocalDb();
      const idx = data.budgets.findIndex(b => b.userId === userId);
      const doc = { userId, budgets: budgetsObj, updatedAt: new Date().toISOString() };
      
      if (idx !== -1) {
        data.budgets[idx] = doc;
      } else {
        data.budgets.push(doc);
      }
      writeLocalDb(data);
      return budgetsObj;
    }
  },

  // SETTINGS CONFIGURATION (INCOME & THEME)
  async getSettings(userId) {
    const defaultSettings = { defaultIncome: 10000000, theme: 'light', currency: 'Rp' };
    if (MONGODB_URI) {
      const database = await connectToMongo();
      const doc = await database.collection('settings').findOne({ userId });
      return doc ? { ...defaultSettings, ...doc.settings } : defaultSettings;
    } else {
      const data = readLocalDb();
      const doc = data.settings.find(s => s.userId === userId);
      return doc ? { ...defaultSettings, ...doc.settings } : defaultSettings;
    }
  },

  async saveSettings(userId, settingsObj) {
    if (MONGODB_URI) {
      const database = await connectToMongo();
      await database.collection('settings').updateOne(
        { userId },
        { $set: { settings: settingsObj, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return settingsObj;
    } else {
      const data = readLocalDb();
      const idx = data.settings.findIndex(s => s.userId === userId);
      const doc = { userId, settings: settingsObj, updatedAt: new Date().toISOString() };
      
      if (idx !== -1) {
        data.settings[idx] = doc;
      } else {
        data.settings.push(doc);
      }
      writeLocalDb(data);
      return settingsObj;
    }
  }
};
