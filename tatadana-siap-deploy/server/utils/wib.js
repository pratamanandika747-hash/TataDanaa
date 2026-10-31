// server/utils/wib.js
// Precision WIB (Asia/Jakarta, UTC+7) Date and Time Utilities

/**
 * Returns current timestamp in WIB as an ISO string
 */
function getWIBDate(date = new Date()) {
  const d = new Date(date);
  // Add 7 hours to UTC
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wibTime = new Date(utc + (3600000 * 7));
  return wibTime;
}

/**
 * Format date in Indonesian WIB format:
 * Example: "Sabtu, 10 Okt 2026 — 12:30 WIB"
 */
function formatWIBFull(date = new Date()) {
  const wib = getWIBDate(date);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const dayName = days[wib.getDay()];
  const day = wib.getDate();
  const monthName = months[wib.getMonth()];
  const year = wib.getFullYear();
  const hours = String(wib.getHours()).padStart(2, '0');
  const minutes = String(wib.getMinutes()).padStart(2, '0');

  return `${dayName}, ${day} ${monthName} ${year} — ${hours}:${minutes} WIB`;
}

/**
 * Format currency in Indonesian Rupiah
 * Example: 15000 -> "Rp15.000"
 */
function formatRupiah(number) {
  const val = Math.round(Number(number) || 0);
  return 'Rp' + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Get current year-month in WIB: "YYYY-MM"
 */
function getCurrentMonthWIB() {
  const wib = getWIBDate();
  const year = wib.getFullYear();
  const month = String(wib.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

module.exports = {
  getWIBDate,
  formatWIBFull,
  formatRupiah,
  getCurrentMonthWIB
};
