// server/server.js
// TataDana High-Performance Full-Stack Server
// Serves REST APIs, Webhooks, Document Generators, and Client SPA

const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./db');
const AIEngine = require('./ai/engine');
const WebhookHandler = require('./telegram/webhook');
const { testAndRegisterWebhook } = require('./telegram/connection');
const { generateFinancialReportPDF } = require('./reporting/pdfGenerator');
const { generateFinancialReportExcel } = require('./reporting/excelGenerator');
const { formatRupiah, getCurrentMonthWIB } = require('./utils/wib');

const aiEngine = new AIEngine(db);
const webhookHandler = new WebhookHandler(db, aiEngine);

// Helper for parsing JSON body
function parseBody(req, limitBytes = 10 * 1024 * 1024) {
  return new Promise((resolve) => {
    let body = '';
    let size = 0;
    let aborted = false;

    req.on('data', chunk => {
      if (aborted) return;
      size += chunk.length;
      if (size > limitBytes) {
        aborted = true;
        resolve({});
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });

    req.on('error', () => {
      resolve({});
    });
  });
}

// Helper for sending JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Active session token simulation (dev mode)
let activeUserId = 'usr-demo-001';

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  console.log(`[${method}] ${pathname}`);

  try {
    // -------------------------------------------------------------
    // TELEGRAM WEBHOOK (Part 2 & Part 4)
    // -------------------------------------------------------------
    if (pathname === '/api/telegram/webhook' && method === 'POST') {
      const payload = await parseBody(req);
      const result = await webhookHandler.handleUpdate(payload);
      return sendJson(res, 200, { ok: true, result });
    }

    // -------------------------------------------------------------
    // AUTHENTICATION ROUTES (Part 8)
    // -------------------------------------------------------------
    if (pathname === '/api/auth/register' && method === 'POST') {
      const { email, phoneNumber, fullName } = await parseBody(req);
      if (!phoneNumber || !fullName) {
        return sendJson(res, 400, { success: false, message: 'Nomor HP dan nama lengkap wajib diisi.' });
      }
      let user = db.findUserByPhone(phoneNumber);
      if (!user) {
        user = db.createUser({ email, phoneNumber, fullName });
      }
      return sendJson(res, 200, {
        success: true,
        message: 'Kode OTP telah dikirimkan ke nomor WhatsApp/SMS Anda.',
        devOtpHint: config.DEV_OTP_CODE,
        user: { id: user.id, phone: user.phone_number }
      });
    }

    if (pathname === '/api/auth/verify-otp' && method === 'POST') {
      const { phoneNumber, otpCode } = await parseBody(req);
      if (otpCode !== config.DEV_OTP_CODE && otpCode !== '123456') {
        return sendJson(res, 400, { success: false, message: 'Kode OTP tidak valid atau telah kedaluwarsa.' });
      }
      const user = db.findUserByPhone(phoneNumber) || db.getDefaultUser();
      activeUserId = user.id;
      return sendJson(res, 200, {
        success: true,
        message: 'Verifikasi berhasil!',
        token: 'jwt-token-' + user.id,
        user
      });
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const { email, password } = await parseBody(req);
      const user = db.findUserByEmail(email) || db.getDefaultUser();
      activeUserId = user.id;
      return sendJson(res, 200, {
        success: true,
        token: 'jwt-token-' + user.id,
        user
      });
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = db.getUser(activeUserId) || db.getDefaultUser();
      return sendJson(res, 200, { success: true, user });
    }

    // -------------------------------------------------------------
    // WALLETS ROUTES (Part 3)
    // -------------------------------------------------------------
    if (pathname === '/api/wallets' && method === 'GET') {
      const wallets = db.getUserWallets(activeUserId);
      return sendJson(res, 200, { success: true, wallets });
    }

    if (pathname === '/api/wallets' && method === 'POST') {
      const body = await parseBody(req);
      const user = db.getUser(activeUserId);
      const wallets = db.getUserWallets(activeUserId);

      // Starter limit: max 3 wallets
      if (user.plan_tier !== 'pro' && wallets.length >= 3) {
        return sendJson(res, 403, {
          success: false,
          message: 'Paket Starter dibatasi maksimal 3 dompet. Upgrade ke Pro untuk dompet unlimited!'
        });
      }

      const wallet = db.createWallet(activeUserId, body);
      return sendJson(res, 201, { success: true, wallet });
    }

    // -------------------------------------------------------------
    // CATEGORIES ROUTES (Part 3)
    // -------------------------------------------------------------
    if (pathname === '/api/categories' && method === 'GET') {
      const categories = db.getUserCategories(activeUserId);
      return sendJson(res, 200, { success: true, categories });
    }

    if (pathname === '/api/categories' && method === 'POST') {
      const { name, type, icon, color } = await parseBody(req);
      const user = db.getUser(activeUserId);
      const categories = db.getUserCategories(activeUserId);

      // Starter limit check
      if (user.plan_tier !== 'pro' && categories.length >= 10) {
        return sendJson(res, 403, {
          success: false,
          message: 'Batas kategori paket Starter tercapai. Upgrade ke Pro untuk kategori custom tanpa batas!'
        });
      }

      const cat = db.findOrCreateCategory(activeUserId, name, type || 'expense');
      if (icon) cat.icon = icon;
      if (color) cat.color = color;
      return sendJson(res, 201, { success: true, category: cat });
    }

    // -------------------------------------------------------------
    // TRANSACTIONS ROUTES (Part 3)
    // -------------------------------------------------------------
    if (pathname === '/api/transactions' && method === 'GET') {
      const { categoryId, walletId, type, search, startDate, endDate, limit, offset } = query;
      const data = db.getTransactions(activeUserId, {
        categoryId,
        walletId,
        type,
        search,
        startDate,
        endDate,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0
      });
      return sendJson(res, 200, { success: true, ...data });
    }

    if (pathname === '/api/transactions' && method === 'POST') {
      const body = await parseBody(req);
      const user = db.getUser(activeUserId);

      // Starter plan limit: 50 transactions/month
      const currentTxCount = db.getMonthlyTransactionCount(activeUserId);
      if (user.plan_tier !== 'pro' && currentTxCount >= 50) {
        return sendJson(res, 403, {
          success: false,
          message: 'Batas 50 transaksi bulanan Starter telah tercapai. Upgrade ke Pro untuk transaksi unlimited!'
        });
      }

      const tx = db.createTransaction({
        userId: activeUserId,
        walletId: body.walletId,
        categoryId: body.categoryId,
        type: body.type,
        amount: body.amount,
        notes: body.notes,
        source: 'web'
      });
      return sendJson(res, 201, { success: true, transaction: tx });
    }

    // -------------------------------------------------------------
    // BUDGETS ROUTES (Part 3)
    // -------------------------------------------------------------
    if (pathname === '/api/budgets' && method === 'GET') {
      const month = query.month || getCurrentMonthWIB();
      const budgets = db.getUserBudgets(activeUserId, month);
      return sendJson(res, 200, { success: true, budgets });
    }

    // -------------------------------------------------------------
    // REPORTS & EXPORT ROUTES (Part 3)
    // -------------------------------------------------------------
    if (pathname === '/api/reports/summary' && method === 'GET') {
      const month = query.month || getCurrentMonthWIB();
      const stats = db.getMonthlyStats(activeUserId, month);
      const budgets = db.getUserBudgets(activeUserId, month);
      const totalBudget = budgets.reduce((acc, b) => acc + Number(b.amount), 0);
      const totalBudgetSpent = budgets.reduce((acc, b) => acc + Number(b.spent), 0);

      // Top 5 expense categories
      const txs = db.getTransactions(activeUserId, { startDate: `${month}-01`, endDate: `${month}-31`, type: 'pengeluaran', limit: 1000 }).transactions;
      const catMap = {};
      txs.forEach(t => {
        catMap[t.category_name] = (catMap[t.category_name] || 0) + Number(t.amount);
      });
      const topCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount }));

      return sendJson(res, 200, {
        success: true,
        month,
        income: stats.income,
        expense: stats.expense,
        netCashflow: stats.net,
        transactionCount: stats.count,
        totalBudget,
        budgetRemaining: Math.max(0, totalBudget - totalBudgetSpent),
        topCategories
      });
    }

    if (pathname === '/api/reports/export/pdf' && method === 'GET') {
      const user = db.getUser(activeUserId);
      if (user.plan_tier !== 'pro') {
        return sendJson(res, 403, {
          success: false,
          message: 'Export Laporan PDF adalah fitur khusus TataDana PRO.'
        });
      }

      const startDate = query.startDate || '2026-10-01';
      const endDate = query.endDate || '2026-10-31';
      const stats = db.getMonthlyStats(activeUserId);
      const { transactions } = db.getTransactions(activeUserId, { startDate, endDate, limit: 100 });

      const pdfBuffer = generateFinancialReportPDF({
        userName: user.full_name,
        periodStart: startDate,
        periodEnd: endDate,
        summary: stats,
        transactions
      });

      const fileName = `TataDana_Laporan_${startDate}_${endDate}.pdf`;
      db.saveExportRecord({
        userId: user.id,
        file_name: fileName,
        file_type: 'pdf',
        storage_path: `reports/${user.id}/${fileName}`,
        period_start: startDate,
        period_end: endDate,
        total_records: transactions.length,
        file_size_bytes: pdfBuffer.length
      });

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length
      });
      return res.end(pdfBuffer);
    }

    if (pathname === '/api/reports/export/excel' && method === 'GET') {
      const user = db.getUser(activeUserId);
      if (user.plan_tier !== 'pro') {
        return sendJson(res, 403, {
          success: false,
          message: 'Export Laporan Excel (.xlsx) adalah fitur khusus TataDana PRO.'
        });
      }

      const startDate = query.startDate || '2026-10-01';
      const endDate = query.endDate || '2026-10-31';
      const stats = db.getMonthlyStats(activeUserId);
      const { transactions } = db.getTransactions(activeUserId, { startDate, endDate, limit: 500 });

      const excelBuffer = generateFinancialReportExcel({
        userName: user.full_name,
        periodStart: startDate,
        periodEnd: endDate,
        summary: stats,
        transactions
      });

      const fileName = `TataDana_Laporan_${startDate}_${endDate}.xls`;
      db.saveExportRecord({
        userId: user.id,
        file_name: fileName,
        file_type: 'xlsx',
        storage_path: `reports/${user.id}/${fileName}`,
        period_start: startDate,
        period_end: endDate,
        total_records: transactions.length,
        file_size_bytes: excelBuffer.length
      });

      res.writeHead(200, {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length
      });
      return res.end(excelBuffer);
    }

    if (pathname === '/api/reports/history' && method === 'GET') {
      const history = db.getUserExports(activeUserId);
      return sendJson(res, 200, { success: true, history });
    }

    // -------------------------------------------------------------
    // TELEGRAM SETTINGS & TEST CONNECTION (Part 5)
    // -------------------------------------------------------------
    if (pathname === '/api/settings/telegram/test' && method === 'POST') {
      const { botToken } = await parseBody(req);
      const testResult = await testAndRegisterWebhook(botToken);
      if (testResult.success) {
        db.saveTelegramSession(activeUserId, {
          bot_token: botToken,
          connection_status: 'connected'
        });
      }
      return sendJson(res, testResult.success ? 200 : 400, testResult);
    }

    if (pathname === '/api/settings/telegram' && method === 'GET') {
      const session = db.getTelegramSession(activeUserId) || { connection_status: 'disconnected' };
      return sendJson(res, 200, { success: true, session });
    }

    if (pathname === '/api/settings/telegram' && method === 'POST') {
      const body = await parseBody(req);
      const saved = db.saveTelegramSession(activeUserId, body);
      return sendJson(res, 200, { success: true, session: saved });
    }

    // -------------------------------------------------------------
    // PAYMENT & MIDTRANS (Part 6)
    // -------------------------------------------------------------
    if (pathname === '/api/payments/create' && method === 'POST') {
      const { planTier, paymentMethod } = await parseBody(req);
      const amount = planTier === 'pro' ? 99000 : 49000;
      const orderId = 'ORDER-' + Date.now();
      const payment = db.createPayment({
        userId: activeUserId,
        orderId,
        amount,
        planTier,
        paymentMethod: paymentMethod || 'midtrans_snap'
      });
      return sendJson(res, 200, {
        success: true,
        orderId,
        amount,
        snapToken: 'SNAP-TOKEN-' + Math.random().toString(36).substr(2, 8),
        payment
      });
    }

    // -------------------------------------------------------------
    // ADMIN DASHBOARD & WEBHOOK SIMULATOR (Part 10)
    // -------------------------------------------------------------
    if (pathname === '/api/admin/impersonate' && method === 'POST') {
      const { targetUserId, reason } = await parseBody(req);
      const target = db.getUser(targetUserId);
      if (!target) {
        return sendJson(res, 404, { success: false, message: 'User tidak ditemukan.' });
      }
      db.insertAdminAuditLog({
        admin_id: 'usr-admin-001',
        target_user_id: targetUserId,
        action_type: 'impersonate',
        reason: reason || 'Troubleshooting / Support Tiket'
      });
      activeUserId = targetUserId;
      return sendJson(res, 200, { success: true, message: `Beralih ke akun user: ${target.full_name}`, user: target });
    }

    if (pathname === '/api/admin/users' && method === 'GET') {
      const list = db.profiles.map(p => {
        const sub = db.subscriptions.find(s => s.user_id === p.id);
        const tg = db.telegramSessions.find(t => t.user_id === p.id);
        const txCount = db.transactions.filter(t => t.user_id === p.id).length;
        return {
          ...p,
          plan_tier: sub ? sub.plan_tier : 'starter',
          telegram_status: tg ? tg.connection_status : 'disconnected',
          total_transactions: txCount
        };
      });
      return sendJson(res, 200, { success: true, users: list });
    }

    if (pathname === '/api/admin/ai/providers' && method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        mode: aiEngine.mode,
        providers: aiEngine.getProviders()
      });
    }

    if (pathname === '/api/admin/ai/providers' && method === 'POST') {
      const { mode, providerName, settings } = await parseBody(req);
      if (mode) aiEngine.setMode(mode);
      if (providerName && settings) aiEngine.updateProviderConfig(providerName, settings);
      return sendJson(res, 200, { success: true, message: 'Konfigurasi AI Provider berhasil diperbarui.' });
    }

    if (pathname === '/api/admin/ai/logs' && method === 'GET') {
      const logs = db.getAILogs(30);
      return sendJson(res, 200, { success: true, logs });
    }

    if (pathname === '/api/admin/audit-logs' && method === 'GET') {
      const logs = db.getAdminAuditLogs(30);
      return sendJson(res, 200, { success: true, logs });
    }

    if (pathname === '/api/admin/payments' && method === 'GET') {
      return sendJson(res, 200, { success: true, payments: db.payments });
    }

    if (pathname === '/api/admin/payments/approve' && method === 'POST') {
      const { orderId } = await parseBody(req);
      const updated = db.updatePaymentStatus(orderId, 'settlement', 'usr-admin-001');
      db.insertAdminAuditLog({
        admin_id: 'usr-admin-001',
        target_user_id: updated?.user_id,
        action_type: 'approve_payment',
        reason: 'Approval transfer manual Midtrans'
      });
      return sendJson(res, 200, { success: true, message: 'Pembayaran disetujui. Akun user kini PRO!' });
    }

    // Built-in Webhook Simulator for testing locally without tunnel
    if (pathname === '/api/admin/simulator' && method === 'POST') {
      const { type, text, senderName } = await parseBody(req);
      const fakeUpdateId = Math.floor(Math.random() * 9000000) + 1000000;
      const user = db.getUser(activeUserId);

      let fakeUpdate = null;
      if (type === 'text') {
        fakeUpdate = {
          update_id: fakeUpdateId,
          message: {
            message_id: 101,
            from: { id: 123456789, first_name: senderName || user.full_name },
            chat: { id: 123456789 },
            text: text || 'beli bakso 25rb'
          }
        };
      } else if (type === 'photo') {
        fakeUpdate = {
          update_id: fakeUpdateId,
          message: {
            message_id: 102,
            from: { id: 123456789, first_name: senderName || user.full_name },
            chat: { id: 123456789 },
            photo: [{ file_id: 'sample_photo_id' }]
          }
        };
      } else if (type === 'voice') {
        fakeUpdate = {
          update_id: fakeUpdateId,
          message: {
            message_id: 103,
            from: { id: 123456789, first_name: senderName || user.full_name },
            chat: { id: 123456789 },
            voice: { file_id: 'sample_voice_id', duration: 15 }
          }
        };
      }

      const resHandler = await webhookHandler.handleUpdate(fakeUpdate);
      return sendJson(res, 200, { success: true, simulation: resHandler });
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING FOR CLIENT SPA
    // -------------------------------------------------------------
    const clientDir = path.resolve(__dirname, '../client');
    const safePath = path.normalize(pathname === '/' ? '/index.html' : pathname);
    let filePath = path.join(clientDir, safePath);

    // Prevent directory traversal
    if (!filePath.startsWith(clientDir)) {
      filePath = path.join(clientDir, 'index.html');
    }

    try {
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(clientDir, 'index.html');
      }
    } catch (e) {
      filePath = path.join(clientDir, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', () => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      req.on('close', () => {
        stream.destroy();
      });
      return;
    }

    // 404
    sendJson(res, 404, { success: false, message: 'Endpoint tidak ditemukan.' });
  } catch (err) {
    console.error('[Server Error]:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
});

server.listen(config.PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 TataDana Full-Stack Server Running on Port ${config.PORT}`);
  console.log(`🔗 Local URL: http://localhost:${config.PORT}`);
  console.log(`⏰ Timezone: ${config.TIMEZONE} (Asia/Jakarta, UTC+7)`);
  console.log(`=======================================================`);
});

module.exports = server;
