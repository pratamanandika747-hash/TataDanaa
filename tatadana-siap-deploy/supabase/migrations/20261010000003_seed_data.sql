-- ====================================================================
-- Migration: 20261010000003_seed_data.sql
-- Description: Default seed data for AI Providers, Presets & Onboarding Trigger
-- Timezone: Asia/Jakarta (WIB, UTC+7)
-- ====================================================================

-- 1. AI MULTI-PROVIDER PRESETS (Gemini Flash as primary, with failover mode)
INSERT INTO public.ai_providers (provider_name, is_enabled, is_primary, api_key_encrypted, model_name, mode, priority_order)
VALUES 
    ('gemini', true, true, 'ENCRYPTED_DEMO_GEMINI_KEY', 'gemini-2.5-flash', 'failover', 1),
    ('openai', true, false, 'ENCRYPTED_DEMO_OPENAI_KEY', 'gpt-4o-mini', 'failover', 2),
    ('deepseek', true, false, 'ENCRYPTED_DEMO_DEEPSEEK_KEY', 'deepseek-chat', 'failover', 3)
ON CONFLICT (provider_name) DO UPDATE 
SET is_primary = EXCLUDED.is_primary, model_name = EXCLUDED.model_name;

-- 2. SYSTEM PRESET CATEGORIES (Available globally to all users)
INSERT INTO public.categories (user_id, name, type, icon, color, is_custom)
VALUES
    (NULL, 'Makanan & Minuman', 'expense', '🍜', '#F97316', false),
    (NULL, 'Transportasi', 'expense', '🚗', '#3B82F6', false),
    (NULL, 'Tagihan & Utilitas', 'expense', '🏠', '#8B5CF6', false),
    (NULL, 'Belanja Kebutuhan', 'expense', '👕', '#EC4899', false),
    (NULL, 'Hiburan & Hobi', 'expense', '🎮', '#10B981', false),
    (NULL, 'Kesehatan', 'expense', '💊', '#EF4444', false),
    (NULL, 'Pendidikan & Buku', 'expense', '📚', '#6366F1', false),
    (NULL, 'Gaji & Pendapatan', 'income', '💰', '#059669', false),
    (NULL, 'Bonus & Freelance', 'income', '💼', '#0D9488', false)
ON CONFLICT DO NOTHING;

-- 3. SEED NEW USER ONBOARDING FUNCTION
CREATE OR REPLACE FUNCTION public.seed_new_user_data(new_user_id UUID) 
RETURNS VOID AS $$
BEGIN
    -- 1. Create Default Wallets if user has none
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = new_user_id) THEN
        INSERT INTO public.wallets (user_id, name, wallet_type, balance, is_default_telegram, color, icon)
        VALUES
            (new_user_id, 'Tunai (Cash)', 'cash', 250000, false, '#10B981', '💵'),
            (new_user_id, 'BCA Tabungan', 'bank', 3500000, true, '#FF5B00', '🏦'),
            (new_user_id, 'GoPay', 'ewallet', 150000, false, '#00AED6', '📱');
    END IF;

    -- 2. Create Initial User Custom Categories
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = new_user_id) THEN
        INSERT INTO public.categories (user_id, name, type, icon, color, is_custom)
        VALUES
            (new_user_id, 'Makanan & Minuman', 'expense', '🍜', '#F97316', true),
            (new_user_id, 'Transportasi', 'expense', '🚗', '#3B82F6', true),
            (new_user_id, 'Tagihan & Utilitas', 'expense', '🏠', '#8B5CF6', true),
            (new_user_id, 'Belanja Kebutuhan', 'expense', '👕', '#EC4899', true),
            (new_user_id, 'Hiburan & Hobi', 'expense', '🎮', '#10B981', true),
            (new_user_id, 'Kesehatan', 'expense', '💊', '#EF4444', true),
            (new_user_id, 'Pendidikan & Buku', 'expense', '📚', '#6366F1', true),
            (new_user_id, 'Gaji & Pendapatan', 'income', '💰', '#059669', true),
            (new_user_id, 'Bonus & Freelance', 'income', '💼', '#0D9488', true);
    END IF;

    -- 3. Create Initial Monthly Budgets for the current month
    IF NOT EXISTS (SELECT 1 FROM public.budgets WHERE user_id = new_user_id) THEN
        INSERT INTO public.budgets (user_id, category_id, amount, month_period)
        SELECT 
            new_user_id, 
            c.id, 
            CASE 
                WHEN c.name = 'Makanan & Minuman' THEN 1500000
                WHEN c.name = 'Transportasi' THEN 600000
                WHEN c.name = 'Tagihan & Utilitas' THEN 1000000
                ELSE 500000
            END,
            TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')
        FROM public.categories c
        WHERE c.user_id = new_user_id AND c.type = 'expense'
        LIMIT 4
        ON CONFLICT DO NOTHING;
    END IF;

    -- 4. Create Initial Starter Subscription
    IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = new_user_id) THEN
        INSERT INTO public.subscriptions (user_id, plan_tier, billing_type, status, monthly_tx_limit, wallet_limit, budget_limit)
        VALUES (new_user_id, 'starter', 'monthly', 'active', 50, 3, 5);
    END IF;

    -- 5. Initialize Telegram Session
    IF NOT EXISTS (SELECT 1 FROM public.telegram_sessions WHERE user_id = new_user_id) THEN
        INSERT INTO public.telegram_sessions (user_id, connection_status, reminder_enabled, reminder_frequency)
        VALUES (new_user_id, 'disconnected', true, 1);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 4. ATTACH AUTOMATIC ONBOARDING TRIGGER ON PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.seed_new_user_data(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_profile_onboarding ON public.profiles;
CREATE TRIGGER trg_profile_onboarding
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_onboarding();

