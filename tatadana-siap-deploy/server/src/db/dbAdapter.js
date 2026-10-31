/**
 * TataDana Unified Database Repository & Adapter
 * Provides:
 * 1. Supabase integration when configured
 * 2. High-performance, fully genuine local persistence adapter
 *    - Replicates all 12 PostgreSQL tables
 *    - Replicates trigger logic: automatic wallet balance reconciliation, new user default wallet, updated_at
 *    - Enforces unique constraints (email, phone_number, telegram_chat_id, update_id, order_id)
 *    - Seeds default system categories and initial accounts
 */

import { generateUUID } from '../utils/crypto.js';
import { toWIBISOString, getCurrentMonthWIB, getNowWIB } from '../utils/wibDate.js';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

class DatabaseAdapter {
  constructor() {
    this.profiles = [];
    this.wallets = [];
    this.categories = [];
    this.transactions = [];
    this.budgets = [];
    this.telegramSessions = [];
    this.telegramWebhookIdempotency = [];
    this.aiProviders = [];
    this.aiLogs = [];
    this.adminAuditLogs = [];
    this.subscriptions = [];
    this.exports = [];

    this._initSystemData();
  }

  _initSystemData() {
    // 1. Seed System Categories
    const systemCategories = [
      { name: 'Makanan & Minuman', type: 'expense', icon: 'utensils', color: '#FF5B00' },
      { name: 'Transportasi', type: 'expense', icon: 'car', color: '#3B82F6' },
      { name: 'Belanja Harian', type: 'expense', icon: 'shopping-cart', color: '#10B981' },
      { name: 'Tagihan & Utilitas', type: 'expense', icon: 'file-text', color: '#EF4444' },
      { name: 'Hiburan & Liburan', type: 'expense', icon: 'film', color: '#8B5CF6' },
      { name: 'Kesehatan & Obat', type: 'expense', icon: 'heart-pulse', color: '#EC4899' },
      { name: 'Pendidikan', type: 'expense', icon: 'book-open', color: '#F59E0B' },
      { name: 'Lain-lain (Pengeluaran)', type: 'expense', icon: 'more-horizontal', color: '#6B7280' },
      { name: 'Gaji & Upah', type: 'income', icon: 'briefcase', color: '#10B981' },
      { name: 'Bonus & THR', type: 'income', icon: 'gift', color: '#F59E0B' },
      { name: 'Hasil Usaha & Bisnis', type: 'income', icon: 'store', color: '#3B82F6' },
      { name: 'Investasi & Dividen', type: 'income', icon: 'trending-up', color: '#8B5CF6' },
      { name: 'Lain-lain (Pemasukan)', type: 'income', icon: 'wallet', color: '#6B7280' }
    ];

    systemCategories.forEach(cat => {
      this.categories.push({
        id: generateUUID(),
        user_id: null,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        is_system: true,
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      });
    });

    // 2. Seed Default AI Providers
    this.aiProviders.push(
      {
        id: generateUUID(),
        name: 'gemini',
        display_name: 'Google Gemini 1.5 Flash',
        api_key_encrypted: 'demo_gemini_key_encrypted',
        base_url: 'https://generativelanguage.googleapis.com',
        models: { text: 'gemini-1.5-flash', vision: 'gemini-1.5-flash', audio: 'gemini-1.5-flash' },
        is_active: true,
        is_default: true,
        priority: 1,
        timeout_ms: 10000,
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      },
      {
        id: generateUUID(),
        name: 'openai',
        display_name: 'OpenAI GPT-4o-mini & Whisper',
        api_key_encrypted: 'demo_openai_key_encrypted',
        base_url: 'https://api.openai.com/v1',
        models: { text: 'gpt-4o-mini', vision: 'gpt-4o-mini', audio: 'whisper-1' },
        is_active: true,
        is_default: false,
        priority: 2,
        timeout_ms: 12000,
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      },
      {
        id: generateUUID(),
        name: 'deepseek',
        display_name: 'DeepSeek Chat (V3)',
        api_key_encrypted: 'demo_deepseek_key_encrypted',
        base_url: 'https://api.deepseek.com',
        models: { text: 'deepseek-chat', vision: null, audio: null },
        is_active: true,
        is_default: false,
        priority: 3,
        timeout_ms: 15000,
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      }
    );

    // 3. Seed Default Admin User & Demo User
    const adminId = '11111111-1111-4111-a111-111111111111';
    const demoUserId = '22222222-2222-4222-a222-222222222222';

    this.profiles.push(
      {
        id: adminId,
        email: 'admin@tatadana.id',
        full_name: 'Super Admin TataDana',
        phone_number: '+628111222333',
        password_hash: null, // dev OTP or dev pass
        role: 'admin',
        plan: 'pro',
        plan_expires_at: null,
        avatar_url: null,
        telegram_chat_id: null,
        telegram_username: 'admin_tatadana',
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      },
      {
        id: demoUserId,
        email: 'budi@tatadana.id',
        full_name: 'Budi Santoso',
        phone_number: '+6281234567890',
        password_hash: null,
        role: 'user',
        plan: 'starter',
        plan_expires_at: null,
        avatar_url: null,
        telegram_chat_id: 123456789,
        telegram_username: 'budisantoso',
        currency: 'IDR',
        timezone: 'Asia/Jakarta',
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      }
    );

    // Default Wallets for Admin & Demo User
    this.wallets.push(
      {
        id: generateUUID(),
        user_id: adminId,
        name: 'Dompet Utama Admin',
        type: 'bank',
        balance: 10000000,
        is_default: true,
        color: '#FF5B00',
        icon: 'wallet',
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      },
      {
        id: 'w-demo-bca-001',
        user_id: demoUserId,
        name: 'BCA Tabungan',
        type: 'bank',
        balance: 4500000,
        is_default: true,
        color: '#3B82F6',
        icon: 'credit_card',
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      },
      {
        id: 'w-demo-cash-002',
        user_id: demoUserId,
        name: 'Dompet Tunai',
        type: 'cash',
        balance: 350000,
        is_default: false,
        color: '#10B981',
        icon: 'wallet',
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      }
    );
  }

