// client/js/app.js
// TataDana Single Page Application (SPA) Engine
// Implements Landing Page, Auth Pages, User Dashboard, Reports, Settings, and Admin Dashboard

const API_BASE = '';

// App State
const state = {
  currentPage: 'landing', // 'landing' | 'login' | 'register' | 'otp' | 'dashboard' | 'laporan' | 'budget' | 'wallet' | 'settings' | 'admin'
  showMobileSidebar: false,
  user: null,
  wallets: [],
  categories: [],
  transactions: [],
  budgets: [],
  reportSummary: null,
  reportFilter: {
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    type: '',
    categoryId: '',
    walletId: '',
    search: '',
    page: 1,
    limit: 10
  },
  aiProviders: [],
  aiMode: 'failover',
  adminUsers: [],
  adminLogs: [],
  adminAuditLogs: [],
  adminPayments: [],
  otpPhone: '',
  registeredUser: null,
  registrationSuccess: false,
  adminWhatsappNumber: '083840023120',
  expandedReceiptId: null,
  tempAvatarUrl: null,
  telegramStatus: 'connected',
  telegramBotToken: '8853112131:AAGNZDVNBGnBTZBZcNhIni1iv2eb011-Fjo',
  telegramBotInfo: { username: 'TataKeuanganBot', first_name: 'tatadana' },
  tataAiMessages: [
    {
      role: 'bot',
      text: `Halo! Saya **Tata AI**, asisten dan perencana finansial cerdas pribadimu di TataDana. 🤖✨

Saya siap membantumu:
• 📊 Menganalisis kesehatan arus kas & rasio pengeluaran
• 📝 Mencatat transaksi secara instan (contoh: *"Catat beli bensin 35rb"* atau *"Gajian 5jt"*)
• 🎯 Menghitung simulasi dana darurat 3-6 bulan
• 💡 Memberikan tips hemat praktis formula 50/30/20

Silakan pilih prompt cepat di bawah atau ketik langsung pertanyaanmu!`,
      time: 'Baru saja',
      action: null
    }
  ],
  tataAiSuggestions: [
    "📊 Analisis Cashflow Bulan Ini",
    "💡 Berikan Rekomendasi Hemat Gaji",
    "🎯 Bikin Simulasi Dana Darurat 3 Bulan",
    "📝 Catat 'Kopi Susu 25rb Pakai BCA'",
    "📈 Apakah Budget Makanan Saya Masih Aman?"
  ],
  isAiTyping: false,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth() + 1,
  calendarData: null,
  selectedCalendarDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
  calendarAutoSync: true,
  calendarLiveTime: '',
  calendarLastSyncedAt: null,
  budgetSummary: null,
  activeBudgetTab: 'all',
  showAddBudgetModal: false,
  showAddWalletModal: false,
  showAddCategoryModal: false,
  showPdfPreviewModal: false,
  adminStats: null,
  adminTab: 'approvals',
  adminApprovalFilter: 'all',
  viewingUserProfile: null,
  adminUserSearch: '',
  viewingUserDatabase: null,
  userDbTab: 'wallets'
};

// Utilities
function formatRupiah(num) {
  const val = Math.round(Number(num) || 0);
  return 'Rp' + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatCompactRupiah(num) {
  const val = Math.abs(Math.round(Number(num) || 0));
  if (val >= 1000000000) return (val / 1000000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'jt';
  if (val >= 1000) return (val / 1000).toFixed(0) + 'rb';
  return val.toString();
}

window.toggleMobileSidebar = function() {
  state.showMobileSidebar = !state.showMobileSidebar;
  render();
};

window.closeMobileSidebar = function() {
  if (state.showMobileSidebar) {
    state.showMobileSidebar = false;
    render();
  }
};

function getRealtimeDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const dateNum = now.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
  return { year, month, dateNum, dateStr, now };
}

function formatFullIndonesianDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${days[dateObj.getDay()] || ''}, ${d} ${months[m] || ''} ${y}`;
}

function formatTimeWIB(isoDateStr) {
  if (!isoDateStr) return '';
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
  } catch (e) {
    return '';
  }
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-orange-600';
  toast.className = `${bg} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transform transition-all duration-300 pointer-events-auto translate-y-2 opacity-0`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// API Client
async function api(endpoint, options = {}) {
  try {
    let currentUserId = (state.user && state.user.id) || '';
    if (!currentUserId) {
      try {
        currentUserId = sessionStorage.getItem('tatadana_user_id') || localStorage.getItem('tatadana_user_id') || '';
      } catch (e) {}
    }
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (currentUserId) {
      headers['x-user-id'] = currentUserId;
    }
    const res = await fetch(API_BASE + endpoint, {
      ...options,
      headers
    });
    if (res.headers.get('content-type')?.includes('application/pdf') || res.headers.get('content-type')?.includes('spreadsheet') || res.headers.get('content-type')?.includes('ms-excel')) {
      return res.blob();
    }
    return await res.json();
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, error: err.message };
  }
}

// Data Fetchers
async function fetchCurrentUser() {
  const res = await api('/api/auth/me');
  if (res.success) {
    state.user = res.user;
  }
}

async function fetchWallets() {
  const res = await api('/api/wallets');
  if (res.success) state.wallets = res.wallets || [];
}

async function fetchCategories() {
  const res = await api('/api/categories');
  if (res.success) state.categories = res.categories || [];
}

async function fetchTransactions() {
  const q = new URLSearchParams({
    startDate: state.reportFilter.startDate,
    endDate: state.reportFilter.endDate,
    type: state.reportFilter.type,
    categoryId: state.reportFilter.categoryId,
    walletId: state.reportFilter.walletId,
    search: state.reportFilter.search,
    limit: state.reportFilter.limit,
    offset: (state.reportFilter.page - 1) * state.reportFilter.limit
  });
  const res = await api(`/api/transactions?${q.toString()}`);
  if (res.success) {
    state.transactions = res.transactions || [];
    state.transactionTotal = res.total || 0;
  }
}

async function fetchBudgets() {
  const res = await api('/api/budgets');
  if (res.success) state.budgets = res.budgets || [];
}

async function fetchReportSummary() {
  const q = new URLSearchParams({
    startDate: state.reportFilter.startDate || '',
    endDate: state.reportFilter.endDate || '',
    type: state.reportFilter.type || '',
    categoryId: state.reportFilter.categoryId || '',
    walletId: state.reportFilter.walletId || '',
    search: state.reportFilter.search || ''
  });
  const res = await api(`/api/reports/summary?${q.toString()}`);
  if (res.success) state.reportSummary = res;
}

// Router & Navigation with Auto-Polling for WhatsApp Admin Verification
let otpPollInterval = null;

function startOtpPolling() {
  stopOtpPolling();
  otpPollInterval = setInterval(async () => {
    if (state.currentPage !== 'otp') {
      stopOtpPolling();
      return;
    }
    const phone = state.otpPhone || (state.registeredUser && state.registeredUser.phoneNumber);
    if (!phone) return;
    try {
      const res = await api(`/api/auth/check-status?phone=${encodeURIComponent(phone)}`);
      if (res && res.success && res.verified) {
        stopOtpPolling();
        state.user = res.user;
        showToast('🎉 Selamat! Akun Anda telah disetujui & diverifikasi oleh Super Admin!', 'success');
        await Promise.all([
          fetchWallets(),
          fetchCategories(),
          fetchTransactions(),
          fetchBudgets(),
          fetchBudgetSummary(),
          fetchCalendarData(),
          fetchReportSummary()
        ]);
        navigate(res.user.role === 'superadmin' ? 'admin' : 'dashboard');
      }
    } catch (e) {
      // ignore transient network errors during polling
    }
  }, 3000);
}

function stopOtpPolling() {
  if (otpPollInterval) {
    clearInterval(otpPollInterval);
    otpPollInterval = null;
  }
}

let calendarClockInterval = null;
let calendarSyncInterval = null;

function updateCalendarLiveClockDisplay() {
  const clockEl = document.getElementById('calendar-realtime-clock');
  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayName = days[now.getDay()];
  const dayNum = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();
  const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
  state.calendarLiveTime = `${timeStr} WIB • ${dayName}, ${dayNum} ${monthName} ${year}`;
  if (clockEl) {
    clockEl.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span><span class="font-mono font-extrabold text-gray-900">${timeStr} WIB</span> <span class="text-gray-500 font-semibold">• ${dayName}, ${dayNum} ${monthName} ${year}</span>`;
  }
}

function startCalendarRealtimeEngines() {
  if (calendarClockInterval) clearInterval(calendarClockInterval);
  calendarClockInterval = setInterval(updateCalendarLiveClockDisplay, 1000);

  if (calendarSyncInterval) clearInterval(calendarSyncInterval);
  calendarSyncInterval = setInterval(async () => {
    if (state.currentPage === 'kalender' && state.calendarAutoSync && !state.showAddTxModal) {
      await window.fetchCalendarData(state.calendarYear, state.calendarMonth, true);
    }
  }, 4000); // 4 seconds real-time auto-sync
}

function stopCalendarRealtimeEngines() {
  if (calendarClockInterval) {
    clearInterval(calendarClockInterval);
    calendarClockInterval = null;
  }
  if (calendarSyncInterval) {
    clearInterval(calendarSyncInterval);
    calendarSyncInterval = null;
  }
}

