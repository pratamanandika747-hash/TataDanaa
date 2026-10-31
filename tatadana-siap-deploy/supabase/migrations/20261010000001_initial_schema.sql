-- Migration: 20261010000001_initial_schema.sql
-- Description: Core schema for TataDana Fintech Personal Finance Platform
-- Timezone: WIB (Asia/Jakarta, UTC+7)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (User Profile & Phone Authentication)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE NOT NULL,
    phone_verified BOOLEAN DEFAULT FALSE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    default_currency TEXT DEFAULT 'IDR',
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 2. Subscriptions Table (Starter vs Pro)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_tier TEXT DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro')),
    billing_type TEXT DEFAULT 'monthly' CHECK (billing_type IN ('monthly', 'lifetime')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled')),
    monthly_tx_limit INT DEFAULT 50, -- 50 for Starter, -1 for unlimited Pro
    wallet_limit INT DEFAULT 3,      -- 3 for Starter, -1 for unlimited Pro
    budget_limit INT DEFAULT 5,      -- 5 for Starter, -1 for unlimited Pro
    ai_ocr_enabled BOOLEAN DEFAULT FALSE,      -- Pro only
    ai_advisor_enabled BOOLEAN DEFAULT FALSE,  -- Pro only
    advanced_export_enabled BOOLEAN DEFAULT FALSE, -- Pro only
    started_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 3. Wallets Table (Multi-Wallet: Cash, BCA, Mandiri, GoPay, OVO, etc.)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    wallet_type TEXT DEFAULT 'bank' CHECK (wallet_type IN ('cash', 'bank', 'ewallet', 'investment')),
    account_number TEXT,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    is_default_telegram BOOLEAN DEFAULT FALSE,
    color TEXT DEFAULT '#FF5B00',
    icon TEXT DEFAULT '👛',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 4. Categories Table (Income / Expense categories with emoji & color)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'expense' CHECK (type IN ('income', 'expense', 'pemasukan', 'pengeluaran')),
    icon TEXT DEFAULT '🏷️',
    color TEXT DEFAULT '#FF5B00',
    is_custom BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 5. Budgets Table (Monthly Budget per category)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL,
    month_period TEXT NOT NULL, -- Format: YYYY-MM in WIB
    spent_amount NUMERIC(15, 2) DEFAULT 0.00,
    alert_80_sent BOOLEAN DEFAULT FALSE,
    alert_100_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 6. Transactions Table (Income, Expense, Transfer, Receipt Parent)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    target_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL, -- for transfers
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'pemasukan', 'pengeluaran')),
    amount NUMERIC(15, 2) NOT NULL,
    notes TEXT,
    merchant_name TEXT,
    source TEXT DEFAULT 'web' CHECK (source IN ('web', 'telegram_text', 'telegram_voice', 'telegram_photo')),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    is_receipt_parent BOOLEAN DEFAULT FALSE,
    raw_transcript TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 7. Receipt Items Table (Items inside multi-item receipt transaction)
CREATE TABLE IF NOT EXISTS public.receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1.00,
    price_per_item NUMERIC(15, 2) NOT NULL,
    total_amount NUMERIC(15, 2) NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 8. Telegram Sessions Table (User bot linkage & settings)
CREATE TABLE IF NOT EXISTS public.telegram_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    telegram_user_id BIGINT UNIQUE,
    telegram_chat_id BIGINT,
    bot_token TEXT, -- Encrypted token
    connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected', 'testing', 'connected', 'error')),
    reminder_enabled BOOLEAN DEFAULT TRUE,
    reminder_frequency INT DEFAULT 1 CHECK (reminder_frequency IN (1, 2)),
    reminder_time_1 TIME DEFAULT '19:00:00',
    reminder_time_2 TIME DEFAULT '12:00:00',
    last_interaction_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 9. Telegram Webhook Idempotency Table (Deduplication)
CREATE TABLE IF NOT EXISTS public.telegram_webhook_idempotency (
    update_id BIGINT PRIMARY KEY,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    processed_status TEXT DEFAULT 'processed' CHECK (processed_status IN ('processing', 'processed', 'error')),
    error_message TEXT
);

-- 10. AI Providers Table (Multi-Provider: Gemini, OpenAI, DeepSeek)
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name TEXT UNIQUE NOT NULL CHECK (provider_name IN ('gemini', 'openai', 'deepseek')),
    is_enabled BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    api_key_encrypted TEXT NOT NULL,
    model_name TEXT NOT NULL,
    mode TEXT DEFAULT 'single' CHECK (mode IN ('single', 'failover')),
    priority_order INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 11. AI Logs Table (Monitoring latency, cost, and tokens)
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider_name TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('text_parse', 'voice_stt', 'receipt_ocr', 'financial_advisor')),
    status TEXT NOT NULL CHECK (status IN ('success', 'fallback', 'failed')),
    prompt_tokens INT DEFAULT 0,
    completion_tokens INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    error_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 12. Admin Audit Logs Table (Privacy & Transaction Inspection Auditing)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL CHECK (action_type IN ('impersonate', 'view_transactions', 'update_plan', 'approve_payment', 'reject_payment')),
    reason TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 13. Payment Transactions Table (Midtrans Integration)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id TEXT UNIQUE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    plan_tier TEXT NOT NULL CHECK (plan_tier IN ('starter', 'pro')),
    payment_method TEXT DEFAULT 'midtrans_snap' CHECK (payment_method IN ('midtrans_snap', 'manual_transfer')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settlement', 'deny', 'expired', 'cancel', 'refund')),
    payment_proof_url TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- 14. Report Exports Table (PDF / Excel Downloads & History)
CREATE TABLE IF NOT EXISTS public.report_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'xlsx')),
    storage_path TEXT NOT NULL,
    signed_url TEXT,
    signed_url_expires_at TIMESTAMP WITH TIME ZONE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_records INT DEFAULT 0,
    file_size_bytes BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Jakarta')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets(user_id, month_period);
CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_user_cat_month ON public.budgets(user_id, category_id, month_period);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_tg_uid ON public.telegram_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_tx ON public.receipt_items(transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_system_name ON public.categories(name) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name ON public.categories(user_id, name) WHERE user_id IS NOT NULL;


