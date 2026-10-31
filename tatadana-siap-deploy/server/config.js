// server/config.js
// Centralized configuration for TataDana Backend
// All secrets loaded from environment variables with sensible defaults for local development

const path = require('path');
const fs = require('fs');

// Attempt to load .env if present
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  TIMEZONE: 'Asia/Jakarta', // 100% WIB for all transactions & bot replies
  TIMEZONE_OFFSET_HOURS: 7,

  // Telegram Configuration
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL || 'http://localhost:3000',

  // AI Multi-Provider Keys
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',

  // Supabase Configuration
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://demo-tatadana.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'reports',

  // Midtrans Payment Gateway
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-demoKey',
  MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-demoKey',
  MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION === 'true',

  // Dev mode credentials & helpers
  DEV_OTP_CODE: '123456',
  DEV_MODE: true
};
