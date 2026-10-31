/**
 * Configuration and External Service Connectors
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

dotenv.config();

export { env };
export * from './supabase.js';
export * from './midtrans.js';

export const config = {
  port: process.env.PORT || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'tatadana-super-secret-key-wib-2026',
  encryptionKey: process.env.ENCRYPTION_KEY || 'tatadana-32-char-encryption-key!',
  timezone: 'Asia/Jakarta',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'tatadana-exports',

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || 'td-webhook-secret-2026',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',

  // Midtrans
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY || '',
  midtransClientKey: process.env.MIDTRANS_CLIENT_KEY || '',
  midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',

  // AI Providers
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',

  // Plan Pricing
  pricing: {
    starter: {
      price: 49000,
      period: 'bulan',
      monthlyTxLimit: 50,
      maxWallets: 3,
      maxBudgets: 5,
      allowReceiptOcr: false,
      allowVoiceStt: false,
      allowAiAdvisor: false,
      allowExport: false
    },
    pro: {
      price: 99000,
      period: 'sekali bayar seumur hidup (lifetime)',
      monthlyTxLimit: Infinity,
      maxWallets: Infinity,
      maxBudgets: Infinity,
      allowReceiptOcr: true,
      allowVoiceStt: true,
      allowAiAdvisor: true,
      allowExport: true
    }
  }
};
