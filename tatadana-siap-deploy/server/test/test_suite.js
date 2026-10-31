/**
 * TataDana Backend Automated Test Suite
 * Validates Currency Parser, Timezone WIB, Idempotency, Progress Bar, Plan Guard, and AI Failover
 */

import { parseIndonesianTransaction, extractAmount, formatRupiah } from '../src/services/currencyParser.js';
import { getNowWIB, formatWIBDate, toWIBISOString } from '../src/utils/timezone.js';
import { telegramBot } from '../src/services/telegramBot.js';
import { IdempotencyManager } from '../src/utils/idempotency.js';
import { inMemoryStore } from '../src/store/inMemoryStore.js';
import { aiEngine } from '../src/services/aiEngine.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING TATADANA BACKEND VERIFICATION SUITE');
  console.log('====================================================\n');

  // --- TEST GROUP 1: Indonesian Currency & Natural Text Parser ---
  console.log('--- 1. Testing Indonesian Currency & Text Parsing ---');

  const bakso = parseIndonesianTransaction('beli bakso 15rb');
  assert(bakso.success === true, 'Parse "beli bakso 15rb" success');
  assert(bakso.nominal === 15000, 'Nominal is 15000 integer');
  assert(bakso.jenis === 'pengeluaran', 'Type is pengeluaran');
  assert(bakso.kategori === 'Makanan & Minuman', 'Category is Makanan & Minuman');

  const gaji = parseIndonesianTransaction('gajian 5jt');
  assert(gaji.success === true, 'Parse "gajian 5jt" success');
  assert(gaji.nominal === 5000000, 'Nominal is 5000000 integer');
  assert(gaji.jenis === 'pemasukan', 'Type is pemasukan');
  assert(gaji.kategori === 'Gaji & Pendapatan', 'Category is Gaji & Pendapatan');

  const kopi = parseIndonesianTransaction('kopi 35k');
  assert(kopi.nominal === 35000, 'Parse "kopi 35k" nominal is 35000');
  assert(kopi.kategori === 'Makanan & Minuman', 'Category is Makanan & Minuman');

  const listrik = parseIndonesianTransaction('bayar listrik 250.000');
  assert(listrik.nominal === 250000, 'Parse "bayar listrik 250.000" nominal is 250000');
  assert(listrik.kategori === 'Tagihan & Utilitas', 'Category is Tagihan & Utilitas');

  const bensin = parseIndonesianTransaction('bensin 50rb');
  assert(bensin.nominal === 50000, 'Parse "bensin 50rb" nominal is 50000');
  assert(bensin.kategori === 'Transportasi & Bensin', 'Category is Transportasi & Bensin');

  const standalone500k = extractAmount('500k');
  assert(standalone500k?.amount === 500000, 'Extract standalone "500k" is 500000');

  const decimalJuta = extractAmount('1.5jt');
  assert(decimalJuta?.amount === 1500000, 'Extract "1.5jt" is 1500000');

  const spelledOut = parseIndonesianTransaction('makan siang dua puluh lima ribu');
  assert(spelledOut.nominal === 25000, 'Parse spelled out "dua puluh lima ribu" is 25000');

  const formattedRp = formatRupiah(150000);
  assert(formattedRp.includes('150.000'), 'formatRupiah formats correctly with dots');

  // --- TEST GROUP 2: Timezone WIB Invariants ---
  console.log('\n--- 2. Testing WIB Timezone Utilities ---');
  const wibISO = toWIBISOString();
  assert(wibISO.endsWith('+07:00'), 'toWIBISOString ends with +07:00 offset');
  const formattedWib = formatWIBDate(new Date(), true);
  assert(formattedWib.includes('WIB'), 'formatWIBDate includes "WIB" indicator');

  // --- TEST GROUP 3: Telegram Bot Visual Progress Bar & Reply ---
  console.log('\n--- 3. Testing Telegram Progress Bar & Formatting ---');
  const bar0 = telegramBot.renderProgressBar(0, 10);
  assert(bar0 === '░░░░░░░░░░', 'Progress bar 0% renders 10 empty blocks');

  const bar50 = telegramBot.renderProgressBar(50, 10);
  assert(bar50 === '█████░░░░░', 'Progress bar 50% renders 5 filled and 5 empty blocks');

  const bar100 = telegramBot.renderProgressBar(100, 10);
  assert(bar100 === '██████████', 'Progress bar 100% renders 10 filled blocks');

  const testReply = telegramBot.formatTransactionReply({
    user: { full_name: 'Budi', plan: 'pro' },
    transaction: { type: 'pengeluaran', amount: 50000, notes: 'Makan Bakso', date: new Date() },
    category: { name: 'Makanan & Minuman', icon_emoji: '🍜' },
    wallet: { name: 'BCA', balance: 500000 },
    budget: { amount: 1000000 },
    budgetSpent: 200000,
    aiAdvice: 'Tips Hemat AI'
  });
  assert(testReply.includes('Pengeluaran Tercatat'), 'Reply contains header');
  assert(testReply.includes('50.000'), 'Reply contains formatted nominal');
  assert(testReply.includes('Makanan & Minuman'), 'Reply contains category');
  assert(testReply.includes('Tips Hemat AI'), 'Pro reply contains AI advice');

  // --- TEST GROUP 4: Webhook Idempotency ---
  console.log('\n--- 4. Testing Webhook Idempotency Manager ---');
  const idempotency = new IdempotencyManager();
  const checkInitial = await idempotency.check(998811);
  assert(checkInitial.isDuplicate === false, 'First check of update_id is not duplicate');

  await idempotency.markProcessing(998811, 123456, 'test message');
  const checkProcessing = await idempotency.check(998811);
  assert(checkProcessing.isDuplicate === true, 'Duplicate update_id correctly detected during processing');
  assert(checkProcessing.status === 'processing', 'Status is processing');

  await idempotency.markCompleted(998811);
  const checkCompleted = await idempotency.check(998811);
  assert(checkCompleted.isDuplicate === true, 'Duplicate update_id correctly detected after completion');
  assert(checkCompleted.status === 'completed', 'Status is completed');

  // --- TEST GROUP 5: Plan Quota Enforcement Logic ---
  console.log('\n--- 5. Testing Plan Quota Rules ---');
  const starterUser = inMemoryStore.profiles.find(p => p.plan === 'starter');
  assert(starterUser !== undefined, 'Starter user exists in test fixtures');
  const proUser = inMemoryStore.profiles.find(p => p.plan === 'pro');
  assert(proUser !== undefined, 'Pro user exists in test fixtures');

  // Check wallets count limit for Starter (max 3)
  const starterWallets = inMemoryStore.wallets.filter(w => w.user_id === starterUser.id);
  assert(starterWallets.length <= 3, 'Starter user has wallets within limit');

  // --- TEST GROUP 6: AI Multi-Provider & Fallback ---
  console.log('\n--- 6. Testing AI Engine Text Parse & Fallback ---');
  const aiParseResult = await aiEngine.parseTextTransaction('kopi susu gula aren 25rb');
  assert(aiParseResult.success === true, 'AI parse succeeds (with built-in failover)');
  assert(aiParseResult.data.nominal === 25000, 'AI parsed nominal is 25000');
  assert(aiParseResult.data.jenis === 'pengeluaran', 'AI parsed type is pengeluaran');

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed with error:', err);
  process.exit(1);
});