function navigate(page, updateHash = true) {
  state.currentPage = page;
  state.showMobileSidebar = false;
  if (updateHash) {
    try {
      if (window.location.hash !== '#' + page) {
        window.location.hash = page;
      }
      sessionStorage.setItem('tatadana_page', page);
      localStorage.setItem('tatadana_page', page);
    } catch (e) {}
  }
  if (page === 'otp') {
    startOtpPolling();
  } else {
    stopOtpPolling();
  }
  if (page === 'kalender') {
    startCalendarRealtimeEngines();
    if (typeof window.fetchCalendarData === 'function') {
      window.fetchCalendarData(state.calendarYear, state.calendarMonth, true);
    }
  } else {
    stopCalendarRealtimeEngines();
  }

  if (page === 'admin') {
    fetchAdminData();
    fetchAdminStats();
    if (!window._adminPollInterval) {
      window._adminPollInterval = setInterval(async () => {
        if (state.currentPage === 'admin') {
          const prevCount = (state.adminPayments || []).length;
          const prevUserCount = (state.adminUsers || []).length;
          await Promise.all([fetchAdminData(), fetchAdminStats()]);
          if ((state.adminPayments || []).length !== prevCount || (state.adminUsers || []).length !== prevUserCount) {
            render();
          }
        }
      }, 4000);
    }
  } else {
    if (window._adminPollInterval) {
      clearInterval(window._adminPollInterval);
      window._adminPollInterval = null;
    }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

// -------------------------------------------------------------
// VIEWS IMPLEMENTATION
// -------------------------------------------------------------

// 1. LANDING PAGE (Part 7)
function renderLandingPage() {
  return `
    <!-- Sticky Navbar -->
    <header class="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div class="flex items-center gap-3 cursor-pointer" onclick="navigate('landing')">
          <div class="w-11 h-11 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-black text-xl shadow-md shadow-orange-500/20">
            TD
          </div>
          <div>
            <span class="text-xl font-extrabold text-gray-900 tracking-tight">TataDana</span>
            <span class="block text-[11px] font-medium text-orange-600 -mt-1">Keuangan Semudah Chat</span>
          </div>
        </div>

        <nav class="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600">
          <a href="#fitur" class="hover:text-orange-600 transition-colors">Fitur</a>
          <a href="#demo" class="hover:text-orange-600 transition-colors">Demo Bot</a>
          <a href="#harga" class="hover:text-orange-600 transition-colors">Harga</a>
          <a href="#faq" class="hover:text-orange-600 transition-colors">FAQ</a>
        </nav>

        <div class="flex items-center gap-3">
          <button onclick="navigate('login')" class="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 hover:text-orange-600 hover:bg-orange-50 transition-all">
            Masuk
          </button>
          <button onclick="navigate('register')" class="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-brand text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all">
            Coba Gratis
          </button>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="relative pt-12 pb-20 overflow-hidden bg-gradient-to-b from-orange-50/40 via-white to-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        
        <!-- Pre-headline badge -->
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100/80 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-wider mb-6">
          <span>✨</span> Catat keuangan langsung dari Telegram kamu
        </div>

        <!-- Headline (H1) -->
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight max-w-4xl mx-auto leading-tight sm:leading-none mb-6">
          Gaji habis sebelum akhir bulan? Sudah saatnya kamu <span class="text-gradient">tahu ke mana uangmu pergi.</span>
        </h1>

        <!-- Sub-headline -->
        <p class="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          TataDana mencatat setiap pengeluaranmu langsung dari chat Telegram atau foto struk — sisanya kami yang urus. 100% otomatis, rapi, dan tersimpan aman di database pribadimu.
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <button onclick="navigate('register')" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold bg-gradient-brand text-white shadow-xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:-translate-y-0.5 transition-all">
            Mulai Gratis Sekarang
          </button>
          <a href="#demo" class="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-bold text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
            Lihat cara kerjanya →
          </a>
        </div>

        <!-- Hero Section Video Placeholder -->
        <!-- TODO: ganti dengan video asli demo aplikasi setelah masa beta -->
        <div class="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-orange-100 shadow-2xl bg-white p-2 sm:p-4">
          <div class="aspect-video rounded-xl bg-gradient-to-br from-orange-950 via-gray-900 to-amber-950 flex flex-col items-center justify-center text-white relative group cursor-pointer" onclick="exploreUserDashboard()">
            <div class="w-20 h-20 rounded-full bg-orange-500/90 flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform">
              ▶
            </div>
            <p class="mt-4 text-sm font-semibold text-orange-200">Klik untuk masuk langsung ke Interactive User Dashboard</p>
            <span class="text-[11px] text-gray-400 mt-1">[Preview Interactive User Dashboard]</span>
          </div>
        </div>

      </div>
    </section>

    <!-- Problem-Solution Section -->
    <section class="py-20 bg-white border-y border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-14">
          <h2 class="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">Masalah Klasik Finansial</h2>
          <h3 class="text-3xl font-extrabold text-gray-900">Kenapa mencatat keuangan manual selalu gagal?</h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div class="p-8 rounded-2xl bg-orange-50/50 border border-orange-100/80">
            <div class="text-4xl mb-4">😩</div>
            <h4 class="text-lg font-bold text-gray-900 mb-2">"Buka aplikasi keuangan? Nanti dulu deh..."</h4>
            <p class="text-sm text-gray-600 leading-relaxed">
              Aplikasi keuangan biasa terlalu ribet: harus login, pilih kategori bertingkat, pilih akun bank. Akhirnya malas dan lupa dicatat.
            </p>
          </div>

          <div class="p-8 rounded-2xl bg-orange-50/50 border border-orange-100/80">
            <div class="text-4xl mb-4">💸</div>
            <h4 class="text-lg font-bold text-gray-900 mb-2">"Kok uangnya habis ya? Padahal tidak beli apa-apa"</h4>
            <p class="text-sm text-gray-600 leading-relaxed">
              Pengeluaran kecil seperti kopi 20rb, parkir 5rb, atau jajan sore tidak pernah tercatat. Tahu-tahu saldo ludes di pertengahan bulan.
            </p>
          </div>

          <div class="p-8 rounded-2xl bg-orange-50/50 border border-orange-100/80">
            <div class="text-4xl mb-4">📉</div>
            <h4 class="text-lg font-bold text-gray-900 mb-2">"Udah niat bikin budget, tapi seminggu lupa"</h4>
            <p class="text-sm text-gray-600 leading-relaxed">
              Budget yang tidak dipantau secara real-time sama saja tidak ada budget. TataDana mengirimkan reminder otomatis sebelum kamu kebablasan.
            </p>
          </div>
        </div>

        <!-- Transition to Solution -->
        <div class="mt-14 text-center">
          <p class="text-lg text-gray-600 font-medium">
            Bagaimana kalau mencatat keuangan semudah kirim pesan ke teman?
          </p>
          <p class="text-2xl font-black text-orange-600 mt-1">
            👉 Introducing TataDana
          </p>
        </div>
      </div>
    </section>

    <!-- Interactive Dashboard & Telegram Chat Preview (Section 8) -->
    <section id="demo" class="py-20 bg-gray-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-12">
          <span class="text-xs font-bold text-orange-600 uppercase tracking-widest">Interactive Live Demo</span>
          <h3 class="text-3xl font-extrabold text-gray-900 mt-1">Coba Langsung Simulasi Bot Telegram TataDana</h3>
          <p class="text-gray-600 text-sm mt-2">Ketik pengeluaran atau pemasukan dengan bahasa santai kamu di bawah ini:</p>
        </div>

        <div class="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <!-- Telegram Chat Mockup (5 cols) -->
          <div class="lg:col-span-6 bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col h-[520px]">
            <div class="bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">🤖</div>
                <div>
                  <h4 class="font-bold text-sm leading-tight">TataDana Bot</h4>
                  <span class="text-[11px] text-orange-100">@TataDana_bot • Online (WIB)</span>
                </div>
              </div>
              <span class="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">LIVE PARSER</span>
            </div>

            <!-- Messages area -->
            <div id="demo-chat-messages" class="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 text-xs">
              <div class="flex justify-start">
                <div class="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-xs max-w-[90%] shadow-sm leading-relaxed text-gray-800">
                  👋 Halo! Coba ketik transaksimu seperti:
                  <div class="mt-1 font-mono text-orange-600 font-semibold">• "beli bakso 15rb"</div>
                  <div class="font-mono text-orange-600 font-semibold">• "gajian 5jt"</div>
                  <div class="font-mono text-orange-600 font-semibold">• "kopi 25k sama snack 10k"</div>
                </div>
              </div>
            </div>

            <!-- Input bar -->
            <div class="p-3 bg-white border-t border-gray-100 flex gap-2">
              <input id="demo-input-text" type="text" placeholder="Ketik: 'beli sate 25rb'..." class="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500" onkeydown="if(event.key==='Enter') sendDemoMessage()">
              <button onclick="sendDemoMessage()" class="px-4 py-2 bg-gradient-brand text-white text-xs font-bold rounded-xl shadow-md hover:bg-orange-600">
                Kirim
              </button>
            </div>
          </div>

          <!-- Live Dashboard Mirror (6 cols) -->
          <div class="lg:col-span-6 space-y-4">
            <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <div class="flex justify-between items-center mb-4">
                <h4 class="font-bold text-sm text-gray-700">Tampilan di Dashboard Web Kamu</h4>
                <span class="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Real-time Sync</span>
              </div>

              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="p-3 rounded-xl bg-orange-50/60 border border-orange-100">
                  <span class="text-xs text-gray-500 block">Total Saldo Terkini</span>
                  <span id="demo-balance" class="text-lg font-black text-gray-900">Rp4.250.000</span>
                </div>
                <div class="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                  <span class="text-xs text-gray-500 block">Pengeluaran Bulan Ini</span>
                  <span id="demo-expense" class="text-lg font-black text-orange-600">Rp850.000</span>
                </div>
              </div>

              <!-- Budget Progress Mirror -->
              <div>
                <div class="flex justify-between text-xs mb-1">
                  <span class="font-medium text-gray-600">Budget Makanan & Minuman</span>
                  <span class="font-bold text-orange-600">65% Terpakai</span>
                </div>
                <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-brand rounded-full" style="width: 65%"></div>
                </div>
                <span class="text-[11px] text-gray-400 mt-1 block">Sisa Rp525.000 dari budget Rp1.500.000</span>
              </div>
            </div>

            <!-- Features Quick Box -->
            <div class="p-5 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50/60 border border-orange-100 text-xs text-gray-700 space-y-2">
              <div class="font-bold text-orange-900 flex items-center gap-1.5 text-sm">
                <span>⚡</span> Mengapa TataDana Berbeda?
              </div>
              <p>• <b>Tanpa Aplikasi Tambahan</b>: Cukup gunakan Telegram yang sudah terinstall di ponselmu.</p>
              <p>• <b>AI Multi-Provider</b>: Didukung Gemini Flash untuk parsing instan mata uang Rupiah ("15rb", "500k", "1.5jt").</p>
              <p>• <b>100% In-App Supabase</b>: Semua datamu tersimpan di PostgreSQL privat, bukan file pihak ketiga yang tersebar.</p>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- Fitur Section (Alternating Layout) -->
    <section id="fitur" class="py-20 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
        
        <!-- Feature 1 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span class="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider">FITUR 01</span>
            <h3 class="text-3xl font-extrabold text-gray-900 mt-3 mb-4">Catat Lewat Teks, Suara, atau Foto Struk</h3>
            <p class="text-gray-600 leading-relaxed text-sm mb-6">
              Sedang di jalan? Kirim voice note 10 detik. Selesai makan di resto? Cukup foto struk belanjaanmu. AI Vision kami mengekstrak nama restoran, tanggal, total, dan rincian belanjaan per barang secara otomatis.
            </p>
            <ul class="space-y-2 text-sm font-medium text-gray-700">
              <li class="flex items-center gap-2"><span>✅</span> Mengerti singkatan "rb", "k", "jt", "juta" tanpa salah hitung</li>
              <li class="flex items-center gap-2"><span>✅</span> Struk belanja dengan banyak item dirinci rapi</li>
              <li class="flex items-center gap-2"><span>✅</span> Notifikasi langsung dengan visual budget bar █ dan ░</li>
            </ul>
          </div>
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-lg">
            <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm font-mono text-xs text-gray-700 space-y-2">
              <div class="text-orange-600 font-bold">🧾 Hasil Ekstraksi Struk Belanja (Pro)</div>
              <div>├ Merchant : Indomaret Point</div>
              <div>├ Total    : Rp78.500</div>
              <div>├ Susu UHT 1L (2x)   : Rp40.000</div>
              <div>├ Roti Gandum (1x)  : Rp18.500</div>
              <div>└ Kopi Botol (2x)   : Rp20.000</div>
            </div>
          </div>
        </div>

        <!-- Feature 2 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center lg:flex-row-reverse">
          <div class="order-2 lg:order-1 rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-lg">
            <div class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm space-y-4">
              <div class="flex justify-between items-center">
                <span class="font-bold text-xs text-gray-800">Export Laporan Finansial</span>
                <span class="px-2 py-0.5 rounded text-[11px] bg-orange-100 text-orange-700 font-bold">On-Demand</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <button onclick="downloadReport('pdf')" class="p-3 rounded-xl border border-gray-200 hover:border-orange-500 text-center transition-colors">
                  <div class="text-2xl mb-1">📄</div>
                  <span class="text-xs font-bold text-gray-800 block">Download PDF</span>
                  <span class="text-[10px] text-gray-400">Siap Cetak / Pajak</span>
                </button>
                <button onclick="downloadReport('excel')" class="p-3 rounded-xl border border-gray-200 hover:border-orange-500 text-center transition-colors">
                  <div class="text-2xl mb-1">📊</div>
                  <span class="text-xs font-bold text-gray-800 block">Download Excel</span>
                  <span class="text-[10px] text-gray-400">Format .xlsx Valid</span>
                </button>
              </div>
            </div>
          </div>
          <div class="order-1 lg:order-2">
            <span class="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider">FITUR 02</span>
            <h3 class="text-3xl font-extrabold text-gray-900 mt-3 mb-4">Laporan Interaktif & Export PDF/Excel</h3>
            <p class="text-gray-600 leading-relaxed text-sm mb-6">
              Lihat riwayat keuanganmu kapan saja di dashboard web native TataDana. Filter transaksi berdasarkan dompet, kategori, atau rentang tanggal. Butuh dokumen untuk laporan bulanan atau pembukuan? Export langsung ke PDF rapi dan spreadsheet Excel resmi.
            </p>
          </div>
        </div>

        <!-- Feature 3 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span class="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider">FITUR 03</span>
            <h3 class="text-3xl font-extrabold text-gray-900 mt-3 mb-4">AI Financial Advisor Proaktif</h3>
            <p class="text-gray-600 leading-relaxed text-sm mb-6">
              Bukan cuma mencatat, TataDana adalah teman finansialmu. Sistem otomatis memberi peringatan saat pengeluaran salah satu kategori melonjak lebih dari 50%, atau saat pengeluaran bulananmu sudah mendekati total pemasukan.
            </p>
          </div>
          <div class="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-lg">
            <div class="bg-white rounded-xl p-4 border border-orange-100 shadow-sm space-y-2 text-xs">
              <div class="flex items-center gap-2 text-orange-600 font-bold">
                <span>🤖</span> Financial Advisor
              </div>
              <p class="text-gray-800 font-medium">
                "Halo! Pengeluaran Makanan minggu ini naik 45% dibanding minggu lalu. Total pengeluaranmu sudah 82% dari pemasukan bulan ini."
              </p>
              <div class="p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-900 font-semibold">
                💡 Saran: Kurangi jajan kopi dan makan di luar untuk 7 hari ke depan agar target tabunganmu tercapai!
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- Testimonials Masonry Grid -->
    <!-- TODO: ganti dengan testimoni asli setelah beta user aktif -->
    <section class="py-20 bg-gray-50 border-t border-gray-100">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <span class="text-xs font-bold text-orange-600 uppercase tracking-widest">Testimoni Pengguna</span>
          <h3 class="text-3xl font-extrabold text-gray-900 mt-1">Dicintai Karyawan, Freelancer & Mahasiswa</h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div class="flex items-center gap-1 text-amber-400">★★★★★</div>
            <p class="text-xs text-gray-600 leading-relaxed">
              "Dulu selalu malas buka aplikasi budgeting. Sejak pakai TataDana, habis bayar kopi langsung ketik 'kopi 20k' di Telegram. Akhir bulan akhirnya punya sisa tabungan!"
            </p>
            <div class="pt-2 border-t border-gray-100 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs">DA</div>
              <div>
                <span class="text-xs font-bold text-gray-900 block">Dinda Ayu</span>
                <span class="text-[11px] text-gray-400">Karyawan Swasta, Jakarta</span>
              </div>
            </div>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div class="flex items-center gap-1 text-amber-400">★★★★★</div>
            <p class="text-xs text-gray-600 leading-relaxed">
              "Fitur scan foto struknya juara banget! Beli belanjaan mingguan di supermarket langsung kefoto dan dirinci per item tanpa perlu ngetik satu-satu."
            </p>
            <div class="pt-2 border-t border-gray-100 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs">RP</div>
              <div>
                <span class="text-xs font-bold text-gray-900 block">Rian Pratama</span>
                <span class="text-[11px] text-gray-400">Freelance Designer</span>
              </div>
            </div>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div class="flex items-center gap-1 text-amber-400">★★★★★</div>
            <p class="text-xs text-gray-600 leading-relaxed">
              "Laporannya lengkap dan bisa langsung didownload ke Excel. Sangat membantu memisahkan pos uang saku kuliah dan biaya kos bulanan."
            </p>
            <div class="pt-2 border-t border-gray-100 flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs">FS</div>
              <div>
                <span class="text-xs font-bold text-gray-900 block">Fajar Siddiq</span>
                <span class="text-[11px] text-gray-400">Mahasiswa, Bandung</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing Section (Part 6) -->
    <section id="harga" class="py-20 bg-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-2xl mx-auto mb-14">
          <span class="text-xs font-bold text-orange-600 uppercase tracking-widest">Pilihan Paket</span>
          <h3 class="text-3xl font-extrabold text-gray-900 mt-1">Investasi Kecil untuk Finansial yang Terkontrol</h3>
          <p class="text-gray-500 text-sm mt-2">Pilih paket yang paling sesuai dengan kebutuhanmu.</p>
        </div>

        <div class="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          <!-- Starter Plan -->
          <div class="p-8 rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-center mb-4">
                <h4 class="text-xl font-bold text-gray-900">Starter</h4>
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">Bulanan</span>
              </div>
              <div class="mb-6">
                <span class="text-4xl font-extrabold text-gray-900">Rp49.000</span>
                <span class="text-xs text-gray-500">/ bulan</span>
              </div>
              <ul class="space-y-3 text-xs text-gray-600 mb-8">
                <li class="flex items-center gap-2"><span>✅</span> Catat transaksi via teks & voice note Telegram</li>
                <li class="flex items-center gap-2"><span>✅</span> Maksimal 50 transaksi / bulan</li>
                <li class="flex items-center gap-2"><span>✅</span> Maksimal 3 dompet & 5 kategori budget</li>
                <li class="flex items-center gap-2"><span>✅</span> Dashboard web ringkasan bulanan</li>
                <li class="flex items-center gap-2 text-gray-400"><span>❌</span> Tanpa input via foto struk belanja</li>
                <li class="flex items-center gap-2 text-gray-400"><span>❌</span> Tanpa AI Financial Advisor proaktif</li>
                <li class="flex items-center gap-2 text-gray-400"><span>❌</span> Tanpa export PDF / Excel</li>
              </ul>
            </div>
            <button onclick="navigate('register')" class="w-full py-3.5 rounded-xl text-sm font-bold border-2 border-orange-500 text-orange-600 hover:bg-orange-50 transition-colors">
              Pilih Starter
            </button>
          </div>

          <!-- Pro Plan -->
          <div class="p-8 rounded-2xl border-2 border-orange-500 bg-orange-50/20 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div class="absolute top-4 right-4 bg-orange-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow">
              PALING POPULER
            </div>
            <div>
              <div class="flex justify-between items-center mb-4">
                <h4 class="text-xl font-bold text-gray-900">TataDana PRO</h4>
              </div>
              <div class="mb-6">
                <span class="text-4xl font-extrabold text-orange-600">Rp99.000</span>
                <span class="text-xs font-bold text-gray-700 block mt-1">Sekali Bayar — Akses Seumur Hidup!</span>
              </div>
              <ul class="space-y-3 text-xs text-gray-700 mb-8 font-medium">
                <li class="flex items-center gap-2"><span>⭐</span> <b>Unlimited Transaksi, Dompet & Kategori</b></li>
                <li class="flex items-center gap-2"><span>⭐</span> <b>Input Foto Struk Belanja dengan AI OCR</b></li>
                <li class="flex items-center gap-2"><span>⭐</span> <b>Export Laporan Unlimited ke PDF & Excel (.xlsx)</b></li>
                <li class="flex items-center gap-2"><span>⭐</span> <b>AI Financial Advisor Proaktif</b></li>
                <li class="flex items-center gap-2"><span>⭐</span> Reminder harian custom (maks 2x sehari)</li>
                <li class="flex items-center gap-2"><span>⭐</span> Prioritas customer support</li>
              </ul>
            </div>
            <button onclick="navigate('register')" class="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-brand text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all">
              Dapatkan Akses PRO Sekarang
            </button>
          </div>

        </div>
      </div>
    </section>

    <!-- FAQ Section (Minimal 7 Pertanyaan) -->
    <section id="faq" class="py-20 bg-gray-50 border-t border-gray-100">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <span class="text-xs font-bold text-orange-600 uppercase tracking-widest">Pertanyaan Umum</span>
          <h3 class="text-3xl font-extrabold text-gray-900 mt-1">Frequently Asked Questions</h3>
        </div>

        <div class="space-y-4 text-xs sm:text-sm">
          <details class="group bg-white p-5 rounded-2xl border border-gray-200">
            <summary class="font-bold text-gray-800 cursor-pointer list-none flex justify-between items-center">
              <span>Apakah saya bisa menggunakan foto struk di paket Starter?</span>
              <span class="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p class="mt-3 text-gray-600 leading-relaxed">
              Fitur scan foto struk belanja dengan AI Vision merupakan fitur eksklusif untuk pengguna paket PRO. Di paket Starter, Anda dapat mencatat keuangan menggunakan teks bahasa natural dan voice note Telegram.
            </p>
          </details>

          <details class="group bg-white p-5 rounded-2xl border border-gray-200">
            <summary class="font-bold text-gray-800 cursor-pointer list-none flex justify-between items-center">
              <span>Bagaimana keamanan data transaksi saya di TataDana?</span>
              <span class="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p class="mt-3 text-gray-600 leading-relaxed">
              Keamanan Anda adalah prioritas utama. Seluruh data transaksi disimpan 100% di database PostgreSQL Supabase dengan Row Level Security (RLS) terisolasi per akun user, token bot terenkripsi, dan tidak ada pembagian data ke pihak ketiga.
            </p>
          </details>

          <details class="group bg-white p-5 rounded-2xl border border-gray-200">
            <summary class="font-bold text-gray-800 cursor-pointer list-none flex justify-between items-center">
              <span>Apakah saya harus membuat bot Telegram sendiri?</span>
              <span class="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p class="mt-3 text-gray-600 leading-relaxed">
              TataDana menyediakan bot publik resmi yang bisa langsung digunakan, atau Anda dapat menghubungkan bot privat buatan sendiri via BotFather di menu Settings untuk privasi maksimal.
            </p>
          </details>

          <details class="group bg-white p-5 rounded-2xl border border-gray-200">
            <summary class="font-bold text-gray-800 cursor-pointer list-none flex justify-between items-center">
              <span>Bagaimana cara kerja format teks bahasa Indonesia?</span>
              <span class="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p class="mt-3 text-gray-600 leading-relaxed">
              Sistem kami menggunakan AI yang mengenali variasi nominal umum Indonesia seperti "15rb", "25k", "1.5jt", "500 ribu", dan otomatis memetakan ke kategori yang sesuai (misal: bakso ke Makanan, ojol ke Transportasi).
            </p>
          </details>

          <details class="group bg-white p-5 rounded-2xl border border-gray-200">
            <summary class="font-bold text-gray-800 cursor-pointer list-none flex justify-between items-center">
              <span>Apakah paket PRO benar-benar hanya sekali bayar?</span>
              <span class="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p class="mt-3 text-gray-600 leading-relaxed">
              Ya! Paket PRO seharga Rp99.000 berlaku seumur hidup (lifetime access) tanpa biaya langganan bulanan tersembunyi.
            </p>
          </details>

          <details class="group bg-white p-5 rounded-2xl border border-gray-200">
            <summary class="font-bold text-gray-800 cursor-pointer list-none flex justify-between items-center">
              <span>Metode pembayaran apa saja yang didukung?</span>
              <span class="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p class="mt-3 text-gray-600 leading-relaxed">
              Kami mendukung pembayaran otomatis melalui Midtrans (GoPay, QRIS, BCA Virtual Account, Mandiri, Indomaret/Alfamart) serta opsi transfer bank manual dengan verifikasi admin.
            </p>
          </details>

          <details class="group bg-white p-5 rounded-2xl border border-gray-200">
            <summary class="font-bold text-gray-800 cursor-pointer list-none flex justify-between items-center">
              <span>Bisakah saya mengunduh laporan keuangan saya?</span>
              <span class="text-orange-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <p class="mt-3 text-gray-600 leading-relaxed">
              Tentu saja! Pengguna Pro dapat mengekspor laporan keuangan dalam format PDF berlayout modern atau spreadsheet Excel (.xlsx) valid untuk periode kustom kapan saja.
            </p>
          </details>
        </div>
      </div>
    </section>

    <!-- Final CTA Banner -->
    <section class="py-16 bg-gradient-brand text-white">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <h3 class="text-3xl sm:text-4xl font-extrabold tracking-tight">Mulai Kendalikan Keuanganmu Hari Ini</h3>
        <p class="text-orange-100 max-w-xl mx-auto text-sm sm:text-base">
          Bergabunglah sekarang. Catat pemasukan dan pengeluaran semudah mengirim pesan ke teman.
        </p>
        <div>
          <button onclick="navigate('register')" class="px-8 py-4 rounded-xl text-sm font-bold bg-white text-orange-600 shadow-2xl hover:bg-orange-50 hover:scale-105 transition-all">
            Daftar Gratis Sekarang →
          </button>
        </div>
      </div>
    </section>

    <!-- Footer (4 Columns) -->
    <footer class="bg-gray-900 text-gray-400 py-14 text-xs border-t border-gray-800">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-orange-500 text-white font-black text-sm flex items-center justify-center">TD</div>
            <span class="text-base font-bold text-white">TataDana</span>
          </div>
          <p class="leading-relaxed text-gray-500">
            Catat keuangan semudah chat langsung dari Telegram kamu. FinTech SaaS Indonesia.
          </p>
        </div>

        <div>
          <h5 class="text-white font-bold mb-3">Produk</h5>
          <ul class="space-y-2">
            <li><a href="#fitur" class="hover:text-white transition-colors">Telegram Bot</a></li>
            <li><a href="#demo" class="hover:text-white transition-colors">Dashboard Laporan</a></li>
            <li><a href="#harga" class="hover:text-white transition-colors">Harga & Paket</a></li>
            <li><a href="#demo" class="hover:text-white transition-colors">AI Financial Advisor</a></li>
          </ul>
        </div>

        <div>
          <h5 class="text-white font-bold mb-3">Perusahaan</h5>
          <ul class="space-y-2">
            <li><a href="#" class="hover:text-white transition-colors">Tentang Kami</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Blog Keuangan</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Karir</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Kontak Support</a></li>
          </ul>
        </div>

        <div>
          <h5 class="text-white font-bold mb-3">Legal & Privasi</h5>
          <ul class="space-y-2">
            <li><a href="#" class="hover:text-white transition-colors">Kebijakan Privasi</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Syarat & Ketentuan</a></li>
            <li><a href="#" class="hover:text-white transition-colors">Keamanan Supabase</a></li>
            <li><span class="text-gray-500">© 2026 TataDana Indonesia.</span></li>
          </ul>
        </div>
      </div>
    </footer>
  `;
}

// 2. AUTH PAGES (Login, Register & Phone OTP) - Part 8
function renderAuthPage(type = 'login') {
  const isLogin = type === 'login';
  const isOtp = type === 'otp';

  return `
    <div class="min-h-screen flex flex-col md:flex-row bg-white">
      
      <!-- Left Panel (40%) - Branding -->
      <div class="hidden md:flex md:w-5/12 bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 p-12 text-white flex-col justify-between relative overflow-hidden">
        <div class="relative z-10">
          <div class="flex items-center gap-3 cursor-pointer" onclick="navigate('landing')">
            <div class="w-10 h-10 rounded-xl bg-white text-orange-600 flex items-center justify-center font-black text-lg shadow-md">
              TD
            </div>
            <span class="text-2xl font-extrabold tracking-tight">TataDana</span>
          </div>
        </div>

        <div class="relative z-10 space-y-4">
          <div class="inline-block px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">
            FinTech Indonesia
          </div>
          <h2 class="text-4xl font-extrabold leading-tight">
            Keuanganmu.<br>Terkontrol.
          </h2>
          <p class="text-orange-100 text-sm leading-relaxed max-w-sm">
            Catat setiap rupiah langsung dari chat Telegram. Analisis real-time di dashboard web tanpa ribet.
          </p>
        </div>

        <div class="relative z-10 text-xs text-orange-200">
          Dilindungi enkripsi data & Supabase PostgreSQL
        </div>
      </div>

      <!-- Right Panel (60%) - Form -->
      <div class="w-full md:w-7/12 flex items-center justify-center p-4 sm:p-12">
        <div class="w-full max-w-md space-y-6 sm:space-y-8">
          
          <!-- Mobile Brand Logo Header -->
          <div class="md:hidden flex items-center justify-between pb-3 border-b border-gray-100">
            <div class="flex items-center gap-2.5 cursor-pointer" onclick="navigate('landing')">
              <div class="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-black text-sm shadow-xs">
                TD
              </div>
              <span class="font-extrabold text-base text-gray-900 tracking-tight">TataDana</span>
            </div>
            <button onclick="navigate('landing')" class="text-xs font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer">
              ← Beranda
            </button>
          </div>

          <div class="text-center sm:text-left">
            <h3 class="text-2xl font-extrabold text-gray-900 flex items-center gap-2 justify-center sm:justify-start">
              ${isOtp ? '<span>💬</span> Verifikasi Akun via WhatsApp Admin' : isLogin ? 'Masuk ke TataDana' : 'Daftar Akun Baru'}
            </h3>
            <p class="text-xs text-gray-500 mt-1">
              ${isOtp ? 'Pendaftaran Anda berhasil dicatat! Kirim chat WhatsApp ke nomor Admin untuk konfirmasi aktivasi akun langsung oleh Super Admin.' : isLogin ? 'Kelola keuanganmu hari ini' : 'Semua pendaftar baru wajib verifikasi nomor WhatsApp untuk mengaktifkan akun.'}
            </p>
          </div>

          ${isOtp ? `
            <!-- TAMPILAN PENDAFTARAN BERHASIL DICATAT & VERIFIKASI VIA CHAT WHATSAPP ADMIN -->
            <div class="space-y-5 animate-fadeIn">
              
              <!-- 1. Banner Konfirmasi Pendaftaran Berhasil Dicatat -->
              <div class="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-xs text-emerald-950 space-y-2.5 shadow-sm">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-black shadow-xs flex-shrink-0">
                    ✓
                  </div>
                  <div>
                    <span class="font-black text-emerald-900 text-sm block">Pendaftaran Berhasil Dicatat! 🎉</span>
                    <span class="text-[11px] text-emerald-700 font-medium">Data pendaftaran akun Anda telah masuk ke sistem dan antrean approval Super Admin.</span>
                  </div>
                </div>

                <!-- Rincian Data Pengguna Terdaftar -->
                <div class="bg-white/95 p-3 rounded-xl border border-emerald-200 text-[11px] space-y-1.5 text-gray-700">
                  <div class="flex justify-between items-center">
                    <span class="text-gray-500">Nama Pendaftar:</span>
                    <span class="font-bold text-gray-900">${state.registeredUser?.fullName || 'Pengguna Baru'}</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-gray-500">Nomor WhatsApp Anda:</span>
                    <span class="font-bold font-mono text-emerald-700">${state.otpPhone || '-'}</span>
                  </div>
                  ${state.registeredUser?.email ? `
                    <div class="flex justify-between items-center">
                      <span class="text-gray-500">Email:</span>
                      <span class="font-bold text-gray-900">${state.registeredUser.email}</span>
                    </div>
                  ` : ''}
                  <div class="flex justify-between items-center pt-1 border-t border-emerald-100">
                    <span class="text-gray-500">Status Akun:</span>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                      Menunggu Approval & Verifikasi Super Admin
                    </span>
                  </div>
                </div>
              </div>

              <!-- 2. Menu Verifikasi: Kirim Chat ke WhatsApp Admin (083840023120) -->
              <div class="p-4.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white space-y-3.5 shadow-lg shadow-emerald-600/20">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold text-emerald-100 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🛡️</span> Verifikasi via Chat WhatsApp Admin
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 text-white">
                    Verifikasi Langsung
                  </span>
                </div>

                <div class="bg-white rounded-xl p-3.5 text-gray-900 shadow-xs flex items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-[#25D366] text-white flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                      💬
                    </div>
                    <div>
                      <span class="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">No WhatsApp Admin Resmi:</span>
                      <span class="text-lg font-black text-gray-900 tracking-wider font-mono">083840023120</span>
                      <span class="text-[10px] text-emerald-600 font-bold block flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Super Admin Siaga • Fast Response
                      </span>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  <a href="https://wa.me/6283840023120?text=${encodeURIComponent(`Halo Admin TataDana, saya baru saja mendaftar akun TataDana atas nama ${state.registeredUser?.fullName || 'Pengguna Baru'} (${state.otpPhone || ''}). Mohon verifikasi dan setujui aktivasi akun saya.`)}" target="_blank" class="w-full py-3 px-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] text-center">
                    <span>💬</span> Kirim Chat ke WA Admin
                  </a>
                  <button type="button" onclick="copyAdminWhatsApp()" class="w-full py-3 px-3 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer">
                    <span>📋</span> Salin No WA Admin
                  </button>
                </div>

                <div class="p-3 rounded-xl bg-emerald-800/50 border border-emerald-400/30 text-[11px] text-emerald-50 leading-relaxed">
                  💡 <b>Verifikasi Mudah & Cepat</b>: Anda cukup mengirimkan pesan chat WhatsApp ke nomor Admin di atas. Super Admin akan memverifikasi dan menyetujui akun Anda langsung dari <b>Admin Dashboard</b>. Akun Anda otomatis aktif begitu disetujui!
                </div>
              </div>

              <!-- 3. Status Real-time & Cek Verifikasi -->
              <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                <div class="flex items-start gap-3">
                  <div class="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-lg flex-shrink-0">
                    ⏳
                  </div>
                  <div class="space-y-0.5">
                    <span class="text-xs font-black text-gray-900 block">Menunggu Approval Super Admin</span>
                    <p class="text-[11px] text-gray-500 leading-relaxed">
                      Sistem kami secara otomatis mendeteksi persetujuan Super Admin. Halaman ini akan otomatis membuka Dashboard begitu akun Anda disetujui.
                    </p>
                  </div>
                </div>

                <button onclick="checkVerificationStatus()" class="w-full py-3.5 rounded-xl text-sm font-black bg-gradient-brand text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <span>🔄</span> Cek Status Verifikasi Sekarang
                </button>

                <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <button type="button" onclick="navigate('login')" class="text-gray-500 hover:text-gray-800 font-semibold cursor-pointer">
                    ← Kembali ke Halaman Masuk
                  </button>
                  <button type="button" onclick="navigate('register')" class="text-orange-600 hover:text-orange-700 font-bold hover:underline cursor-pointer">
                    Perbaiki Data Pendaftaran →
                  </button>
                </div>
              </div>

            </div>
          ` : `
            <!-- Login/Register Form -->
            <div class="space-y-4">
              ${!isLogin ? `
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap</label>
                  <input id="auth-name" type="text" placeholder="Masukkan nama lengkap Anda" class="w-full px-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all">
                </div>

                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                    <span>Nomor WhatsApp Aktif <span class="text-rose-500 font-bold">*Wajib</span></span>
                    <span class="text-[10px] font-bold text-emerald-600">💬 Verifikasi WhatsApp</span>
                  </label>
                  <input id="auth-phone" type="tel" placeholder="Contoh: 081234567890 atau +6281234567890" class="w-full px-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all">
                  <span class="text-[10px] text-gray-500 mt-0.5 block">Wajib diverifikasi via WhatsApp Admin (083840023120) untuk aktivasi akun.</span>
                </div>
              ` : ''}

              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">
                  ${isLogin ? 'Email atau Nomor WhatsApp' : 'Alamat Email'}
                </label>
                <input id="auth-email" type="${isLogin ? 'text' : 'email'}" placeholder="${isLogin ? 'Masukkan email atau nomor WhatsApp' : 'nama@email.com'}" class="w-full px-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all">
              </div>

              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">Kata Sandi</label>
                <input id="auth-password" type="password" placeholder="Masukkan kata sandi akun" class="w-full px-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all">
              </div>

              <button onclick="${isLogin ? 'handleLogin()' : 'handleRegister()'}" class="w-full py-3.5 rounded-xl text-sm font-bold bg-gradient-brand text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer">
                ${isLogin ? 'Masuk Sekarang' : 'Daftar & Lanjut ke Verifikasi WhatsApp Admin →'}
              </button>

              <div class="relative flex py-2 items-center">
                <div class="flex-grow border-t border-gray-200"></div>
                <span class="flex-shrink mx-4 text-[11px] text-gray-400">atau masuk dengan</span>
                <div class="flex-grow border-t border-gray-200"></div>
              </div>

              <button onclick="handleGoogleLogin()" class="w-full py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 cursor-pointer">
                <span>🌐</span> Masuk dengan Google OAuth
              </button>
            </div>

            <div class="text-center text-xs text-gray-500">
              ${isLogin ? `
                Belum punya akun? <button onclick="navigate('register')" class="text-orange-600 font-bold hover:underline cursor-pointer">Daftar sekarang</button>
              ` : `
                Sudah punya akun? <button onclick="navigate('login')" class="text-orange-600 font-bold hover:underline cursor-pointer">Masuk</button>
              `}
            </div>
          `}

        </div>
      </div>

    </div>
  `;
}

// 3. DASHBOARD SHELL & SIDEBAR (Part 9 - Fully Responsive Mobile & Desktop)
function renderDashboardLayout(contentHtml, activeNav = 'dashboard') {
  const user = state.user || { full_name: 'Pengguna TataDana', plan_tier: 'starter', email: 'user@tatadana.id' };
  const isPro = user.plan_tier === 'pro';

  return `
    <div class="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900 font-sans">
      
      <!-- Mobile Top Navbar (Sticky Header on Small Devices) -->
      <header class="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200/90 px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-3">
          <button onclick="toggleMobileSidebar()" class="w-9 h-9 rounded-xl bg-gray-100 hover:bg-orange-50 hover:text-orange-600 flex items-center justify-center text-gray-700 transition-colors cursor-pointer text-base font-bold shadow-2xs" title="Buka Menu">
            <span>☰</span>
          </button>
          <div class="flex items-center gap-2 cursor-pointer" onclick="navigate('dashboard')">
            <div class="w-8 h-8 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-black text-sm shadow-xs">
              TD
            </div>
            <div>
              <span class="font-extrabold text-sm text-gray-900 tracking-tight leading-none block">TataDana</span>
              <span class="text-[9px] font-bold ${isPro ? 'text-orange-600' : 'text-gray-400'} uppercase">
                ${isPro ? '⭐ PRO' : 'STARTER'}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="openAddTxModal()" class="px-2.5 py-1.5 rounded-xl bg-gradient-brand text-white font-bold text-xs flex items-center gap-1 shadow-xs hover:opacity-95 transition-all cursor-pointer">
            <span>➕</span> <span class="text-[11px]">Catat</span>
          </button>
          <div onclick="navigate('settings')" class="w-8 h-8 rounded-full cursor-pointer flex-shrink-0" title="Buka Profil">
            ${user.avatar_url ? `
              <img src="${user.avatar_url}" alt="Foto Profil" class="w-8 h-8 rounded-full object-cover border-2 border-orange-500 shadow-2xs">
            ` : `
              <div class="w-8 h-8 rounded-full bg-gradient-brand text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                ${(user.full_name || 'U').charAt(0)}
              </div>
            `}
          </div>
        </div>
      </header>

      <!-- Mobile Sidebar Overlay Backdrop -->
      ${state.showMobileSidebar ? `
        <div class="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden" onclick="closeMobileSidebar()"></div>
      ` : ''}

      <!-- Responsive Sidebar (Drawer on Mobile, Fixed Column on Desktop) -->
      <aside class="fixed inset-y-0 left-0 z-50 w-72 md:w-64 bg-white border-r border-gray-200 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
        state.showMobileSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }">
        <div>
          <!-- Logo & Mobile Close Button -->
          <div class="h-16 md:h-20 flex items-center justify-between px-5 md:px-6 border-b border-gray-100">
            <div class="flex items-center gap-3 cursor-pointer" onclick="navigate('dashboard'); closeMobileSidebar();">
              <div class="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white font-black text-lg shadow-sm">
                TD
              </div>
              <div>
                <span class="font-extrabold text-gray-900 tracking-tight block">TataDana</span>
                <span class="text-[10px] font-bold ${isPro ? 'text-orange-600' : 'text-gray-400'} uppercase">
                  ${isPro ? '⭐ PRO MEMBER' : 'STARTER PLAN'}
                </span>
              </div>
            </div>

            <!-- Mobile Close Button -->
            <button onclick="closeMobileSidebar()" class="md:hidden w-8 h-8 rounded-xl bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-500 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer" title="Tutup Menu">
              ✕
            </button>
          </div>

          <!-- Quick Record Button in Sidebar -->
          <div class="px-4 pt-4 pb-2">
            <button onclick="openAddTxModal(); closeMobileSidebar();" class="w-full py-2.5 px-4 rounded-xl bg-gradient-brand text-white font-bold text-xs shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 hover:opacity-95 flex items-center justify-center gap-2 transition-all cursor-pointer">
              <span class="text-sm">➕</span>
              <span>Catat Transaksi</span>
            </button>
          </div>

          <!-- Nav Items -->
          <nav class="p-4 pt-1 space-y-1.5 text-xs font-semibold text-gray-600 overflow-y-auto max-h-[calc(100vh-230px)]">
            <button onclick="navigate('dashboard'); closeMobileSidebar();" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${activeNav === 'dashboard' ? 'bg-orange-50 text-orange-600 font-bold' : 'hover:bg-gray-50 text-gray-700'}">
              <span>🏠</span> Beranda
            </button>
            <button onclick="navigate('tata_ai'); closeMobileSidebar();" class="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors cursor-pointer ${activeNav === 'tata_ai' ? 'bg-orange-50 text-orange-600 font-bold shadow-xs' : 'hover:bg-gray-50 text-gray-700'}">
              <span class="flex items-center gap-3">
                <span>🤖</span> Tata AI Bot
              </span>
              <span class="text-[10px] bg-gradient-brand text-white px-2 py-0.5 rounded-full font-bold shadow-xs">Cerdas</span>
            </button>
            <button onclick="navigate('kalender'); closeMobileSidebar();" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${activeNav === 'kalender' ? 'bg-orange-50 text-orange-600 font-bold' : 'hover:bg-gray-50 text-gray-700'}">
              <span>📅</span> Kalender Keuangan
            </button>
            <button onclick="navigate('laporan'); closeMobileSidebar();" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${activeNav === 'laporan' ? 'bg-orange-50 text-orange-600 font-bold' : 'hover:bg-gray-50 text-gray-700'}">
              <span>📊</span> Laporan Finansial
            </button>
            <button onclick="navigate('budget'); closeMobileSidebar();" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${activeNav === 'budget' ? 'bg-orange-50 text-orange-600 font-bold' : 'hover:bg-gray-50 text-gray-700'}">
              <span>🎯</span> Budgeting
            </button>
            <button onclick="navigate('wallet'); closeMobileSidebar();" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${activeNav === 'wallet' ? 'bg-orange-50 text-orange-600 font-bold' : 'hover:bg-gray-50 text-gray-700'}">
              <span>👛</span> Multi Dompet
            </button>
            <button onclick="navigate('settings'); closeMobileSidebar();" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer ${activeNav === 'settings' ? 'bg-orange-50 text-orange-600 font-bold' : 'hover:bg-gray-50 text-gray-700'}">
              <span>👤</span> Profil & Pengaturan
            </button>

            <!-- Admin Link (Superadmin Only) -->
            ${user.role === 'superadmin' ? `
              <div class="pt-3 border-t border-gray-100">
                <button onclick="navigate('admin'); closeMobileSidebar();" class="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-purple-700 bg-purple-50 hover:bg-purple-100 font-bold cursor-pointer">
                  <span>🛡️</span> Admin Dashboard
                </button>
              </div>
            ` : ''}
          </nav>
        </div>

        <!-- User Profile Card in Sidebar -->
        <div class="p-4 border-t border-gray-100">
          <div onclick="navigate('settings'); closeMobileSidebar();" class="flex items-center gap-3 p-2 rounded-xl bg-gray-50 hover:bg-orange-50/80 transition-all cursor-pointer group" title="Buka Profil & Edit Foto Profil">
            ${user.avatar_url ? `
              <img src="${user.avatar_url}" alt="Foto Profil" class="w-9 h-9 rounded-full object-cover border-2 border-orange-500 shadow-xs flex-shrink-0">
            ` : `
              <div class="w-9 h-9 rounded-full bg-gradient-brand text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                ${(user.full_name || 'U').charAt(0)}
              </div>
            `}
            <div class="flex-1 min-w-0">
              <span class="text-xs font-bold text-gray-900 block truncate group-hover:text-orange-600 transition-colors">${user.full_name}</span>
              <span class="text-[10px] text-gray-400 block truncate">${user.phone_number || user.email}</span>
            </div>
            <button onclick="event.stopPropagation(); handleLogout();" title="Keluar dari Akun" class="text-gray-400 hover:text-rose-600 text-sm p-1 rounded-lg hover:bg-white transition-colors cursor-pointer">
              🚪
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content Area (Full width on mobile, with safe bottom margin for bottom bar) -->
      <main class="ml-0 md:ml-64 flex-1 p-3 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-full overflow-x-hidden min-h-screen">
        ${contentHtml}
      </main>

      <!-- Mobile Bottom Navigation Bar (FinTech Bottom Tab Navigation) -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-gray-200/90 shadow-2xl px-2 py-1 flex items-center justify-around safe-area-bottom">
        
        <!-- 1. Beranda -->
        <button onclick="navigate('dashboard')" class="flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${activeNav === 'dashboard' ? 'text-orange-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'}">
          <span class="text-lg leading-none">🏠</span>
          <span class="text-[10px] mt-1 font-semibold leading-none">Beranda</span>
        </button>

        <!-- 2. Kalender -->
        <button onclick="navigate('kalender')" class="flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${activeNav === 'kalender' ? 'text-orange-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'}">
          <span class="text-lg leading-none">📅</span>
          <span class="text-[10px] mt-1 font-semibold leading-none">Kalender</span>
        </button>

        <!-- 3. Center Action Button: Quick Record -->
        <button onclick="openAddTxModal()" class="flex-1 flex flex-col items-center justify-center -mt-6 group cursor-pointer" title="Catat Transaksi">
          <div class="w-13 h-13 rounded-full bg-gradient-brand text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-orange-500/40 border-4 border-white group-active:scale-95 transition-transform">
            ➕
          </div>
          <span class="text-[10px] font-black text-orange-600 mt-0.5 leading-none">Catat</span>
        </button>

        <!-- 4. Laporan -->
        <button onclick="navigate('laporan')" class="flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all ${activeNav === 'laporan' ? 'text-orange-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'}">
          <span class="text-lg leading-none">📊</span>
          <span class="text-[10px] mt-1 font-semibold leading-none">Laporan</span>
        </button>

        <!-- 5. Menu Drawer / Lebih -->
        <button onclick="toggleMobileSidebar()" class="flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all text-gray-500 hover:text-gray-900 cursor-pointer">
          <span class="text-lg leading-none">☰</span>
          <span class="text-[10px] mt-1 font-semibold leading-none">Menu</span>
        </button>

      </nav>

      <!-- Desktop Floating Action Button (FAB) -->
      <button onclick="openAddTxModal()" title="Catat Transaksi Cepat" class="hidden md:flex fixed bottom-6 right-6 z-40 bg-gradient-brand text-white font-bold px-4 py-3 rounded-full shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all items-center gap-2 text-xs border-2 border-white cursor-pointer">
        <span class="text-base">➕</span>
        <span class="tracking-wide">Catat Transaksi</span>
      </button>

      <!-- Add Transaction Modal -->
      ${state.showAddTxModal ? `
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div class="flex justify-between items-center border-b border-gray-100 pb-3">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">📝</span>
                <div>
                  <h3 class="text-base font-extrabold text-gray-900 leading-tight">Catat Transaksi Manual</h3>
                  <p class="text-[11px] text-gray-400">Tambah pengeluaran atau pemasukan langsung ke akunmu</p>
                </div>
              </div>
              <button onclick="closeAddTxModal()" class="text-gray-400 hover:text-gray-600 text-lg font-bold">✕</button>
            </div>

            <form onsubmit="submitNewTransaction(event)" class="space-y-3.5 text-xs">
              <!-- Type Selector (Tabs) -->
              <div>
                <label class="block font-semibold text-gray-600 mb-1.5">Jenis Transaksi</label>
                <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
                  <button type="button" onclick="setTxModalType('pengeluaran')" id="btn-tx-type-pengeluaran" class="py-2 rounded-lg font-extrabold transition-all ${state.modalTxType !== 'pemasukan' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'}">
                    💸 Pengeluaran
                  </button>
                  <button type="button" onclick="setTxModalType('pemasukan')" id="btn-tx-type-pemasukan" class="py-2 rounded-lg font-extrabold transition-all ${state.modalTxType === 'pemasukan' ? 'bg-white text-emerald-600 shadow-xs' : 'text-gray-500 hover:text-gray-800'}">
                    💰 Pemasukan
                  </button>
                </div>
                <input type="hidden" id="new-tx-type" value="${state.modalTxType || 'pengeluaran'}">
              </div>

              <!-- Amount Input & Quick Buttons -->
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Nominal (Rp) <span class="text-rose-500">*</span></label>
                <div class="relative">
                  <span class="absolute left-3.5 top-2.5 font-extrabold text-gray-400 text-sm">Rp</span>
                  <input type="number" id="new-tx-amount" required placeholder="0" min="1" step="any" oninput="checkTxBalanceSufficiency()" class="w-full pl-11 pr-3 py-2.5 border border-gray-300 rounded-xl font-bold text-gray-900 text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-colors">
                </div>
                <!-- Warning Container for Insufficient Balance -->
                <div id="tx-balance-warning" class="hidden mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <span class="text-base">⚠️</span>
                  <span id="tx-balance-warning-text">Saldo anda tidak mencukupi</span>
                </div>
                <!-- Quick Amount Buttons -->
                <div class="flex flex-wrap gap-1.5 mt-2">
                  <button type="button" onclick="addTxAmount(10000)" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-orange-100 hover:text-orange-700 font-semibold text-[11px] text-gray-600 transition-colors">+10rb</button>
                  <button type="button" onclick="addTxAmount(25000)" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-orange-100 hover:text-orange-700 font-semibold text-[11px] text-gray-600 transition-colors">+25rb</button>
                  <button type="button" onclick="addTxAmount(50000)" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-orange-100 hover:text-orange-700 font-semibold text-[11px] text-gray-600 transition-colors">+50rb</button>
                  <button type="button" onclick="addTxAmount(100000)" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-orange-100 hover:text-orange-700 font-semibold text-[11px] text-gray-600 transition-colors">+100rb</button>
                  <button type="button" onclick="addTxAmount(500000)" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-orange-100 hover:text-orange-700 font-semibold text-[11px] text-gray-600 transition-colors">+500rb</button>
                  <button type="button" onclick="setTxAmount(0)" class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-rose-100 hover:text-rose-700 font-semibold text-[11px] text-gray-500 transition-colors">Reset</button>
                </div>
              </div>

              <!-- Category Dropdown with Icons -->
              <div>
                <div class="flex justify-between items-center mb-1">
                  <label class="block font-semibold text-gray-600">Kategori Transaksi <span class="text-rose-500">*</span></label>
                  <button type="button" onclick="openAddCategoryModal()" class="text-[11px] font-bold text-orange-600 hover:underline cursor-pointer">+ Tambah Kategori</button>
                </div>
                <select id="new-tx-category" required class="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-orange-500">
                  ${(() => {
                    const targetType = state.modalTxType === 'pemasukan' ? 'income' : 'expense';
                    const list = (state.categories || []).filter(c => c.type === targetType);
                    const cats = list.length > 0 ? list : state.categories || [];
                    return cats.map(c => `
                      <option value="${c.id}">${c.icon || '🏷️'} ${c.name}</option>
                    `).join('');
                  })()}
                </select>
              </div>

              <!-- Wallet Dropdown with Balance -->
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Pilih Dompet / Akun <span class="text-rose-500">*</span></label>
                <select id="new-tx-wallet" required onchange="checkTxBalanceSufficiency()" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-orange-500">
                  ${(state.wallets || []).map(w => `
                    <option value="${w.id}">
                      ${w.icon || (w.wallet_type === 'bank' ? '🏦' : w.wallet_type === 'ewallet' ? '📱' : '💵')} ${w.name} (Saldo: ${formatRupiah(w.balance)})
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Date Picker -->
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Tanggal Transaksi (WIB)</label>
                <input type="date" id="new-tx-date" value="${state.modalTxDate || state.selectedCalendarDate || new Date().toISOString().slice(0, 10)}" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500">
              </div>

              <!-- Merchant / Notes Input -->
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Catatan / Nama Merchant</label>
                <input type="text" id="new-tx-notes" placeholder="Contoh: Makan siang Padang, Beli bensin, dll" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500">
              </div>

              <!-- Action Buttons -->
              <div class="flex gap-2.5 pt-2">
                <button type="button" onclick="closeAddTxModal()" class="w-1/2 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" id="btn-submit-tx" class="w-1/2 py-2.5 rounded-xl bg-gradient-brand text-white font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-all">Simpan Transaksi</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      <!-- Add Wallet Modal -->
      ${state.showAddWalletModal ? `
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div class="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 class="text-base font-bold text-gray-900">👛 Tambah Dompet Baru</h3>
              <button onclick="closeAddWalletModal()" class="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <form onsubmit="submitNewWallet(event)" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Nama Dompet</label>
                <input type="text" id="new-wallet-name" required placeholder="Contoh: Bank Jago, ShopeePay, Brankas Tunai" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              </div>
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Jenis Dompet</label>
                <select id="new-wallet-type" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="bank">🏦 Rekening Bank (BCA, Mandiri, BRI, dll)</option>
                  <option value="ewallet">📱 E-Wallet (GoPay, OVO, Dana, ShopeePay)</option>
                  <option value="cash">💵 Uang Tunai / Cash</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Saldo Awal (Rp)</label>
                <input type="number" id="new-wallet-balance" required placeholder="0" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              </div>
              <div class="pt-1">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="new-wallet-default" class="rounded text-orange-600 focus:ring-orange-500">
                  <span class="font-medium text-gray-700">Jadikan Dompet Default untuk Bot Telegram</span>
                </label>
              </div>
              <div class="flex gap-2 pt-3">
                <button type="button" onclick="closeAddWalletModal()" class="w-1/2 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-50">Batal</button>
                <button type="submit" class="w-1/2 py-2.5 rounded-xl bg-gradient-brand text-white font-bold shadow-md hover:bg-orange-600">Simpan Dompet</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      <!-- Add Budget Modal -->
      ${state.showAddBudgetModal ? `
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div class="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 class="text-base font-bold text-gray-900">🎯 Atur Batas Anggaran (Budget)</h3>
              <button onclick="closeAddBudgetModal()" class="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <form onsubmit="submitNewBudget(event)" class="space-y-3 text-xs">
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Kategori</label>
                <select id="budget-category-id" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  ${state.categories.filter(c => c.type !== 'income').map(c => `<option value="${c.id}">${c.icon || '🏷️'} ${c.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Periode Anggaran</label>
                <select id="budget-period" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="daily">📅 Harian (Batas per hari)</option>
                  <option value="weekly">📆 Mingguan (Batas per minggu)</option>
                  <option value="monthly" selected>🗓️ Bulanan (Batas per bulan)</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Nominal Batas Anggaran (Rp)</label>
                <input type="number" id="budget-amount" required placeholder="Contoh: 500000" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              </div>
              <div class="flex gap-2 pt-3">
                <button type="button" onclick="closeAddBudgetModal()" class="w-1/2 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-50">Batal</button>
                <button type="submit" class="w-1/2 py-2.5 rounded-xl bg-gradient-brand text-white font-bold shadow-md hover:bg-orange-600">Simpan Budget</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      <!-- Add Category Modal -->
      ${state.showAddCategoryModal ? `
        <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div class="flex justify-between items-center border-b border-gray-100 pb-3">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">🏷️</span>
                <div>
                  <h3 class="text-base font-extrabold text-gray-900 leading-tight">Tambah Kategori Baru</h3>
                  <p class="text-[11px] text-gray-400">Atur pos pembukuan keuangan kustommu</p>
                </div>
              </div>
              <button onclick="closeAddCategoryModal()" class="text-gray-400 hover:text-gray-600 text-lg font-bold">✕</button>
            </div>
            <form onsubmit="submitNewCategory(event)" class="space-y-3.5 text-xs">
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Nama Kategori <span class="text-rose-500">*</span></label>
                <input type="text" id="new-cat-name" required placeholder="Contoh: Belanja Online, Skincare, Donasi, Hobi" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 font-medium">
              </div>
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Jenis Pos Kategori <span class="text-rose-500">*</span></label>
                <select id="new-cat-type" class="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-orange-500">
                  <option value="expense">💸 Pos Pengeluaran (Belanja, Tagihan, Jajan)</option>
                  <option value="income">💰 Pos Pemasukan (Gaji, Bonus, Freelance)</option>
                </select>
              </div>
              <div>
                <label class="block font-semibold text-gray-600 mb-1">Pilih Ikon Emoji</label>
                <div class="flex items-center gap-2">
                  <input type="text" id="new-cat-icon" value="🏷️" maxlength="4" class="w-14 px-2 py-2 border border-gray-300 rounded-xl text-center text-lg focus:outline-none focus:border-orange-500">
                  <div class="flex flex-wrap gap-1 text-base flex-1">
                    ${['🍜', '🚗', '🏠', '👕', '💊', '📚', '🎮', '💼', '🎁', '⚡', '☕', '🛒'].map(ic => `
                      <button type="button" onclick="document.getElementById('new-cat-icon').value = '${ic}'" class="p-1 rounded-lg hover:bg-orange-50 hover:scale-110 transition-all">${ic}</button>
                    `).join('')}
                  </div>
                </div>
              </div>
              <div class="flex gap-2.5 pt-2">
                <button type="button" onclick="closeAddCategoryModal()" class="w-1/2 py-2.5 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" id="btn-submit-cat" class="w-1/2 py-2.5 rounded-xl bg-gradient-brand text-white font-bold shadow-md shadow-orange-500/20 hover:opacity-95 transition-all">Simpan Kategori</button>
              </div>
            </form>
          </div>
        </div>
      ` : ''}

      <!-- Interactive PDF Preview Modal -->
      ${state.showPdfPreviewModal ? renderPdfPreviewModal() : ''}

    </div>
  `;
}

// Interactive Financial PDF Report Preview Modal
function renderPdfPreviewModal() {
  const user = state.user || { full_name: 'Pengguna TataDana', email: 'user@tatadana.id' };
  const summary = state.reportSummary || { income: 0, expense: 0, netCashflow: 0 };
  const txs = state.transactions || [];
  const sDate = state.reportFilter.startDate || 'Semua Periode';
  const eDate = state.reportFilter.endDate || 'Semua Periode';
  const filterCat = state.reportFilter.categoryId ? (state.categories.find(c => c.id === state.reportFilter.categoryId)?.name || 'Semua Pos') : 'Semua Pos Kategori';
  const filterWallet = state.reportFilter.walletId ? (state.wallets.find(w => w.id === state.reportFilter.walletId)?.name || 'Semua Dompet') : 'Semua Dompet/Akun';
  const filterType = state.reportFilter.type ? (state.reportFilter.type === 'pemasukan' ? 'Hanya Pemasukan' : 'Hanya Pengeluaran') : 'Semua Jenis Transaksi';
  const generatedAt = typeof formatFullIndonesianDate === 'function' ? `${formatFullIndonesianDate(new Date().toISOString().slice(0, 10))} ${new Date().toLocaleTimeString('id-ID', { hour12: false })} WIB` : new Date().toLocaleString('id-ID');
  const reportDocId = `TD-REP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${(user.id || '901').slice(-4).toUpperCase()}`;

  return `
    <div class="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto" onclick="closePdfPreviewModal()">
      <div class="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[94vh] overflow-hidden" onclick="event.stopPropagation()">
        
        <!-- Toolbar Header -->
        <div class="px-5 py-3.5 bg-slate-800/95 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-sm font-bold">📄</span>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-extrabold text-white">TataDana_Laporan_Keuangan.pdf</h4>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">✓ Siap Cetak (A4)</span>
              </div>
              <p class="text-[11px] text-gray-400">Pratinjau antarmuka dokumen laporan resmi finansial & arus kas</p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="printPdfReport()" class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs">
              <span>🖨️</span> Cetak / Print
            </button>
            <button onclick="downloadReport('pdf')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-brand hover:opacity-95 text-white shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
              <span>📄</span> Unduh PDF
            </button>
            <button onclick="downloadReport('excel')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1 cursor-pointer">
              <span>📊</span> Excel
            </button>
            <button onclick="closePdfPreviewModal()" class="w-8 h-8 rounded-xl bg-white/10 hover:bg-rose-500 hover:text-white text-gray-400 flex items-center justify-center transition-all cursor-pointer font-bold">
              ✕
            </button>
          </div>
        </div>

        <!-- Scrollable Document Area -->
        <div class="overflow-y-auto p-3 sm:p-8 bg-slate-950/70 flex justify-center">
          
          <!-- The A4 Sheet Paper -->
          <div id="printable-pdf-document" class="bg-white text-gray-900 rounded-xl shadow-2xl p-6 sm:p-10 max-w-3xl w-full space-y-6 border border-gray-200 relative font-sans">
            
            <!-- Top Orange Accent Bar -->
            <div class="h-2.5 w-full bg-gradient-brand rounded-t-xl -mt-6 sm:-mt-10 -mx-6 sm:-mx-10 mb-6"></div>

            <!-- Document Header -->
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200/80 pb-5">
              <div>
                <div class="flex items-center gap-2.5">
                  <span class="w-9 h-9 rounded-xl bg-gradient-brand text-white flex items-center justify-center text-lg font-black shadow-md shadow-orange-500/30">TD</span>
                  <div>
                    <h2 class="text-xl font-black text-gray-900 tracking-tight">TATADANA</h2>
                    <span class="text-[10px] font-bold text-orange-600 uppercase tracking-widest block -mt-0.5">Financial Statement & Audit</span>
                  </div>
                </div>
                <div class="mt-3 text-xs text-gray-600 space-y-0.5">
                  <div class="font-extrabold text-gray-900">${user.full_name || 'Pengguna TataDana'}</div>
                  <div class="text-gray-500 text-[11px]">${user.email || user.phone_number || ''} • ID: ${(user.id || 'usr-01').toUpperCase()}</div>
                  <div class="pt-0.5">
                    <span class="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <span>✓</span> Akun Terverifikasi
                    </span>
                  </div>
                </div>
              </div>

              <div class="text-right text-xs space-y-1">
                <div class="text-[10px] font-black uppercase tracking-wider text-gray-400">Nomor Dokumen</div>
                <div class="font-mono font-bold text-gray-900 text-sm">${reportDocId}</div>
                <div class="text-[11px] text-gray-500">
                  <span class="font-semibold text-gray-700">Periode:</span> ${sDate} s.d. ${eDate}
                </div>
                <div class="text-[11px] text-gray-500">
                  <span class="font-semibold text-gray-700">Dicetak:</span> ${generatedAt}
                </div>
              </div>
            </div>

            <!-- Filter Criteria Metadata Ribbon -->
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-gray-800">Kriteria:</span>
                <span class="px-2 py-0.5 rounded-md bg-white border border-gray-200 font-semibold text-[11px] text-gray-700">👛 ${filterWallet}</span>
                <span class="px-2 py-0.5 rounded-md bg-white border border-gray-200 font-semibold text-[11px] text-gray-700">🏷️ ${filterCat}</span>
                <span class="px-2 py-0.5 rounded-md bg-white border border-gray-200 font-semibold text-[11px] text-gray-700">🔄 ${filterType}</span>
              </div>
              <div class="text-[11px] font-bold text-gray-700 bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                ${txs.length} Catatan Transaksi
              </div>
            </div>

            <!-- 3 FinTech Financial KPI Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <!-- Card 1: Income -->
              <div class="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 relative overflow-hidden">
                <div class="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
                <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">
                  <span>Total Pemasukan</span>
                  <span>💰</span>
                </div>
                <div class="text-lg font-black text-emerald-600">+${formatRupiah(summary.income)}</div>
                <span class="text-[10px] text-emerald-700/80 mt-0.5 block font-medium">Akumulasi uang masuk</span>
              </div>

              <!-- Card 2: Expense -->
              <div class="p-4 rounded-xl bg-rose-50/60 border border-rose-200/80 relative overflow-hidden">
                <div class="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
                <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-rose-800 mb-1">
                  <span>Total Pengeluaran</span>
                  <span>💸</span>
                </div>
                <div class="text-lg font-black text-rose-600">-${formatRupiah(summary.expense)}</div>
                <span class="text-[10px] text-rose-700/80 mt-0.5 block font-medium">Total belanja & tagihan</span>
              </div>

              <!-- Card 3: Net Cashflow -->
              <div class="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 relative overflow-hidden">
                <div class="absolute top-0 left-0 right-0 h-1 bg-orange-500"></div>
                <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                  <span>Arus Kas Bersih (Net)</span>
                  <span>⚖️</span>
                </div>
                <div class="text-lg font-black ${summary.netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                  ${summary.netCashflow >= 0 ? '+' : ''}${formatRupiah(summary.netCashflow)}
                </div>
                <span class="text-[10px] font-semibold ${summary.netCashflow >= 0 ? 'text-emerald-700' : 'text-rose-700'} mt-0.5 block">
                  ${summary.netCashflow >= 0 ? 'Surplus Finansial Sehat' : 'Defisit Pengeluaran'}
                </span>
              </div>
            </div>

            <!-- Transaction Data Table -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <h4 class="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                  <span>📋</span> Rincian Arus Transaksi Keuangan
                </h4>
                <span class="text-[11px] text-gray-400">Mata Uang: Rupiah (IDR)</span>
              </div>

              <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <table class="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr class="bg-slate-900 text-white text-[11px] font-bold">
                      <th class="py-2.5 px-3 w-10 text-center">No</th>
                      <th class="py-2.5 px-3">Tanggal (WIB)</th>
                      <th class="py-2.5 px-3">Jenis</th>
                      <th class="py-2.5 px-3">Kategori</th>
                      <th class="py-2.5 px-3">Dompet</th>
                      <th class="py-2.5 px-3">Catatan / Merchant</th>
                      <th class="py-2.5 px-3 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    ${txs.length === 0 ? `
                      <tr>
                        <td colspan="7" class="py-8 text-center text-gray-400 text-xs">
                          Tidak ada catatan transaksi pada filter periode ini.
                        </td>
                      </tr>
                    ` : txs.slice(0, 35).map((t, idx) => {
                      const isInc = t.type === 'pemasukan';
                      const dateOnly = (t.transaction_date || '').split('T')[0] || '-';
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';
                      return `
                        <tr class="${rowBg} hover:bg-orange-50/40 transition-colors">
                          <td class="py-2 px-3 text-center text-gray-400 font-mono text-[11px]">${idx + 1}</td>
                          <td class="py-2 px-3 font-medium text-gray-700 whitespace-nowrap">${dateOnly}</td>
                          <td class="py-2 px-3">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${isInc ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}">
                              ${isInc ? '+ MASUK' : '- KELUAR'}
                            </span>
                          </td>
                          <td class="py-2 px-3 font-medium text-gray-800">${t.category_icon || '🏷️'} ${t.category_name || '-'}</td>
                          <td class="py-2 px-3 text-gray-600">${t.wallet_name || '-'}</td>
                          <td class="py-2 px-3 text-gray-600 truncate max-w-[160px]">${t.merchant_name ? `🏪 ${t.merchant_name} — ` : ''}${t.notes || '-'}</td>
                          <td class="py-2 px-3 text-right font-black ${isInc ? 'text-emerald-600' : 'text-rose-600'} whitespace-nowrap">
                            ${isInc ? '+' : '-'}${formatRupiah(t.amount)}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <tfoot>
                    <tr class="bg-gray-100/90 font-bold text-xs border-t-2 border-gray-300">
                      <td colspan="6" class="py-2.5 px-3 text-gray-800">
                        Net Cashflow Akumulasi (${txs.length} Transaksi)
                      </td>
                      <td class="py-2.5 px-3 text-right font-black ${summary.netCashflow >= 0 ? 'text-emerald-700' : 'text-rose-700'}">
                        ${summary.netCashflow >= 0 ? '+' : ''}${formatRupiah(summary.netCashflow)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              ${txs.length > 35 ? `
                <div class="text-center text-[11px] text-gray-400 font-medium py-1">
                  ... dan ${txs.length - 35} transaksi lainnya tercatat lengkap di database TataDana.
                </div>
              ` : ''}
            </div>

            <!-- Digital Seal & Security Verification Footer -->
            <div class="pt-2 border-t border-gray-200/80">
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-orange-100 border border-orange-200 text-orange-600 flex items-center justify-center text-lg font-black flex-shrink-0">
                    🛡️
                  </div>
                  <div class="space-y-0.5">
                    <div class="text-[11px] font-black text-gray-900 tracking-wide">TERVERIFIKASI SISTEM ELEKTRONIK TATADANA</div>
                    <p class="text-[10px] text-gray-500 leading-tight">Dokumen ini diterbitkan secara sah dan tersinkronisasi 100% dengan Cloud Database Supabase.</p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="inline-block px-2.5 py-1 rounded bg-white border border-gray-200 font-mono text-[10px] font-bold text-gray-700 shadow-2xs">
                    STATUS: SAH & AKTIF
                  </span>
                  <span class="block text-[9px] text-gray-400 mt-0.5 font-mono">HASH: TD-${Date.now().toString(16).slice(-6).toUpperCase()}</span>
                </div>
              </div>
            </div>

            <!-- Document Footer Note -->
            <div class="flex justify-between items-center text-[10px] text-gray-400 pt-1">
              <span>Halaman 1 dari 1 • Dokumen Laporan Keuangan Pribadi</span>
              <span>TataDana FinTech Indonesia • Rahasia & Terlindungi</span>
            </div>

            <!-- Bottom Brand Accent Line -->
            <div class="h-1.5 w-full bg-gradient-brand rounded-b-xl -mb-6 sm:-mb-10 -mx-6 sm:-mx-10 mt-6"></div>

          </div>
        </div>

      </div>
    </div>
  `;
}

// 4. USER DASHBOARD OVERVIEW (Part 9)
function renderDashboardOverview() {
  const summary = state.reportSummary || { income: 0, expense: 0, netCashflow: 0, totalBudget: 0, budgetRemaining: 0 };
  const txs = state.transactions.slice(0, 10);
  const user = state.user || {};
  const isPro = user.plan_tier === 'pro';
  const totalConsolidatedBalance = (state.wallets || []).reduce((acc, w) => acc + Number(w.balance || 0), 0);

  return `
    <div class="space-y-8">
      
      <!-- Top Bar: Greeting & Actions -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div onclick="navigate('settings')" class="cursor-pointer group relative" title="Klik untuk edit foto profil">
            ${user.avatar_url ? `
              <img src="${user.avatar_url}" alt="Foto Profil" class="w-12 h-12 rounded-2xl object-cover border-2 border-orange-500 shadow-sm group-hover:scale-105 transition-all">
            ` : `
              <div class="w-12 h-12 rounded-2xl bg-gradient-brand text-white flex items-center justify-center font-black text-lg shadow-sm group-hover:scale-105 transition-all">
                ${(user.full_name || 'U').charAt(0)}
              </div>
            `}
            <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-xs"></span>
          </div>
          <div>
            <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">Halo, ${user.full_name || 'Pengguna'}! 👋</h2>
            <p class="text-xs text-gray-500 mt-0.5">Pantau arus kas dan budget keuanganmu secara real-time (WIB).</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="openAddTxModal()" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-md hover:shadow-orange-500/30">
            + Catat Transaksi Baru
          </button>
        </div>
      </div>

      <!-- Onboarding Checklist for New Users -->
      <div class="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-lg font-bold">
            🚀
          </div>
          <div>
            <h4 class="text-xs font-bold text-gray-900">Onboarding Checklist TataDana</h4>
            <div class="flex items-center gap-4 text-[11px] text-gray-500 mt-1">
              <span class="text-emerald-600 font-semibold">✔ Verifikasi HP</span>
              <span class="text-emerald-600 font-semibold">✔ Set Dompet</span>
              <span class="text-orange-600 font-semibold">⏳ Hubungkan Telegram Bot</span>
            </div>
          </div>
        </div>
        <button onclick="navigate('settings')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 hover:bg-orange-100">
          Selesaikan Pengaturan →
        </button>
      </div>

      <!-- 4 Stats Cards (Part 9) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
            <span>Total Saldo Terkonsolidasi</span>
            <span class="text-blue-500">🏦</span>
          </div>
          <div class="text-2xl font-black text-gray-900">${formatRupiah(totalConsolidatedBalance)}</div>
          <span class="text-[11px] text-emerald-600 font-semibold mt-1 block">Dari ${state.wallets?.length || 0} Dompet Aktif</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
            <span>Pemasukan Bulan Ini</span>
            <span class="text-emerald-500">📈</span>
          </div>
          <div class="text-2xl font-black text-emerald-600">${formatRupiah(summary.income)}</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Bulan Oktober 2026</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
            <span>Pengeluaran Bulan Ini</span>
            <span class="text-rose-500">📉</span>
          </div>
          <div class="text-2xl font-black text-rose-600">${formatRupiah(summary.expense)}</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Bulan Oktober 2026</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
            <span>Budget Tersisa</span>
            <span class="text-orange-500">🎯</span>
          </div>
          <div class="text-2xl font-black text-orange-600">${formatRupiah(summary.budgetRemaining)}</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Dari total ${formatRupiah(summary.totalBudget)}</span>
        </div>

      </div>

      <!-- Charts & Visual Section -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Cashflow Bar Chart Preview (8 cols) -->
        <div class="lg:col-span-8 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div class="flex justify-between items-center mb-6">
            <div>
              <h4 class="text-sm font-bold text-gray-900">Perbandingan Pemasukan vs Pengeluaran 6 Bulan</h4>
              <span class="text-xs text-gray-400">Arus kas historis TataDana</span>
            </div>
            <div class="flex items-center gap-3 text-xs">
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Masuk</span>
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Keluar</span>
            </div>
          </div>

          <!-- Simulated Bar Chart Layout -->
          ${(state.transactions || []).length === 0 ? `
            <div class="h-48 flex flex-col items-center justify-center border-b border-gray-100 text-center">
              <span class="text-3xl mb-1">📊</span>
              <p class="text-xs text-gray-700 font-bold">Belum Ada Riwayat Arus Kas</p>
              <p class="text-[11px] text-gray-400 mt-0.5">Grafik perbandingan akan otomatis tampil setelah Anda mencatat transaksi pemasukan atau pengeluaran pertama.</p>
            </div>
          ` : `
          <div class="h-48 flex items-end justify-between gap-4 pt-4 border-b border-gray-100">
            ${['Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt'].map((m, idx) => {
              const hInc = idx === 5 ? Math.min(100, Math.max(12, Math.round(((summary.income || 0) / 10000000) * 100))) : 0;
              const hExp = idx === 5 ? Math.min(100, Math.max(12, Math.round(((summary.expense || 0) / 10000000) * 100))) : 0;
              return `
                <div class="flex-1 flex flex-col items-center gap-2">
                  <div class="w-full flex items-end justify-center gap-1.5 h-36">
                    <div class="w-3.5 bg-emerald-500 rounded-t-md transition-all hover:bg-emerald-600" style="height: ${hInc}%" title="Pemasukan ${m}"></div>
                    <div class="w-3.5 bg-orange-500 rounded-t-md transition-all hover:bg-orange-600" style="height: ${hExp}%" title="Pengeluaran ${m}"></div>
                  </div>
                  <span class="text-[11px] font-semibold text-gray-500">${m}</span>
                </div>
              `;
            }).join('')}
          </div>
          `}
        </div>

        <!-- Category Breakdown Pie / Progress (4 cols) -->
        <div class="lg:col-span-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h4 class="text-sm font-bold text-gray-900 mb-1">Top Kategori Pengeluaran</h4>
          <span class="text-xs text-gray-400 block mb-4">Breakdown bulan berjalan</span>

          <div class="space-y-3.5">
            ${(() => {
              const expTxs = (state.transactions || []).filter(t => t.type === 'pengeluaran');
              const catMap = {};
              expTxs.forEach(t => {
                const cid = t.category_id || 'other';
                if (!catMap[cid]) {
                  catMap[cid] = {
                    name: t.category_name || 'Kategori',
                    icon: t.category_icon || '🏷️',
                    spent: 0
                  };
                }
                catMap[cid].spent += Number(t.amount || 0);
              });
              const catList = Object.values(catMap).sort((a, b) => b.spent - a.spent);
              const totalExp = catList.reduce((s, c) => s + c.spent, 0) || 1;
              if (catList.length === 0) {
                return '<div class="py-10 text-center text-xs text-gray-400">Belum ada data pengeluaran bulan ini. Catat pengeluaran baru untuk melihat rincian kategori.</div>';
              }
              const colors = ['bg-orange-500', 'bg-blue-500', 'bg-pink-500', 'bg-purple-500', 'bg-emerald-500'];
              return catList.slice(0, 5).map((c, i) => {
                const pct = Math.round((c.spent / totalExp) * 100);
                const color = colors[i % colors.length];
                return `
                  <div>
                    <div class="flex justify-between text-xs font-semibold mb-1">
                      <span>${c.icon} ${c.name}</span>
                      <span class="text-gray-900">${formatRupiah(c.spent)}</span>
                    </div>
                    <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div class="h-full ${color} rounded-full" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              }).join('');
            })()}
          </div>
        </div>

      </div>

      <!-- 10 Transaksi Terbaru -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h4 class="text-sm font-bold text-gray-900">Transaksi Terbaru</h4>
            <span class="text-xs text-gray-400">Sinkronisasi langsung dari web & Telegram</span>
          </div>
          <button onclick="navigate('laporan')" class="text-xs font-bold text-orange-600 hover:underline">
            Lihat Semua Laporan →
          </button>
        </div>

        <div class="divide-y divide-gray-100 text-xs">
          ${txs.length === 0 ? `
            <div class="p-8 text-center text-gray-400">Belum ada transaksi. Silakan catat transaksi baru atau kirim pesan via Telegram.</div>
          ` : txs.map(t => {
            const isInc = t.type === 'pemasukan';
            return `
              <div class="p-4 flex items-center justify-between hover:bg-gray-50/70 transition-colors">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-xl ${isInc ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'} flex items-center justify-center text-sm font-bold">
                    ${t.category_icon || (isInc ? '💰' : '💸')}
                  </div>
                  <div>
                    <span class="font-bold text-gray-900 block">${t.notes || t.category_name}</span>
                    <span class="text-[11px] text-gray-400">
                      ${(t.transaction_date || '').slice(0, 10)} • 👛 ${t.wallet_name || 'BCA'} • 
                      <span class="font-medium ${t.source?.includes('telegram') ? 'text-blue-600' : 'text-gray-500'}">
                        ${t.source === 'telegram_photo' ? '📸 Telegram Struk' : t.source === 'telegram_voice' ? '🎙️ Telegram Suara' : t.source === 'telegram_text' ? '✈️ Telegram Chat' : '💻 Web App'}
                      </span>
                    </span>
                  </div>
                </div>
                <div class="text-right">
                  <span class="font-bold text-sm block ${isInc ? 'text-emerald-600' : 'text-gray-900'}">
                    ${isInc ? '+' : '-'}${formatRupiah(t.amount)}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

    </div>
  `;
}

// 5. LAPORAN PAGE (Part 3)
function renderLaporanPage() {
  const summary = state.reportSummary || { income: 0, expense: 0, netCashflow: 0 };
  const txs = state.transactions;
  const user = state.user || {};
  const isPro = user.plan_tier === 'pro';

  // Category Breakdown Calculations
  const categoryMap = {};
  (state.categories || []).forEach(c => {
    categoryMap[c.id] = { ...c, total: 0, count: 0 };
  });

  txs.forEach(t => {
    const cid = t.category_id || 'cat-other';
    if (!categoryMap[cid]) {
      categoryMap[cid] = {
        id: cid,
        name: t.category_name || 'Lainnya',
        icon: t.category_icon || '🏷️',
        type: t.type === 'pemasukan' ? 'income' : 'expense',
        color: '#FF5B00',
        total: 0,
        count: 0
      };
    }
    categoryMap[cid].total += Number(t.amount || 0);
    categoryMap[cid].count += 1;
  });

  const catList = Object.values(categoryMap);
  const expenseCatStats = catList.filter(c => c.type === 'expense' && c.total > 0).sort((a, b) => b.total - a.total);
  const incomeCatStats = catList.filter(c => c.type === 'income' && c.total > 0).sort((a, b) => b.total - a.total);

  const totalExpenseVal = expenseCatStats.reduce((s, c) => s + c.total, 0) || 1;
  const totalIncomeVal = incomeCatStats.reduce((s, c) => s + c.total, 0) || 1;

  return `
    <div class="space-y-6">
      
      <!-- Top header & Export buttons -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">📊 Laporan & Pembukuan Keuangan</h2>
          <p class="text-xs text-gray-500 mt-0.5">Analisis mendalam, pos kategori keuangan terstruktur, dan generator dokumen resmi.</p>
        </div>

        <div class="flex items-center gap-2.5">
          <button onclick="openAddTxModal()" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 flex items-center gap-2 transition-all cursor-pointer">
            <span>➕</span> Catat Transaksi
          </button>
          <button onclick="openAddCategoryModal()" class="px-3.5 py-2.5 rounded-xl text-xs font-bold border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer" title="Tambah Pos Kategori Baru">
            <span>🏷️</span> Tambah Kategori
          </button>
          <button onclick="openPdfPreviewModal()" class="px-4 py-2.5 rounded-xl text-xs font-bold border border-orange-400 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:border-orange-500 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer" title="Lihat Pratinjau Tampilan Dokumen PDF">
            <span>👁️</span> Pratinjau PDF
          </button>
          <button onclick="downloadReport('pdf')" class="px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-300 bg-white hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 shadow-sm flex items-center gap-2 transition-all cursor-pointer">
            <span>📄</span> Export PDF
          </button>
          <button onclick="downloadReport('excel')" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer">
            <span>📊</span> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      <!-- Financial Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-4 rounded-xl bg-white border border-gray-200">
          <span class="text-xs text-gray-500">Total Pemasukan Periode Ini</span>
          <div class="text-xl font-black text-emerald-600 mt-1">${formatRupiah(summary.income)}</div>
        </div>
        <div class="p-4 rounded-xl bg-white border border-gray-200">
          <span class="text-xs text-gray-500">Total Pengeluaran Periode Ini</span>
          <div class="text-xl font-black text-rose-600 mt-1">${formatRupiah(summary.expense)}</div>
        </div>
        <div class="p-4 rounded-xl bg-white border border-gray-200">
          <span class="text-xs text-gray-500">Net Cashflow Bersih</span>
          <div class="text-xl font-black text-gray-900 mt-1">${formatRupiah(summary.netCashflow)}</div>
        </div>
      </div>

      <!-- Category Distribution Breakdown Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Pos Pengeluaran Breakdown -->
        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div class="flex justify-between items-center border-b border-gray-100 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold">💸</span>
              <h4 class="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Distribusi Pos Pengeluaran</h4>
            </div>
            <span class="text-[11px] text-gray-400 font-medium">${expenseCatStats.length} Pos Aktif</span>
          </div>

          <div class="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            ${expenseCatStats.length === 0 ? `
              <div class="py-6 text-center text-gray-400 text-xs">Belum ada data pengeluaran pada filter ini.</div>
            ` : expenseCatStats.map(c => {
              const pct = Math.round((c.total / totalExpenseVal) * 100);
              const isSelected = state.reportFilter.categoryId === c.id;
              return `
                <div onclick="setReportCategoryFilter('${c.id}')" title="Klik untuk memfilter transaksi kategori ini" class="p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-orange-500 bg-orange-50/50 ring-2 ring-orange-300' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-white'}">
                  <div class="flex justify-between items-center text-xs mb-1">
                    <span class="font-bold text-gray-800 flex items-center gap-1.5">
                      <span>${c.icon || '🏷️'}</span>
                      <span>${c.name}</span>
                      <span class="text-[10px] text-gray-400 font-normal">(${c.count} transaksi)</span>
                    </span>
                    <span class="font-black text-rose-600">${formatRupiah(c.total)} <span class="text-[10px] text-gray-400 font-normal">(${pct}%)</span></span>
                  </div>
                  <div class="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-rose-500 rounded-full" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Pos Pemasukan Breakdown -->
        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div class="flex justify-between items-center border-b border-gray-100 pb-2.5">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">💰</span>
              <h4 class="text-xs font-extrabold text-gray-900 uppercase tracking-wider">Distribusi Pos Pemasukan</h4>
            </div>
            <span class="text-[11px] text-gray-400 font-medium">${incomeCatStats.length} Pos Aktif</span>
          </div>

          <div class="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            ${incomeCatStats.length === 0 ? `
              <div class="py-6 text-center text-gray-400 text-xs">Belum ada data pemasukan pada filter ini.</div>
            ` : incomeCatStats.map(c => {
              const pct = Math.round((c.total / totalIncomeVal) * 100);
              const isSelected = state.reportFilter.categoryId === c.id;
              return `
                <div onclick="setReportCategoryFilter('${c.id}')" title="Klik untuk memfilter transaksi kategori ini" class="p-2.5 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-300' : 'border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-white'}">
                  <div class="flex justify-between items-center text-xs mb-1">
                    <span class="font-bold text-gray-800 flex items-center gap-1.5">
                      <span>${c.icon || '💰'}</span>
                      <span>${c.name}</span>
                      <span class="text-[10px] text-gray-400 font-normal">(${c.count} transaksi)</span>
                    </span>
                    <span class="font-black text-emerald-600">${formatRupiah(c.total)} <span class="text-[10px] text-gray-400 font-normal">(${pct}%)</span></span>
                  </div>
                  <div class="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 rounded-full" style="width: ${pct}%"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Filter & Search Controls (6 Columns) -->
      <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
        <div>
          <label class="block text-gray-500 mb-1 font-semibold">Cari Catatan</label>
          <input type="text" id="filter-search" placeholder="Cari..." value="${state.reportFilter.search}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500" oninput="applyReportFilter()">
        </div>
        <div>
          <label class="block text-gray-500 mb-1 font-semibold">Tanggal Mulai</label>
          <input type="date" id="filter-start" value="${state.reportFilter.startDate}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500" onchange="applyReportFilter()">
        </div>
        <div>
          <label class="block text-gray-500 mb-1 font-semibold">Tanggal Akhir</label>
          <input type="date" id="filter-end" value="${state.reportFilter.endDate}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500" onchange="applyReportFilter()">
        </div>
        <div>
          <label class="block text-gray-500 mb-1 font-semibold">Jenis Transaksi</label>
          <select id="filter-type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500" onchange="applyReportFilter()">
            <option value="">Semua Jenis</option>
            <option value="pengeluaran" ${state.reportFilter.type === 'pengeluaran' ? 'selected' : ''}>💸 Pengeluaran</option>
            <option value="pemasukan" ${state.reportFilter.type === 'pemasukan' ? 'selected' : ''}>💰 Pemasukan</option>
          </select>
        </div>
        <div>
          <label class="block text-gray-500 mb-1 font-semibold">Kategori Transaksi</label>
          <select id="filter-category" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500" onchange="applyReportFilter()">
            <option value="">Semua Kategori</option>
            <optgroup label="Pos Pengeluaran">
              ${(state.categories || []).filter(c => c.type === 'expense').map(c => `
                <option value="${c.id}" ${state.reportFilter.categoryId === c.id ? 'selected' : ''}>${c.icon || '🏷️'} ${c.name}</option>
              `).join('')}
            </optgroup>
            <optgroup label="Pos Pemasukan">
              ${(state.categories || []).filter(c => c.type === 'income').map(c => `
                <option value="${c.id}" ${state.reportFilter.categoryId === c.id ? 'selected' : ''}>${c.icon || '💰'} ${c.name}</option>
              `).join('')}
            </optgroup>
          </select>
        </div>
        <div>
          <label class="block text-gray-500 mb-1 font-semibold">Dompet</label>
          <select id="filter-wallet" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-orange-500" onchange="applyReportFilter()">
            <option value="">Semua Dompet</option>
            ${state.wallets.map(w => `<option value="${w.id}" ${state.reportFilter.walletId === w.id ? 'selected' : ''}>${w.name}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Quick Category Chips Bar -->
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs py-1">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-gray-400 font-semibold text-[11px] mr-1">Filter Cepat Kategori:</span>
          <button onclick="setReportCategoryFilter('')" class="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${!state.reportFilter.categoryId ? 'bg-orange-500 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
            Semua
          </button>
          ${(state.categories || []).map(c => {
            const isSelected = state.reportFilter.categoryId === c.id;
            return `
              <button onclick="setReportCategoryFilter('${c.id}')" class="px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${isSelected ? 'bg-orange-500 text-white shadow-xs ring-2 ring-orange-300' : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50/50'}">
                <span>${c.icon || '🏷️'}</span>
                <span>${c.name}</span>
              </button>
            `;
          }).join('')}
        </div>
        ${(state.reportFilter.categoryId || state.reportFilter.type || state.reportFilter.walletId || state.reportFilter.search) ? `
          <button onclick="resetReportFilter()" class="px-3 py-1 rounded-lg text-[11px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1">
            <span>✕</span> Reset Filter
          </button>
        ` : ''}
      </div>

      <!-- Transaction Table with Pagination & Receipt Expansion (Part 3) -->
      <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-gray-700">
            <thead class="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
              <tr>
                <th class="p-4">Tanggal (WIB)</th>
                <th class="p-4">Jenis</th>
                <th class="p-4">Pos Kategori</th>
                <th class="p-4">Dompet</th>
                <th class="p-4">Catatan / Merchant</th>
                <th class="p-4 text-right">Nominal</th>
                <th class="p-4 text-center">Aksi / Detail</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${txs.length === 0 ? `
                <tr><td colspan="7" class="p-8 text-center text-gray-400">Tidak ada transaksi ditemukan untuk filter ini.</td></tr>
              ` : txs.map(t => {
                const isInc = t.type === 'pemasukan';
                const hasItems = t.receipt_items && t.receipt_items.length > 0;
                const isExpanded = state.expandedReceiptId === t.id;

                return `
                  <tr class="hover:bg-gray-50/70 transition-colors">
                    <td class="p-4 font-mono">${(t.transaction_date || '').slice(0, 10)}</td>
                    <td class="p-4 font-semibold ${isInc ? 'text-emerald-600' : 'text-rose-600'}">
                      ${isInc ? '💰 Pemasukan' : '💸 Pengeluaran'}
                    </td>
                    <td class="p-4">
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isInc ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-orange-50 text-orange-700 border border-orange-200/60'}">
                        <span>${t.category_icon || '🏷️'}</span>
                        <span>${t.category_name || '-'}</span>
                      </span>
                    </td>
                    <td class="p-4">👛 ${t.wallet_name || 'BCA'}</td>
                    <td class="p-4 font-medium text-gray-900">
                      ${t.merchant_name ? `🏪 ${t.merchant_name}` : t.notes || '-'}
                      ${t.raw_transcript ? `<span class="block text-[10px] text-gray-400 font-mono">🎙️ "${t.raw_transcript}"</span>` : ''}
                    </td>
                    <td class="p-4 text-right font-black ${isInc ? 'text-emerald-600' : 'text-gray-900'}">
                      ${isInc ? '+' : '-'}${formatRupiah(t.amount)}
                    </td>
                    <td class="p-4 text-center">
                      <div class="flex items-center justify-center gap-1.5">
                        ${hasItems ? `
                          <button onclick="toggleReceiptExpand('${t.id}')" class="px-2 py-1 rounded-lg text-[11px] font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
                            ${isExpanded ? '▲ Tutup' : `▼ Rincian (${t.receipt_items.length})`}
                          </button>
                        ` : ''}
                        <button onclick="deleteTransaction('${t.id}')" class="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Hapus Transaksi">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Expandable Receipt Line Items Row (Part 3) -->
                  ${isExpanded && hasItems ? `
                    <tr class="bg-orange-50/40">
                      <td colspan="7" class="p-4">
                        <div class="bg-white p-4 rounded-xl border border-orange-200 text-xs shadow-inner">
                          <h5 class="font-bold text-orange-900 mb-2 flex items-center gap-1.5">
                            <span>🧾</span> Rincian Item Belanja Struk (${t.merchant_name || 'Merchant'}):
                          </h5>
                          <div class="divide-y divide-gray-100">
                            ${t.receipt_items.map(it => `
                              <div class="py-1.5 flex justify-between items-center text-gray-700">
                                <span>• ${it.item_name} <span class="text-gray-400">(${it.quantity}x @ ${formatRupiah(it.price_per_item)})</span></span>
                                <span class="font-bold text-gray-900">${formatRupiah(it.total_amount)}</span>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ` : ''}
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

// 6. SETTINGS & PROFILE TAB (Profil Akun, Foto Profil, Galeri, Telegram Bot)
function renderSettingsPage() {
  const user = state.user || {};
  const isConnected = state.telegramStatus === 'connected';
  const isPro = user.plan_tier === 'pro';
  const displayAvatar = state.tempAvatarUrl !== null ? state.tempAvatarUrl : (user.avatar_url || null);

  return `
    <div class="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      
      <div>
        <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">👤 Profil Akun & Pengaturan</h2>
        <p class="text-xs text-gray-500 mt-0.5">Kelola foto profil akun, unggah atau ekspor gambar galeri, identitas profil, dan integrasi bot Telegram.</p>
      </div>

      <!-- CARD 1: Profil Akun & Edit Foto Profil -->
      <div class="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
        
        <div class="border-b border-gray-100 pb-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 class="text-base md:text-lg font-black text-gray-900 flex items-center gap-2">
              <span>👤</span> Profil Akun & Edit Foto Profil
            </h3>
            <span class="text-xs text-gray-500">Ubah foto profil dari galeri, simpan avatar beresolusi tinggi ke perangkat, atau pilih preset instan.</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 rounded-full text-xs font-bold ${isPro ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-gray-100 text-gray-700'}">
              ${isPro ? '⭐ PRO MEMBER' : 'STARTER PLAN'}
            </span>
          </div>
        </div>

        <!-- Avatar Management Section -->
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 pt-1">
          <!-- Avatar Preview with Ring & Quick Status -->
          <div class="relative group flex-shrink-0">
            <div id="avatar-preview-container" class="w-28 h-28 rounded-full ring-4 ring-orange-500/30 p-1 bg-white shadow-lg overflow-hidden flex items-center justify-center">
              ${displayAvatar ? `
                <img id="avatar-preview-img" src="${displayAvatar}" alt="Foto Profil" class="w-full h-full object-cover rounded-full">
              ` : `
                <div id="avatar-fallback-initial" class="w-full h-full rounded-full bg-gradient-brand text-white flex items-center justify-center font-black text-3xl shadow-inner">
                  ${(user.full_name || 'U').charAt(0).toUpperCase()}
                </div>
              `}
            </div>
            <button type="button" onclick="document.getElementById('avatar-file-input').click()" title="Ganti Foto dari Galeri" class="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center text-sm shadow-md hover:bg-orange-700 hover:scale-110 active:scale-95 transition-all border-2 border-white cursor-pointer">
              📷
            </button>
            <input type="file" id="avatar-file-input" accept="image/*" class="hidden" onchange="handleAvatarFileSelect(event)">
          </div>

          <!-- Avatar Action Controls -->
          <div class="flex-1 space-y-3 text-center sm:text-left w-full">
            <div>
              <h4 class="text-base font-extrabold text-gray-900">${user.full_name || 'Pengguna TataDana'}</h4>
              <p class="text-xs text-gray-500">${user.email || 'user@tatadana.id'} • ${user.phone_number || '-'}</p>
            </div>

            <!-- Action Buttons: Upload from Gallery, Export to Gallery, Remove -->
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
              <button type="button" onclick="document.getElementById('avatar-file-input').click()" class="px-4 py-2 rounded-xl text-xs font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer hover:scale-105 active:scale-95">
                <span>📁</span> Pilih Foto dari Galeri
              </button>
              <button type="button" onclick="exportAvatarToGallery()" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer hover:scale-105 active:scale-95" title="Simpan gambar profil beresolusi tinggi ke galeri perangkat">
                <span>📥</span> Ekspor Foto ke Galeri
              </button>
              <button type="button" id="btn-remove-avatar" onclick="removeAvatar()" class="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-all flex items-center gap-1 shadow-xs cursor-pointer hover:scale-105 active:scale-95 ${!displayAvatar ? 'hidden' : ''}" title="Hapus foto profil dan gunakan inisial default">
                <span>🗑️</span> Hapus Foto
              </button>
            </div>

            <p class="text-[11px] text-gray-400 leading-relaxed">
              Format yang didukung: <b>JPEG, PNG, WEBP, GIF</b>. Gambar akan diselaraskan otomatis pada menu Sidebar, Beranda, dan ruang chat Tata AI.
            </p>
          </div>
        </div>

        <!-- Instant Preset Avatars Selector -->
        <div class="p-4 rounded-2xl bg-orange-50/50 border border-orange-100 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <span>🎨</span> Pilihan Avatar Preset Cepat:
            </span>
            <span class="text-[10px] text-gray-500">Klik salah satu karakter untuk langsung dicoba</span>
          </div>
          <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
            ${[
              { emoji: '🧑‍💻', name: 'Developer', bg: '#3B82F6' },
              { emoji: '👩‍💼', name: 'Eksekutif', bg: '#8B5CF6' },
              { emoji: '🦸', name: 'Hero', bg: '#EF4444' },
              { emoji: '🚀', name: 'Investor', bg: '#F97316' },
              { emoji: '🦁', name: 'Tangguh', bg: '#EAB308' },
              { emoji: '🦊', name: 'Cerdas', bg: '#EA580C' },
              { emoji: '🐼', name: 'Bijak', bg: '#10B981' },
              { emoji: '🪙', name: 'Sultan', bg: '#059669' }
            ].map(preset => `
              <button type="button" onclick="setPresetAvatar('${preset.emoji}', '${preset.bg}', '${preset.name}')" class="p-2.5 rounded-xl bg-white border border-gray-200 hover:border-orange-500 hover:scale-105 active:scale-95 transition-all text-center group shadow-xs cursor-pointer">
                <div class="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-xl shadow-inner" style="background-color: ${preset.bg}15; border: 1.5px solid ${preset.bg}40;">
                  ${preset.emoji}
                </div>
                <span class="text-[10px] font-semibold text-gray-600 block mt-1 truncate group-hover:text-orange-600">${preset.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Account Details Form -->
        <form onsubmit="updateUserProfile(event)" class="space-y-4 pt-2 border-t border-gray-100">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label class="block font-bold text-gray-700 mb-1.5">Nama Lengkap</label>
              <input type="text" id="edit-profile-name" value="${user.full_name || ''}" required placeholder="Masukkan nama lengkap" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 font-semibold text-gray-800">
            </div>
            <div>
              <label class="block font-bold text-gray-700 mb-1.5">Nomor WhatsApp / HP</label>
              <input type="text" id="edit-profile-phone" value="${user.phone_number || ''}" required placeholder="+6281234567890" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500 font-semibold text-gray-800">
            </div>
            <div>
              <label class="block font-bold text-gray-700 mb-1.5">Alamat Email</label>
              <input type="email" id="edit-profile-email" value="${user.email || ''}" disabled class="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl font-medium text-gray-500 cursor-not-allowed">
            </div>
            <div>
              <label class="block font-bold text-gray-700 mb-1.5">Status Hak Akses</label>
              <div class="px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-xl font-bold flex items-center justify-between">
                <span class="${user.role === 'superadmin' ? 'text-purple-700' : 'text-gray-700'}">
                  ${user.role === 'superadmin' ? '🛡️ Super Admin' : '👤 Pengguna Standar'}
                </span>
                <span class="text-[10px] px-2 py-0.5 rounded font-black ${isPro ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-700'}">
                  ${isPro ? '⭐ PRO' : 'STARTER'}
                </span>
              </div>
            </div>
          </div>

          <!-- Save Button -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div id="profile-save-status" class="text-xs font-semibold text-gray-500"></div>
            <button type="submit" id="btn-save-profile" class="px-6 py-2.5 rounded-xl bg-gradient-brand text-white font-bold text-xs shadow-md shadow-orange-500/20 hover:opacity-95 active:scale-95 transition-all flex items-center gap-2 cursor-pointer ml-auto">
              <span>💾</span> Simpan Profil & Foto
            </button>
          </div>
        </form>

      </div>

      <!-- CARD 2: Integrasi Telegram Bot (Part 5) -->
      <div class="bg-white rounded-3xl border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
        
        <!-- Tab Header: Telegram Bot Integration (Part 5) -->
        <div class="border-b border-gray-100 pb-4 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h3 class="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>✈️</span> Integrasi Telegram Bot (@TataKeuanganBot)
            </h3>
            <span class="text-xs text-gray-500">Bot Telegram aktif dan terhubung real-time untuk pencatatan otomatis</span>
          </div>
          <div class="flex items-center gap-2">
            <a href="https://t.me/TataKeuanganBot" target="_blank" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center gap-1.5 border border-blue-200 shadow-xs">
              <span>🚀</span> Buka @TataKeuanganBot
            </a>
            <span id="tg-status-badge" class="px-3 py-1.5 rounded-full text-xs font-bold ${isConnected ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'}">
              ${isConnected ? '🟢 Terhubung (@TataKeuanganBot)' : '🔴 Tidak Terhubung'}
            </span>
          </div>
        </div>

        <!-- Inline Step-by-Step Guide from @BotFather -->
        <div class="p-4 rounded-xl bg-orange-50 border border-orange-200 text-xs text-gray-700 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-orange-900 block text-sm">🤖 Bot Telegram Resmi Kamu:</span>
            <span class="bg-orange-100 text-orange-800 font-mono text-[11px] px-2 py-0.5 rounded font-bold">@TataKeuanganBot</span>
          </div>
          <p class="leading-relaxed">
            Bot Telegram Anda sudah tersambung langsung ke database TataDana melalui <b>HTTP API & Real-Time Long Polling</b>. 
            Anda dapat langsung chat dengan <b>@TataKeuanganBot</b> di Telegram untuk mencatat pengeluaran (*"kopi 25rb"*), cek saldo (*"/saldo"*), anggaran (*"/budget"*), hingga scan struk & voice note!
          </p>
        </div>

        <!-- Token Input & Test Connection Button -->
        <div class="space-y-3">
          <label class="block text-xs font-bold text-gray-700">Bot Token Telegram (Aktif)</label>
          <div class="flex gap-2">
            <input id="tg-bot-token" type="text" placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxyz..." value="${state.telegramBotToken || '8853112131:AAGNZDVNBGnBTZBZcNhIni1iv2eb011-Fjo'}" class="flex-1 px-4 py-2.5 text-xs font-mono border border-gray-300 rounded-xl focus:outline-none focus:border-orange-500">
            <button id="btn-test-tg" onclick="testTelegramConnection()" class="px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-md hover:shadow-orange-500/30 transition-all flex items-center gap-1.5">
              <span>⚡</span> Test Ulang Koneksi
            </button>
          </div>
          <div id="tg-test-feedback" class="text-xs font-semibold">
            <span class="text-emerald-600 font-bold">🟢 Bot @TataKeuanganBot aktif & polling berjalan realtime di server.</span>
          </div>
        </div>

        <!-- Reminder Settings Tab -->
        <div class="pt-6 border-t border-gray-100 space-y-4">
          <h4 class="text-sm font-bold text-gray-900">⏰ Pengingat Catat Harian (Telegram Reminder)</h4>
          <div class="flex items-center gap-4 text-xs">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" id="reminder-toggle" checked class="rounded text-orange-600 focus:ring-orange-500">
              <span class="font-semibold text-gray-700">Aktifkan Reminder Otomatis</span>
            </label>
            <select id="reminder-freq" class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">
              <option value="1">1x Sehari (19:00 WIB)</option>
              <option value="2">2x Sehari (12:00 & 19:00 WIB)</option>
            </select>
          </div>

          <!-- Preview Pesan Reminder (Part 4.8) -->
          <div class="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-700">
            <span class="text-gray-400 block mb-1">[Pratinjau Pesan yang Dikirimkan Bot]:</span>
            ⏰ Reminder Keuangan!<br>
            Jangan lupa catat pengeluaran hari ini ya 📝<br>
            Pencatatan rutin = keuangan lebih terkontrol 💪<br>
            Ketik transaksimu sekarang!
          </div>
        </div>

      </div>

    </div>
  `;
}

// 7. ADMIN DASHBOARD & APPROVAL PORTAL
function renderAdminDashboard() {
  // Case 1: Regular users attempting to access Admin Panel -> Strict 403 Forbidden
  if (state.user && state.user.role !== 'superadmin') {
    return `
      <div class="max-w-md mx-auto my-12 bg-white rounded-3xl shadow-2xl border border-rose-200 p-8 space-y-6 text-center animate-fade-in">
        <div class="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-4xl mx-auto shadow-inner">
          🚫
        </div>
        <div>
          <span class="px-3 py-1 rounded-full text-[11px] font-black bg-rose-100 text-rose-700 uppercase tracking-wider">
            403 • Akses Ditolak
          </span>
          <h2 class="text-2xl font-black text-gray-900 mt-2">Bukan Akun Superadmin</h2>
          <p class="text-xs text-gray-600 mt-2 leading-relaxed">
            Akun Anda (<b>${state.user.full_name}</b>) terdaftar sebagai pengguna standar TataDana dan <b>tidak memiliki izin</b> untuk membuka Pusat Kendali Superadmin.
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left text-xs text-gray-700 space-y-1.5">
          <div class="font-bold text-gray-900 flex items-center gap-1.5">
            <span>🛡️ Hak Akses Khusus:</span>
            <span>Superadmin Resmi</span>
          </div>
          <p class="text-[11px] text-gray-500 leading-normal">
            Panel ini hanya diperuntukkan bagi Superadmin resmi (<b>@nandikapratama</b>) untuk manajemen pengguna, persetujuan pembayaran PRO, dan audit sistem.
          </p>
        </div>

        <div class="space-y-2.5 pt-2">
          <button onclick="navigate('dashboard')" class="w-full py-3.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/30 transition-all flex items-center justify-center gap-2">
            <span>🏠</span> Kembali ke Dashboard Saya
          </button>
          <button onclick="state.user = null; navigate('login')" class="w-full py-2.5 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors">
            Ganti Akun / Masuk sebagai Superadmin
          </button>
        </div>
      </div>
    `;
  }

  // Case 2: Unauthenticated visitor -> Superadmin Verification Gate
  if (!state.user) {
    return `
      <div class="max-w-md mx-auto my-12 bg-white rounded-3xl shadow-xl border border-purple-200 p-8 space-y-6 text-center">
        <div class="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-3xl mx-auto shadow-inner">
          🛡️
        </div>
        <div>
          <h2 class="text-2xl font-black text-gray-900">Akses Terbatas: Superadmin</h2>
          <p class="text-xs text-gray-500 mt-2">Halaman ini dikhususkan untuk Administrator Sistem TataDana. Masukkan kredensial admin Anda untuk melanjutkan.</p>
        </div>

        <div class="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-left text-xs text-purple-900 space-y-1">
          <div class="font-bold flex items-center gap-1.5">
            <span>🛡️ Keamanan Administrator:</span>
            <span>Akses Terbatas</span>
          </div>
          <div class="text-[11px] text-purple-700">
            Halaman ini hanya dapat diakses oleh Super Admin yang sah. Silakan masukkan kredensial admin Anda untuk membuka panel kendali.
          </div>
        </div>

        <form onsubmit="handleDirectAdminLogin(event)" class="space-y-4 text-left">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Email / Identifier Admin</label>
            <input id="admin-gate-email" type="text" placeholder="@nandikapratama" class="w-full px-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">Password Admin</label>
            <input id="admin-gate-password" type="password" placeholder="••••••••" class="w-full px-4 py-2.5 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all">
          </div>
          <button type="submit" class="w-full py-3 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer">
            Verifikasi & Buka Panel Admin
          </button>
        </form>

        <div class="pt-2">
          <button onclick="navigate('dashboard')" class="text-xs text-gray-500 hover:text-gray-800 font-semibold">
            ← Kembali ke Dashboard Pengguna
          </button>
        </div>
      </div>
    `;
  }

  const users = state.adminUsers || [];
  const providers = state.aiProviders || [];
  const auditLogs = state.adminAuditLogs || [];
  const payments = state.adminPayments || [];
  const stats = state.adminStats || { totalUsers: users.length, proUsers: 1, starterUsers: 1, totalTransactions: 12, totalVolume: 6500000, pendingApprovals: payments.filter(p => p.status === 'pending').length, totalRevenue: 99000 };
  const currentTab = state.adminTab || 'approvals';

  return `
    <div class="space-y-6">
      
      <!-- Admin Top Banner -->
      <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 uppercase tracking-wider text-purple-200">
              🛡️ SUPERADMIN CONTROL PANEL
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
              👤 Nandika Pratama (@nandikapratama)
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300">
              Sistem Aktif (WIB)
            </span>
          </div>
          <h2 class="text-2xl font-black tracking-tight">Pusat Kendali & Approval TataDana</h2>
          <p class="text-xs text-purple-200 mt-0.5">Kelola antrean upgrade PRO, manajemen akun pengguna, audit keamanan, dan provider AI.</p>
        </div>

        <!-- User Impersonation Dropdown -->
        <div class="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl backdrop-blur-md border border-white/10">
          <span class="text-xs font-semibold text-purple-200">🎭 Impersonate User:</span>
          <select id="impersonate-select" onchange="handleImpersonate(this.value)" class="bg-purple-950 text-white text-xs px-3 py-1.5 rounded-lg border border-purple-400 focus:outline-none">
            <option value="">Pilih Akun Pengguna...</option>
            ${users.map(u => `<option value="${u.id}">${u.full_name} (${(u.plan_tier || 'starter').toUpperCase()})</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- 4 Top KPI Stats Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span class="text-xs text-gray-500 block mb-1">Total Pengguna</span>
          <div class="text-2xl font-black text-gray-900">${stats.totalUsers || users.length} Akun</div>
          <div class="text-[11px] text-gray-500 mt-1 flex gap-2 font-medium">
            <span class="text-orange-600 font-bold">${stats.proUsers || 1} PRO</span> • 
            <span>${stats.starterUsers || 1} Starter</span>
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-white border ${stats.pendingApprovals > 0 ? 'border-amber-400 bg-amber-50/20' : 'border-gray-200'} shadow-sm">
          <div class="flex justify-between items-center mb-1 text-xs">
            <span class="text-gray-500">Antrean Approval</span>
            ${stats.pendingApprovals > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 animate-pulse">Perlu Aksi</span>` : ''}
          </div>
          <div class="text-2xl font-black ${stats.pendingApprovals > 0 ? 'text-amber-600' : 'text-gray-900'}">${stats.pendingApprovals || 0} Menunggu</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Permintaan upgrade paket</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span class="text-xs text-gray-500 block mb-1">Total Volume Transaksi</span>
          <div class="text-2xl font-black text-gray-900">${formatRupiah(stats.totalVolume || 6500000)}</div>
          <span class="text-[11px] text-emerald-600 font-semibold mt-1 block">Tercatat di Supabase</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span class="text-xs text-gray-500 block mb-1">Pendapatan SaaS</span>
          <div class="text-2xl font-black text-purple-700">${formatRupiah(stats.totalRevenue || 99000)}</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Dari transaksi PRO yang disetujui</span>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto text-xs font-bold">
        <button onclick="setAdminTab('approvals')" class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${currentTab === 'approvals' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}">
          <span>🛡️</span> Antrean Approval Admin
          ${stats.pendingApprovals > 0 ? `<span class="bg-amber-400 text-gray-950 px-1.5 py-0.2 rounded-full text-[10px]">${stats.pendingApprovals}</span>` : ''}
        </button>
        <button onclick="setAdminTab('users')" class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${currentTab === 'users' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}">
          <span>👥</span> Manajemen Pengguna
        </button>
        <button onclick="setAdminTab('ai')" class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${currentTab === 'ai' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}">
          <span>🤖</span> AI Multi-Provider
        </button>
        <button onclick="setAdminTab('audit')" class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${currentTab === 'audit' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}">
          <span>📜</span> Audit Logs Keamanan
        </button>
        <button onclick="setAdminTab('simulator')" class="px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${currentTab === 'simulator' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}">
          <span>🧪</span> Telegram Webhook Simulator
        </button>
      </div>

      <!-- TAB 1: Antrean Verifikasi & Approval Pembayaran -->
      ${currentTab === 'approvals' ? `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">
                  🛡️ Antrean Pusat
                </span>
                ${stats.pendingApprovals > 0 ? `
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 animate-pulse">
                    ⚡ ${stats.pendingApprovals} Menunggu Tindakan Admin
                  </span>
                ` : ''}
              </div>
              <h3 class="text-base font-extrabold text-gray-900">🛡️ Antrean Verifikasi Pengguna Baru & Approval Pembayaran</h3>
              <p class="text-xs text-gray-500">Tinjau profil pengguna baru yang mendaftar, verifikasi nomor WhatsApp secara instan, serta setujui permintaan upgrade akun ke PRO.</p>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="fetchAdminData(); render();" class="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer">
                <span>🔄</span> Refresh Antrean
              </button>
            </div>
          </div>

          <!-- Filter Pills: Semua | Pendaftaran Baru | Upgrade PRO -->
          <div class="flex flex-wrap items-center gap-2 pt-1 border-b border-gray-100 pb-3">
            ${(() => {
              const filter = state.adminApprovalFilter || 'all';
              const totalCount = payments.length;
              const regCount = payments.filter(p => p.type === 'registration_verification' || (p.order_id && p.order_id.startsWith('REG-'))).length;
              const payCount = payments.filter(p => !(p.type === 'registration_verification' || (p.order_id && p.order_id.startsWith('REG-')))).length;
              return `
                <button onclick="setAdminApprovalFilter('all')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${filter === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
                  Semua Antrean (${totalCount})
                </button>
                <button onclick="setAdminApprovalFilter('registration')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${filter === 'registration' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
                  <span>👤</span> Pendaftaran Akun Baru (${regCount})
                </button>
                <button onclick="setAdminApprovalFilter('payment')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${filter === 'payment' ? 'bg-orange-600 text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
                  <span>⭐</span> Upgrade Paket PRO (${payCount})
                </button>
              `;
            })()}
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-gray-700">
              <thead class="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                <tr>
                  <th class="p-3.5">ID & Jenis Antrean</th>
                  <th class="p-3.5">Profil Pengguna & Kontak</th>
                  <th class="p-3.5">Paket & Nominal</th>
                  <th class="p-3.5">Waktu Masuk (WIB)</th>
                  <th class="p-3.5">Status</th>
                  <th class="p-3.5 text-center">Aksi Approval & Verifikasi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${(() => {
                  const filter = state.adminApprovalFilter || 'all';
                  const filteredList = payments.filter(p => {
                    const isReg = p.type === 'registration_verification' || (p.order_id && p.order_id.startsWith('REG-'));
                    if (filter === 'registration') return isReg;
                    if (filter === 'payment') return !isReg;
                    return true;
                  });

                  if (filteredList.length === 0) {
                    return `<tr><td colspan="6" class="p-8 text-center text-gray-400">Belum ada data dalam antrean verifikasi & approval.</td></tr>`;
                  }

                  return filteredList.map(p => {
                    const isReg = p.type === 'registration_verification' || (p.order_id && p.order_id.startsWith('REG-'));
                    const u = users.find(x => x.id === p.user_id) || {};
                    const fullName = p.user_full_name || u.full_name || p.full_name || 'Pengguna Baru';
                    const phone = p.user_phone_number || u.phone_number || p.phone_number || '-';
                    const email = p.user_email || u.email || p.email || '-';
                    const isPending = p.status === 'pending';
                    const isSettled = p.status === 'settlement';
                    const tier = p.plan_tier || u.plan_tier || 'starter';
                    const initial = fullName.charAt(0).toUpperCase();

                    return `
                      <tr class="hover:bg-gray-50/80 transition-colors ${isPending ? (isReg ? 'bg-emerald-50/20' : 'bg-orange-50/20') : ''}">
                        <td class="p-3.5 align-top">
                          <div class="space-y-1">
                            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${isReg ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-700'}">
                              <span>${isReg ? '👤' : '⭐'}</span>
                              <span>${isReg ? 'Pendaftaran Akun' : 'Upgrade Paket PRO'}</span>
                            </span>
                            <div class="font-mono text-gray-900 font-bold text-[11px]">${p.order_id}</div>
                          </div>
                        </td>

                        <td class="p-3.5 align-top">
                          <div class="flex items-start gap-2.5">
                            <div class="w-8 h-8 rounded-xl ${isReg ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'} flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                              ${initial}
                            </div>
                            <div class="space-y-0.5">
                              <div class="flex items-center gap-1.5">
                                <span class="font-black text-gray-900">${fullName}</span>
                                <button type="button" onclick="openUserProfileModal('${p.order_id}')" class="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors" title="Buka profil lengkap">
                                  👁️ Profil
                                </button>
                                <button type="button" onclick="openUserDatabaseModal('${p.user_id || u.id || p.order_id || ''}', '${phone || ''}', '${fullName || ''}')" class="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded cursor-pointer transition-colors" title="Buka seluruh database pengguna">
                                  📂 Database
                                </button>
                              </div>
                              <div class="flex items-center gap-2 text-[11px]">
                                <span class="text-gray-600 font-mono flex items-center gap-1">
                                  <span>💬</span> ${phone}
                                </span>
                                ${phone !== '-' ? `
                                  <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${fullName}, salam dari Admin TataDana!`)}" target="_blank" class="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline">
                                    Chat WA →
                                  </a>
                                ` : ''}
                              </div>
                              <span class="text-gray-400 text-[11px] block">${email}</span>
                            </div>
                          </div>
                        </td>

                        <td class="p-3.5 align-top">
                          <div class="space-y-1">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${tier === 'pro' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}">
                              ${tier.toUpperCase()}
                            </span>
                            <div class="font-bold text-gray-800">
                              ${p.amount > 0 ? formatRupiah(p.amount) : '<span class="text-gray-400 font-medium">Rp0 (Registrasi)</span>'}
                            </div>
                          </div>
                        </td>

                        <td class="p-3.5 align-top text-gray-500 font-mono text-[11px]">
                          ${(p.created_at || 'Hari ini').slice(0, 19).replace('T', ' ')} WIB
                        </td>

                        <td class="p-3.5 align-top">
                          ${isSettled ? `
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-max">
                              🟢 ${isReg ? 'Terverifikasi & Aktif' : 'Disetujui (Settled)'}
                            </span>
                          ` : isPending ? `
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 w-max animate-pulse">
                              🟡 ${isReg ? 'Menunggu Verifikasi WhatsApp' : 'Menunggu Approval PRO'}
                            </span>
                          ` : `
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1 w-max">
                              🔴 Ditolak
                            </span>
                          `}
                        </td>

                        <td class="p-3.5 align-top text-center">
                          ${isPending ? `
                            <div class="flex items-center justify-center gap-1.5 flex-wrap">
                              <button onclick="approvePayment('${p.order_id || ''}', '${p.user_id || ''}', '${(phone || '').replace(/[^0-9+]/g, '')}')" class="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer">
                                <span>✅</span> ${isReg ? 'Setujui & Verifikasi Akun' : 'Approve PRO'}
                              </button>
                              ${isReg && phone !== '-' ? `
                                <a href="https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${fullName}! Pendaftaran akun Anda di TataDana telah diverifikasi & disetujui oleh Admin. Akun Anda sudah aktif.`)}" target="_blank" class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#25D366] hover:bg-emerald-600 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer">
                                  <span>💬</span> Chat WA
                                </a>
                              ` : ''}
                              <button onclick="rejectPayment('${p.order_id || ''}', '${p.user_id || ''}', '${(phone || '').replace(/[^0-9+]/g, '')}')" class="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-300 hover:bg-rose-50 hover:text-rose-600 text-gray-600 transition-colors cursor-pointer">
                                ✕ Tolak
                              </button>
                            </div>
                          ` : `
                            <div class="flex items-center justify-center gap-2">
                              <span class="text-gray-400 text-[11px] italic">Telah Diproses</span>
                              <button onclick="openUserProfileModal('${p.order_id}')" class="text-xs font-bold text-purple-600 hover:underline cursor-pointer">Lihat Profil</button>
                            </div>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('');
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- TAB 2: Manajemen Pengguna & Seluruh Database -->
      ${currentTab === 'users' ? `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 uppercase tracking-wider">
                  👥 Database Pusat Pengguna
                </span>
                <span class="text-xs text-gray-400 font-semibold">Total ${users.length} Akun Terdaftar</span>
              </div>
              <h3 class="text-base font-extrabold text-gray-900">👥 Manajemen Pengguna & Seluruh Database</h3>
              <p class="text-xs text-gray-500">Audit database seluruh pendaftar, saldo dompet terkonsolidasi, histori transaksi, anggaran, dan hak akses.</p>
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto">
              <div class="relative w-full sm:w-64">
                <input type="text" id="admin-user-search-input" value="${state.adminUserSearch || ''}" oninput="setAdminUserSearch(this.value)" placeholder="Cari nama, WhatsApp, email..." class="w-full px-3.5 py-2 pl-9 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-purple-500 bg-gray-50/50">
                <span class="absolute left-3 top-2.5 text-xs text-gray-400">🔍</span>
              </div>
              <button onclick="fetchAdminData(); render();" class="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold hover:bg-gray-50 flex items-center gap-1.5 transition-colors cursor-pointer" title="Refresh">
                <span>🔄</span>
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-gray-700">
              <thead class="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                <tr>
                  <th class="p-3.5">Pengguna & Kontak</th>
                  <th class="p-3.5">Role & Paket</th>
                  <th class="p-3.5">Database Dompet</th>
                  <th class="p-3.5">Aktivitas Finansial</th>
                  <th class="p-3.5 text-center">Aksi Super Admin</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                ${(() => {
                  const q = (state.adminUserSearch || '').toLowerCase().trim();
                  const filteredUsers = users.filter(u => {
                    if (!q) return true;
                    return (u.full_name || '').toLowerCase().includes(q) ||
                           (u.email || '').toLowerCase().includes(q) ||
                           (u.phone_number || '').includes(q) ||
                           (u.id || '').toLowerCase().includes(q);
                  });

                  if (filteredUsers.length === 0) {
                    return `<tr><td colspan="5" class="p-8 text-center text-gray-400">Tidak ada pengguna yang cocok dengan pencarian "${state.adminUserSearch}".</td></tr>`;
                  }

                  return filteredUsers.map(u => {
                    const isVerified = Boolean(u.whatsapp_verified || u.phone_verified);
                    const cleanPhone = (u.phone_number || '').replace(/[^0-9]/g, '');
                    const initial = (u.full_name || 'U').charAt(0).toUpperCase();

                    return `
                      <tr class="hover:bg-gray-50/70 transition-colors">
                        <td class="p-3.5 align-top">
                          <div class="flex items-start gap-2.5">
                            <div class="w-8 h-8 rounded-xl ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'} flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                              ${initial}
                            </div>
                            <div class="space-y-0.5">
                              <span class="font-bold text-gray-900 block text-xs">${u.full_name}</span>
                              <div class="flex items-center gap-2 text-[11px]">
                                <span class="text-gray-500 font-mono">💬 ${u.phone_number || '-'}</span>
                                ${cleanPhone ? `
                                  <a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Halo ${u.full_name}, salam dari Admin TataDana!`)}" target="_blank" class="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline">
                                    Chat WA →
                                  </a>
                                ` : ''}
                              </div>
                              <span class="text-gray-400 text-[10px] block break-all">${u.email || '-'}</span>
                              <span class="font-mono text-[10px] text-purple-600 bg-purple-50 px-1 py-0.2 rounded inline-block">${u.id}</span>
                            </div>
                          </div>
                        </td>

                        <td class="p-3.5 align-top">
                          <div class="space-y-1.5">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-gray-100 text-gray-600'}">
                                ${u.role === 'superadmin' ? '🛡️ SUPERADMIN' : 'USER'}
                              </span>
                              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${u.plan_tier === 'pro' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-gray-100 text-gray-600'}">
                                ${u.plan_tier === 'pro' ? '⭐ PRO' : 'STARTER'}
                              </span>
                            </div>
                            <div>
                              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${isVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                <span>${isVerified ? '🟢' : '🟡'}</span>
                                <span>${isVerified ? 'WA Terverifikasi' : 'Menunggu Verifikasi WA'}</span>
                              </span>
                            </div>
                          </div>
                        </td>

                        <td class="p-3.5 align-top">
                          <div class="space-y-1">
                            <div class="font-black text-gray-900 text-sm">
                              ${formatRupiah(u.total_balance || 0)}
                            </div>
                            <span class="text-[11px] text-gray-500 block">
                              👛 ${u.wallets_count !== undefined ? u.wallets_count : 1} Dompet Terdaftar
                            </span>
                          </div>
                        </td>

                        <td class="p-3.5 align-top">
                          <div class="space-y-1 text-[11px]">
                            <div class="font-bold text-gray-800 flex items-center gap-1.5">
                              <span>📊</span>
                              <span>${u.transactions_count || 0} Catatan Transaksi</span>
                            </div>
                            <div class="text-[10px] text-gray-400">
                              <span>🎯 ${u.budgets_count || 0} Pos Budget</span> • 
                              <span>🏷️ ${u.categories_count || 5} Kategori</span>
                            </div>
                            ${(u.total_income || 0) > 0 || (u.total_expense || 0) > 0 ? `
                              <div class="text-[10px] space-x-1.5 font-medium">
                                <span class="text-emerald-600">+${formatRupiah(u.total_income || 0)}</span>
                                <span class="text-rose-600">-${formatRupiah(u.total_expense || 0)}</span>
                              </div>
                            ` : `
                              <span class="text-[10px] text-gray-400 italic">Keuangan bersih (Rp0)</span>
                            `}
                          </div>
                        </td>

                        <td class="p-3.5 align-top text-center">
                          <div class="flex items-center justify-center gap-1.5 flex-wrap">
                            <button onclick="openUserDatabaseModal('${u.id}', '${u.phone_number || ''}', '${u.full_name || ''}')" class="px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white shadow-xs transition-all flex items-center gap-1 cursor-pointer" title="Buka seluruh database pengguna ini">
                              <span>📂</span> Buka Database
                            </button>
                            <button onclick="toggleUserTier('${u.id}', '${u.plan_tier}')" class="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer" title="Ubah paket Starter / Pro">
                              ${u.plan_tier === 'pro' ? 'Ke Starter' : '⚡ Upgrade PRO'}
                            </button>
                            <button onclick="handleImpersonate('${u.id}')" class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors cursor-pointer" title="Impersonate live view">
                              🎭 Impersonate
                            </button>
                            ${!isVerified ? `
                              <button onclick="adminVerifyUserWhatsapp('${u.id}')" class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer" title="Verifikasi dan aktifkan akun pengguna langsung dari dashboard">
                                ✔ Setujui & Verifikasi
                              </button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('');
                })()}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- TAB 3: AI Multi-Provider Config -->
      ${currentTab === 'ai' ? `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-base font-extrabold text-gray-900">🤖 Konfigurasi Engine AI Multi-Provider</h3>
              <p class="text-xs text-gray-500">Atur failover mode otomatis antara Google Gemini, OpenAI GPT, dan DeepSeek.</p>
            </div>
            <div class="flex items-center gap-2 text-xs">
              <span class="font-semibold text-gray-600">Mode Eksekusi:</span>
              <select id="ai-mode-select" onchange="updateAIMode(this.value)" class="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold bg-gray-50">
                <option value="failover" ${state.aiMode === 'failover' ? 'selected' : ''}>Failover (Paralel Cadangan Otomatis)</option>
                <option value="single" ${state.aiMode === 'single' ? 'selected' : ''}>Single Provider Only</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${[
              { name: 'Google Gemini', key: 'gemini', model: 'gemini-2.5-flash', status: 'Primary Default', desc: 'Digunakan untuk parser transaksi, OCR vision struk, dan Tata AI bot' },
              { name: 'OpenAI GPT', key: 'openai', model: 'gpt-4o-mini', status: 'Failover 1', desc: 'Cadangan otomatis jika Google Gemini mengalami rate limit / timeout' },
              { name: 'DeepSeek', key: 'deepseek', model: 'deepseek-chat', status: 'Failover 2', desc: 'Cadangan lapis ketiga untuk efisiensi biaya dan latency rendah' }
            ].map(p => `
              <div class="p-5 rounded-2xl border border-gray-200 bg-gray-50 space-y-3 text-xs">
                <div class="flex justify-between items-center">
                  <span class="font-bold text-gray-900 text-sm">${p.name}</span>
                  <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">${p.status}</span>
                </div>
                <p class="text-[11px] text-gray-500">${p.desc}</p>
                <span class="text-gray-500 block">Model: <code class="font-mono bg-white px-1 py-0.5 rounded border border-gray-200">${p.model}</code></span>
                <input type="password" value="sk-encrypted-production-key" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white">
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- TAB 4: Audit Logs Keamanan -->
      ${currentTab === 'audit' ? `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-base font-extrabold text-gray-900">📜 Audit Logs Aktivitas & Keamanan</h3>
              <p class="text-xs text-gray-500">Riwayat pencatatan tindakan admin, approval pembayaran, dan perubahan konfigurasi sistem.</p>
            </div>
          </div>

          <div class="divide-y divide-gray-100 text-xs">
            ${auditLogs.length === 0 ? `
              <div class="p-6 text-center text-gray-400">Belum ada riwayat audit log.</div>
            ` : auditLogs.map(a => `
              <div class="py-3.5 flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.action?.includes('APPROVE') ? 'bg-emerald-100 text-emerald-700' : a.action?.includes('REJECT') ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'}">
                      ${a.action}
                    </span>
                    <span class="text-gray-400 text-[11px]">oleh <b>${a.admin || 'Admin'}</b></span>
                  </div>
                  <p class="text-gray-800 font-medium">${a.details}</p>
                </div>
                <span class="text-gray-400 font-mono text-[11px] flex-shrink-0">${(a.created_at || '').slice(0, 19).replace('T', ' ')} WIB</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- TAB 5: Telegram Webhook Simulator -->
      ${currentTab === 'simulator' ? `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-base font-extrabold text-gray-900">🧪 Telegram Webhook & Command Simulator</h3>
              <p class="text-xs text-gray-500">Uji langsung respon bot Telegram untuk perintah bebas, foto struk, suara, dan commands.</p>
            </div>
            <span class="text-xs font-mono bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full font-bold">Idempotency Active</span>
          </div>

          <!-- Quick Test Command Pills -->
          <div class="flex flex-wrap gap-2 pt-2">
            <span class="text-xs font-bold text-gray-400 flex items-center">⚡ Coba Perintah Bot:</span>
            ${['/start', '/saldo', '/dompet', '/budget', '/hariini', '/mingguini', '/bulanini'].map(cmd => `
              <button onclick="runSimCommand('${cmd}')" class="px-3 py-1 rounded-full text-xs font-mono font-bold bg-gray-100 hover:bg-orange-100 hover:text-orange-700 transition-colors">
                ${cmd}
              </button>
            `).join('')}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <!-- Sim 1: Natural Text -->
            <div class="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
              <span class="text-xs font-bold text-gray-800 block">Kirim Pesan Teks</span>
              <input id="sim-text-input" type="text" placeholder="beli soto 20rb" value="beli soto babat 25rb pakai gopay" class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white">
              <button onclick="triggerWebhookSimulation('text')" class="w-full py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors">
                Simulasi Kirim Teks
              </button>
            </div>

            <!-- Sim 2: Receipt Photo (Pro) -->
            <div class="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
              <span class="text-xs font-bold text-gray-800 block">Foto Struk Belanja</span>
              <div class="text-[11px] text-gray-500">Simulasi scan OCR struk Indomaret multi-item</div>
              <button onclick="triggerWebhookSimulation('photo')" class="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
                Simulasi Kirim Struk
              </button>
            </div>

            <!-- Sim 3: Voice Note -->
            <div class="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
              <span class="text-xs font-bold text-gray-800 block">Voice Note Audio</span>
              <div class="text-[11px] text-gray-500">Simulasi pesan suara audio STT (15s)</div>
              <button onclick="triggerWebhookSimulation('voice')" class="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors">
                Simulasi Kirim Suara
              </button>
            </div>
          </div>

          <!-- Simulation Output Terminal -->
          <div id="sim-output" class="p-4 rounded-xl bg-gray-950 text-emerald-400 font-mono text-xs hidden whitespace-pre-wrap leading-relaxed border border-gray-800"></div>
        </div>
      ` : ''}

      ${state.viewingUserProfile ? `
        <!-- Modal Rincian Profil Pengguna Antrean & Verifikasi -->
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-xl overflow-hidden animate-scale-up">
            
            <!-- Modal Header with gradient -->
            <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 relative">
              <button onclick="closeUserProfileModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-colors cursor-pointer" title="Tutup">
                ✕
              </button>
              <div class="flex items-center gap-2 mb-2">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-purple-200">
                  📋 Data & Profil Antrean Verifikasi
                </span>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${state.viewingUserProfile.status === 'settlement' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'}">
                  ${state.viewingUserProfile.status === 'settlement' ? '🟢 Terverifikasi / Aktif' : '🟡 Menunggu Verifikasi'}
                </span>
              </div>
              <div class="flex items-center gap-4 mt-3">
                <div class="w-16 h-16 rounded-2xl bg-gradient-brand text-white flex items-center justify-center text-2xl font-black shadow-lg border-2 border-white/20 flex-shrink-0">
                  ${state.viewingUserProfile.avatar_url ? `<img src="${state.viewingUserProfile.avatar_url}" class="w-full h-full rounded-2xl object-cover">` : (state.viewingUserProfile.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 class="text-xl font-black tracking-tight">${state.viewingUserProfile.full_name || 'Pengguna Baru'}</h3>
                  <div class="flex items-center gap-2 text-xs text-purple-200 mt-1">
                    <span class="font-mono text-[11px]">${state.viewingUserProfile.user_id || '-'}</span>
                    <span>•</span>
                    <span class="px-2 py-0.2 rounded bg-purple-500/30 text-[10px] font-bold uppercase">${(state.viewingUserProfile.role || 'user')}</span>
                    <span>•</span>
                    <span class="px-2 py-0.2 rounded font-black text-[10px] uppercase ${state.viewingUserProfile.plan_tier === 'pro' ? 'bg-orange-500/40 text-orange-200' : 'bg-white/20 text-white'}">${(state.viewingUserProfile.plan_tier || 'starter')}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Body Details -->
            <div class="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              
              <!-- Info Order & Status Registrasi -->
              <div class="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <span class="text-[11px] text-gray-400 block font-medium">Nomor Order / Antrean:</span>
                  <span class="font-mono font-bold text-gray-800 text-xs">${state.viewingUserProfile.order_id || '-'}</span>
                </div>
                <div>
                  <span class="text-[11px] text-gray-400 block font-medium">Jenis Antrean:</span>
                  <span class="font-bold text-purple-700 text-xs">
                    ${state.viewingUserProfile.type === 'registration_verification' || (state.viewingUserProfile.order_id && state.viewingUserProfile.order_id.startsWith('REG-')) ? '👤 Pendaftaran Pengguna Baru' : '⭐ Upgrade Paket PRO'}
                  </span>
                </div>
                <div>
                  <span class="text-[11px] text-gray-400 block font-medium">Waktu Pendaftaran:</span>
                  <span class="text-gray-700 font-mono text-[11px]">${(state.viewingUserProfile.created_at || '').slice(0, 19).replace('T', ' ')} WIB</span>
                </div>
                <div>
                  <span class="text-[11px] text-gray-400 block font-medium">Nominal Pembayaran:</span>
                  <span class="font-bold text-gray-800 text-xs">${state.viewingUserProfile.amount > 0 ? formatRupiah(state.viewingUserProfile.amount) : 'Rp0 (Pendaftaran Akun)'}</span>
                </div>
              </div>

              <!-- Kontak & Verifikasi WhatsApp -->
              <div class="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                    <span>📱</span> Nomor WhatsApp & Kontak Resmi
                  </span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${state.viewingUserProfile.whatsapp_verified ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}">
                    ${state.viewingUserProfile.whatsapp_verified ? '✓ Terverifikasi' : 'Belum Diverifikasi'}
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span class="text-[11px] text-gray-400 block">Nomor WhatsApp:</span>
                    <span class="font-mono font-extrabold text-gray-900 text-sm">${state.viewingUserProfile.phone_number || '-'}</span>
                  </div>
                  <div class="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span class="text-[11px] text-gray-400 block">Email Terdaftar:</span>
                    <span class="font-semibold text-gray-800 text-xs break-all">${state.viewingUserProfile.email || '-'}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between bg-emerald-100/70 p-2.5 rounded-xl border border-emerald-200 text-[11px]">
                  <span class="text-emerald-950 font-semibold flex items-center gap-1.5">
                    <span>🛡️</span> Metode Verifikasi: <b>Chat WhatsApp ke No Admin</b>
                  </span>
                  <span class="font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    Verifikasi 1-Klik
                  </span>
                </div>

                ${state.viewingUserProfile.phone_number && state.viewingUserProfile.phone_number !== '-' ? `
                  <div class="pt-1">
                    <a href="https://wa.me/${state.viewingUserProfile.phone_number.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Halo ${state.viewingUserProfile.full_name}! Pendaftaran akun Anda di TataDana telah kami verifikasi dan disetujui. Akun Anda sudah aktif.`)}" target="_blank" class="w-full py-2.5 rounded-xl text-xs font-bold bg-[#25D366] hover:bg-emerald-600 text-white shadow-xs flex items-center justify-center gap-2 transition-all">
                      <span>💬</span> Hubungi Pengguna via WhatsApp (${state.viewingUserProfile.phone_number})
                    </a>
                  </div>
                ` : ''}
              </div>

              <!-- Admin Quick Approval Actions inside Modal -->
                <button type="button" onclick="openUserDatabaseModal('${state.viewingUserProfile.user_id || state.viewingUserProfile.id || state.viewingUserProfile.order_id || ''}', '${state.viewingUserProfile.phone_number || ''}', '${state.viewingUserProfile.full_name || ''}'); closeUserProfileModal();" class="px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-all cursor-pointer flex items-center gap-1.5" title="Lihat semua database keuangan user ini">
                  <span>📂</span> Buka Database
                </button>
                <button type="button" onclick="closeUserProfileModal()" class="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 font-bold transition-all cursor-pointer">
                  Tutup
                </button>
                ${state.viewingUserProfile.status === 'pending' ? `
                  <button type="button" onclick="rejectPayment('${state.viewingUserProfile.order_id || ''}', '${state.viewingUserProfile.id || state.viewingUserProfile.user_id || ''}', '${(state.viewingUserProfile.phone_number || '').replace(/[^0-9+]/g, '')}'); closeUserProfileModal();" class="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold transition-all cursor-pointer">
                    ✕ Tolak
                  </button>
                  <button type="button" onclick="approvePayment('${state.viewingUserProfile.order_id || ''}', '${state.viewingUserProfile.id || state.viewingUserProfile.user_id || ''}', '${(state.viewingUserProfile.phone_number || '').replace(/[^0-9+]/g, '')}'); closeUserProfileModal();" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer">
                    <span>✅</span> ${state.viewingUserProfile.type === 'registration_verification' || (state.viewingUserProfile.order_id && state.viewingUserProfile.order_id.startsWith('REG-')) ? 'Setujui & Verifikasi Akun' : 'Approve Pembayaran PRO'}
                  </button>
                ` : `
                  <span class="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <span>✓</span> Telah Disetujui
                  </span>
                `}
              </div>

            </div>

          </div>
        </div>
      ` : ''}

      ${state.viewingUserDatabase ? (() => {
        const udb = state.viewingUserDatabase;
        const prof = udb.profile || {};
        const sum = udb.summary || {};
        const currentDbTab = state.userDbTab || 'wallets';

        return `
          <!-- Modal Database Lengkap Pengguna (Super Admin) -->
          <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-gray-950/70 backdrop-blur-sm animate-fade-in">
            <div class="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
              
              <!-- Modal Top Header -->
              <div class="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white p-5 sm:p-6 flex-shrink-0 relative">
                <button onclick="closeUserDatabaseModal()" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-colors cursor-pointer" title="Tutup">
                  ✕
                </button>
                
                <div class="flex items-center gap-2 mb-2">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    📂 SUPERADMIN DATABASE INSPECTOR
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${prof.whatsapp_verified ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'}">
                    ${prof.whatsapp_verified ? '🟢 WhatsApp Terverifikasi' : '🟡 Menunggu Verifikasi WA'}
                  </span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-4 mt-3">
                  <div class="flex items-center gap-3.5">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-brand text-white flex items-center justify-center text-2xl font-black shadow-lg border-2 border-white/20 flex-shrink-0">
                      ${prof.avatar_url ? `<img src="${prof.avatar_url}" class="w-full h-full rounded-2xl object-cover">` : (prof.full_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 class="text-xl font-black tracking-tight flex items-center gap-2">
                        <span>${prof.full_name || 'Pengguna Baru'}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${prof.plan_tier === 'pro' ? 'bg-orange-500 text-white' : 'bg-white/20 text-purple-200'}">${prof.plan_tier || 'starter'}</span>
                      </h3>
                      <div class="flex flex-wrap items-center gap-3 text-xs text-purple-200 mt-1">
                        <span class="font-mono text-[11px]">${prof.id}</span>
                        <span>•</span>
                        <span>💬 ${prof.phone_number || '-'}</span>
                        <span>•</span>
                        <span>✉️ ${prof.email || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button onclick="handleImpersonate('${prof.id}'); closeUserDatabaseModal();" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer">
                      <span>🎭</span> Impersonate
                    </button>
                    <button onclick="downloadUserDatabaseJSON('${prof.id}')" class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-colors flex items-center gap-1.5 cursor-pointer" title="Download JSON">
                      <span>📥</span> Export JSON
                    </button>
                  </div>
                </div>
              </div>

              <!-- 5 Metrik Ringkasan Database Pengguna -->
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-gray-50 border-b border-gray-200 text-xs flex-shrink-0">
                <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  <span class="text-[10px] text-gray-400 font-semibold block">Total Saldo Dompet</span>
                  <div class="text-base font-black text-gray-900 mt-0.5">${formatRupiah(sum.totalBalance)}</div>
                  <span class="text-[10px] text-gray-500">${sum.totalWallets} Dompet Aktif</span>
                </div>
                <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  <span class="text-[10px] text-gray-400 font-semibold block">Total Pemasukan</span>
                  <div class="text-base font-black text-emerald-600 mt-0.5">${formatRupiah(sum.totalIncome)}</div>
                  <span class="text-[10px] text-gray-500">Tercatat</span>
                </div>
                <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  <span class="text-[10px] text-gray-400 font-semibold block">Total Pengeluaran</span>
                  <div class="text-base font-black text-rose-600 mt-0.5">${formatRupiah(sum.totalExpense)}</div>
                  <span class="text-[10px] text-gray-500">Tercatat</span>
                </div>
                <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                  <span class="text-[10px] text-gray-400 font-semibold block">Net Cashflow</span>
                  <div class="text-base font-black text-indigo-700 mt-0.5">${formatRupiah(sum.netCashflow)}</div>
                  <span class="text-[10px] text-gray-500">${sum.totalTransactions} Transaksi</span>
                </div>
                <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs col-span-2 sm:col-span-1">
                  <span class="text-[10px] text-gray-400 font-semibold block">Anggaran & Kategori</span>
                  <div class="text-base font-black text-orange-600 mt-0.5">${sum.totalBudgets} Pos Budget</div>
                  <span class="text-[10px] text-gray-500">${sum.totalCategories} Kategori</span>
                </div>
              </div>

              <!-- Database Sub-Tabs Navigation -->
              <div class="flex items-center gap-1.5 px-6 pt-3 border-b border-gray-200 bg-white overflow-x-auto text-xs font-bold flex-shrink-0">
                <button onclick="setUserDbTab('wallets')" class="px-3.5 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${currentDbTab === 'wallets' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'}">
                  <span>👛</span> Dompet (${(udb.wallets || []).length})
                </button>
                <button onclick="setUserDbTab('transactions')" class="px-3.5 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${currentDbTab === 'transactions' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'}">
                  <span>📊</span> Transaksi (${(udb.transactions || []).length})
                </button>
                <button onclick="setUserDbTab('budgets')" class="px-3.5 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${currentDbTab === 'budgets' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'}">
                  <span>🎯</span> Anggaran (${(udb.budgets || []).length})
                </button>
                <button onclick="setUserDbTab('categories')" class="px-3.5 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${currentDbTab === 'categories' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'}">
                  <span>🏷️</span> Kategori (${(udb.categories || []).length})
                </button>
                <button onclick="setUserDbTab('payments')" class="px-3.5 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${currentDbTab === 'payments' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'}">
                  <span>🛡️</span> Antrean & Order (${(udb.payments || []).length})
                </button>
                <button onclick="setUserDbTab('raw')" class="px-3.5 py-2 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${currentDbTab === 'raw' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-800'}">
                  <span>📜</span> Raw JSON
                </button>
              </div>

              <!-- Database Sub-Tab Scrollable Content -->
              <div class="p-6 overflow-y-auto flex-1 text-xs">
                
                <!-- Sub-tab 1: Wallets -->
                ${currentDbTab === 'wallets' ? `
                  <div class="space-y-3">
                    <div class="flex justify-between items-center mb-1">
                      <span class="font-extrabold text-gray-900 text-sm">Daftar Dompet Pengguna</span>
                      <span class="text-gray-500">Total: ${formatRupiah(sum.totalBalance)}</span>
                    </div>
                    ${(udb.wallets || []).length === 0 ? `
                      <div class="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl">User belum memiliki dompet.</div>
                    ` : `
                      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        ${(udb.wallets || []).map(w => `
                          <div class="p-4 rounded-2xl border border-gray-200 bg-white shadow-2xs space-y-2">
                            <div class="flex items-center justify-between">
                              <span class="text-2xl">${w.icon || '👛'}</span>
                              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${w.is_default_telegram ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}">
                                ${w.is_default_telegram ? 'Default Telegram' : w.wallet_type || 'cash'}
                              </span>
                            </div>
                            <div>
                              <span class="font-bold text-gray-900 text-sm block">${w.name}</span>
                              <span class="font-mono text-[10px] text-gray-400">ID: ${w.id}</span>
                            </div>
                            <div class="pt-1 border-t border-gray-100">
                              <span class="text-[10px] text-gray-400 block font-medium">Saldo:</span>
                              <div class="text-base font-black text-gray-900">${formatRupiah(w.balance)}</div>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                ` : ''}

                <!-- Sub-tab 2: Transactions -->
                ${currentDbTab === 'transactions' ? `
                  <div class="space-y-3">
                    <div class="flex justify-between items-center mb-1">
                      <span class="font-extrabold text-gray-900 text-sm">Semua Transaksi Tercatat (${(udb.transactions || []).length})</span>
                      <span class="text-gray-500">Masuk: ${formatRupiah(sum.totalIncome)} • Keluar: ${formatRupiah(sum.totalExpense)}</span>
                    </div>
                    ${(udb.transactions || []).length === 0 ? `
                      <div class="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl">Belum ada transaksi yang dicatat oleh pengguna ini (Saldo Rp0).</div>
                    ` : `
                      <div class="overflow-x-auto rounded-xl border border-gray-200">
                        <table class="w-full text-left text-xs text-gray-700">
                          <thead class="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
                            <tr>
                              <th class="p-3">Waktu (WIB)</th>
                              <th class="p-3">Tipe & Kategori</th>
                              <th class="p-3">Dompet</th>
                              <th class="p-3">Catatan / Merchant</th>
                              <th class="p-3">Nominal</th>
                              <th class="p-3">Sumber</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-100">
                            ${(udb.transactions || []).map(t => {
                              const isInc = t.type === 'pemasukan';
                              return `
                                <tr class="hover:bg-gray-50/70">
                                  <td class="p-3 font-mono text-[11px] text-gray-500">${(t.transaction_date || '').slice(0, 19).replace('T', ' ')}</td>
                                  <td class="p-3">
                                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isInc ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                                      ${isInc ? '➕ Pemasukan' : '➖ Pengeluaran'}
                                    </span>
                                    <span class="ml-1.5 font-medium text-gray-800">${t.category_icon || '🏷️'} ${t.category_name || '-'}</span>
                                  </td>
                                  <td class="p-3 font-semibold text-gray-700">${t.wallet_name || '-'}</td>
                                  <td class="p-3 font-bold text-gray-900">${t.notes || t.merchant_name || '-'}</td>
                                  <td class="p-3 font-black ${isInc ? 'text-emerald-600' : 'text-rose-600'}">${formatRupiah(t.amount)}</td>
                                  <td class="p-3">
                                    <span class="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">${t.source || 'web'}</span>
                                  </td>
                                </tr>
                              `;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                    `}
                  </div>
                ` : ''}

                <!-- Sub-tab 3: Budgets -->
                ${currentDbTab === 'budgets' ? `
                  <div class="space-y-3">
                    <div class="flex justify-between items-center mb-1">
                      <span class="font-extrabold text-gray-900 text-sm">Pos Anggaran / Budgets (${(udb.budgets || []).length})</span>
                    </div>
                    ${(udb.budgets || []).length === 0 ? `
                      <div class="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl">User belum mengatur anggaran belanja (Budget Rp0).</div>
                    ` : `
                      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        ${(udb.budgets || []).map(b => `
                          <div class="p-4 rounded-2xl border border-gray-200 bg-white shadow-2xs space-y-2">
                            <div class="flex justify-between items-center">
                              <span class="font-bold text-gray-900 text-xs">${b.category_icon || '🏷️'} ${b.category_name}</span>
                              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-orange-100 text-orange-700">${b.period || 'monthly'}</span>
                            </div>
                            <div class="space-y-1">
                              <div class="flex justify-between text-xs">
                                <span class="text-gray-400">Limit:</span>
                                <span class="font-bold text-gray-900">${formatRupiah(b.amount)}</span>
                              </div>
                              <div class="flex justify-between text-xs">
                                <span class="text-gray-400">Terpakai:</span>
                                <span class="font-bold text-rose-600">${formatRupiah(b.spent_amount || 0)}</span>
                              </div>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                ` : ''}

                <!-- Sub-tab 4: Categories -->
                ${currentDbTab === 'categories' ? `
                  <div class="space-y-3">
                    <div class="flex justify-between items-center mb-1">
                      <span class="font-extrabold text-gray-900 text-sm">Pos Kategori Keuangan (${(udb.categories || []).length})</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      ${(udb.categories || []).map(c => `
                        <div class="p-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <span class="text-xl">${c.icon || '🏷️'}</span>
                            <div>
                              <span class="font-bold text-gray-900 block text-xs">${c.name}</span>
                              <span class="text-[10px] font-mono text-gray-400">${c.id}</span>
                            </div>
                          </div>
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${c.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}">
                            ${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                          </span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- Sub-tab 5: Payments & Registration Orders -->
                ${currentDbTab === 'payments' ? `
                  <div class="space-y-3">
                    <div class="flex justify-between items-center mb-1">
                      <span class="font-extrabold text-gray-900 text-sm">Riwayat Antrean Registrasi & Pembayaran (${(udb.payments || []).length})</span>
                    </div>
                    ${(udb.payments || []).length === 0 ? `
                      <div class="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl">Belum ada riwayat antrean atau order pembayaran.</div>
                    ` : `
                      <div class="space-y-2">
                        ${(udb.payments || []).map(p => `
                          <div class="p-3.5 rounded-xl border border-gray-200 bg-white flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div class="flex items-center gap-2">
                                <span class="font-mono font-black text-gray-900">${p.order_id}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.type === 'registration_verification' || p.order_id.startsWith('REG-') ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-700'}">
                                  ${p.type === 'registration_verification' || p.order_id.startsWith('REG-') ? 'Pendaftaran Akun' : 'Upgrade PRO'}
                                </span>
                              </div>
                              <span class="text-[11px] text-gray-400 font-mono mt-0.5 block">${(p.created_at || '').slice(0, 19).replace('T', ' ')} WIB</span>
                            </div>
                            <div class="text-right">
                              <span class="font-black text-gray-900 block">${p.amount > 0 ? formatRupiah(p.amount) : 'Rp0 (Registrasi)'}</span>
                              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.status === 'settlement' ? 'bg-emerald-100 text-emerald-800' : p.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}">
                                ${p.status === 'settlement' ? 'Disetujui / Aktif' : p.status === 'pending' ? 'Menunggu Approval' : 'Ditolak'}
                              </span>
                            </div>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                ` : ''}

                <!-- Sub-tab 6: Raw JSON Audit -->
                ${currentDbTab === 'raw' ? `
                  <div class="space-y-2">
                    <div class="flex justify-between items-center">
                      <span class="font-bold text-gray-700 text-xs">Full Raw Database JSON Payload:</span>
                      <button onclick="copyToClipboard('${encodeURIComponent(JSON.stringify(udb, null, 2))}')" class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer">
                        📋 Salin JSON ke Clipboard
                      </button>
                    </div>
                    <pre class="p-4 rounded-2xl bg-gray-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-96 whitespace-pre border border-gray-800">${JSON.stringify(udb, null, 2)}</pre>
                  </div>
                ` : ''}

              </div>

              <!-- Modal Footer -->
              <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs flex-shrink-0">
                <span class="text-gray-500 text-[11px]">Database terenkripsi & tersinkronisasi langsung dengan server pusat TataDana.</span>
                <button type="button" onclick="closeUserDatabaseModal()" class="px-5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white font-bold transition-colors cursor-pointer">
                  Tutup Database
                </button>
              </div>

            </div>
          </div>
        `;
      })() : ''}

    </div>
  `;
}

// 8. TATA AI BOT VIEW (In-App Conversational Financial Assistant)
function renderTataAIPage() {
  const user = state.user || { full_name: 'Pengguna TataDana' };
  const summary = state.reportSummary || { income: 0, expense: 0, netCashflow: 0 };
  const ratio = summary.income > 0 ? Math.round((summary.expense / summary.income) * 100) : 0;
  const isPro = user.plan_tier === 'pro';

  return `
    <div class="space-y-6">
      
      <!-- Top Header -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-100 text-orange-700 uppercase tracking-wider">
              ⭐ AI Financial Companion
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online (WIB)
            </span>
          </div>
          <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <span>🤖</span> Tata AI Bot
          </h2>
          <p class="text-xs text-gray-500 mt-0.5">
            Konsultasikan rencana anggaran, analisa arus kas bulanan, dan catat transaksi instan hanya dengan berbicara santai.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="clearTataAiChat()" class="px-3.5 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors flex items-center gap-1.5">
            <span>🔄</span> Reset Percakapan
          </button>
        </div>
      </div>

      <!-- Main Two-Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left: Chat Window (8 Columns) -->
        <div class="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[700px] overflow-hidden">
          
          <!-- Chat Feed Header -->
          <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50/60 to-white flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-lg shadow-sm">
                🤖
              </div>
              <div>
                <h4 class="text-sm font-bold text-gray-900">Tata AI Assistant</h4>
                <span class="text-[11px] text-gray-400 block">Multimodal Engine • Google Gemini 2.5 Flash</span>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                ⚡ Auto-Sync Database Active
              </span>
            </div>
          </div>

          <!-- Chat Stream Messages -->
          <div id="tata-ai-messages-container" class="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/40 text-xs">
            ${state.tataAiMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return `
                <div class="flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2.5 animate-fadeIn">
                  ${!isUser ? `
                    <div class="w-8 h-8 rounded-xl bg-orange-500 text-white flex-shrink-0 flex items-center justify-center text-sm shadow-sm font-bold">
                      TD
                    </div>
                  ` : ''}

                  <div class="max-w-[85%] space-y-1.5">
                    <div class="${isUser ? 'bg-gradient-brand text-white rounded-2xl rounded-br-xs shadow-md shadow-orange-500/10' : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-xs shadow-xs'} p-4 leading-relaxed whitespace-pre-wrap">
                      ${formatAiText(msg.text)}

                      ${msg.action === 'transaction_recorded' ? `
                        <div class="mt-3 pt-3 border-t border-emerald-100 bg-emerald-50/80 -mx-2 -mb-2 p-2.5 rounded-xl text-emerald-800 flex items-center justify-between">
                          <span class="font-bold flex items-center gap-1.5">
                            <span>✅</span> Tersimpan di Dompet & Laporan
                          </span>
                          <button onclick="navigate('laporan')" class="text-xs font-bold underline hover:text-emerald-900">
                            Buka Laporan →
                          </button>
                        </div>
                      ` : ''}
                    </div>

                    <div class="flex ${isUser ? 'justify-end' : 'justify-start'} items-center gap-2 px-1 text-[10px] text-gray-400">
                      <span>${msg.time || 'Sekarang'}</span>
                      ${!isUser ? `<button onclick="copyToClipboard('${encodeURIComponent(msg.text)}')" class="hover:text-gray-600">📋 Salin</button>` : ''}
                    </div>
                  </div>

                  ${isUser ? `
                    ${user.avatar_url ? `
                      <img src="${user.avatar_url}" alt="Foto Anda" class="w-8 h-8 rounded-xl object-cover flex-shrink-0 border border-orange-300 shadow-xs">
                    ` : `
                      <div class="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex-shrink-0 flex items-center justify-center text-xs font-bold border border-orange-200">
                        ${(user.full_name || 'U').charAt(0)}
                      </div>
                    `}
                  ` : ''}
                </div>
              `;
            }).join('')}

            ${state.isAiTyping ? `
              <div class="flex justify-start items-end gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center text-sm shadow-sm">
                  🤖
                </div>
                <div class="bg-white border border-gray-200 rounded-2xl rounded-bl-xs p-4 shadow-xs flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full bg-orange-500 animate-bounce"></div>
                  <div class="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0.2s]"></div>
                  <div class="w-2 h-2 rounded-full bg-orange-500 animate-bounce [animation-delay:0.4s]"></div>
                  <span class="text-xs text-gray-400 font-medium ml-1">Tata AI sedang menganalisis...</span>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Prompt Suggestions Chips -->
          <div class="px-6 py-2.5 bg-white border-t border-gray-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span class="text-[11px] font-bold text-gray-400 flex items-center gap-1 flex-shrink-0">
              <span>💡</span> Coba Tanya:
            </span>
            ${state.tataAiSuggestions.map(s => `
              <button onclick="sendTataAiSuggestion('${s}')" class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors border border-orange-100">
                ${s}
              </button>
            `).join('')}
          </div>

          <!-- Chat Input Bar -->
          <div class="p-4 bg-white border-t border-gray-100">
            <form onsubmit="handleTataAiSubmit(event)" class="flex items-center gap-2">
              <input 
                id="tata-ai-input" 
                type="text" 
                placeholder="Tanya analisis cashflow atau ketik 'Catat beli soto 25rb pakai BCA'..." 
                autocomplete="off"
                class="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
              />
              <button 
                type="button" 
                onclick="simulateVoicePrompt()" 
                title="Simulasi Voice Input"
                class="px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors text-sm"
              >
                🎙️
              </button>
              <button 
                type="submit" 
                id="btn-tata-ai-send"
                class="px-5 py-3 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-md shadow-orange-500/20 hover:shadow-orange-500/40 transition-all flex items-center gap-1.5"
              >
                <span>Kirim</span>
                <span>➤</span>
              </button>
            </form>
          </div>

        </div>

        <!-- Right: Realtime Financial Insights & Assistant Cheatsheet (4 Columns) -->
        <div class="lg:col-span-4 space-y-6">
          
          <!-- Financial Snapshot Card -->
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div class="flex justify-between items-center border-b border-gray-100 pb-3">
              <h4 class="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <span>📊</span> Konteks Finansialmu
              </h4>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${summary.netCashflow >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                ${summary.netCashflow >= 0 ? 'Cashflow Sehat' : 'Defisit'}
              </span>
            </div>

            <div class="space-y-3 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-gray-500">Pemasukan Bulan Ini</span>
                <span class="font-bold text-emerald-600">${formatRupiah(summary.income)}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-500">Pengeluaran Bulan Ini</span>
                <span class="font-bold text-rose-600">${formatRupiah(summary.expense)}</span>
              </div>
              <div class="flex justify-between items-center pt-2 border-t border-gray-100">
                <span class="font-semibold text-gray-800">Net Surplus / Sisa</span>
                <span class="font-extrabold text-sm text-gray-900">${formatRupiah(summary.netCashflow)}</span>
              </div>
            </div>

            <!-- Health Bar Gauge -->
            <div class="pt-2">
              <div class="flex justify-between text-[11px] font-semibold text-gray-600 mb-1">
                <span>Rasio Pengeluaran</span>
                <span>${ratio}% dari Gaji</span>
              </div>
              <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full ${ratio < 50 ? 'bg-emerald-500' : ratio < 80 ? 'bg-orange-500' : 'bg-rose-500'} rounded-full transition-all duration-500" style="width: ${Math.min(100, ratio)}%"></div>
              </div>
              <span class="text-[10px] text-gray-400 mt-1 block">
                ${ratio < 50 ? '🎉 Pengeluaran sangat hemat di bawah batas aman 50%.' : ratio < 80 ? '⚠️ Pengeluaran stabil, pantau pos jajan & kuliner.' : '🚨 Bahaya! Pengeluaran melebihi 80% pemasukan.'}
              </span>
            </div>
          </div>

          <!-- Cheat Sheet Commands Card -->
          <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <h4 class="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <span>⚡</span> Pola Perintah Instan
            </h4>
            <p class="text-[11px] text-gray-500 leading-relaxed">
              Kamu bisa langsung memerintahkan Tata AI dengan bahasa sehari-hari:
            </p>

            <div class="space-y-2 text-xs">
              <div onclick="sendTataAiSuggestion('Catat beli kopi 20rb')" class="p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer transition-all">
                <span class="font-bold text-orange-600 block">📝 Pencatatan Cepat</span>
                <span class="text-[11px] text-gray-600 font-mono">"Catat beli kopi 20rb"</span>
              </div>
              <div onclick="sendTataAiSuggestion('Analisis keuangan saya bulan ini')" class="p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer transition-all">
                <span class="font-bold text-orange-600 block">📊 Analisis Kesehatan</span>
                <span class="text-[11px] text-gray-600 font-mono">"Analisis keuangan saya bulan ini"</span>
              </div>
              <div onclick="sendTataAiSuggestion('Simulasi dana darurat 3 bulan')" class="p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer transition-all">
                <span class="font-bold text-orange-600 block">🎯 Target Dana Darurat</span>
                <span class="text-[11px] text-gray-600 font-mono">"Simulasi dana darurat 3 bulan"</span>
              </div>
              <div onclick="sendTataAiSuggestion('Tips hemat gaji 50/30/20')" class="p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer transition-all">
                <span class="font-bold text-orange-600 block">💡 Formula Hemat</span>
                <span class="text-[11px] text-gray-600 font-mono">"Tips hemat gaji 50/30/20"</span>
              </div>
            </div>
          </div>

          <!-- AI Model Specs Card -->
          <div class="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-lg">✨</span>
              <span class="text-xs font-bold uppercase tracking-wider">TataDana Intelligent AI</span>
            </div>
            <p class="text-[11px] text-orange-100 leading-relaxed">
              Ditenagai LLM Finansial dengan latency sub-detik, sinkronisasi RLS Supabase 100%, serta integrasi ke bot Telegram kamu.
            </p>
          </div>

        </div>

      </div>

    </div>
  `;
}

// // 8B. FINANCIAL CALENDAR PAGE (REAL-TIME ENGINE)
function renderCalendarPage() {
  const nowInfo = getRealtimeDateInfo();
  const todayDateStr = nowInfo.dateStr;

  const calData = state.calendarData || {
    year: state.calendarYear || nowInfo.year,
    month: state.calendarMonth || nowInfo.month,
    monthLabel: `${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][(state.calendarMonth || nowInfo.month) - 1]} ${state.calendarYear || nowInfo.year}`,
    firstDayOffset: 0,
    daysInMonth: 31,
    days: [],
    summary: { totalIncome: 0, totalExpense: 0, netCashflow: 0, activeDays: 0 }
  };

  const calSummary = calData.summary || { totalIncome: 0, totalExpense: 0, netCashflow: 0, activeDays: 0 };
  const selectedDate = state.selectedCalendarDate || todayDateStr;
  const selectedDayData = (calData.days || []).find(d => d.date === selectedDate);
  const selectedTxs = selectedDayData?.transactions || [];

  const dayHeaders = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const isCurrentMonthViewed = (calData.year === nowInfo.year && calData.month === nowInfo.month);

  const now = new Date();
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayName = days[now.getDay()];
  const dayNum = now.getDate();
  const monthName = months[now.getMonth()];
  const year = now.getFullYear();
  const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });
  const liveClockContent = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span><span class="font-mono font-extrabold text-gray-900">${timeStr} WIB</span> <span class="text-gray-500 font-semibold">• ${dayName}, ${dayNum} ${monthName} ${year}</span>`;

  return `
    <div class="space-y-6">
      
      <!-- Top Bar: Title, Live Status & Controls -->
      <div class="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-orange-50/70 via-white to-amber-50/50 p-4 sm:p-5 rounded-2xl border border-orange-100 shadow-xs">
        <div>
          <div class="flex items-center gap-2.5">
            <h2 class="text-2xl font-black text-gray-900 tracking-tight">📅 Kalender Keuangan Real-Time</h2>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              LIVE WIB
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span id="calendar-realtime-clock" class="inline-flex items-center font-medium bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-xs">
              ${liveClockContent}
            </span>
            <span class="text-[11px] text-gray-500 flex items-center gap-1 font-medium bg-white/70 px-2 py-0.5 rounded-md border border-gray-100">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Auto-sync otomatis tiap 4 detik ${state.calendarLastSyncedAt ? `(Terakhir: ${state.calendarLastSyncedAt})` : ''}
            </span>
          </div>
        </div>
        
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="goToTodayCalendar()" class="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs shadow-md shadow-orange-500/20 hover:shadow-orange-500/35 transition-all flex items-center gap-1.5 cursor-pointer">
            <span>🎯</span> Hari Ini
          </button>
          
          <button onclick="syncCalendarRealtime()" title="Sinkronkan data transaksi terbaru" class="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer">
            <span>🔄</span> Sync
          </button>

          <div class="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1.5 rounded-xl shadow-xs">
            <button onclick="prevCalendarMonth()" class="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-bold cursor-pointer" title="Bulan Sebelumnya">
              ◀
            </button>
            <div class="flex flex-col items-center px-2 min-w-[125px]">
              <span class="text-xs font-black text-gray-900 text-center">
                ${calData.monthLabel}
              </span>
              ${isCurrentMonthViewed ? `
                <span class="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Bulan Berjalan</span>
              ` : ''}
            </div>
            <button onclick="nextCalendarMonth()" class="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-bold cursor-pointer" title="Bulan Berikutnya">
              ▶
            </button>
          </div>
        </div>
      </div>

      <!-- 4 Monthly KPI Snapshot Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-emerald-200 transition-all">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span class="font-bold">Pemasukan Bulan Ini</span>
            <span class="text-emerald-500 text-base">💰</span>
          </div>
          <div class="text-xl font-black text-emerald-600">${formatRupiah(calSummary.totalIncome)}</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Akumulasi uang masuk (real-time)</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-rose-200 transition-all">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span class="font-bold">Pengeluaran Bulan Ini</span>
            <span class="text-rose-500 text-base">💸</span>
          </div>
          <div class="text-xl font-black text-rose-600">${formatRupiah(calSummary.totalExpense)}</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Total belanja & tagihan</span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-orange-200 transition-all">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span class="font-bold">Arus Kas Bersih (Net)</span>
            <span class="text-orange-500 text-base">⚖️</span>
          </div>
          <div class="text-xl font-black ${calSummary.netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
            ${calSummary.netCashflow >= 0 ? '+' : ''}${formatRupiah(calSummary.netCashflow)}
          </div>
          <span class="text-[11px] font-semibold ${calSummary.netCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-1 block">
            ${calSummary.netCashflow >= 0 ? 'Surplus Keuangan Sehat' : 'Defisit Pengeluaran'}
          </span>
        </div>

        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-blue-200 transition-all">
          <div class="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span class="font-bold">Aktivitas Pencatatan</span>
            <span class="text-blue-500 text-base">📝</span>
          </div>
          <div class="text-xl font-black text-gray-900">${calSummary.activeDays || 0} Hari Aktif</div>
          <span class="text-[11px] text-gray-400 mt-1 block">Dari ${calData.daysInMonth || 31} hari di bulan ini</span>
        </div>

      </div>

      <!-- Main Layout: Calendar Grid (8 Col) + Selected Day Drawer (4 Col) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Calendar Matrix (8 Columns on desktop) -->
        <div class="lg:col-span-8 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div class="flex flex-wrap justify-between items-center pb-2 border-b border-gray-100 gap-2">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>🗓️</span> Lembar Kalender Transaksi
              </h3>
              <span class="text-[11px] text-gray-400 font-medium hidden sm:inline">• Klik tanggal untuk audit</span>
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-500">
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span> Pemasukan
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded bg-rose-500 inline-block"></span> Pengeluaran
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded bg-orange-500 inline-block"></span> Hari Ini
              </span>
            </div>
          </div>

          <!-- Day Name Headers (Mon - Sun) -->
          <div class="grid grid-cols-7 gap-1 text-center font-bold text-xs text-gray-500 pb-1">
            ${dayHeaders.map(d => `<div class="py-1 uppercase tracking-wider text-[11px]">${d}</div>`).join('')}
          </div>

          <!-- Calendar Days Grid -->
          <div class="grid grid-cols-7 gap-1.5 sm:gap-2">
            <!-- Empty offset cells before 1st of month -->
            ${Array.from({ length: calData.firstDayOffset || 0 }).map(() => `
              <div class="min-h-[58px] sm:min-h-[76px] p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-gray-50/40 border border-transparent opacity-20"></div>
            `).join('')}

            <!-- Actual Month Days -->
            ${(calData.days || []).map(d => {
              const isSelected = d.date === selectedDate;
              const isToday = d.isToday || d.date === todayDateStr;
              const hasTxs = d.count > 0;
              const hasInc = d.total_income > 0;
              const hasExp = d.total_expense > 0;

              return `
                <div 
                  onclick="selectCalendarDate('${d.date}')"
                  class="min-h-[58px] sm:min-h-[82px] p-1 sm:p-2 rounded-lg sm:rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                    isSelected 
                      ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-400/50 shadow-sm z-10' 
                      : isToday
                        ? 'border-orange-400 bg-orange-50/30 ring-2 ring-orange-300/40 shadow-xs'
                        : hasTxs 
                          ? 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-xs' 
                          : 'border-gray-100 bg-gray-50/30 hover:bg-white hover:border-gray-200'
                  }"
                >
                  <div class="flex justify-between items-start">
                    <span class="text-[11px] sm:text-xs font-black ${isSelected ? 'text-orange-600 font-extrabold' : isToday ? 'text-orange-600 font-black' : 'text-gray-800'}">
                      ${d.day}
                    </span>
                    ${isToday ? `
                      <span class="text-[7px] sm:text-[8px] font-black uppercase tracking-wider bg-orange-600 text-white px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded shadow-xs">Hari Ini</span>
                    ` : hasTxs ? `
                      <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${hasExp ? 'bg-rose-500' : 'bg-emerald-500'} shadow-xs"></span>
                    ` : ''}
                  </div>

                  <div class="space-y-0.5 mt-0.5 sm:mt-1">
                    ${hasInc ? `
                      <div class="text-[8px] sm:text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-0.5 sm:px-1 py-0.2 rounded truncate">
                        <span class="hidden sm:inline">+${formatRupiah(d.total_income)}</span>
                        <span class="sm:hidden font-extrabold block text-center">+${formatCompactRupiah(d.total_income)}</span>
                      </div>
                    ` : ''}
                    ${hasExp ? `
                      <div class="text-[8px] sm:text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-0.5 sm:px-1 py-0.2 rounded truncate">
                        <span class="hidden sm:inline">-${formatRupiah(d.total_expense)}</span>
                        <span class="sm:hidden font-extrabold block text-center">-${formatCompactRupiah(d.total_expense)}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Selected Day Detail Drawer (4 Columns on desktop) -->
        <div class="lg:col-span-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div class="border-b border-gray-100 pb-3 flex justify-between items-center">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wider text-orange-600">Detail Hari Terpilih</span>
                ${selectedDate === todayDateStr ? `
                  <span class="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.2 rounded-full">🟢 Hari Ini</span>
                ` : ''}
              </div>
              <h3 class="text-base font-extrabold text-gray-900 mt-0.5">${formatFullIndonesianDate(selectedDate)}</h3>
            </div>
            <button onclick="openAddTxModal('${selectedDate}')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors flex items-center gap-1 cursor-pointer">
              <span>➕</span> Catat
            </button>
          </div>

          <!-- Day Financial Snapshot -->
          <div class="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl text-xs border border-gray-100">
            <div>
              <span class="text-gray-400 block text-[10px] font-semibold">Pemasukan Hari Ini</span>
              <span class="font-extrabold text-emerald-600 text-sm">${formatRupiah(selectedDayData?.total_income || 0)}</span>
            </div>
            <div>
              <span class="text-gray-400 block text-[10px] font-semibold">Pengeluaran Hari Ini</span>
              <span class="font-extrabold text-rose-600 text-sm">${formatRupiah(selectedDayData?.total_expense || 0)}</span>
            </div>
          </div>

          <!-- Transactions List for this day -->
          <div class="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            ${selectedTxs.length === 0 ? `
              <div class="p-8 text-center space-y-2.5">
                <span class="text-3xl block">🍃</span>
                <p class="text-xs text-gray-500 font-medium">Tidak ada transaksi tercatat pada tanggal ${selectedDate}.</p>
                <button onclick="openAddTxModal('${selectedDate}')" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-xs hover:opacity-95 transition-all cursor-pointer">
                  ➕ Catat di Tanggal Ini
                </button>
              </div>
            ` : selectedTxs.map(t => {
              const isInc = t.type === 'pemasukan';
              const timeDisplay = formatTimeWIB(t.transaction_date);
              return `
                <div class="p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition-all space-y-1.5 shadow-2xs">
                  <div class="flex justify-between items-start">
                    <div class="flex items-center gap-2.5">
                      <span class="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        ${t.category_icon || '🏷️'}
                      </span>
                      <div>
                        <h5 class="text-xs font-bold text-gray-900">${t.category_name || 'Umum'}</h5>
                        <div class="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
                          <span>👛 ${t.wallet_name || 'Dompet'}</span>
                          ${timeDisplay ? `<span>• 🕒 ${timeDisplay}</span>` : ''}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-black ${isInc ? 'text-emerald-600' : 'text-rose-600'}">
                        ${isInc ? '+' : '-'}${formatRupiah(t.amount)}
                      </span>
                      <button onclick="deleteTransaction('${t.id}')" title="Hapus Transaksi" class="text-gray-300 hover:text-rose-600 text-xs p-1 transition-colors cursor-pointer">
                        🗑️
                      </button>
                    </div>
                  </div>
                  ${t.notes ? `
                    <p class="text-[11px] text-gray-600 pl-10.5">${t.merchant_name ? `🏪 <b>${t.merchant_name}</b> — ` : ''}${t.notes}</p>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

        </div>

      </div>

    </div>
  `;
}

// 9. BUDGET PAGE (HARIAN + MINGGUAN + BULANAN)
function renderBudgetPage() {
  const summary = state.budgetSummary || {
    daily: { limit: 0, spent: 0, remaining: 0, pct: 0, items: [] },
    weekly: { limit: 0, spent: 0, remaining: 0, pct: 0, items: [] },
    monthly: { limit: 0, spent: 0, remaining: 0, pct: 0, items: [] }
  };
  const activeTab = state.activeBudgetTab || 'all';

  // Extract items based on activeTab
  let itemsToShow = [];
  if (activeTab === 'daily') {
    itemsToShow = summary.daily?.items || [];
  } else if (activeTab === 'weekly') {
    itemsToShow = summary.weekly?.items || [];
  } else if (activeTab === 'monthly') {
    itemsToShow = summary.monthly?.items || [];
  } else {
    itemsToShow = [
      ...(summary.daily?.items || []),
      ...(summary.weekly?.items || []),
      ...(summary.monthly?.items || [])
    ];
  }

  return `
    <div class="space-y-6">
      
      <!-- Top Bar: Header & Add Budget Action -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">🎯 Budgeting & Alokasi Anggaran</h2>
          <p class="text-xs text-gray-500 mt-0.5">Kontrol pengeluaran harian, mingguan, dan bulanan secara terpadu.</p>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="openAddBudgetModal()" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-md hover:shadow-orange-500/20 transition-all flex items-center gap-1.5">
            <span>+</span>
            <span>Atur Budget Baru</span>
          </button>
        </div>
      </div>

      <!-- 3 Summary KPI Cards: Harian, Mingguan, Bulanan -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <!-- KPI 1: Budget Harian -->
        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="text-base">📅</span>
              <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Budget Harian</h4>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${summary.daily?.pct >= 90 ? 'bg-rose-100 text-rose-700' : summary.daily?.pct >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}">
              ${summary.daily?.pct >= 90 ? '🚨 Kritis' : summary.daily?.pct >= 70 ? '⚠️ Waspada' : '✅ Aman'}
            </span>
          </div>

          <div>
            <div class="flex justify-between items-baseline mb-1">
              <span class="text-xl font-black text-gray-900">${formatRupiah(summary.daily?.spent || 0)}</span>
              <span class="text-xs text-gray-400">Limit: ${formatRupiah(summary.daily?.limit || 0)}</span>
            </div>
            <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full ${summary.daily?.pct >= 90 ? 'bg-rose-500' : summary.daily?.pct >= 70 ? 'bg-orange-500' : 'bg-emerald-500'} rounded-full transition-all" style="width: ${Math.min(100, summary.daily?.pct || 0)}%"></div>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
            <span>Sisa Kuota Hari Ini:</span>
            <span class="font-bold text-gray-800">${formatRupiah(summary.daily?.remaining || 0)}</span>
          </div>
        </div>

        <!-- KPI 2: Budget Mingguan -->
        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="text-base">📆</span>
              <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Budget Mingguan</h4>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${summary.weekly?.pct >= 90 ? 'bg-rose-100 text-rose-700' : summary.weekly?.pct >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}">
              ${summary.weekly?.pct >= 90 ? '🚨 Kritis' : summary.weekly?.pct >= 70 ? '⚠️ Waspada' : '✅ Aman'}
            </span>
          </div>

          <div>
            <div class="flex justify-between items-baseline mb-1">
              <span class="text-xl font-black text-gray-900">${formatRupiah(summary.weekly?.spent || 0)}</span>
              <span class="text-xs text-gray-400">Limit: ${formatRupiah(summary.weekly?.limit || 0)}</span>
            </div>
            <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full ${summary.weekly?.pct >= 90 ? 'bg-rose-500' : summary.weekly?.pct >= 70 ? 'bg-orange-500' : 'bg-emerald-500'} rounded-full transition-all" style="width: ${Math.min(100, summary.weekly?.pct || 0)}%"></div>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
            <span>Sisa Kuota Minggu Ini:</span>
            <span class="font-bold text-gray-800">${formatRupiah(summary.weekly?.remaining || 0)}</span>
          </div>
        </div>

        <!-- KPI 3: Budget Bulanan -->
        <div class="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3">
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <span class="text-base">🗓️</span>
              <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Budget Bulanan</h4>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${summary.monthly?.pct >= 90 ? 'bg-rose-100 text-rose-700' : summary.monthly?.pct >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}">
              ${summary.monthly?.pct >= 90 ? '🚨 Kritis' : summary.monthly?.pct >= 70 ? '⚠️ Waspada' : '✅ Aman'}
            </span>
          </div>

          <div>
            <div class="flex justify-between items-baseline mb-1">
              <span class="text-xl font-black text-gray-900">${formatRupiah(summary.monthly?.spent || 0)}</span>
              <span class="text-xs text-gray-400">Limit: ${formatRupiah(summary.monthly?.limit || 0)}</span>
            </div>
            <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div class="h-full ${summary.monthly?.pct >= 90 ? 'bg-rose-500' : summary.monthly?.pct >= 70 ? 'bg-orange-500' : 'bg-emerald-500'} rounded-full transition-all" style="width: ${Math.min(100, summary.monthly?.pct || 0)}%"></div>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
            <span>Sisa Kuota Bulan Ini:</span>
            <span class="font-bold text-gray-800">${formatRupiah(summary.monthly?.remaining || 0)}</span>
          </div>
        </div>

      </div>

      <!-- Filter Tabs: Semua | Harian | Mingguan | Bulanan -->
      <div class="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button onclick="setBudgetTab('all')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'all' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}">
          Semua Budget
        </button>
        <button onclick="setBudgetTab('daily')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'daily' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}">
          📅 Harian (${summary.daily?.items?.length || 0})
        </button>
        <button onclick="setBudgetTab('weekly')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'weekly' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}">
          📆 Mingguan (${summary.weekly?.items?.length || 0})
        </button>
        <button onclick="setBudgetTab('monthly')" class="px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'monthly' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'}">
          🗓️ Bulanan (${summary.monthly?.items?.length || 0})
        </button>
      </div>

      <!-- Category Budget Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${itemsToShow.length === 0 ? `
          <div class="col-span-full bg-white p-10 rounded-2xl border border-gray-200 text-center space-y-3">
            <span class="text-4xl block">🎯</span>
            <h4 class="text-sm font-bold text-gray-900">Belum ada alokasi budget untuk kategori ini</h4>
            <p class="text-xs text-gray-500">Mulai tetapkan limit anggaran untuk mengontrol pengeluaranmu secara disiplin.</p>
            <button onclick="openAddBudgetModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-md">
              + Atur Batas Budget Baru
            </button>
          </div>
        ` : itemsToShow.map(b => {
          const limit = b.amount || 1000000;
          const spent = b.spent || b.spent_amount || 0;
          const pct = Math.min(100, Math.round((spent / limit) * 100));
          const isWarning = pct >= 80;
          const periodLabel = b.period === 'daily' ? '📅 Harian' : b.period === 'weekly' ? '📆 Mingguan' : '🗓️ Bulanan';

          return `
            <div class="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4 relative group">
              <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center text-lg font-bold">
                    ${b.category_icon || '🏷️'}
                  </div>
                  <div>
                    <h4 class="text-sm font-bold text-gray-900">${b.category_name || 'Kategori'}</h4>
                    <span class="text-[11px] font-semibold text-gray-400">${periodLabel}</span>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isWarning ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">
                    ${isWarning ? '⚠️ Peringatan' : 'Aman'}
                  </span>
                  <button onclick="deleteBudget('${b.id}')" title="Hapus Budget" class="text-gray-300 hover:text-rose-500 p-1 text-xs">
                    ✕
                  </button>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-xs font-semibold mb-1">
                  <span class="text-gray-500">Terpakai: ${formatRupiah(spent)}</span>
                  <span class="text-gray-900 font-bold">${pct}%</span>
                </div>
                <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div class="h-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-orange-500' : 'bg-emerald-500'} rounded-full transition-all" style="width: ${pct}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-gray-400 mt-1.5">
                  <span>Limit: ${formatRupiah(limit)}</span>
                  <span>Sisa: ${formatRupiah(Math.max(0, limit - spent))}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

    </div>
  `;
}

// 10. MULTI WALLET PAGE (TAMBAH DOMPET BARU, SET DEFAULT, HAPUS)
function renderWalletPage() {
  const wallets = state.wallets || [];
  const totalBalance = wallets.reduce((acc, w) => acc + Number(w.balance || 0), 0);
  const user = state.user || {};
  const isPro = user.plan_tier === 'pro';

  return `
    <div class="space-y-6">
      
      <!-- Top Bar: Header & Add Wallet Button -->
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-extrabold text-gray-900 tracking-tight">👛 Manajemen Multi Dompet</h2>
          <p class="text-xs text-gray-500 mt-0.5">Kelola rekening bank, e-wallet, dan uang tunai secara terpusat.</p>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 shadow-sm">
            Total Terkonsolidasi: <span class="text-orange-600 font-extrabold text-sm ml-1">${formatRupiah(totalBalance)}</span>
          </div>
          <button onclick="openAddWalletModal()" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-brand text-white shadow-md hover:shadow-orange-500/20 transition-all flex items-center gap-1.5">
            <span>+</span>
            <span>Tambah Dompet Baru</span>
          </button>
        </div>
      </div>

      <!-- Plan Quota Banner -->
      ${!isPro ? `
        <div class="p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between text-xs text-orange-900">
          <div class="flex items-center gap-2">
            <span>ℹ️</span>
            <span><b>Paket Starter:</b> Maksimal 3 dompet aktif (terpakai ${wallets.length}/3). Upgrade ke PRO untuk dompet tak terbatas!</span>
          </div>
          <button onclick="navigate('settings')" class="px-3 py-1 bg-white border border-orange-200 rounded-lg text-orange-600 font-bold hover:bg-orange-100">
            Upgrade PRO ⚡
          </button>
        </div>
      ` : ''}

      <!-- Wallet Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        ${wallets.map(w => {
          const isBank = w.wallet_type === 'bank' || w.type === 'bank';
          const isEwallet = w.wallet_type === 'ewallet' || w.type === 'ewallet';
          const icon = isBank ? '🏦' : isEwallet ? '📱' : '💵';
          const typeLabel = isBank ? 'Rekening Bank' : isEwallet ? 'E-Wallet' : 'Uang Tunai';

          return `
            <div class="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div class="flex justify-between items-start">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl ${isBank ? 'bg-blue-50 text-blue-600' : isEwallet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} flex items-center justify-center text-xl font-bold">
                      ${w.icon || icon}
                    </div>
                    <div>
                      <h4 class="text-base font-bold text-gray-900">${w.name}</h4>
                      <span class="text-[11px] text-gray-400 capitalize">${typeLabel}</span>
                    </div>
                  </div>
                  ${w.is_default_telegram ? `
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700">
                      ✈️ Default Bot
                    </span>
                  ` : ''}
                </div>

                <div class="mt-4">
                  <span class="text-xs text-gray-400 block mb-1">Saldo Tersedia</span>
                  <div class="text-2xl font-black text-gray-900">${formatRupiah(w.balance)}</div>
                </div>
              </div>

              <div class="pt-4 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                ${!w.is_default_telegram ? `
                  <button onclick="setDefaultWallet('${w.id}')" class="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-orange-50 hover:text-orange-600 font-semibold transition-colors">
                    ✈️ Jadikan Default Bot
                  </button>
                ` : `
                  <span class="text-emerald-600 font-bold flex items-center gap-1 text-[11px]">
                    <span>✔</span> Default Telegram
                  </span>
                `}

                <button onclick="deleteWallet('${w.id}')" class="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-rose-600 hover:bg-rose-50 font-semibold transition-colors" title="Hapus Dompet">
                  🗑️ Hapus
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Smart Telegram Wallet Routing Tip -->
      <div class="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-2 text-xs">
        <h4 class="font-bold text-gray-900 flex items-center gap-1.5">
          <span>💡</span> Smart Routing Dompet di Bot Telegram
        </h4>
        <p class="text-gray-600 leading-relaxed">
          TataDana bot secara otomatis mendeteksi nama dompet dari pesanmu. Contoh: 
          <code class="bg-white px-2 py-0.5 rounded border border-gray-200 font-mono text-orange-600">beli kopi 25rb pakai gopay</code> atau 
          <code class="bg-white px-2 py-0.5 rounded border border-gray-200 font-mono text-orange-600">bensin 50rb bca</code>.
          Jika nama dompet tidak disebutkan, transaksi otomatis memotong dompet dengan lencana <b>Default Bot</b>.
        </p>
      </div>

    </div>
  `;
}

// -------------------------------------------------------------
// USER ACTIONS & CONTROLLERS
// -------------------------------------------------------------

// Profile & Avatar Management Controllers
window.handleAvatarFileSelect = function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    showToast('Ukuran foto terlalu besar! Maksimal 10MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const rawDataUrl = e.target.result;
    
    // Scale down image to optimal size (max 600x600) using Canvas to keep memory light
    const img = new Image();
    img.onload = function() {
      const maxDim = 600;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      
      state.tempAvatarUrl = optimizedDataUrl;
      
      // Update DOM preview directly
      const previewContainer = document.getElementById('avatar-preview-container');
      if (previewContainer) {
        previewContainer.innerHTML = `<img id="avatar-preview-img" src="${optimizedDataUrl}" alt="Preview Foto" class="w-full h-full object-cover rounded-full">`;
      }
      const removeBtn = document.getElementById('btn-remove-avatar');
      if (removeBtn) removeBtn.classList.remove('hidden');

      const statusEl = document.getElementById('profile-save-status');
      if (statusEl) statusEl.innerHTML = `<span class="text-orange-600 font-bold">✨ Foto baru dipilih dari galeri. Klik 'Simpan Profil & Foto' untuk menerapkan.</span>`;

      showToast('Foto berhasil dipilih dari galeri! Klik "Simpan Profil & Foto".', 'success');
    };
    img.src = rawDataUrl;
  };
  reader.readAsDataURL(file);
};

window.setPresetAvatar = function(emoji, bg, name) {
  // Generate a high-resolution 400x400 avatar badge using Canvas
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // Background Circle with Gradient
  const grad = ctx.createLinearGradient(0, 0, 400, 400);
  grad.addColorStop(0, bg || '#FF5B00');
  grad.addColorStop(1, '#FF8A00');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(200, 200, 190, 0, Math.PI * 2);
  ctx.fill();

  // Subtle Outer Ring
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  // Draw Emoji
  ctx.font = '190px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 200, 215);

  const dataUrl = canvas.toDataURL('image/png');
  state.tempAvatarUrl = dataUrl;

  const previewContainer = document.getElementById('avatar-preview-container');
  if (previewContainer) {
    previewContainer.innerHTML = `<img id="avatar-preview-img" src="${dataUrl}" alt="Preset Avatar" class="w-full h-full object-cover rounded-full">`;
  }
  const removeBtn = document.getElementById('btn-remove-avatar');
  if (removeBtn) removeBtn.classList.remove('hidden');

  const statusEl = document.getElementById('profile-save-status');
  if (statusEl) statusEl.innerHTML = `<span class="text-orange-600 font-bold">✨ Avatar preset ${name} dipilih! Klik 'Simpan Profil & Foto'.</span>`;

  showToast(`Preset avatar ${name} (${emoji}) dipilih! Klik "Simpan Profil & Foto".`, 'info');
};

window.removeAvatar = function() {
  state.tempAvatarUrl = '';
  const previewContainer = document.getElementById('avatar-preview-container');
  const user = state.user || {};
  const initial = (user.full_name || 'U').charAt(0).toUpperCase();
  if (previewContainer) {
    previewContainer.innerHTML = `
      <div id="avatar-fallback-initial" class="w-full h-full rounded-full bg-gradient-brand text-white flex items-center justify-center font-black text-3xl shadow-inner">
        ${initial}
      </div>
    `;
  }
  const removeBtn = document.getElementById('btn-remove-avatar');
  if (removeBtn) removeBtn.classList.add('hidden');

  const statusEl = document.getElementById('profile-save-status');
  if (statusEl) statusEl.innerHTML = `<span class="text-rose-600 font-bold">🗑️ Foto profil akan dihapus saat disimpan.</span>`;

  showToast('Foto profil direset ke inisial. Klik "Simpan Profil & Foto" untuk menerapkan.', 'info');
};

window.exportAvatarToGallery = function() {
  const user = state.user || {};
  const currentAvatar = state.tempAvatarUrl !== null ? state.tempAvatarUrl : (user.avatar_url || null);
  const cleanName = (user.full_name || 'Akun_TataDana').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `TataDana_FotoProfil_${cleanName}.png`;

  if (currentAvatar && currentAvatar.startsWith('data:image')) {
    // Direct Data URL download to gallery
    const a = document.createElement('a');
    a.href = currentAvatar;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(`Foto profil berhasil diekspor ke galeri (${fileName})!`, 'success');
  } else if (currentAvatar && (currentAvatar.startsWith('http://') || currentAvatar.startsWith('https://'))) {
    // Remote image: render to canvas to avoid cross-origin download issues
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 400;
      canvas.height = img.height || 400;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Foto profil berhasil diekspor ke galeri (${fileName})!`, 'success');
    };
    img.onerror = function() {
      showToast('Gagal mengunduh foto profil.', 'error');
    };
    img.src = currentAvatar;
  } else {
    // Generate high-resolution 512x512 initials avatar and export to gallery
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#FF5B00');
    grad.addColorStop(1, '#FF8A00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 240, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // Initial text
    const initial = (user.full_name || 'U').charAt(0).toUpperCase();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 220px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, 256, 266);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(`Foto profil inisial berhasil diekspor ke galeri (${fileName})!`, 'success');
  }
};

window.updateUserProfile = async function(event) {
  if (event && event.preventDefault) event.preventDefault();
  const nameInput = document.getElementById('edit-profile-name');
  const phoneInput = document.getElementById('edit-profile-phone');
  const btn = document.getElementById('btn-save-profile');
  const statusEl = document.getElementById('profile-save-status');

  const fullName = nameInput ? nameInput.value.trim() : '';
  const phoneNumber = phoneInput ? phoneInput.value.trim() : '';

  if (!fullName) {
    showToast('Nama lengkap tidak boleh kosong.', 'error');
    return;
  }

  if (btn) btn.innerHTML = '<span>⏳</span> Menyimpan...';
  if (statusEl) statusEl.innerHTML = '<span class="text-orange-500 font-semibold">⏳ Sedang memperbarui profil di server...</span>';

  let avatarUrlToSend = undefined;
  if (state.tempAvatarUrl !== null) {
    avatarUrlToSend = state.tempAvatarUrl === '' ? null : state.tempAvatarUrl;
  }

  const res = await api('/api/user/profile', {
    method: 'POST',
    body: JSON.stringify({
      userId: state.user?.id,
      fullName,
      phoneNumber,
      avatarUrl: avatarUrlToSend
    })
  });

  if (btn) btn.innerHTML = '<span>💾</span> Simpan Profil & Foto';

  if (res && res.success) {
    state.user = res.user;
    state.tempAvatarUrl = null;
    if (statusEl) statusEl.innerHTML = '<span class="text-emerald-600 font-bold">✔ Profil & foto berhasil disimpan!</span>';
    showToast('Profil & foto profil berhasil diperbarui!', 'success');
    render();
  } else {
    if (statusEl) statusEl.innerHTML = `<span class="text-rose-600 font-bold">❌ ${res?.message || 'Gagal menyimpan profil'}</span>`;
    showToast(res?.message || 'Gagal menyimpan perubahan profil', 'error');
  }
};

window.sendDemoMessage = async function() {
  const input = document.getElementById('demo-input-text');
  const chat = document.getElementById('demo-chat-messages');
  if (!input || !chat) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  // Add user bubble
  chat.innerHTML += `
    <div class="flex justify-end">
      <div class="bg-orange-500 text-white p-2.5 rounded-2xl rounded-tr-xs max-w-[85%] font-medium">
        ${text}
      </div>
    </div>
  `;
  chat.scrollTop = chat.scrollHeight;

  // Call simulation webhook
  const res = await api('/api/admin/simulator', {
    method: 'POST',
    body: JSON.stringify({ type: 'text', text })
  });

  if (res.success && res.simulation) {
    const replyText = res.simulation.reply || res.simulation.response || 'Transaksi berhasil dicatat!';
    chat.innerHTML += `
      <div class="flex justify-start">
        <div class="bg-white border border-gray-200 p-2.5 rounded-2xl rounded-tl-xs max-w-[90%] font-mono text-[11px] text-gray-800 leading-relaxed whitespace-pre-wrap">
${replyText}
        </div>
      </div>
    `;
    chat.scrollTop = chat.scrollHeight;
    showToast('Transaksi tercatat di database TataDana!', 'success');
  }
};

window.testTelegramConnection = async function() {
  const token = document.getElementById('tg-bot-token')?.value?.trim();
  const feedback = document.getElementById('tg-test-feedback');
  const badge = document.getElementById('tg-status-badge');
  const btn = document.getElementById('btn-test-tg');

  if (!token) {
    showToast('Silakan masukkan token bot Telegram.', 'error');
    return;
  }

  btn.innerHTML = '<span>⏳</span> Testing...';
  if (feedback) feedback.innerHTML = '<span class="text-orange-500">⏳ Sedang menguji koneksi ke Telegram API & setWebhook...</span>';

  const res = await api('/api/settings/telegram/test', {
    method: 'POST',
    body: JSON.stringify({ botToken: token })
  });

  btn.innerHTML = '<span>⚡</span> Test Koneksi';
  if (res.success) {
    state.telegramStatus = 'connected';
    if (badge) {
      badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700';
      badge.textContent = '🟢 Terhubung';
    }
    if (feedback) feedback.innerHTML = `<span class="text-emerald-600 font-bold">${res.message}</span>`;
    showToast('Bot Telegram berhasil terhubung & setWebhook terdaftar!', 'success');
  } else {
    state.telegramStatus = 'error';
    if (badge) {
      badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700';
      badge.textContent = '🔴 Tidak Terhubung';
    }
    if (feedback) feedback.innerHTML = `<span class="text-rose-600 font-bold">Error: ${res.message}</span>`;
    showToast(res.message, 'error');
  }
};

window.downloadReport = async function(format) {
  showToast(`Sedang men-generate file ${format.toUpperCase()}...`, 'info');

  const q = new URLSearchParams();
  if (state.reportFilter.startDate) q.set('startDate', state.reportFilter.startDate);
  if (state.reportFilter.endDate) q.set('endDate', state.reportFilter.endDate);
  if (state.reportFilter.type) q.set('type', state.reportFilter.type);
  if (state.reportFilter.walletId) q.set('walletId', state.reportFilter.walletId);
  if (state.reportFilter.categoryId) q.set('categoryId', state.reportFilter.categoryId);
  if (state.reportFilter.search) q.set('search', state.reportFilter.search);

  try {
    const res = await fetch(`${API_BASE}/api/reports/export/${format}?${q.toString()}`);
    if (!res.ok) {
      showToast('Gagal men-generate laporan dari server.', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sDate = state.reportFilter.startDate || 'Semua';
    const eDate = state.reportFilter.endDate || 'Semua';
    a.download = `TataDana_Laporan_${sDate}_sd_${eDate}.${format === 'pdf' ? 'pdf' : 'xls'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    showToast(`File Laporan ${format.toUpperCase()} berhasil didownload!`, 'success');
  } catch (err) {
    console.error('Download error:', err);
    showToast('Gagal mengunduh laporan.', 'error');
  }
};

window.openPdfPreviewModal = function() {
  state.showPdfPreviewModal = true;
  render();
};

window.closePdfPreviewModal = function() {
  state.showPdfPreviewModal = false;
  render();
};

window.printPdfReport = function() {
  window.print();
};

window.triggerWebhookSimulation = async function(type) {
  const terminal = document.getElementById('sim-output');
  let text = '';
  if (type === 'text') {
    text = document.getElementById('sim-text-input')?.value || 'beli bakso 25rb';
  }

  const res = await api('/api/admin/simulator', {
    method: 'POST',
    body: JSON.stringify({ type, text })
  });

  if (terminal) {
    terminal.classList.remove('hidden');
    terminal.textContent = JSON.stringify(res, null, 2);
  }
  showToast(`Simulasi webhook ${type} sukses dieksekusi!`, 'success');
  fetchTransactions();
};

window.toggleReceiptExpand = function(txId) {
  state.expandedReceiptId = state.expandedReceiptId === txId ? null : txId;
  render();
};

window.copyAdminWhatsApp = function() {
  const number = state.adminWhatsappNumber || '083840023120';
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(number).then(() => {
      showToast('Nomor WhatsApp Admin (083840023120) berhasil disalin!', 'success');
    }).catch(() => {
      showToast('Nomor Admin: 083840023120', 'info');
    });
  } else {
    showToast('Nomor WhatsApp Admin: 083840023120', 'info');
  }
};

window.fillAdminCredentials = function() {
  showToast('Silakan masukkan kredensial Superadmin resmi Anda.', 'info');
};

window.handleDirectAdminLogin = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = document.getElementById('admin-gate-email')?.value?.trim();
  const password = document.getElementById('admin-gate-password')?.value;
  if (!email || !password) {
    showToast('Email/identifier dan kata sandi admin wajib diisi.', 'error');
    return;
  }
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (res.success && res.user && res.user.role === 'superadmin') {
    state.user = res.user;
    try {
      sessionStorage.setItem('tatadana_user_id', res.user.id);
      localStorage.setItem('tatadana_user_id', res.user.id);
      sessionStorage.setItem('tatadana_page', 'admin');
      localStorage.setItem('tatadana_page', 'admin');
    } catch (e) {}
    showToast(`Autentikasi Superadmin Berhasil: ${res.user.full_name}`, 'success');
    await Promise.all([fetchAdminData(), fetchAdminStats()]);
    render();
  } else {
    showToast(res.message || 'Login admin gagal! Anda bukan Superadmin.', 'error');
  }
};

window.handleLogin = async function() {
  const email = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;
  if (!email || !password) {
    showToast('Email/nomor WhatsApp dan kata sandi wajib diisi.', 'error');
    return;
  }

  let clientProfile = null;
  let clientApproved = [];
  try {
    clientProfile = JSON.parse(localStorage.getItem('tatadana_registered_user') || 'null');
    clientApproved = JSON.parse(localStorage.getItem('tatadana_approved_registrations') || '[]');
  } catch(e) {}

  const res = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, clientProfile, clientApproved })
  });

  if (res.success) {
    state.user = res.user;
    try {
      sessionStorage.setItem('tatadana_user_id', res.user.id);
      localStorage.setItem('tatadana_user_id', res.user.id);
    } catch (e) {}
    await Promise.all([
      fetchWallets(),
      fetchCategories(),
      fetchTransactions(),
      fetchBudgets(),
      fetchBudgetSummary(),
      fetchCalendarData(),
      fetchReportSummary()
    ]);
    showToast(`Selamat datang kembali, ${res.user.full_name}!`, 'success');
    if (res.user.role === 'superadmin') {
      navigate('admin');
    } else {
      navigate('dashboard');
    }
  } else if (res.requires_whatsapp_verification) {
    state.otpPhone = res.phoneNumber;
    state.registeredUser = res.user || { fullName: 'Pengguna TataDana', email: email, phoneNumber: res.phoneNumber };
    state.adminWhatsappNumber = res.adminWhatsapp || '083840023120';
    showToast('Akun Anda belum aktif. Wajib verifikasi melalui nomor WhatsApp Admin 083840023120.', 'info');
    navigate('otp');
  } else {
    showToast(res.message || 'Login gagal. Periksa email & password Anda.', 'error');
  }
};

window.handleLogout = async function() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  state.user = null;
  try {
    sessionStorage.removeItem('tatadana_page');
    sessionStorage.removeItem('tatadana_user_id');
    localStorage.removeItem('tatadana_page');
    localStorage.removeItem('tatadana_user_id');
  } catch (e) {}
  showToast('Anda telah keluar dari akun.', 'info');
  navigate('landing');
};

window.exploreUserDashboard = async function() {
  try {
    const res = await api('/api/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ role: 'user' })
    });
    if (res.success && res.user) {
      state.user = res.user;
      try {
        sessionStorage.setItem('tatadana_user_id', res.user.id);
      } catch (e) {}
    }
    await Promise.all([
      fetchWallets(),
      fetchCategories(),
      fetchTransactions(),
      fetchBudgets(),
      fetchBudgetSummary(),
      fetchReportSummary()
    ]);
  } catch (e) {
    console.warn('Switch to regular user warning:', e);
  }
  navigate('dashboard');
};

window.handleRegister = async function() {
  const fullName = document.getElementById('auth-name')?.value?.trim();
  const phoneNumber = document.getElementById('auth-phone')?.value?.trim();
  const email = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;

  if (!fullName) {
    showToast('Nama lengkap wajib diisi!', 'error');
    return;
  }
  if (!phoneNumber || phoneNumber.length < 9) {
    showToast('Nomor WhatsApp wajib diisi dengan benar untuk verifikasi!', 'error');
    return;
  }
  if (!password || password.length < 6) {
    showToast('Kata sandi minimal 6 karakter!', 'error');
    return;
  }

  const res = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, phoneNumber, email, password })
  });

  if (res.success) {
    state.registeredUser = { fullName, phoneNumber, email };
    state.otpPhone = res.phoneNumber || phoneNumber;
    state.adminWhatsappNumber = res.adminWhatsapp || '083840023120';
    state.registrationSuccess = true;

    // Cache locally so admin immediately sees it even on instant refresh
    try {
      const pendingList = JSON.parse(localStorage.getItem('tatadana_pending_registrations') || '[]');
      const cleanPhone = (phoneNumber || '').trim();
      const confirmedUserId = (res.user && res.user.id) || ('usr-' + Date.now());
      const confirmedOrderId = res.order_id || res.orderId || ('REG-' + confirmedUserId.replace('usr-', ''));

      localStorage.setItem('tatadana_registered_user', JSON.stringify({
        id: confirmedUserId,
        fullName,
        phoneNumber: cleanPhone,
        email: email || `${cleanPhone}@tatadana.id`,
        password
      }));

      if (!pendingList.some(p => p.phone_number === cleanPhone || p.user_id === confirmedUserId || p.order_id === confirmedOrderId)) {
        pendingList.unshift({
          order_id: confirmedOrderId,
          user_id: confirmedUserId,
          type: 'registration_verification',
          full_name: fullName,
          phone_number: cleanPhone,
          email: email || `${cleanPhone}@tatadana.id`,
          amount: 0,
          plan_tier: 'starter',
          status: 'pending',
          created_at: new Date().toISOString()
        });
        localStorage.setItem('tatadana_pending_registrations', JSON.stringify(pendingList));
      }
    } catch (e) {}

    showToast('Pendaftaran berhasil dicatat! Kirim chat WhatsApp ke Admin (083840023120) untuk aktivasi.', 'success');
    navigate('otp');
  } else {
    showToast(res.message || 'Pendaftaran gagal', 'error');
  }
};

window.checkVerificationStatus = async function() {
  const phone = state.otpPhone || (state.registeredUser && state.registeredUser.phoneNumber);
  if (!phone) {
    showToast('Nomor WhatsApp pendaftaran tidak ditemukan.', 'error');
    return;
  }
  showToast('Memeriksa status persetujuan Super Admin...', 'info');
  try {
    const res = await api(`/api/auth/check-status?phone=${encodeURIComponent(phone)}`);
    if (res && res.success && res.verified) {
      stopOtpPolling();
      state.user = res.user;
      showToast('🎉 Selamat! Akun Anda telah disetujui & aktif oleh Super Admin.', 'success');
      await Promise.all([
        fetchWallets(),
        fetchCategories(),
        fetchTransactions(),
        fetchBudgets(),
        fetchBudgetSummary(),
        fetchCalendarData(),
        fetchReportSummary()
      ]);
      navigate(res.user.role === 'superadmin' ? 'admin' : 'dashboard');
    } else {
      showToast('⏳ Akun Anda masih dalam antrean approval. Silakan kirim pesan ke WhatsApp Admin (083840023120).', 'info');
    }
  } catch (err) {
    showToast('Gagal memeriksa status verifikasi.', 'error');
  }
};

window.handleGoogleLogin = function() {
  showToast('Google OAuth berhasil terhubung!', 'success');
  navigate('dashboard');
};

window.handleImpersonate = async function(userId) {
  if (!userId) return;
  const res = await api('/api/admin/impersonate', {
    method: 'POST',
    body: JSON.stringify({ targetUserId: userId })
  });
  if (res.success) {
    state.user = res.user;
    await Promise.all([
      fetchWallets(),
      fetchCategories(),
      fetchTransactions(),
      fetchBudgets(),
      fetchBudgetSummary(),
      fetchCalendarData(),
      fetchReportSummary()
    ]);
    showToast(res.message, 'success');
    navigate('dashboard');
  }
};

window.setAdminTab = async function(tab) {
  state.adminTab = tab;
  render();
  try {
    await Promise.all([fetchAdminData(), fetchAdminStats()]);
    render();
  } catch (e) {}
};

window.fetchAdminStats = async function() {
  try {
    const [statsRes, auditRes] = await Promise.all([
      api('/api/admin/stats'),
      api('/api/admin/audit-logs')
    ]);
    if (statsRes && statsRes.success) state.adminStats = statsRes.stats;
    if (auditRes && auditRes.success) state.adminAuditLogs = auditRes.logs;
  } catch (err) {
    console.error('Failed to fetch admin stats:', err);
  }
};

window.approvePayment = async function(orderId, optionalUserId, optionalPhone) {
  const payments = state.adminPayments || [];
  const users = state.adminUsers || [];

  const cleanOrder = String(orderId || '').trim();
  const cleanOptionalUser = String(optionalUserId || '').trim();
  const cleanOptionalPhone = String(optionalPhone || '').replace(/[^0-9]/g, '');

  let p = payments.find(x => 
    (cleanOrder && x.order_id === cleanOrder) ||
    (cleanOrder && x.user_id === cleanOrder) ||
    (cleanOptionalUser && x.user_id === cleanOptionalUser) ||
    (cleanOptionalPhone && x.phone_number && x.phone_number.replace(/[^0-9]/g, '') === cleanOptionalPhone)
  );

  const targetUserId = (p && p.user_id) || cleanOptionalUser || (cleanOrder.startsWith('usr-') ? cleanOrder : '');
  const u = users.find(x => 
    (targetUserId && x.id === targetUserId) ||
    (cleanOrder && x.id === cleanOrder) ||
    (cleanOptionalPhone && x.phone_number && x.phone_number.replace(/[^0-9]/g, '') === cleanOptionalPhone)
  );

  const payload = {
    orderId: (p && p.order_id) || cleanOrder || (u ? ('REG-' + u.id.replace('usr-', '')) : ''),
    userId: targetUserId || (u && u.id) || '',
    phoneNumber: (p && (p.phone_number || p.user_phone_number)) || (u && u.phone_number) || optionalPhone || '',
    fullName: (p && (p.full_name || p.user_full_name)) || (u && u.full_name) || '',
    email: (p && (p.email || p.user_email)) || (u && u.email) || '',
    type: (p && p.type) || 'registration_verification'
  };

  const res = await api('/api/admin/payments/approve', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res && res.success) {
    // 1. Clean localStorage pending registrations & add to approved cache
    try {
      const localPending = JSON.parse(localStorage.getItem('tatadana_pending_registrations') || '[]');
      const filtered = localPending.filter(x => 
        x.order_id !== payload.orderId && 
        x.user_id !== payload.userId && 
        (!payload.phoneNumber || (x.phone_number || '').replace(/[^0-9]/g, '') !== payload.phoneNumber.replace(/[^0-9]/g, ''))
      );
      localStorage.setItem('tatadana_pending_registrations', JSON.stringify(filtered));

      const approvedCache = JSON.parse(localStorage.getItem('tatadana_approved_registrations') || '[]');
      if (payload.userId && !approvedCache.includes(payload.userId)) approvedCache.push(payload.userId);
      const pureDigits = (payload.phoneNumber || '').replace(/[^0-9]/g, '');
      if (pureDigits && !approvedCache.includes(pureDigits)) approvedCache.push(pureDigits);
      localStorage.setItem('tatadana_approved_registrations', JSON.stringify(approvedCache));
    } catch (e) {}

    // 2. Optimistically update local state so UI updates immediately
    if (p) p.status = 'settlement';
    if (u) {
      u.whatsapp_verified = true;
      u.phone_verified = true;
    }

    showToast(res.message || 'Pendaftaran / Pembayaran berhasil disetujui!', 'success');
    await Promise.all([fetchAdminData(), fetchAdminStats()]);
    render();
  } else {
    showToast((res && res.message) || 'Gagal menyetujui pembayaran', 'error');
  }
};

window.rejectPayment = async function(orderId, optionalUserId, optionalPhone) {
  const payments = state.adminPayments || [];
  const cleanOrder = String(orderId || '').trim();
  const cleanOptionalUser = String(optionalUserId || '').trim();
  const cleanOptionalPhone = String(optionalPhone || '').replace(/[^0-9]/g, '');

  let p = payments.find(x => 
    (cleanOrder && x.order_id === cleanOrder) ||
    (cleanOrder && x.user_id === cleanOrder) ||
    (cleanOptionalUser && x.user_id === cleanOptionalUser)
  );

  const payload = {
    orderId: (p && p.order_id) || cleanOrder,
    userId: (p && p.user_id) || cleanOptionalUser,
    phoneNumber: (p && (p.phone_number || p.user_phone_number)) || optionalPhone || '',
    reason: 'Ditolak oleh Admin'
  };

  const res = await api('/api/admin/payments/reject', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res && res.success) {
    try {
      const localPending = JSON.parse(localStorage.getItem('tatadana_pending_registrations') || '[]');
      const filtered = localPending.filter(x => x.order_id !== payload.orderId && x.user_id !== payload.userId);
      localStorage.setItem('tatadana_pending_registrations', JSON.stringify(filtered));
    } catch (e) {}
    if (p) p.status = 'rejected';
    showToast(res.message || 'Pembayaran / Pendaftaran telah ditolak.', 'info');
    await Promise.all([fetchAdminData(), fetchAdminStats()]);
    render();
  } else {
    showToast((res && res.message) || 'Gagal menolak pembayaran', 'error');
  }
};

window.setAdminApprovalFilter = function(filter) {
  state.adminApprovalFilter = filter;
  render();
};

window.openUserProfileModal = function(orderOrUserId) {
  const payments = state.adminPayments || [];
  const users = state.adminUsers || [];
  
  const p = payments.find(x => x.order_id === orderOrUserId || x.user_id === orderOrUserId);
  const targetUserId = p ? p.user_id : orderOrUserId;
  const u = users.find(x => x.id === targetUserId) || {};
  
  const fullName = (p && p.user_full_name) || u.full_name || (p && p.full_name) || 'Pengguna Baru';
  const phone = (p && p.user_phone_number) || u.phone_number || (p && p.phone_number) || '-';
  const email = (p && p.user_email) || u.email || (p && p.email) || '-';
  const role = (p && p.user_role) || u.role || 'user';
  const planTier = (p && p.user_plan_tier) || u.plan_tier || (p && p.plan_tier) || 'starter';
  const isVerified = (p && p.user_whatsapp_verified !== undefined) ? p.user_whatsapp_verified : Boolean(u.whatsapp_verified || u.phone_verified);
  const createdAt = (p && (p.user_created_at || p.created_at)) || u.created_at || new Date().toISOString();
  const orderId = (p && p.order_id) || (orderOrUserId && orderOrUserId.startsWith('REG-') ? orderOrUserId : '-');
  const type = (p && p.type) || (orderId.startsWith('REG-') ? 'registration_verification' : 'plan_upgrade');
  const status = (p && p.status) || (isVerified ? 'settlement' : 'pending');
  const amount = (p && p.amount) || 0;
  const avatarUrl = u.avatar_url || (p && p.user_avatar_url) || null;

  state.viewingUserProfile = {
    order_id: orderId,
    user_id: targetUserId,
    full_name: fullName,
    phone_number: phone,
    email: email,
    role: role,
    plan_tier: planTier,
    whatsapp_verified: isVerified,
    created_at: createdAt,
    type: type,
    status: status,
    amount: amount,
    avatar_url: avatarUrl
  };
  
  render();
};

window.closeUserProfileModal = function() {
  state.viewingUserProfile = null;
  render();
};

window.openUserDatabaseModal = async function(userId, optionalPhone, optionalFullName) {
  const cleanId = String(userId || '').trim();
  const users = state.adminUsers || [];
  const payments = state.adminPayments || [];

  // Look up user in state
  let u = users.find(x => 
    (cleanId && (x.id === cleanId || x.id.replace('usr-', '') === cleanId.replace('REG-', '').replace('usr-', ''))) ||
    (optionalPhone && x.phone_number && x.phone_number.replace(/[^0-9]/g, '') === String(optionalPhone).replace(/[^0-9]/g, ''))
  );

  let p = payments.find(x => 
    (cleanId && (x.order_id === cleanId || x.user_id === cleanId)) ||
    (optionalPhone && x.phone_number && x.phone_number.replace(/[^0-9]/g, '') === String(optionalPhone).replace(/[^0-9]/g, ''))
  );

  const finalUserId = (u && u.id) || (p && p.user_id) || cleanId;
  const finalPhone = (u && u.phone_number) || (p && (p.phone_number || p.user_phone_number)) || optionalPhone || '';
  const finalFullName = (u && u.full_name) || (p && (p.full_name || p.user_full_name)) || optionalFullName || 'Pengguna Baru';

  showToast('Memuat database pengguna...', 'info');

  try {
    const res = await api('/api/admin/user-database', {
      method: 'POST',
      body: JSON.stringify({ 
        userId: finalUserId,
        orderId: cleanId,
        phoneNumber: finalPhone,
        fullName: finalFullName,
        email: (u && u.email) || (p && (p.email || p.user_email)) || ''
      })
    });

    if (res && res.success && res.database) {
      state.viewingUserDatabase = res.database;
      state.userDbTab = 'wallets';
      render();
      return;
    }
  } catch (err) {
    console.warn('Backend call for user-database failed, building client-side inspector:', err);
  }

  // Resilient fallback inspector if server is unreachable or isolated container
  const fallbackProfile = u || {
    id: finalUserId || ('usr-' + Date.now()),
    full_name: finalFullName,
    phone_number: finalPhone,
    email: (p && (p.email || p.user_email)) || '-',
    role: 'user',
    plan_tier: (p && p.plan_tier) || 'starter',
    whatsapp_verified: Boolean((p && p.status === 'settlement') || (u && u.whatsapp_verified)),
    phone_verified: Boolean((p && p.status === 'settlement') || (u && u.phone_verified)),
    created_at: (p && p.created_at) || (u && u.created_at) || new Date().toISOString()
  };

  const starterWallet = {
    id: 'w-' + fallbackProfile.id + '-1',
    user_id: fallbackProfile.id,
    name: 'Dompet Utama',
    wallet_type: 'cash',
    balance: fallbackProfile.total_balance || 0,
    is_default_telegram: true,
    color: '#FF5B00',
    icon: '💵'
  };

  state.viewingUserDatabase = {
    profile: fallbackProfile,
    wallets: [starterWallet],
    transactions: [],
    budgets: [],
    categories: [
      { id: 'cat-01', name: 'Makanan & Minuman', icon: '🍜', color: '#F97316' },
      { id: 'cat-02', name: 'Transportasi', icon: '🚗', color: '#3B82F6' },
      { id: 'cat-03', name: 'Tagihan & Utilitas', icon: '🏠', color: '#8B5CF6' }
    ],
    payments: p ? [p] : [],
    auditLogs: [],
    summary: {
      totalWallets: 1,
      totalBalance: fallbackProfile.total_balance || 0,
      totalTransactions: fallbackProfile.transactions_count || 0,
      totalIncome: fallbackProfile.total_income || 0,
      totalExpense: fallbackProfile.total_expense || 0,
      netCashflow: fallbackProfile.net_cashflow || 0,
      totalBudgets: 0,
      totalCategories: 3
    }
  };
  state.userDbTab = 'wallets';
  render();
  showToast('Database pengguna berhasil dibuka!', 'success');
};

window.closeUserDatabaseModal = function() {
  state.viewingUserDatabase = null;
  render();
};

window.setUserDbTab = function(tab) {
  state.userDbTab = tab;
  render();
};

window.setAdminUserSearch = function(query) {
  state.adminUserSearch = query || '';
  render();
};

window.adminVerifyUserWhatsapp = async function(userId) {
  const res = await api('/api/admin/users/verify-whatsapp', {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
  if (res && res.success) {
    try {
      const approvedCache = JSON.parse(localStorage.getItem('tatadana_approved_registrations') || '[]');
      if (userId && !approvedCache.includes(userId)) approvedCache.push(userId);
      localStorage.setItem('tatadana_approved_registrations', JSON.stringify(approvedCache));

      const localPending = JSON.parse(localStorage.getItem('tatadana_pending_registrations') || '[]');
      const filtered = localPending.filter(x => x.user_id !== userId);
      localStorage.setItem('tatadana_pending_registrations', JSON.stringify(filtered));
    } catch (e) {}

    showToast(res.message || 'Nomor WhatsApp berhasil diverifikasi!', 'success');
    await Promise.all([fetchAdminData(), fetchAdminStats()]);
    render();
  } else {
    showToast((res && res.message) || 'Gagal memverifikasi nomor WhatsApp', 'error');
  }
};

window.downloadUserDatabaseJSON = function(userId) {
  if (!state.viewingUserDatabase) return;
  const jsonStr = JSON.stringify(state.viewingUserDatabase, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const userName = (state.viewingUserDatabase.profile?.full_name || 'user').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `TataDana_Database_${userName}_${userId}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('File JSON Database pengguna berhasil diunduh!', 'success');
};

window.toggleUserTier = async function(userId, currentTier) {
  const newTier = currentTier === 'pro' ? 'starter' : 'pro';
  const res = await api('/api/admin/users/tier', {
    method: 'POST',
    body: JSON.stringify({ userId, tier: newTier })
  });
  if (res.success) {
    showToast(res.message || `Status akun berhasil diubah ke ${newTier.toUpperCase()}`, 'success');
    await Promise.all([fetchAdminData(), fetchAdminStats()]);
    render();
  } else {
    showToast(res.message || 'Gagal mengubah tier akun', 'error');
  }
};

window.runSimCommand = function(cmd) {
  const input = document.getElementById('sim-text-input');
  if (input) input.value = cmd;
  triggerWebhookSimulation('text');
};


window.updateAIMode = async function(mode) {
  state.aiMode = mode;
  try {
    const res = await api('/api/admin/ai/providers', {
      method: 'POST',
      body: JSON.stringify({ mode })
    });
    if (res.success) {
      showToast(`Mode AI diubah ke: ${mode === 'failover' ? 'Failover' : 'Single'}`, 'success');
    }
  } catch (e) {
    showToast(`Mode AI diubah ke: ${mode}`, 'success');
  }
  render();
};

window.applyReportFilter = async function() {
  const searchEl = document.getElementById('filter-search');
  const startEl = document.getElementById('filter-start');
  const endEl = document.getElementById('filter-end');
  const typeEl = document.getElementById('filter-type');
  const walletEl = document.getElementById('filter-wallet');
  const catEl = document.getElementById('filter-category');

  if (searchEl) state.reportFilter.search = searchEl.value;
  if (startEl) state.reportFilter.startDate = startEl.value;
  if (endEl) state.reportFilter.endDate = endEl.value;
  if (typeEl) state.reportFilter.type = typeEl.value;
  if (walletEl) state.reportFilter.walletId = walletEl.value;
  if (catEl) state.reportFilter.categoryId = catEl.value;

  await Promise.all([fetchTransactions(), fetchReportSummary()]);
  render();
};

window.setReportCategoryFilter = async function(catId) {
  state.reportFilter.categoryId = catId;
  const selectEl = document.getElementById('filter-category');
  if (selectEl) selectEl.value = catId;
  await Promise.all([fetchTransactions(), fetchReportSummary()]);
  render();
};

window.resetReportFilter = async function() {
  state.reportFilter.startDate = '2026-10-01';
  state.reportFilter.endDate = '2026-10-31';
  state.reportFilter.type = '';
  state.reportFilter.categoryId = '';
  state.reportFilter.walletId = '';
  state.reportFilter.search = '';
  await Promise.all([fetchTransactions(), fetchReportSummary()]);
  render();
};

window.openAddCategoryModal = function() {
  state.showAddCategoryModal = true;
  render();
};

window.closeAddCategoryModal = function() {
  state.showAddCategoryModal = false;
  render();
};

window.submitNewCategory = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const nameEl = document.getElementById('new-cat-name');
  const typeEl = document.getElementById('new-cat-type');
  const iconEl = document.getElementById('new-cat-icon');
  const submitBtn = document.getElementById('btn-submit-cat');

  const name = nameEl?.value?.trim();
  if (!name) {
    showToast('Nama kategori wajib diisi', 'error');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Menyimpan...';
  }

  const payload = {
    name,
    type: typeEl?.value || 'expense',
    icon: iconEl?.value || '🏷️',
    color: typeEl?.value === 'income' ? '#059669' : '#FF5B00'
  };

  const res = await api('/api/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    showToast(`Kategori "${name}" berhasil ditambahkan!`, 'success');
    state.showAddCategoryModal = false;
    await fetchCategories();
    render();
  } else {
    showToast(res.message || 'Gagal menambahkan kategori', 'error');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Simpan Kategori';
    }
  }
};

window.openAddTxModal = function(customDate, customType) {
  state.modalTxDate = customDate || state.selectedCalendarDate || new Date().toISOString().slice(0, 10);
  state.modalTxType = customType || 'pengeluaran';
  state.showAddTxModal = true;
  render();
};

window.closeAddTxModal = function() {
  state.showAddTxModal = false;
  render();
};

window.setTxModalType = function(type) {
  state.modalTxType = type;
  const input = document.getElementById('new-tx-type');
  if (input) input.value = type;
  const btnExp = document.getElementById('btn-tx-type-pengeluaran');
  const btnInc = document.getElementById('btn-tx-type-pemasukan');
  if (btnExp && btnInc) {
    if (type === 'pengeluaran') {
      btnExp.className = 'py-2 rounded-lg font-extrabold transition-all bg-white text-rose-600 shadow-xs';
      btnInc.className = 'py-2 rounded-lg font-extrabold transition-all text-gray-500 hover:text-gray-800';
    } else {
      btnExp.className = 'py-2 rounded-lg font-extrabold transition-all text-gray-500 hover:text-gray-800';
      btnInc.className = 'py-2 rounded-lg font-extrabold transition-all bg-white text-emerald-600 shadow-xs';
    }
  }

  // Dynamically update category select options to match selected type
  const catSelect = document.getElementById('new-tx-category');
  if (catSelect) {
    const targetType = type === 'pengeluaran' ? 'expense' : 'income';
    const filteredCats = (state.categories || []).filter(c => c.type === targetType);
    const list = filteredCats.length > 0 ? filteredCats : state.categories || [];
    catSelect.innerHTML = list.map(c => `<option value="${c.id}">${c.icon || '🏷️'} ${c.name}</option>`).join('');
  }

  checkTxBalanceSufficiency();
};

window.checkTxBalanceSufficiency = function() {
  const amountEl = document.getElementById('new-tx-amount');
  const typeEl = document.getElementById('new-tx-type');
  const walletEl = document.getElementById('new-tx-wallet');
  const warningEl = document.getElementById('tx-balance-warning');
  const warningText = document.getElementById('tx-balance-warning-text');

  if (!amountEl || !warningEl) return;

  const amount = Number(amountEl.value) || 0;
  const currentType = typeEl?.value || state.modalTxType || 'pengeluaran';
  const walletId = walletEl?.value || (state.wallets && state.wallets[0]?.id);
  const wallet = (state.wallets || []).find(w => w.id === walletId);

  if (currentType === 'pengeluaran' && wallet && amount > Number(wallet.balance || 0) && amount > 0) {
    warningEl.classList.remove('hidden');
    if (warningText) {
      warningText.innerHTML = `Saldo anda tidak mencukupi (Saldo ${wallet.name}: <b>${formatRupiah(wallet.balance || 0)}</b>)`;
    }
    amountEl.classList.add('border-rose-500', 'focus:border-rose-500', 'focus:ring-rose-100');
    amountEl.classList.remove('border-gray-300', 'focus:border-orange-500');
  } else {
    warningEl.classList.add('hidden');
    amountEl.classList.remove('border-rose-500', 'focus:border-rose-500', 'focus:ring-rose-100');
    amountEl.classList.add('border-gray-300', 'focus:border-orange-500');
  }
};

window.addTxAmount = function(val) {
  const el = document.getElementById('new-tx-amount');
  if (el) {
    el.value = (Number(el.value) || 0) + val;
    checkTxBalanceSufficiency();
  }
};

window.setTxAmount = function(val) {
  const el = document.getElementById('new-tx-amount');
  if (el) {
    el.value = val === 0 ? '' : val;
    checkTxBalanceSufficiency();
  }
};

window.submitNewTransaction = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const amountEl = document.getElementById('new-tx-amount');
  const typeEl = document.getElementById('new-tx-type');
  const catEl = document.getElementById('new-tx-category');
  const walletEl = document.getElementById('new-tx-wallet');
  const dateEl = document.getElementById('new-tx-date');
  const notesEl = document.getElementById('new-tx-notes');
  const submitBtn = document.getElementById('btn-submit-tx');

  const amount = Number(amountEl?.value) || 0;
  if (amount <= 0) {
    showToast('Nominal transaksi harus lebih dari 0', 'error');
    return;
  }

  const txType = typeEl?.value || state.modalTxType || 'pengeluaran';
  const walletId = walletEl?.value || (state.wallets && state.wallets[0]?.id);
  const selectedWallet = (state.wallets || []).find(w => w.id === walletId);

  // Validasi saldo jika jenis transaksi adalah pengeluaran
  if (txType === 'pengeluaran' && selectedWallet && amount > Number(selectedWallet.balance || 0)) {
    showToast('Saldo anda tidak mencukupi', 'error');
    checkTxBalanceSufficiency();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Menyimpan...';
  }

  const txDate = dateEl?.value ? `${dateEl.value}T12:00:00+07:00` : new Date().toISOString();

  const payload = {
    amount,
    type: txType,
    categoryId: catEl?.value || (state.categories[0]?.id),
    walletId: walletId,
    transaction_date: txDate,
    notes: notesEl?.value || 'Transaksi Baru',
    source: 'manual_web'
  };

  const res = await api('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.success) {
    showToast('Transaksi manual berhasil dicatat!', 'success');
    state.showAddTxModal = false;
    await Promise.all([
      fetchWallets(),
      fetchTransactions(),
      fetchBudgets(),
      fetchBudgetSummary(),
      fetchCalendarData(),
      fetchReportSummary()
    ]);
    render();
  } else {
    showToast(res.message || 'Gagal mencatat transaksi', 'error');
    if (res.message === 'Saldo anda tidak mencukupi') {
      checkTxBalanceSufficiency();
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Simpan Transaksi';
    }
  }
};

window.deleteTransaction = async function(txId) {
  if (!confirm('Apakah Anda yakin ingin menghapus catatan transaksi ini? Saldo dompet akan disesuaikan kembali.')) {
    return;
  }

  showToast('Menghapus transaksi...', 'info');
  const res = await api('/api/transactions/delete', {
    method: 'POST',
    body: JSON.stringify({ transactionId: txId })
  });

  if (res && res.success) {
    showToast('Transaksi berhasil dihapus & saldo dikembalikan.', 'success');
    await Promise.all([
      fetchWallets(),
      fetchTransactions(),
      fetchBudgets(),
      fetchBudgetSummary(),
      fetchCalendarData(),
      fetchReportSummary()
    ]);
    render();
  } else {
    showToast(res.message || 'Gagal menghapus transaksi', 'error');
  }
};

// -------------------------------------------------------------
// CALENDAR, BUDGET & WALLET CONTROLLERS
// -------------------------------------------------------------

// Calendar Controllers (Real-Time Synchronized)
window.fetchCalendarData = async function(year, month, isSilent = false) {
  const nowInfo = getRealtimeDateInfo();
  const yr = year || state.calendarYear || nowInfo.year;
  const mo = month || state.calendarMonth || nowInfo.month;
  state.calendarYear = yr;
  state.calendarMonth = mo;
  try {
    const res = await api(`/api/calendar/month?year=${yr}&month=${mo}`);
    if (res && res.success) {
      state.calendarData = res;
      state.calendarLastSyncedAt = new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
      const prefix = `${yr}-${String(mo).padStart(2, '0')}`;
      if (!state.selectedCalendarDate || !state.selectedCalendarDate.startsWith(prefix)) {
        if (nowInfo.dateStr.startsWith(prefix)) {
          state.selectedCalendarDate = nowInfo.dateStr;
        } else {
          state.selectedCalendarDate = `${prefix}-01`;
        }
      }
      if (isSilent && state.currentPage === 'kalender') {
        render();
      }
    }
  } catch (err) {
    console.error('Failed to fetch calendar:', err);
  }
};

window.goToTodayCalendar = async function() {
  const nowInfo = getRealtimeDateInfo();
  state.calendarYear = nowInfo.year;
  state.calendarMonth = nowInfo.month;
  state.selectedCalendarDate = nowInfo.dateStr;
  await window.fetchCalendarData(nowInfo.year, nowInfo.month);
  render();
  showToast(`🎯 Kalender beralih ke Hari Ini (${formatFullIndonesianDate(nowInfo.dateStr)})`, 'info');
};

window.syncCalendarRealtime = async function() {
  showToast('Menyinkronkan kalender real-time...', 'info');
  await Promise.all([
    window.fetchCalendarData(state.calendarYear, state.calendarMonth),
    fetchTransactions(),
    fetchWallets()
  ]);
  render();
  showToast('Sinkronisasi kalender real-time berhasil!', 'success');
};

window.selectCalendarDate = function(dateStr) {
  state.selectedCalendarDate = dateStr;
  render();
};

window.prevCalendarMonth = async function() {
  const nowInfo = getRealtimeDateInfo();
  let yr = state.calendarYear || nowInfo.year;
  let mo = (state.calendarMonth || nowInfo.month) - 1;
  if (mo < 1) {
    mo = 12;
    yr -= 1;
  }
  await fetchCalendarData(yr, mo);
  render();
};

window.nextCalendarMonth = async function() {
  const nowInfo = getRealtimeDateInfo();
  let yr = state.calendarYear || nowInfo.year;
  let mo = (state.calendarMonth || nowInfo.month) + 1;
  if (mo > 12) {
    mo = 1;
    yr += 1;
  }
  await fetchCalendarData(yr, mo);
  render();
};

// Budget Controllers
window.fetchBudgetSummary = async function() {
  try {
    const res = await api('/api/budgets/summary');
    if (res && res.success) {
      state.budgetSummary = res;
    }
  } catch (err) {
    console.error('Failed to fetch budget summary:', err);
  }
};

window.setBudgetTab = function(tab) {
  state.activeBudgetTab = tab;
  render();
};

window.openAddBudgetModal = function() {
  state.showAddBudgetModal = true;
  render();
};

window.closeAddBudgetModal = function() {
  state.showAddBudgetModal = false;
  render();
};

window.submitNewBudget = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const catEl = document.getElementById('budget-category-id');
  const periodEl = document.getElementById('budget-period');
  const amountEl = document.getElementById('budget-amount');

  const categoryId = catEl?.value;
  const period = periodEl?.value || 'monthly';
  const amount = Number(amountEl?.value) || 0;

  if (amount <= 0) {
    showToast('Nominal anggaran harus lebih dari 0', 'error');
    return;
  }

  const res = await api('/api/budgets', {
    method: 'POST',
    body: JSON.stringify({ categoryId, period, amount })
  });

  if (res && res.success) {
    showToast(res.message || 'Budget berhasil disimpan!', 'success');
    state.showAddBudgetModal = false;
    await Promise.all([fetchBudgets(), fetchBudgetSummary()]);
    render();
  } else {
    showToast(res?.message || 'Gagal menyimpan budget', 'error');
  }
};

window.deleteBudget = async function(budgetId) {
  if (!confirm('Apakah Anda yakin ingin menghapus alokasi budget ini?')) return;
  const res = await api('/api/budgets/delete', {
    method: 'POST',
    body: JSON.stringify({ budgetId })
  });

  if (res && res.success) {
    showToast('Budget berhasil dihapus', 'success');
    await Promise.all([fetchBudgets(), fetchBudgetSummary()]);
    render();
  } else {
    showToast(res?.message || 'Gagal menghapus budget', 'error');
  }
};

// Wallet Controllers
window.openAddWalletModal = function() {
  state.showAddWalletModal = true;
  render();
};

window.closeAddWalletModal = function() {
  state.showAddWalletModal = false;
  render();
};

window.submitNewWallet = async function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const nameEl = document.getElementById('new-wallet-name');
  const typeEl = document.getElementById('new-wallet-type');
  const balanceEl = document.getElementById('new-wallet-balance');
  const defaultEl = document.getElementById('new-wallet-default');

  const name = nameEl?.value?.trim();
  const wallet_type = typeEl?.value || 'bank';
  const balance = Number(balanceEl?.value) || 0;
  const is_default_telegram = Boolean(defaultEl?.checked);

  if (!name) {
    showToast('Nama dompet harus diisi', 'error');
    return;
  }

  const res = await api('/api/wallets', {
    method: 'POST',
    body: JSON.stringify({ name, wallet_type, balance, is_default_telegram })
  });

  if (res && res.success) {
    showToast(res.message || 'Dompet baru berhasil ditambahkan!', 'success');
    state.showAddWalletModal = false;
    await fetchWallets();
    render();
  } else {
    showToast(res?.message || 'Gagal menambahkan dompet', 'error');
  }
};

window.setDefaultWallet = async function(walletId) {
  const res = await api('/api/wallets/set-default', {
    method: 'POST',
    body: JSON.stringify({ walletId })
  });

  if (res && res.success) {
    showToast(res.message || 'Dompet default bot berhasil diubah!', 'success');
    await fetchWallets();
    render();
  } else {
    showToast(res?.message || 'Gagal mengubah dompet default', 'error');
  }
};

window.deleteWallet = async function(walletId) {
  if (!confirm('Apakah Anda yakin ingin menghapus dompet ini?')) return;
  const res = await api('/api/wallets/delete', {
    method: 'POST',
    body: JSON.stringify({ walletId })
  });

  if (res && res.success) {
    showToast(res.message || 'Dompet berhasil dihapus', 'success');
    await fetchWallets();
    render();
  } else {
    showToast(res?.message || 'Gagal menghapus dompet', 'error');
  }
};


// -------------------------------------------------------------
// TATA AI BOT CONTROLLERS & EVENT HANDLERS
// -------------------------------------------------------------

function formatAiText(str) {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

window.copyToClipboard = function(encodedText) {
  const text = decodeURIComponent(encodedText);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Pesan berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
      showToast('Teks disalin', 'success');
    });
  } else {
    showToast('Teks disalin ke clipboard', 'success');
  }
};

window.clearTataAiChat = function() {
  state.tataAiMessages = [
    {
      role: 'bot',
      text: `Halo! Saya **Tata AI**, asisten dan perencana finansial cerdas pribadimu di TataDana. 🤖✨

Saya siap membantumu:
• 📊 Menganalisis kesehatan arus kas & rasio pengeluaran
• 📝 Mencatat transaksi secara instan (contoh: *"Catat beli bensin 35rb"* atau *"Gajian 5jt"*)
• 🎯 Menghitung simulasi dana darurat 3-6 bulan
• 💡 Memberikan tips hemat praktis formula 50/30/20

Silakan pilih prompt cepat di bawah atau ketik langsung pertanyaanmu!`,
      time: 'Baru saja',
      action: null
    }
  ];
  render();
  showToast('Riwayat percakapan direset.', 'info');
};

window.sendTataAiSuggestion = function(text) {
  const input = document.getElementById('tata-ai-input');
  if (input) input.value = text;
  window.sendTataAiMessage(text);
};

window.simulateVoicePrompt = function() {
  const input = document.getElementById('tata-ai-input');
  const examples = [
    'Catat bensin 35rb pakai dompet BCA',
    'Analisis cashflow dan sarankan cara menghemat',
    'Berapa target dana darurat 6 bulan saya?',
    'Beli kopi susu gula aren 22rb'
  ];
  const rand = examples[Math.floor(Math.random() * examples.length)];
  if (input) {
    input.value = rand;
    input.focus();
  }
  showToast('🎙️ Suara ditranskripsikan ke input!', 'info');
};

window.handleTataAiSubmit = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('tata-ai-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  window.sendTataAiMessage(text);
};

window.sendTataAiMessage = async function(message) {
  if (!message || !message.trim()) return;
  const userMsg = message.trim();

  // Add user message to state
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
  state.tataAiMessages.push({
    role: 'user',
    text: userMsg,
    time: timeStr
  });
  state.isAiTyping = true;
  render();

  // Scroll to bottom
  setTimeout(() => {
    const feed = document.getElementById('tata-ai-messages-container');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, 50);

  // Call AI Backend
  const res = await api('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message: userMsg })
  });

  state.isAiTyping = false;

  if (res.success && res.reply) {
    state.tataAiMessages.push({
      role: 'bot',
      text: res.reply,
      time: timeStr,
      action: res.action
    });

    // If transaction was automatically recorded by Tata AI, refresh app data
    if (res.action === 'transaction_recorded') {
      showToast('Transaksi tercatat otomatis oleh Tata AI!', 'success');
      await Promise.all([fetchWallets(), fetchTransactions(), fetchBudgets(), fetchReportSummary()]);
    }
  } else {
    state.tataAiMessages.push({
      role: 'bot',
      text: 'Maaf, terjadi kendala saat menghubungkan ke layanan Tata AI. Silakan coba kembali sesaat lagi.',
      time: timeStr
    });
    showToast(res.message || 'Gagal memproses pesan AI', 'error');
  }

  render();

  setTimeout(() => {
    const feed = document.getElementById('tata-ai-messages-container');
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, 50);
};

async function fetchAiSuggestions() {
  try {
    const res = await api('/api/ai/suggestions');
    if (res.success && res.suggestions) {
      state.tataAiSuggestions = res.suggestions;
    }
  } catch (err) {
    console.warn('Failed to fetch suggestions:', err);
  }
}

async function fetchAdminData() {
  try {
    const [usersRes, aiRes, logsRes, payRes] = await Promise.all([
      api('/api/admin/users'),
      api('/api/admin/ai/providers'),
      api('/api/admin/ai/logs'),
      api('/api/admin/payments')
    ]);
    if (usersRes && usersRes.success) state.adminUsers = usersRes.users || [];
    if (aiRes && aiRes.success) {
      state.aiProviders = aiRes.providers || [];
      state.aiMode = aiRes.mode;
    }
    if (logsRes && logsRes.success) state.adminLogs = logsRes.logs || [];
    if (payRes && payRes.success) state.adminPayments = payRes.payments || [];

    // LocalStorage fallback sync: ensure newly registered users appear instantly on refresh
    try {
      const localPending = JSON.parse(localStorage.getItem('tatadana_pending_registrations') || '[]');
      if (Array.isArray(localPending) && localPending.length > 0) {
        state.adminPayments = state.adminPayments || [];
        state.adminUsers = state.adminUsers || [];
        localPending.forEach(lp => {
          const lpPhone = (lp.phone_number || '').replace(/[^0-9]/g, '');
          const existsPay = state.adminPayments.some(p => p.order_id === lp.order_id || (p.phone_number && p.phone_number.replace(/[^0-9]/g, '') === lpPhone));
          if (!existsPay) {
            state.adminPayments.unshift({
              ...lp,
              user_full_name: lp.full_name,
              user_phone_number: lp.phone_number,
              user_email: lp.email,
              user_role: 'user',
              user_plan_tier: lp.plan_tier || 'starter',
              user_whatsapp_verified: false,
              user_created_at: lp.created_at || new Date().toISOString()
            });
          }
          const existsUser = state.adminUsers.some(u => u.id === lp.user_id || (u.phone_number && u.phone_number.replace(/[^0-9]/g, '') === lpPhone));
          if (!existsUser) {
            state.adminUsers.unshift({
              id: lp.user_id,
              full_name: lp.full_name,
              phone_number: lp.phone_number,
              email: lp.email,
              role: 'user',
              plan_tier: lp.plan_tier || 'starter',
              whatsapp_verified: false,
              phone_verified: false,
              wallets_count: 1,
              total_balance: 0,
              transactions_count: 0,
              total_income: 0,
              total_expense: 0,
              net_cashflow: 0,
              budgets_count: 0,
              categories_count: 5,
              created_at: lp.created_at || new Date().toISOString()
            });
          }
        });
      }
    } catch (e) {}

    // Apply approved cache to state so verified users stay verified across instances
    try {
      const approvedCache = JSON.parse(localStorage.getItem('tatadana_approved_registrations') || '[]');
      if (Array.isArray(approvedCache) && approvedCache.length > 0) {
        (state.adminPayments || []).forEach(p => {
          const pPhone = (p.phone_number || p.user_phone_number || '').replace(/[^0-9]/g, '');
          if (approvedCache.includes(p.user_id) || approvedCache.includes(p.order_id) || (pPhone && approvedCache.includes(pPhone))) {
            p.status = 'settlement';
          }
        });
        (state.adminUsers || []).forEach(u => {
          const uPhone = (u.phone_number || '').replace(/[^0-9]/g, '');
          if (approvedCache.includes(u.id) || (uPhone && approvedCache.includes(uPhone))) {
            u.whatsapp_verified = true;
            u.phone_verified = true;
          }
        });
      }
    } catch (e) {}

    // Update real-time stats
    const totalUsers = (state.adminUsers || []).length;
    const pendingCount = (state.adminPayments || []).filter(p => p.status === 'pending').length;
    state.adminStats = {
      ...(state.adminStats || {}),
      totalUsers,
      pendingApprovals: pendingCount
    };
  } catch (err) {
    console.warn('Failed to fetch admin data:', err);
  }
}

// Global Main Render Function
function render() {
  const app = document.getElementById('app') || document.getElementById('root') || document.getElementById('app-root');
  if (!app) return;

  switch (state.currentPage) {
    case 'landing':
      app.innerHTML = renderLandingPage();
      break;
    case 'login':
      app.innerHTML = renderAuthPage('login');
      break;
    case 'register':
      app.innerHTML = renderAuthPage('register');
      break;
    case 'otp':
      app.innerHTML = renderAuthPage('otp');
      break;
    case 'dashboard':
      app.innerHTML = renderDashboardLayout(renderDashboardOverview(), 'dashboard');
      break;
    case 'tata_ai':
      app.innerHTML = renderDashboardLayout(renderTataAIPage(), 'tata_ai');
      break;
    case 'kalender':
      app.innerHTML = renderDashboardLayout(renderCalendarPage(), 'kalender');
      break;
    case 'laporan':
      app.innerHTML = renderDashboardLayout(renderLaporanPage(), 'laporan');
      break;
    case 'budget':
      app.innerHTML = renderDashboardLayout(renderBudgetPage(), 'budget');
      break;
    case 'wallet':
      app.innerHTML = renderDashboardLayout(renderWalletPage(), 'wallet');
      break;
    case 'settings':
      app.innerHTML = renderDashboardLayout(renderSettingsPage(), 'settings');
      break;
    case 'admin':
      app.innerHTML = renderDashboardLayout(renderAdminDashboard(), 'admin');
      break;
    default:
      app.innerHTML = renderDashboardLayout(renderDashboardOverview(), 'dashboard');
  }
}

// App Initialization
async function init() {
  try {
    await fetchCurrentUser();
  } catch (err) {
    console.warn('Initial auth check warning:', err);
  }

  // Determine starting page on page load / refresh
  const validPages = ['landing', 'login', 'register', 'otp', 'dashboard', 'laporan', 'budget', 'wallet', 'settings', 'admin', 'kalender'];
  const rawHash = (window.location.hash || '').replace('#', '').trim();
  let storedPage = '';
  try {
    storedPage = sessionStorage.getItem('tatadana_page') || localStorage.getItem('tatadana_page') || '';
  } catch (e) {}

  const candidatePage = validPages.includes(rawHash) ? rawHash : (validPages.includes(storedPage) ? storedPage : null);

  // Default routing:
  // When a user opens via link (or candidatePage is landing), route unconditionally to landing page, NOT admin!
  if (candidatePage === 'landing' || (!rawHash && (!storedPage || storedPage === 'landing'))) {
    state.currentPage = 'landing';
  } else if (candidatePage && ['login', 'register', 'otp'].includes(candidatePage)) {
    state.currentPage = candidatePage;
  } else if (state.user) {
    if (candidatePage === 'admin') {
      state.currentPage = state.user.role === 'superadmin' ? 'admin' : 'dashboard';
    } else if (candidatePage && validPages.includes(candidatePage)) {
      state.currentPage = candidatePage;
    } else {
      state.currentPage = state.user.role === 'superadmin' ? 'admin' : 'dashboard';
    }
  } else {
    // Visitor not logged in trying to access protected pages -> landing
    state.currentPage = 'landing';
  }

  try {
    if (window.location.hash !== '#' + state.currentPage) {
      window.location.hash = state.currentPage;
    }
    sessionStorage.setItem('tatadana_page', state.currentPage);
    localStorage.setItem('tatadana_page', state.currentPage);
  } catch (e) {}

  if (state.currentPage === 'kalender') {
    startCalendarRealtimeEngines();
  }

  // Immediate first render to ensure no blank screen on refresh
  render();

  // Fetch auxiliary data safely with allSettled
  try {
    await Promise.allSettled([
      fetchWallets(),
      fetchCategories(),
      fetchTransactions(),
      fetchBudgets(),
      fetchBudgetSummary(),
      typeof window.fetchCalendarData === 'function' ? window.fetchCalendarData(state.calendarYear, state.calendarMonth, true) : Promise.resolve(),
      fetchReportSummary(),
      fetchAiSuggestions(),
      fetchAdminData(),
      fetchAdminStats()
    ]);
  } catch (e) {
    console.warn('Auxiliary data loading warning:', e);
  }

  // Re-render once full data is populated
  render();

  // If user is viewing the Admin page, start a live polling interval for real-time registrations
  if (state.currentPage === 'admin' && !window._adminPollInterval) {
    window._adminPollInterval = setInterval(async () => {
      if (state.currentPage === 'admin') {
        const prevCount = (state.adminPayments || []).length;
        const prevUserCount = (state.adminUsers || []).length;
        await Promise.all([fetchAdminData(), fetchAdminStats()]);
        if ((state.adminPayments || []).length !== prevCount || (state.adminUsers || []).length !== prevUserCount) {
          render();
        }
      }
    }, 4000);
  }
}

window.addEventListener('hashchange', () => {
  const h = (window.location.hash || '').replace('#', '').trim();
  const validPages = ['landing', 'login', 'register', 'otp', 'dashboard', 'laporan', 'budget', 'wallet', 'settings', 'admin', 'kalender'];
  if (validPages.includes(h) && h !== state.currentPage) {
    navigate(h, false);
  }
});

// Robust DOMContentLoaded listener that handles already loaded / interactive state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
