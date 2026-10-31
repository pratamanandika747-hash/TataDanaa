/**
 * Asia/Jakarta (WIB / UTC+7) Standard Date & Time Utilities
 * TataDana strictly operates on WIB across all transaction math,
 * month period boundaries, reports, and bot timestamps.
 */

export const WIB_OFFSET_HOURS = 7;
export const WIB_OFFSET_MS = WIB_OFFSET_HOURS * 60 * 60 * 1000;
export const TIMEZONE_WIB = 'Asia/Jakarta';

/**
 * Returns a new Date shifted to WIB or current Date.
 */
export function getNowWIB() {
  return new Date();
}

/**
 * Formats a Date or timestamp string into an ISO string with +07:00 timezone offset.
 * Example: "2026-10-10T12:30:00.000+07:00"
 */
export function toWIBISOString(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return new Date().toISOString();
  }

  // Calculate WIB components
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wibDate = new Date(utc + WIB_OFFSET_MS);

  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getDate()).padStart(2, '0');
  const hours = String(wibDate.getHours()).padStart(2, '0');
  const minutes = String(wibDate.getMinutes()).padStart(2, '0');
  const seconds = String(wibDate.getSeconds()).padStart(2, '0');
  const ms = String(wibDate.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+07:00`;
}

/**
 * Returns current month and year in WIB.
 */
export function getCurrentMonthWIB(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + WIB_OFFSET_MS);
  const month = wib.getMonth() + 1; // 1-12
  const year = wib.getFullYear();
  const period = `${year}-${String(month).padStart(2, '0')}`;
  return { month, year, period };
}

/**
 * Returns the ISO string of the very start of the current WIB calendar month (00:00:00.000+07:00).
 */
export function getStartOfCurrentMonthWIB(dateInput = new Date()) {
  const { month, year } = getCurrentMonthWIB(dateInput);
  const m = String(month).padStart(2, '0');
  return `${year}-${m}-01T00:00:00.000+07:00`;
}

/**
 * Returns the ISO string of the very end of the current WIB calendar month (23:59:59.999+07:00).
 */
export function getEndOfCurrentMonthWIB(dateInput = new Date()) {
  const { month, year } = getCurrentMonthWIB(dateInput);
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, '0');
  const d = String(lastDay).padStart(2, '0');
  return `${year}-${m}-${d}T23:59:59.999+07:00`;
}

/**
 * Checks if a date string falls inside the current WIB calendar month.
 */
export function isDateInCurrentMonthWIB(dateStr, referenceDate = new Date()) {
  if (!dateStr) return false;
  const current = getCurrentMonthWIB(referenceDate);
  const target = getCurrentMonthWIB(new Date(dateStr));
  return current.year === target.year && current.month === target.month;
}

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Human-readable WIB formatting for responses, exports, and bot messages.
 * Example: "10 Oktober 2026, 12:30 WIB"
 */
export function formatWIB(dateInput, includeTime = true) {
  if (!dateInput) return '-';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + WIB_OFFSET_MS);

  const day = wib.getDate();
  const monthName = INDO_MONTHS[wib.getMonth()];
  const year = wib.getFullYear();

  if (!includeTime) {
    return `${day} ${monthName} ${year}`;
  }

  const hours = String(wib.getHours()).padStart(2, '0');
  const minutes = String(wib.getMinutes()).padStart(2, '0');

  return `${day} ${monthName} ${year}, ${hours}:${minutes} WIB`;
}

/**
 * Normalizes input date string or object to canonical ISO WIB timestamp.
 */
export function normalizeDateWIB(dateInput) {
  if (!dateInput) return toWIBISOString();
  return toWIBISOString(dateInput);
}

// Aliases for compatibility
export const formatWIBDate = formatWIB;
export const getCurrentWIBPeriod = getCurrentMonthWIB;
export const WIB_TIMEZONE = TIMEZONE_WIB;