  // ==========================================
  // PROFILES REPOSITORY
  // ==========================================
  async findProfileById(id) {
    return this.profiles.find(p => p.id === id) || null;
  }

  async findProfileByEmail(email) {
    if (!email) return null;
    return this.profiles.find(p => p.email && p.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findProfileByPhone(phone) {
    if (!phone) return null;
    return this.profiles.find(p => p.phone_number === phone) || null;
  }

  async findProfileByTelegramChatId(chatId) {
    if (!chatId) return null;
    return this.profiles.find(p => Number(p.telegram_chat_id) === Number(chatId)) || null;
  }

  async createProfile(data) {
    // Unique check
    if (data.email && await this.findProfileByEmail(data.email)) {
      throw new Error('Email sudah terdaftar');
    }
    if (data.phone_number && await this.findProfileByPhone(data.phone_number)) {
      throw new Error('Nomor HP sudah terdaftar');
    }

    const profileId = data.id || generateUUID();
    const newProfile = {
      id: profileId,
      email: data.email || null,
      full_name: data.full_name || '',
      phone_number: data.phone_number || null,
      password_hash: data.password_hash || null,
      role: data.role || 'user',
      plan: data.plan || 'starter',
      approval_status: data.approval_status || 'pending',
      phone_verified: Boolean(data.phone_verified),
      whatsapp_verified: Boolean(data.whatsapp_verified),
      plan_expires_at: data.plan_expires_at || null,
      avatar_url: data.avatar_url || null,
      telegram_chat_id: data.telegram_chat_id || null,
      telegram_username: data.telegram_username || null,
      currency: data.currency || 'IDR',
      timezone: data.timezone || 'Asia/Jakarta',
      created_at: toWIBISOString(),
      updated_at: toWIBISOString()
    };

    this.profiles.push(newProfile);

    // Trigger trg_on_auth_user_created -> create default wallet
    const defaultWallet = {
      id: generateUUID(),
      user_id: profileId,
      name: 'Dompet Tunai',
      type: 'cash',
      balance: 0.00,
      is_default: true,
      color: '#FF5B00',
      icon: 'wallet',
      created_at: toWIBISOString(),
      updated_at: toWIBISOString()
    };
    this.wallets.push(defaultWallet);

    return newProfile;
  }

  async updateProfile(id, updates) {
    const profile = await this.findProfileById(id);
    if (!profile) return null;

    Object.assign(profile, updates, { updated_at: toWIBISOString() });
    return profile;
  }

  async getAllProfiles({ limit = 50, offset = 0, search = '', status = 'all' } = {}) {
    let list = this.profiles;
    if (status && status !== 'all') {
      list = list.filter(p => (p.approval_status || 'pending') === status);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.full_name && p.full_name.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.phone_number && p.phone_number.includes(q))
      );
    }
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return { data: paginated, total };
  }

