// server/db.js
// High-performance Database Layer for TataDana
// Features: Supabase Client Integration + Reactive In-Memory Database for local dev & demo

const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: require('crypto').randomUUID } : { v4: () => Math.random().toString(36).substring(2) + Date.now().toString(36) };
const { getCurrentMonthWIB, getWIBDate } = require('./utils/wib');

class DatabaseStore {
  constructor() {
    this.processedUpdates = new Set();
    this.profiles = [];
    this.subscriptions = [];
    this.wallets = [];
    this.categories = [];
    this.budgets = [];
    this.transactions = [];
    this.receiptItems = [];
    this.telegramSessions = [];
    this.aiProviders = [];
    this.aiLogs = [];
    this.adminAuditLogs = [];
    this.payments = [];
    this.exports = [];

    this._initSeedData();
  }

  _initSeedData() {
    const demoUserId = 'usr-demo-001';
    const adminUserId = 'usr-admin-001';

    // 1. Profiles
    this.profiles.push({
      id: demoUserId,
      email: 'budi@tatadana.id',
      phone_number: '+6281234567890',
      phone_verified: true,
      full_name: 'Budi Santoso',
      role: 'user',
      default_currency: 'IDR',
      created_at: new Date().toISOString()
    });

    this.profiles.push({
      id: adminUserId,
      email: 'admin@tatadana.id',
      phone_number: '+628111222333',
      phone_verified: true,
      full_name: 'Super Admin TataDana',
      role: 'superadmin',
      default_currency: 'IDR',
      created_at: new Date().toISOString()
    });

    // 2. Subscriptions
    this.subscriptions.push({
      id: 'sub-001',
      user_id: demoUserId,
      plan_tier: 'starter',
      billing_type: 'monthly',
      status: 'active',
      monthly_tx_limit: 50,
      wallet_limit: 3,
      budget_limit: 5,
      ai_ocr_enabled: false,
      ai_advisor_enabled: false,
      advanced_export_enabled: false
    });

    // 3. Wallets
    this.wallets.push(
      { id: 'w-001', user_id: demoUserId, name: 'BCA Tabungan', wallet_type: 'bank', balance: 4250000, is_default_telegram: true, color: '#FF5B00', icon: '🏦' },
      { id: 'w-002', user_id: demoUserId, name: 'Tunai (Cash)', wallet_type: 'cash', balance: 350000, is_default_telegram: false, color: '#10B981', icon: '💵' },
      { id: 'w-003', user_id: demoUserId, name: 'GoPay', wallet_type: 'ewallet', balance: 185000, is_default_telegram: false, color: '#00AED6', icon: '📱' }
    );

    // 4. Categories
    const defaultCats = [
      { id: 'cat-01', user_id: demoUserId, name: 'Makanan & Minuman', type: 'expense', icon: '🍜', color: '#F97316' },
      { id: 'cat-02', user_id: demoUserId, name: 'Transportasi', type: 'expense', icon: '🚗', color: '#3B82F6' },
      { id: 'cat-03', user_id: demoUserId, name: 'Tagihan & Utilitas', type: 'expense', icon: '🏠', color: '#8B5CF6' },
      { id: 'cat-04', user_id: demoUserId, name: 'Belanja Kebutuhan', type: 'expense', icon: '👕', color: '#EC4899' },
      { id: 'cat-05', user_id: demoUserId, name: 'Hiburan & Hobi', type: 'expense', icon: '🎮', color: '#10B981' },
      { id: 'cat-06', user_id: demoUserId, name: 'Gaji & Pendapatan', type: 'income', icon: '💰', color: '#059669' },
      { id: 'cat-07', user_id: demoUserId, name: 'Bonus & Freelance', type: 'income', icon: '💼', color: '#0D9488' }
    ];
    this.categories.push(...defaultCats);

    // 5. Budgets
    const currentMonth = getCurrentMonthWIB();
    this.budgets.push(
      { id: 'bg-01', user_id: demoUserId, category_id: 'cat-01', amount: 1500000, month_period: currentMonth, spent_amount: 850000 },
      { id: 'bg-02', user_id: demoUserId, category_id: 'cat-02', amount: 600000, month_period: currentMonth, spent_amount: 320000 },
      { id: 'bg-03', user_id: demoUserId, category_id: 'cat-03', amount: 1000000, month_period: currentMonth, spent_amount: 750000 }
    );

    // 6. Transactions
    this.transactions.push(
      { id: 'tx-001', user_id: demoUserId, wallet_id: 'w-001', category_id: 'cat-06', type: 'pemasukan', amount: 6500000, notes: 'Gaji Bulanan', source: 'web', transaction_date: '2026-10-01T09:00:00+07:00' },
      { id: 'tx-002', user_id: demoUserId, wallet_id: 'w-001', category_id: 'cat-01', type: 'pengeluaran', amount: 45000, notes: 'Makan Siang Sate Ayam', source: 'telegram_text', transaction_date: '2026-10-08T12:30:00+07:00' },
      { id: 'tx-003', user_id: demoUserId, wallet_id: 'w-003', category_id: 'cat-02', type: 'pengeluaran', amount: 28000, notes: 'Gojek ke Kantor', source: 'telegram_text', transaction_date: '2026-10-09T08:15:00+07:00' },
      {
        id: 'tx-004',
        user_id: demoUserId,
        wallet_id: 'w-001',
        category_id: 'cat-04',
        type: 'pengeluaran',
        amount: 87500,
        notes: 'Belanja Indomaret Point',
        merchant_name: 'Indomaret Point',
        source: 'telegram_photo',
        is_receipt_parent: true,
        transaction_date: '2026-10-10T10:00:00+07:00'
      }
    );

    // Receipt items for tx-004
    this.receiptItems.push(
      { id: 'ri-01', transaction_id: 'tx-004', item_name: 'Susu UHT 1L', quantity: 2, price_per_item: 20000, total_amount: 40000 },
      { id: 'ri-02', transaction_id: 'tx-004', item_name: 'Roti Gandum', quantity: 1, price_per_item: 17500, total_amount: 17500 },
      { id: 'ri-03', transaction_id: 'tx-004', item_name: 'Kopi Kaleng Latte', quantity: 3, price_per_item: 10000, total_amount: 30000 }
    );

    // 7. Telegram Session
    this.telegramSessions.push({
      user_id: demoUserId,
      telegram_user_id: 123456789,
      connection_status: 'connected',
      bot_token: 'DEMO_BOT_TOKEN',
      reminder_enabled: true,
      reminder_frequency: 1,
      reminder_time_1: '19:00:00'
    });

    // 8. AI Providers
    this.aiProviders.push(
      { id: 'aip-01', provider_name: 'gemini', is_enabled: true, is_primary: true, model_name: 'gemini-2.5-flash', mode: 'failover', priority_order: 1 },
      { id: 'aip-02', provider_name: 'openai', is_enabled: true, is_primary: false, model_name: 'gpt-4o-mini', mode: 'failover', priority_order: 2 },
      { id: 'aip-03', provider_name: 'deepseek', is_enabled: true, is_primary: false, model_name: 'deepseek-chat', mode: 'failover', priority_order: 3 }
    );
  }

