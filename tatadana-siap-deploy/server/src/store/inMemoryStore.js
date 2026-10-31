/**
 * In-Memory Data Store for TataDana
 * Provides out-of-the-box local data persistence & fast state operations.
 * Auto-initializes with seed data matching Supabase migrations 001-003.
 */

import { getNowWIB, toWIBISOString } from '../utils/timezone.js';

export class InMemoryStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.profiles = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        phone_number: '081234567890',
        full_name: 'Admin TataDana',
        email: 'admin@tatadana.id',
        role: 'admin',
        plan: 'pro',
        monthly_tx_count: 5,
        is_phone_verified: true,
        created_at: toWIBISOString()
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        phone_number: '081298765432',
        full_name: 'Budi Santoso',
        email: 'budi@example.com',
        role: 'user',
        plan: 'pro',
        monthly_tx_count: 14,
        is_phone_verified: true,
        created_at: toWIBISOString()
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        phone_number: '081311223344',
        full_name: 'Siti Rahma',
        email: 'siti@example.com',
        role: 'user',
        plan: 'starter',
        monthly_tx_count: 48, // approaching 50 limit
        is_phone_verified: true,
        created_at: toWIBISOString()
      }
    ];

    this.wallets = [
      {
        id: 'w0000001-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000002',
        name: 'Bank BCA',
        type: 'bank',
        balance: 8500000,
        currency: 'IDR',
        is_default: true,
        color: '#005EB8',
        created_at: toWIBISOString()
      },
      {
        id: 'w0000001-0000-0000-0000-000000000002',
        user_id: '00000000-0000-0000-0000-000000000002',
        name: 'GoPay',
        type: 'ewallet',
        balance: 450000,
        currency: 'IDR',
        is_default: false,
        color: '#00AED6',
        created_at: toWIBISOString()
      },
      {
        id: 'w0000001-0000-0000-0000-000000000003',
        user_id: '00000000-0000-0000-0000-000000000002',
        name: 'Dompet Tunai',
        type: 'cash',
        balance: 250000,
        currency: 'IDR',
        is_default: false,
        color: '#10B981',
        created_at: toWIBISOString()
      },
      {
        id: 'w0000001-0000-0000-0000-000000000004',
        user_id: '00000000-0000-0000-0000-000000000003',
        name: 'Dompet Utama',
        type: 'cash',
        balance: 1250000,
        currency: 'IDR',
        is_default: true,
        color: '#FF5B00',
        created_at: toWIBISOString()
      }
    ];

    this.categories = [
      { id: 'c0000001-0000-0000-0000-000000000001', user_id: null, name: 'Makanan & Minuman', type: 'pengeluaran', icon_emoji: '🍜', color: '#FF5B00', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000002', user_id: null, name: 'Transportasi & Bensin', type: 'pengeluaran', icon_emoji: '🚗', color: '#3B82F6', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000003', user_id: null, name: 'Belanja Kebutuhan', type: 'pengeluaran', icon_emoji: '🛒', color: '#10B981', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000004', user_id: null, name: 'Tagihan & Utilitas', type: 'pengeluaran', icon_emoji: '⚡', color: '#F59E0B', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000005', user_id: null, name: 'Hiburan & Hobi', type: 'pengeluaran', icon_emoji: '🍿', color: '#8B5CF6', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000006', user_id: null, name: 'Kesehatan & Medis', type: 'pengeluaran', icon_emoji: '💊', color: '#EC4899', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000007', user_id: null, name: 'Gaji & Pendapatan', type: 'pemasukan', icon_emoji: '💰', color: '#059669', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000008', user_id: null, name: 'Bonus & Freelance', type: 'pemasukan', icon_emoji: '🎁', color: '#2563EB', is_system: true },
      { id: 'c0000001-0000-0000-0000-000000000009', user_id: null, name: 'Investasi & Dividen', type: 'pemasukan', icon_emoji: '📈', color: '#7C3AED', true: true },
      { id: 'c0000001-0000-0000-0000-000000000010', user_id: null, name: 'Lain-lain', type: 'pengeluaran', icon_emoji: '📦', color: '#6B7280', is_system: true }
    ];

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    this.budgets = [
      {
        id: 'b0000001-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000002',
        category_id: 'c0000001-0000-0000-0000-000000000001',
        amount: 2500000,
        month: currentMonth,
        year: currentYear,
        alert_80_sent: false,
        alert_100_sent: false
      },
      {
        id: 'b0000001-0000-0000-0000-000000000002',
        user_id: '00000000-0000-0000-0000-000000000002',
        category_id: 'c0000001-0000-0000-0000-000000000002',
        amount: 800000,
        month: currentMonth,
        year: currentYear,
        alert_80_sent: false,
        alert_100_sent: false
      },
      {
        id: 'b0000001-0000-0000-0000-000000000003',
        user_id: '00000000-0000-0000-0000-000000000002',
        category_id: 'c0000001-0000-0000-0000-000000000005',
        amount: 500000,
        month: currentMonth,
        year: currentYear,
        alert_80_sent: false,
        alert_100_sent: false
      }
    ];

    this.transactions = [
      {
        id: 't0000001-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000002',
        wallet_id: 'w0000001-0000-0000-0000-000000000001',
        category_id: 'c0000001-0000-0000-0000-000000000007',
        type: 'pemasukan',
        amount: 12000000,
        notes: 'Gaji Bulanan PT Maju Bersama',
        source: 'web_manual',
        merchant_name: 'PT Maju Bersama',
        date: new Date(Date.now() - 10 * 86400000).toISOString(),
        created_at: toWIBISOString()
      },
      {
        id: 't0000001-0000-0000-0000-000000000002',
        user_id: '00000000-0000-0000-0000-000000000002',
        wallet_id: 'w0000001-0000-0000-0000-000000000002',
        category_id: 'c0000001-0000-0000-0000-000000000001',
        type: 'pengeluaran',
        amount: 35000,
        notes: 'Kopi Susu Gula Aren 2 Cup',
        source: 'telegram_text',
        merchant_name: 'Kopi Kenangan',
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        created_at: toWIBISOString()
      },
      {
        id: 't0000001-0000-0000-0000-000000000003',
        user_id: '00000000-0000-0000-0000-000000000002',
        wallet_id: 'w0000001-0000-0000-0000-000000000001',
        category_id: 'c0000001-0000-0000-0000-000000000003',
        type: 'pengeluaran',
        amount: 285000,
        notes: 'Belanja Mingguan Supermarket',
        source: 'telegram_receipt',
        merchant_name: 'Superindo Duren Tiga',
        date: new Date(Date.now() - 1 * 86400000).toISOString(),
        receipt_image_url: 'https://images.unsplash.com/photo-1554415707-9e4466b88738?w=400',
        created_at: toWIBISOString()
      }
    ];

    this.transactionItems = [
      { id: 'i0000001-0000-0000-0000-000000000001', transaction_id: 't0000001-0000-0000-0000-000000000003', name: 'Minyak Goreng Sania 2L', quantity: 1, price: 38500, total: 38500 },
      { id: 'i0000001-0000-0000-0000-000000000002', transaction_id: 't0000001-0000-0000-0000-000000000003', name: 'Beras Ramos 5kg', quantity: 1, price: 74000, total: 74000 },
      { id: 'i0000001-0000-0000-0000-000000000003', transaction_id: 't0000001-0000-0000-0000-000000000003', name: 'Daging Sapi Segar 500g', quantity: 1, price: 85000, total: 85000 },
      { id: 'i0000001-0000-0000-0000-000000000004', transaction_id: 't0000001-0000-0000-0000-000000000003', name: 'Telur Ayam Negeri 1kg', quantity: 1, price: 32500, total: 32500 },
      { id: 'i0000001-0000-0000-0000-000000000005', transaction_id: 't0000001-0000-0000-0000-000000000003', name: 'Susu UHT Full Cream 1L', quantity: 2, price: 27500, total: 55000 }
    ];

    this.telegramSessions = [
      {
        id: 's0000001-0000-0000-0000-000000000001',
        telegram_chat_id: 123456789,
        telegram_username: 'budisantoso_tg',
        user_id: '00000000-0000-0000-0000-000000000002',
        link_code: 'TD-9921',
        is_linked: true,
        linked_at: toWIBISOString()
      }
    ];

    this.aiProviders = [
      {
        id: 'a0000001-0000-0000-0000-000000000001',
        provider_key: 'gemini',
        display_name: 'Google Gemini 1.5 Flash',
        is_active: true,
        is_primary: true,
        failover_order: 1,
        model_name: 'gemini-1.5-flash',
        api_key_masked: 'AIzaSy...****',
        settings: { temperature: 0.1, max_tokens: 1024, supports_vision: true, supports_audio: true }
      },
      {
        id: 'a0000001-0000-0000-0000-000000000002',
        provider_key: 'openai',
        display_name: 'OpenAI GPT-4o-mini & Whisper',
        is_active: true,
        is_primary: false,
        failover_order: 2,
        model_name: 'gpt-4o-mini',
        api_key_masked: 'sk-proj...****',
        settings: { temperature: 0.1, max_tokens: 1024, supports_vision: true, audio_model: 'whisper-1' }
      },
      {
        id: 'a0000001-0000-0000-0000-000000000003',
        provider_key: 'deepseek',
        display_name: 'DeepSeek Chat (V3)',
        is_active: true,
        is_primary: false,
        failover_order: 3,
        model_name: 'deepseek-chat',
        api_key_masked: 'sk-ds...****',
        settings: { temperature: 0.1, max_tokens: 1024, supports_vision: false, supports_audio: false }
      }
    ];

    this.aiLogs = [
      {
        id: 'l0000001-0000-0000-0000-000000000001',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        task_type: 'text_parse',
        prompt_tokens: 120,
        completion_tokens: 42,
        latency_ms: 320,
        status: 'success',
        created_at: toWIBISOString()
      },
      {
        id: 'l0000001-0000-0000-0000-000000000002',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        task_type: 'receipt_ocr',
        prompt_tokens: 580,
        completion_tokens: 165,
        latency_ms: 1120,
        status: 'success',
        created_at: toWIBISOString()
      }
    ];

    this.adminAuditLogs = [
      {
        id: 'al000001-0000-0000-0000-000000000001',
        admin_id: '00000000-0000-0000-0000-000000000001',
        action: 'system_init',
        target_user_id: null,
        details: { message: 'Inisialisasi sistem TataDana pertama kali' },
        ip_address: '127.0.0.1',
        created_at: toWIBISOString()
      }
    ];

    this.subscriptions = [
      {
        id: 'sub00001-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000002',
        plan: 'pro',
        order_id: 'ORDER-TD-PRO-001',
        gross_amount: 99000,
        status: 'settlement',
        payment_type: 'qris',
        midtrans_response: { transaction_status: 'settlement', payment_type: 'qris' },
        created_at: toWIBISOString()
      }
    ];

    this.exports = [];
    this.systemSettings = {
      ai_mode: { mode: 'failover', timeout_ms: 7000 },
      telegram_bot: { bot_username: 'TataDanaBot', bot_token: 'MOCK_BOT_TOKEN_TATADANA' }
    };
  }

  // --- Transactions Methods ---
  createTransaction({ userId, walletId, categoryId, type, amount, notes, source = 'web_manual', merchantName = '', receiptImageUrl = null, items = [] }) {
    const id = 't' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const date = toWIBISOString();
    
    const newTx = {
      id,
      user_id: userId,
      wallet_id: walletId,
      category_id: categoryId,
      type,
      amount: Number(amount),
      notes: notes || '',
      merchant_name: merchantName || '',
      source,
      receipt_image_url: receiptImageUrl,
      date,
      created_at: date
    };

    this.transactions.unshift(newTx);

    // Sync wallet balance
    const wallet = this.wallets.find(w => w.id === walletId);
    if (wallet) {
      if (type === 'pemasukan') {
        wallet.balance += Number(amount);
      } else if (type === 'pengeluaran') {
        wallet.balance -= Number(amount);
      }
    }

    // Increment profile monthly_tx_count
    const profile = this.profiles.find(p => p.id === userId);
    if (profile) {
      profile.monthly_tx_count = (profile.monthly_tx_count || 0) + 1;
    }

    // Insert items if any
    const createdItems = [];
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item, idx) => {
        const itemId = 'i' + Math.random().toString(36).substring(2, 9) + idx;
        const itemObj = {
          id: itemId,
          transaction_id: id,
          name: item.name || item.item || 'Barang',
          quantity: Number(item.quantity || item.qty || 1),
          price: Number(item.price || 0),
          total: Number(item.total || (item.quantity || 1) * (item.price || 0))
        };
        this.transactionItems.push(itemObj);
        createdItems.push(itemObj);
      });
    }

    return { ...newTx, items: createdItems };
  }
}

export const inMemoryStore = new InMemoryStore();