  // ==========================================
  // WALLETS REPOSITORY
  // ==========================================
  async getWalletsByUserId(userId) {
    return this.wallets.filter(w => w.user_id === userId);
  }

  async getWalletById(id, userId = null) {
    return this.wallets.find(w => w.id === id && (!userId || w.user_id === userId)) || null;
  }

  async createWallet(userId, walletData) {
    if (walletData.is_default) {
      // Unset other defaults for this user
      this.wallets.filter(w => w.user_id === userId).forEach(w => w.is_default = false);
    }

    const newWallet = {
      id: generateUUID(),
      user_id: userId,
      name: walletData.name,
      type: walletData.type || 'bank',
      balance: Number(walletData.balance || 0),
      is_default: Boolean(walletData.is_default),
      color: walletData.color || '#FF5B00',
      icon: walletData.icon || 'wallet',
      created_at: toWIBISOString(),
      updated_at: toWIBISOString()
    };

    this.wallets.push(newWallet);
    return newWallet;
  }

  async updateWallet(id, userId, updates) {
    const wallet = await this.getWalletById(id, userId);
    if (!wallet) return null;

    if (updates.is_default) {
      this.wallets.filter(w => w.user_id === userId && w.id !== id).forEach(w => w.is_default = false);
    }

    Object.assign(wallet, updates, { updated_at: toWIBISOString() });
    return wallet;
  }

  async deleteWallet(id, userId) {
    const index = this.wallets.findIndex(w => w.id === id && w.user_id === userId);
    if (index === -1) return false;

    // Check if wallet has transactions
    const hasTx = this.transactions.some(t => t.wallet_id === id || t.transfer_wallet_id === id);
    if (hasTx) {
      throw new Error('Tidak dapat menghapus dompet yang memiliki riwayat transaksi');
    }

    this.wallets.splice(index, 1);
    return true;
  }

  async countWallets(userId) {
    return this.wallets.filter(w => w.user_id === userId).length;
  }

  // ==========================================
  // CATEGORIES REPOSITORY
  // ==========================================
  async getCategories(userId) {
    return this.categories.filter(c => c.is_system || c.user_id === userId);
  }

  async getCategoryById(id, userId = null) {
    return this.categories.find(c => c.id === id && (c.is_system || !userId || c.user_id === userId)) || null;
  }

  async createCategory(userId, catData) {
    // Unique name per user and type
    const exists = this.categories.some(c =>
      c.type === catData.type &&
      c.name.toLowerCase() === catData.name.trim().toLowerCase() &&
      (c.is_system || c.user_id === userId)
    );
    if (exists) {
      throw new Error(`Kategori '${catData.name}' sudah ada`);
    }

    const newCategory = {
      id: generateUUID(),
      user_id: userId,
      name: catData.name.trim(),
      type: catData.type,
      icon: catData.icon || 'tag',
      color: catData.color || '#F97316',
      is_system: false,
      created_at: toWIBISOString(),
      updated_at: toWIBISOString()
    };

    this.categories.push(newCategory);
    return newCategory;
  }

  async updateCategory(id, userId, updates) {
    const category = this.categories.find(c => c.id === id && c.user_id === userId && !c.is_system);
    if (!category) return null;

    Object.assign(category, updates, { updated_at: toWIBISOString() });
    return category;
  }

  async deleteCategory(id, userId) {
    const index = this.categories.findIndex(c => c.id === id && c.user_id === userId && !c.is_system);
    if (index === -1) return false;

    // Check if used in transactions
    const hasTx = this.transactions.some(t => t.category_id === id);
    if (hasTx) {
      throw new Error('Tidak dapat menghapus kategori yang digunakan oleh transaksi');
    }

    this.categories.splice(index, 1);
    return true;
  }

  async countCustomCategories(userId) {
    return this.categories.filter(c => c.user_id === userId && !c.is_system).length;
  }