  // Idempotency
  isUpdateProcessed(updateId) {
    if (updateId === undefined || updateId === null) return false;
    const num = Number(updateId);
    return !isNaN(num)
      ? (this.processedUpdates.has(num) || this.processedUpdates.has(String(updateId)))
      : this.processedUpdates.has(String(updateId));
  }

  markUpdateProcessed(updateId) {
    if (updateId === undefined || updateId === null) return;
    if (this.processedUpdates.size > 2000) {
      const kept = Array.from(this.processedUpdates).slice(-1000);
      this.processedUpdates = new Set(kept);
    }
    const num = Number(updateId);
    if (!isNaN(num)) {
      this.processedUpdates.add(num);
    }
    this.processedUpdates.add(String(updateId));
  }

  // Users
  getDefaultUser() {
    return { ...this.profiles[0], plan_tier: this.subscriptions[0]?.plan_tier || 'starter' };
  }

  getUser(userId) {
    const p = this.profiles.find(x => x.id === userId);
    if (!p) return null;
    const sub = this.subscriptions.find(x => x.user_id === userId);
    return { ...p, plan_tier: sub ? sub.plan_tier : 'starter' };
  }

  _normalizePhone(input) {
    if (!input) return '';
    let clean = input.replace(/[^0-9+]/g, '');
    if (clean.startsWith('0')) {
      clean = '+62' + clean.slice(1);
    } else if (clean.startsWith('62')) {
      clean = '+' + clean;
    } else if (!clean.startsWith('+62')) {
      clean = '+62' + clean;
    }
    return clean;
  }

