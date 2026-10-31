/**
 * Centralized Environment Configuration & Defaults
 */

import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'tatadana-super-secret-key-wib-2026',
  encryptionKey: process.env.ENCRYPTION_KEY || 'tatadana-32-char-encryption-key!',
  timezone: 'Asia/Jakarta',

  // Dev bypass
  devOtpCode: process.env.DEV_OTP_CODE || '123456',
  devMode: process.env.NODE_ENV !== 'production',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'tatadana-exports',

  // Midtrans
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-tatadana-demo-key',
  midtransClientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-tatadana-demo-key',
  midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || 'td-webhook-secret-2026',

  // AI Providers
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',

  // Plan Specs
  plans: {
    starter: {
      name: 'Starter',
      price: 49000,
      billingPeriod: 'monthly',
      maxMonthlyTransactions: 50,
      maxWallets: 3,
      maxCustomCategories: 5,
      features: {
        receiptOcr: false,
        voiceStt: false,
        financialAdvisor: false,
        exports: false
      }
    },
    pro: {
      name: 'Pro',
      price: 99000,
      billingPeriod: 'lifetime',
      maxMonthlyTransactions: Infinity,
      maxWallets: Infinity,
      maxCustomCategories: Infinity,
      features: {
        receiptOcr: true,
        voiceStt: true,
        financialAdvisor: true,
        exports: true
      }
    }
  }
};