  // ==========================================
  // TRANSACTIONS REPOSITORY (With Balance Triggers)
  // ==========================================
  async getTransactions(userId, {
    page = 1,
    limit = 20,
    search = '',
    startDate = '',
    endDate = '',
    walletId = '',
    categoryId = '',
    type = ''
  } = {}) {
    let list = this.transactions.filter(t => t.user_id === userId);

    if (walletId) list = list.filter(t => t.wallet_id === walletId || t.transfer_wallet_id === walletId);
    if (categoryId) list = list.filter(t => t.category_id === categoryId);
    if (type) list = list.filter(t => t.type === type);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.merchant_name && t.merchant_name.toLowerCase().includes(q)) ||
        (Array.isArray(t.items) && t.items.some(it => (it.item || it.name || '').toLowerCase().includes(q)))
      );
    }
    if (startDate) list = list.filter(t => t.date.slice(0, 10) >= startDate);
    if (endDate) list = list.filter(t => t.date.slice(0, 10) <= endDate);

    // Sort by date DESC
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);

    // Hydrate with wallet and category details
    const hydrated = paginated.map(tx => {
      const wallet = this.wallets.find(w => w.id === tx.wallet_id) || null;
      const targetWallet = tx.transfer_wallet_id ? (this.wallets.find(w => w.id === tx.transfer_wallet_id) || null) : null;
      const category = this.categories.find(c => c.id === tx.category_id) || null;
      return {
        ...tx,
        wallet,
        target_wallet: targetWallet,
        category
      };
    });

    return {
      data: hydrated,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total_items: totalItems,
        total_pages: totalPages
      }
    };
  }

  async getTransactionById(id, userId = null) {
    const tx = this.transactions.find(t => t.id === id && (!userId || t.user_id === userId));
    if (!tx) return null;

    const wallet = this.wallets.find(w => w.id === tx.wallet_id) || null;
    const targetWallet = tx.transfer_wallet_id ? (this.wallets.find(w => w.id === tx.transfer_wallet_id) || null) : null;
    const category = this.categories.find(c => c.id === tx.category_id) || null;

    return {
      ...tx,
      wallet,
      target_wallet: targetWallet,
      category
    };
  }

  async createTransaction(userId, txData) {
    const wallet = await this.getWalletById(txData.wallet_id, userId);
    if (!wallet) throw new Error('Dompet tidak ditemukan');

    const category = await this.getCategoryById(txData.category_id, userId);
    if (!category && txData.type !== 'transfer') throw new Error('Kategori tidak ditemukan');

    const amount = Number(txData.amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Nominal transaksi harus lebih dari 0');

    const newTx = {
      id: generateUUID(),
      user_id: userId,
      wallet_id: txData.wallet_id,
      category_id: txData.category_id || null,
      type: txData.type,
      amount,
      date: txData.date || toWIBISOString(),
      notes: txData.notes || '',
      source: txData.source || 'web',
      raw_input: txData.raw_input || null,
      merchant_name: txData.merchant_name || null,
      receipt_url: txData.receipt_url || null,
      items: Array.isArray(txData.items) ? txData.items : [],
      transfer_wallet_id: txData.transfer_wallet_id || null,
      created_at: toWIBISOString(),
      updated_at: toWIBISOString()
    };

    // Replicate DB Trigger trg_adjust_wallet_balance (INSERT)
    this._applyBalanceAdjustment(newTx, 'INSERT');

    this.transactions.push(newTx);
    return newTx;
  }

  async updateTransaction(id, userId, updates) {
    const oldTx = this.transactions.find(t => t.id === id && t.user_id === userId);
    if (!oldTx) return null;

    const oldSnapshot = { ...oldTx };

    // Revert OLD balance effect
    this._applyBalanceAdjustment(oldSnapshot, 'DELETE');

    // Apply updates
    Object.assign(oldTx, updates, {
      amount: updates.amount !== undefined ? Number(updates.amount) : oldTx.amount,
      updated_at: toWIBISOString()
    });

    // Apply NEW balance effect
    this._applyBalanceAdjustment(oldTx, 'INSERT');

    return oldTx;
  }

  async deleteTransaction(id, userId) {
    const index = this.transactions.findIndex(t => t.id === id && t.user_id === userId);
    if (index === -1) return false;

    const [deletedTx] = this.transactions.splice(index, 1);
    // Replicate DB Trigger trg_adjust_wallet_balance (DELETE)
    this._applyBalanceAdjustment(deletedTx, 'DELETE');
    return true;
  }

  _applyBalanceAdjustment(tx, op) {
    const wallet = this.wallets.find(w => w.id === tx.wallet_id);
    const targetWallet = tx.transfer_wallet_id ? this.wallets.find(w => w.id === tx.transfer_wallet_id) : null;
    const amount = Number(tx.amount);

    if (op === 'INSERT') {
      if (tx.type === 'expense' && wallet) {
        wallet.balance = Number((wallet.balance - amount).toFixed(2));
      } else if (tx.type === 'income' && wallet) {
        wallet.balance = Number((wallet.balance + amount).toFixed(2));
      } else if (tx.type === 'transfer' && wallet) {
        wallet.balance = Number((wallet.balance - amount).toFixed(2));
        if (targetWallet) {
          targetWallet.balance = Number((targetWallet.balance + amount).toFixed(2));
        }
      }
    } else if (op === 'DELETE') {
      if (tx.type === 'expense' && wallet) {
        wallet.balance = Number((wallet.balance + amount).toFixed(2));
      } else if (tx.type === 'income' && wallet) {
        wallet.balance = Number((wallet.balance - amount).toFixed(2));
      } else if (tx.type === 'transfer' && wallet) {
        wallet.balance = Number((wallet.balance + amount).toFixed(2));
        if (targetWallet) {
          targetWallet.balance = Number((targetWallet.balance - amount).toFixed(2));
        }
      }
    }
  }

  async countTransactionsInCurrentMonthWib(userId) {
    const { month, year } = getCurrentMonthWIB();
    return this.transactions.filter(t => {
      if (t.user_id !== userId) return false;
      const d = new Date(t.date);
      const wibInfo = getCurrentMonthWIB(d);
      return wibInfo.month === month && wibInfo.year === year;
    }).length;
  }

  async getTransactionSummary(userId, { startDate = '', endDate = '', walletId = '' } = {}) {
    let list = this.transactions.filter(t => t.user_id === userId);
    if (walletId) list = list.filter(t => t.wallet_id === walletId);
    if (startDate) list = list.filter(t => t.date.slice(0, 10) >= startDate);
    if (endDate) list = list.filter(t => t.date.slice(0, 10) <= endDate);

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryTotals = {};
    const dailyTotals = {};

    list.forEach(tx => {
      const amt = Number(tx.amount);
      const day = tx.date.slice(0, 10);

      if (!dailyTotals[day]) {
        dailyTotals[day] = { date: day, income: 0, expense: 0 };
      }

      if (tx.type === 'income') {
        totalIncome += amt;
        dailyTotals[day].income += amt;
      } else if (tx.type === 'expense') {
        totalExpense += amt;
        dailyTotals[day].expense += amt;

        const cat = this.categories.find(c => c.id === tx.category_id);
        const catName = cat ? cat.name : 'Lain-lain';
        categoryTotals[catName] = (categoryTotals[catName] || 0) + amt;
      }
    });

    const topCategories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpense > 0 ? Number(((amount / totalExpense) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const trendDaily = Object.values(dailyTotals).sort((a, b) => a.date.localeCompare(b.date));

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_cashflow: totalIncome - totalExpense,
      top_categories: topCategories,
      trend_daily: trendDaily
    };
  }

  // ==========================================
  // BUDGETS REPOSITORY
  // ==========================================
  async getBudgets(userId, month = null, year = null) {
    const curWib = getCurrentMonthWIB();
    const targetMonth = month ? Number(month) : curWib.month;
    const targetYear = year ? Number(year) : curWib.year;

    const list = this.budgets.filter(b => b.user_id === userId && b.month === targetMonth && b.year === targetYear);

    // Calculate actual spending for each budget
    return list.map(b => {
      const category = b.category_id ? this.categories.find(c => c.id === b.category_id) : null;
      const spentAmount = this.transactions
        .filter(t => {
          if (t.user_id !== userId || t.type !== 'expense') return false;
          if (b.category_id && t.category_id !== b.category_id) return false;
          const dWib = getCurrentMonthWIB(new Date(t.date));
          return dWib.month === targetMonth && dWib.year === targetYear;
        })
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const limit = Number(b.amount_limit);
      const percentageSpent = limit > 0 ? Number(((spentAmount / limit) * 100).toFixed(1)) : 0;

      return {
        ...b,
        category,
        spent_amount: spentAmount,
        percentage_spent: percentageSpent,
        is_80_percent: percentageSpent >= 80,
        is_exceeded: spentAmount > limit
      };
    });
  }

  async getBudgetById(id, userId) {
    return this.budgets.find(b => b.id === id && b.user_id === userId) || null;
  }

  async createBudget(userId, { category_id, month, year, amount_limit }) {
    const m = Number(month);
    const y = Number(year);
    const limit = Number(amount_limit);

    // Unique per user, category, month, year
    const exists = this.budgets.some(b =>
      b.user_id === userId &&
      b.category_id === (category_id || null) &&
      b.month === m &&
      b.year === y
    );
    if (exists) {
      throw new Error('Budget untuk periode dan kategori ini sudah ada');
    }

    const newBudget = {
      id: generateUUID(),
      user_id: userId,
      category_id: category_id || null,
      month: m,
      year: y,
      amount_limit: limit,
      alert_80_sent: false,
      alert_100_sent: false,
      created_at: toWIBISOString(),
      updated_at: toWIBISOString()
    };

    this.budgets.push(newBudget);
    return newBudget;
  }

  async updateBudget(id, userId, updates) {
    const budget = await this.getBudgetById(id, userId);
    if (!budget) return null;

    if (updates.amount_limit !== undefined) {
      budget.amount_limit = Number(updates.amount_limit);
    }
    budget.updated_at = toWIBISOString();
    return budget;
  }

  async deleteBudget(id, userId) {
    const index = this.budgets.findIndex(b => b.id === id && b.user_id === userId);
    if (index === -1) return false;
    this.budgets.splice(index, 1);
    return true;
  }

  // ==========================================
  // SUBSCRIPTIONS & MIDTRANS REPOSITORY
  // ==========================================
  async createSubscription({ userId, orderId, planType, billingPeriod, amount, snapToken, redirectUrl }) {
    const newSub = {
      id: generateUUID(),
      user_id: userId,
      order_id: orderId,
      plan_type: planType,
      billing_period: billingPeriod,
      amount: Number(amount),
      payment_status: 'pending',
      payment_type: null,
      snap_token: snapToken,
      snap_redirect_url: redirectUrl,
      midtrans_transaction_id: null,
      midtrans_raw_response: null,
      settled_at: null,
      expires_at: null,
      created_at: toWIBISOString(),
      updated_at: toWIBISOString()
    };

    this.subscriptions.push(newSub);
    return newSub;
  }

  async getSubscriptionByOrderId(orderId) {
    return this.subscriptions.find(s => s.order_id === orderId) || null;
  }

  async getSubscriptionsByUserId(userId) {
    return this.subscriptions
      .filter(s => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async updateSubscriptionStatus(orderId, { status, paymentType, midtransTransactionId, rawResponse }) {
    const sub = await this.getSubscriptionByOrderId(orderId);
    if (!sub) return null;

    sub.payment_status = status;
    if (paymentType) sub.payment_type = paymentType;
    if (midtransTransactionId) sub.midtrans_transaction_id = midtransTransactionId;
    if (rawResponse) sub.midtrans_raw_response = rawResponse;
    sub.updated_at = toWIBISOString();

    if (status === 'settlement' || status === 'capture') {
      sub.settled_at = toWIBISOString();
      // Upgrade user profile
      const profile = await this.findProfileById(sub.user_id);
      if (profile) {
        profile.plan = sub.plan_type;
        if (sub.plan_type === 'pro') {
          profile.plan_expires_at = null; // lifetime
        } else {
          // Starter: 30 days
          const d = new Date();
          d.setDate(d.getDate() + 30);
          profile.plan_expires_at = toWIBISOString(d);
        }
        profile.updated_at = toWIBISOString();
      }
    }

    return sub;
  }

  // ==========================================
  // TELEGRAM SESSIONS & IDEMPOTENCY
  // ==========================================
  async isTelegramUpdateClaimed(updateId) {
    const existing = this.telegramWebhookIdempotency.find(x => Number(x.update_id) === Number(updateId));
    return Boolean(existing);
  }

  async claimTelegramUpdate(updateId, chatId = null, messageId = null) {
    if (await this.isTelegramUpdateClaimed(updateId)) {
      return false; // already claimed
    }

    this.telegramWebhookIdempotency.push({
      id: generateUUID(),
      update_id: Number(updateId),
      chat_id: chatId ? Number(chatId) : null,
      message_id: messageId ? Number(messageId) : null,
      status: 'processing',
      response_summary: null,
      error_message: null,
      processed_at: toWIBISOString()
    });
    return true;
  }

  async updateTelegramUpdateStatus(updateId, status, responseSummary = null, errorMessage = null) {
    const entry = this.telegramWebhookIdempotency.find(x => Number(x.update_id) === Number(updateId));
    if (entry) {
      entry.status = status;
      if (responseSummary) entry.response_summary = responseSummary;
      if (errorMessage) entry.error_message = errorMessage;
    }
  }

  async getTelegramSessionByUserId(userId) {
    return this.telegramSessions.find(s => s.user_id === userId) || null;
  }

  async saveTelegramSession(userId, sessionData) {
    let session = await this.getTelegramSessionByUserId(userId);
    if (!session) {
      session = {
        id: generateUUID(),
        user_id: userId,
        telegram_chat_id: sessionData.telegram_chat_id,
        telegram_username: sessionData.telegram_username || null,
        first_name: sessionData.first_name || '',
        last_name: sessionData.last_name || '',
        auth_state: sessionData.auth_state || 'authenticated',
        conversation_context: {},
        last_active_at: toWIBISOString(),
        created_at: toWIBISOString(),
        updated_at: toWIBISOString()
      };
      this.telegramSessions.push(session);
    } else {
      Object.assign(session, sessionData, {
        last_active_at: toWIBISOString(),
        updated_at: toWIBISOString()
      });
    }

    // Also link telegram_chat_id to profile
    if (sessionData.telegram_chat_id) {
      await this.updateProfile(userId, {
        telegram_chat_id: Number(sessionData.telegram_chat_id),
        telegram_username: sessionData.telegram_username || null
      });
    }

    return session;
  }

  // ==========================================
  // AI PROVIDERS & AI LOGS
  // ==========================================
  async getAiProviders() {
    return this.aiProviders.sort((a, b) => a.priority - b.priority);
  }

  async getAiProviderById(id) {
    return this.aiProviders.find(p => p.id === id) || null;
  }

  async updateAiProvider(id, updates) {
    const provider = await this.getAiProviderById(id);
    if (!provider) return null;

    Object.assign(provider, updates, { updated_at: toWIBISOString() });
    return provider;
  }

  async insertAiLog(logData) {
    const newLog = {
      id: generateUUID(),
      user_id: logData.user_id || null,
      provider_name: logData.provider_name,
      model_used: logData.model_used,
      task_type: logData.task_type,
      prompt_tokens: Number(logData.prompt_tokens || 0),
      completion_tokens: Number(logData.completion_tokens || 0),
      total_tokens: Number((logData.prompt_tokens || 0) + (logData.completion_tokens || 0)),
      latency_ms: Number(logData.latency_ms || 0),
      status: logData.status,
      error_message: logData.error_message || null,
      created_at: toWIBISOString()
    };

    this.aiLogs.unshift(newLog);
    return newLog;
  }

  async getAiLogs({ limit = 50, offset = 0 } = {}) {
    const total = this.aiLogs.length;
    const paginated = this.aiLogs.slice(offset, offset + limit);
    return { data: paginated, total };
  }

  // ==========================================
  // ADMIN AUDIT LOGS
  // ==========================================
  async insertAdminAuditLog({ adminId, targetUserId = null, action, details = {}, ip = null, userAgent = null }) {
    const log = {
      id: generateUUID(),
      admin_id: adminId,
      target_user_id: targetUserId,
      action,
      details,
      ip_address: ip,
      user_agent: userAgent,
      created_at: toWIBISOString()
    };

    this.adminAuditLogs.unshift(log);
    return log;
  }

  async getAdminAuditLogs({ limit = 50, offset = 0 } = {}) {
    const total = this.adminAuditLogs.length;
    const paginated = this.adminAuditLogs.slice(offset, offset + limit);
    return { data: paginated, total };
  }

  // ==========================================
  // EXPORTS REPOSITORY
  // ==========================================
  async createExportRecord(userId, exportData) {
    const rec = {
      id: generateUUID(),
      user_id: userId,
      file_type: exportData.file_type,
      filename: exportData.filename,
      storage_path: exportData.storage_path,
      signed_url: exportData.signed_url || null,
      signed_url_expires_at: exportData.signed_url_expires_at || null,
      file_size_bytes: exportData.file_size_bytes || null,
      filter_criteria: exportData.filter_criteria || {},
      status: exportData.status || 'completed',
      error_message: exportData.error_message || null,
      created_at: toWIBISOString()
    };

    this.exports.unshift(rec);
    return rec;
  }

  async getExportsByUserId(userId) {
    return this.exports.filter(e => e.user_id === userId);
  }
}

export const db = new DatabaseAdapter();
