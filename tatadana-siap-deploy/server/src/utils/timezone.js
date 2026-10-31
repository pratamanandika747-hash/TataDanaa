/**
 * Timezone Utility for TataDana
 * Timezone: Asia/Jakarta (WIB, UTC+7)
 */

export const WIB_TIMEZONE = 'Asia/Jakarta';
export const WIB_OFFSET_HOURS = 7;

/**
 * Returns current Date in WIB timezone
 * @returns {Date}
 */
export function getNowWIB() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * WIB_OFFSET_HOURS));
}

/**
 * Formats a date into standard Indonesian WIB date string
 * e.g., "10 Oktober 2026, 14:30 WIB"
 * @param {Date|string|number} dateInput
 * @param {boolean} includeTime
 * @returns {string}
 */
export function formatWIBDate(dateInput = new Date(), includeTime = true) {
  const date = new Date(dateInput);
  const options = {
    timeZone: WIB_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  };

  const formatted = new Intl.DateTimeFormat('id-ID', options).format(date);
  return includeTime ? `${formatted} WIB` : formatted;
}

/**
 * Returns formatted ISO string with +07:00 offset
 * @param {Date|string} dateInput
 * @returns {string}
 */
export function toWIBISOString(dateInput = new Date()) {
  const d = new Date(dateInput);
  const pad = (n) => String(n).padStart(2, '0');
  
  // Calculate WIB components
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (3600000 * WIB_OFFSET_HOURS));
  
  const year = wib.getFullYear();
  const month = pad(wib.getMonth() + 1);
  const day = pad(wib.getDate());
  const hours = pad(wib.getHours());
  const minutes = pad(wib.getMinutes());
  const seconds = pad(wib.getSeconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+07:00`;
}

/**
 * Get current year and month in WIB
 * @returns {{ year: number, month: number }}
 */
export function getCurrentWIBPeriod() {
  const wib = getNowWIB();
  return {
    year: wib.getFullYear(),
    month: wib.getMonth() + 1 // 1-indexed (1-12)
  };
}

export * from './wibDate.js';

