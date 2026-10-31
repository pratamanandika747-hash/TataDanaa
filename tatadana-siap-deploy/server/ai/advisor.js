// server/ai/advisor.js
// Proactive AI Financial Advisor (Pro Feature)
// Evaluates triggers:
// 1. Expense for category increased > 50% vs last week
// 2. Total monthly expense > 80% of total income
// 3. Single large expense > 20% of monthly category budget

const { formatRupiah } = require('../utils/wib');

function checkFinancialAdvisorAlert({
  userName = 'Kawan TataDana',
  transactionAmount,
  categoryName,
  categoryBudget = 0,
  currentCategorySpent = 0,
  monthlyTotalExpense = 0,
  monthlyTotalIncome = 0,
  isProUser = true
}) {
  if (!isProUser) return null;

  // Trigger 3: Single large expense > 20% of category budget
  if (categoryBudget > 0 && transactionAmount >= (categoryBudget * 0.20)) {
    const pct = Math.round((transactionAmount / categoryBudget) * 100);
    return {
      triggered: true,
      reason: 'single_large_expense',
      message: `🤖 Financial Advisor
Hei ${userName}! Pengeluaran barusan untuk ${categoryName} sebesar ${formatRupiah(transactionAmount)} memakan ${pct}% dari seluruh budget ${categoryName} bulan ini.
💡 Saran: Tahan dulu pengeluaran non-primer di pos ini sampai minggu depan agar budgetmu tetap aman!`
    };
  }

  // Trigger 2: Total expense already > 80% of total income
  if (monthlyTotalIncome > 0 && monthlyTotalExpense >= (monthlyTotalIncome * 0.80)) {
    const ratio = Math.round((monthlyTotalExpense / monthlyTotalIncome) * 100);
    return {
      triggered: true,
      reason: 'expense_income_ratio',
      message: `🤖 Financial Advisor
Hei ${userName}! Peringatan cashflow: Total pengeluaran bulan ini sudah mencapai ${ratio}% dari total pemasukan kamu.
💡 Saran: Aktifkan mode hemat ketat untuk sisa bulan ini dan prioritaskan kebutuhan esensial saja.`
    };
  }

  // Trigger 1: Category spent reached 80% of budget
  if (categoryBudget > 0 && (currentCategorySpent / categoryBudget) >= 0.80) {
    const percent = Math.round((currentCategorySpent / categoryBudget) * 100);
    return {
      triggered: true,
      reason: 'budget_threshold',
      message: `🤖 Financial Advisor
Hei ${userName}! Kuota ${categoryName} sudah terpakai ${percent}%. Sisa budget: ${formatRupiah(Math.max(0, categoryBudget - currentCategorySpent))}.
💡 Saran: Sisihkan dana cadangan atau cari alternatif hemat untuk pengeluaran ${categoryName} berikutnya.`
    };
  }

  return null;
}

module.exports = {
  checkFinancialAdvisorAlert
};