  findUserByPhone(phone) {
    const clean = this._normalizePhone(phone);
    const p = this.profiles.find(x => this._normalizePhone(x.phone_number) === clean);
    if (!p) return null;
    const sub = this.subscriptions.find(x => x.user_id === p.id);
    return { ...p, plan_tier: sub ? sub.plan_tier : 'starter' };
  }

  findUserByEmail(email) {
    const p = this.profiles.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!p) return null;
    const sub = this.subscriptions.find(x => x.user_id === p.id);
    return { ...p, plan_tier: sub ? sub.plan_tier : 'starter' };
  }

  findUserByTelegramId(tgId) {
    const session = this.telegramSessions.find(x => x.telegram_user_id === Number(tgId));
    if (!session) return null;
    return this.getUser(session.user_id);
  }

  createUser({ email, phoneNumber, fullName, role = 'user' }) {
    const id = 'usr-' + Date.now();
    const user = {
      id,
      email,
      phone_number: this._normalizePhone(phoneNumber),
      phone_verified: true,
      full_name: fullName,
      role,
      default_currency: 'IDR',
      created_at: new Date().toISOString()
    };
    this.profiles.push(user);

    // Default starter plan
    this.subscriptions.push({
      id: 'sub-' + Date.now(),
      user_id: id,
      plan_tier: 'starter',
      billing_type: 'monthly',
      status: 'active',
      monthly_tx_limit: 50,
      wallet_limit: 3,
      budget_limit: 5,
      ai_ocr_enabled: false,
      ai_advisor_enabled: false,
      advanced_export_enabled: false
    });

    // Default wallets
    this.wallets.push(
      { id: 'w-c-' + id, user_id: id, name: 'Tunai (Cash)', wallet_type: 'cash', balance: 0, is_default_telegram: false, color: '#10B981', icon: '💵' },
      { id: 'w-b-' + id, user_id: id, name: 'BCA Tabungan', wallet_type: 'bank', balance: 0, is_default_telegram: true, color: '#FF5B00', icon: '🏦' }
    );

    // Default categories
    const initialCats = [
      { id: 'cat-1-' + id, user_id: id, name: 'Makanan & Minuman', type: 'expense', icon: '🍜', color: '#F97316' },
      { id: 'cat-2-' + id, user_id: id, name: 'Transportasi', type: 'expense', icon: '🚗', color: '#3B82F6' },
      { id: 'cat-3-' + id, user_id: id, name: 'Tagihan & Utilitas', type: 'expense', icon: '🏠', color: '#8B5CF6' },
      { id: 'cat-4-' + id, user_id: id, name: 'Gaji & Pendapatan', type: 'income', icon: '💰', color: '#059669' }
    ];
    this.categories.push(...initialCats);

    // Telegram session
    this.telegramSessions.push({
      user_id: id,
      connection_status: 'disconnected',
      reminder_enabled: true,
      reminder_frequency: 1
    });

    return { ...user, plan_tier: 'starter' };
  }

  // Wallets
  getUserWallets(userId) {
    return this.wallets.filter(w => w.user_id === userId);
  }

  getDefaultTelegramWallet(userId) {
    const w = this.wallets.find(w => w.user_id === userId && w.is_default_telegram);
    return w || this.wallets.find(w => w.user_id === userId) || this.wallets[0];
  }

  getWallet(walletId) {
    return this.wallets.find(w => w.id === walletId);
  }

  createWallet(userId, { name, wallet_type = 'bank', balance = 0, is_default_telegram = false, color = '#FF5B00', icon = '👛' }) {
    if (is_default_telegram) {
      this.wallets.filter(w => w.user_id === userId).forEach(w => w.is_default_telegram = false);
    }
    const w = {
      id: 'w-' + Date.now(),
      user_id: userId,
      name,
      wallet_type,
      balance: Number(balance) || 0,
      is_default_telegram,
      color,
      icon
    };
    this.wallets.push(w);
    return w;
  }

  // Categories
  getUserCategories(userId, type = null) {
    return this.categories.filter(c => c.user_id === userId && (!type || c.type === type));
  }

  findOrCreateCategory(userId, name, type = 'expense') {
    let cat = this.categories.find(c => c.user_id === userId && c.name.toLowerCase() === name.toLowerCase());
    if (!cat) {
      cat = {
        id: 'cat-' + Date.now(),
        user_id: userId,
        name,
        type,
        icon: type === 'income' ? '💰' : '🏷️',
        color: '#FF5B00',
        is_custom: true
      };
      this.categories.push(cat);
    }
    return cat;
  }

  // Transactions
  getMonthlyTransactionCount(userId) {
    const curMonth = getCurrentMonthWIB();
    return this.transactions.filter(t => t.user_id === userId && (t.transaction_date || '').startsWith(curMonth)).length;
  }

  createTransaction({ userId, walletId, categoryId, type, amount, notes = '', source = 'web', merchantName = null, isReceiptParent = false, items = [], rawTranscript = null }) {
    const txId = 'tx-' + Date.now();
    const tx = {
      id: txId,
      user_id: userId,
      wallet_id: walletId,
      category_id: categoryId,
      type,
      amount: Number(amount),
      notes,
      merchant_name: merchantName,
      source,
      is_receipt_parent: isReceiptParent,
      raw_transcript: rawTranscript,
      transaction_date: new Date().toISOString()
    };
    this.transactions.unshift(tx);
    if (this.transactions.length > 2000) {
      this.transactions.length = 2000;
    }

    // Update wallet balance
    const wallet = this.wallets.find(w => w.id === walletId);
    if (wallet) {
      if (type === 'pemasukan') {
        wallet.balance = Number(wallet.balance) + Number(amount);
      } else if (type === 'pengeluaran') {
        wallet.balance = Number(wallet.balance) - Number(amount);
      }
    }

    // Save receipt items if present
    if (items && items.length > 0) {
      items.forEach(it => {
        this.receiptItems.push({
          id: 'ri-' + Date.now() + Math.random().toString(36).substr(2, 4),
          transaction_id: txId,
          item_name: it.itemName,
          quantity: it.quantity || 1,
          price_per_item: it.price || it.price_per_item,
          total_amount: it.total || it.total_amount
        });
      });
    }

    // Update budget if expense
    if (type === 'pengeluaran') {
      const curMonth = getCurrentMonthWIB();
      const budget = this.budgets.find(b => b.user_id === userId && b.category_id === categoryId && b.month_period === curMonth);
      if (budget) {
        budget.spent_amount = (Number(budget.spent_amount) || 0) + Number(amount);
      }
    }

    return tx;
  }

  getTransactions(userId, { categoryId, walletId, type, search, startDate, endDate, limit = 50, offset = 0 } = {}) {
    let list = this.transactions.filter(t => t.user_id === userId);

    if (categoryId) list = list.filter(t => t.category_id === categoryId);
    if (walletId) list = list.filter(t => t.wallet_id === walletId);
    if (type) list = list.filter(t => t.type === type);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => (t.notes || '').toLowerCase().includes(q) || (t.merchant_name || '').toLowerCase().includes(q));
    }
    if (startDate) list = list.filter(t => (t.transaction_date || '').slice(0, 10) >= startDate);
    if (endDate) list = list.filter(t => (t.transaction_date || '').slice(0, 10) <= endDate);

    // Join with wallet and category names
    const enriched = list.map(t => {
      const wallet = this.wallets.find(w => w.id === t.wallet_id);
      const cat = this.categories.find(c => c.id === t.category_id);
      const items = t.is_receipt_parent ? this.receiptItems.filter(r => r.transaction_id === t.id) : [];
      return {
        ...t,
        wallet_name: wallet ? wallet.name : '-',
        wallet_icon: wallet ? wallet.icon : '👛',
        category_name: cat ? cat.name : '-',
        category_icon: cat ? cat.icon : '🏷️',
        category_color: cat ? cat.color : '#FF5B00',
        receipt_items: items
      };
    });

    const total = enriched.length;
    const paginated = enriched.slice(offset, offset + limit);

    return { total, transactions: paginated };
  }

  // Budgets
  getUserBudgets(userId, month = getCurrentMonthWIB()) {
    const list = this.budgets.filter(b => b.user_id === userId && b.month_period === month);
    return list.map(b => {
      const cat = this.categories.find(c => c.id === b.category_id);
      return {
        ...b,
        category_name: cat ? cat.name : 'Kategori',
        category_icon: cat ? cat.icon : '🏷️',
        spent: Number(b.spent_amount) || 0
      };
    });
  }

  getCategoryBudget(userId, categoryId, month = getCurrentMonthWIB()) {
    return this.budgets.find(b => b.user_id === userId && b.category_id === categoryId && b.month_period === month);
  }

  getCategoryMonthlySpent(userId, categoryId, month = getCurrentMonthWIB()) {
    const b = this.getCategoryBudget(userId, categoryId, month);
    if (b) return Number(b.spent_amount) || 0;
    // Calculate sum of transactions
    const txs = this.transactions.filter(t => t.user_id === userId && t.category_id === categoryId && t.type === 'pengeluaran' && (t.transaction_date || '').startsWith(month));
    return txs.reduce((sum, t) => sum + Number(t.amount), 0);
  }

  // Statistics
  getMonthlyStats(userId, month = getCurrentMonthWIB()) {
    const txs = this.transactions.filter(t => t.user_id === userId && (t.transaction_date || '').startsWith(month));
    let income = 0;
    let expense = 0;
    txs.forEach(t => {
      if (t.type === 'pemasukan') income += Number(t.amount);
      if (t.type === 'pengeluaran') expense += Number(t.amount);
    });
    return {
      income,
      expense,
      net: income - expense,
      count: txs.length
    };
  }

  getTodayTransactions(userId) {
    const today = new Date().toISOString().slice(0, 10);
    return this.getTransactions(userId, { startDate: today, endDate: today }).transactions;
  }

  getWeeklyStats(userId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const txs = this.transactions.filter(t => t.user_id === userId && (t.transaction_date || '').slice(0, 10) >= sevenDaysAgo);
    let income = 0;
    let expense = 0;
    txs.forEach(t => {
      if (t.type === 'pemasukan') income += Number(t.amount);
      if (t.type === 'pengeluaran') expense += Number(t.amount);
    });
    return { income, expense, net: income - expense };
  }

  // Telegram Session
  getTelegramSession(userId) {
    return this.telegramSessions.find(s => s.user_id === userId);
  }

  getBotToken(userId) {
    const session = this.getTelegramSession(userId);
    return session?.bot_token || process.env.TELEGRAM_BOT_TOKEN || '';
  }

  saveTelegramSession(userId, data) {
    let session = this.telegramSessions.find(s => s.user_id === userId);
    if (!session) {
      session = { user_id: userId, ...data };
      this.telegramSessions.push(session);
    } else {
      Object.assign(session, data);
    }
    return session;
  }

  // AI Logs
  insertAILog(entry) {
    this.aiLogs.unshift({
      id: 'log-' + Date.now(),
      created_at: new Date().toISOString(),
      ...entry
    });
    if (this.aiLogs.length > 1000) {
      this.aiLogs.length = 1000;
    }
  }

  getAILogs(limit = 20) {
    return this.aiLogs.slice(0, limit);
  }

  // Admin Audit Logs
  insertAdminAuditLog(entry) {
    this.adminAuditLogs.unshift({
      id: 'aud-' + Date.now(),
      created_at: new Date().toISOString(),
      ...entry
    });
    if (this.adminAuditLogs.length > 1000) {
      this.adminAuditLogs.length = 1000;
    }
  }

  getAdminAuditLogs(limit = 30) {
    return this.adminAuditLogs.slice(0, limit);
  }

  // Payments
  createPayment({ userId, orderId, amount, planTier, paymentMethod }) {
    const payment = {
      id: 'pay-' + Date.now(),
      user_id: userId,
      order_id: orderId,
      amount: Number(amount),
      plan_tier: planTier,
      payment_method: paymentMethod,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    this.payments.unshift(payment);
    if (this.payments.length > 500) {
      this.payments.length = 500;
    }
    return payment;
  }

  updatePaymentStatus(orderId, status, approvedBy = null) {
    const p = this.payments.find(x => x.order_id === orderId);
    if (p) {
      p.status = status;
      if (approvedBy) p.approved_by = approvedBy;
      if (status === 'settlement') {
        const sub = this.subscriptions.find(s => s.user_id === p.user_id);
        if (sub) {
          sub.plan_tier = p.plan_tier;
          if (p.plan_tier === 'pro') {
            sub.billing_type = 'lifetime';
            sub.monthly_tx_limit = -1;
            sub.wallet_limit = -1;
            sub.budget_limit = -1;
            sub.ai_ocr_enabled = true;
            sub.ai_advisor_enabled = true;
            sub.advanced_export_enabled = true;
          }
        }
      }
    }
    return p;
  }

  // Exports
  saveExportRecord(entry) {
    const record = {
      id: 'exp-' + Date.now(),
      created_at: new Date().toISOString(),
      ...entry
    };
    this.exports.unshift(record);
    if (this.exports.length > 500) {
      this.exports.length = 500;
    }
    return record;
  }

  getUserExports(userId) {
    return this.exports.filter(e => e.user_id === userId);
  }
}

const db = new DatabaseStore();
module.exports = db;
