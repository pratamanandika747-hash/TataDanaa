-- ====================================================================
-- Migration: 20261010000002_rls_and_policies.sql
-- Description: Row Level Security (RLS) Policies, Triggers & Automatic Reconciliations
-- Timezone: Asia/Jakarta (WIB, UTC+7)
-- ====================================================================

-- 1. HELPER FUNCTIONS
-- Helper function to check if current authenticated user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Helper function to calculate current WIB timestamp
CREATE OR REPLACE FUNCTION public.current_wib()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN (NOW() AT TIME ZONE 'Asia/Jakarta');
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_telegram_sessions_updated_at ON public.telegram_sessions;
CREATE TRIGGER trg_telegram_sessions_updated_at BEFORE UPDATE ON public.telegram_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payment_transactions_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_payment_transactions_updated_at BEFORE UPDATE ON public.payment_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. WALLET BALANCE RECONCILIATION TRIGGER
-- Automatically update wallet balances on INSERT, UPDATE, DELETE of transactions
CREATE OR REPLACE FUNCTION public.sync_wallet_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_month TEXT;
    v_old_month TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.type IN ('expense', 'pengeluaran') THEN
            UPDATE public.wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
            v_month := TO_CHAR(COALESCE(NEW.transaction_date, NOW() AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM');
            UPDATE public.budgets 
            SET spent_amount = spent_amount + NEW.amount 
            WHERE user_id = NEW.user_id AND category_id = NEW.category_id AND month_period = v_month;
        ELSIF NEW.type IN ('income', 'pemasukan') THEN
            UPDATE public.wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
        ELSIF NEW.type = 'transfer' AND NEW.target_wallet_id IS NOT NULL THEN
            UPDATE public.wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
            UPDATE public.wallets SET balance = balance + NEW.amount WHERE id = NEW.target_wallet_id;
        END IF;
        RETURN NEW;

    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.type IN ('expense', 'pengeluaran') THEN
            UPDATE public.wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
            v_old_month := TO_CHAR(COALESCE(OLD.transaction_date, NOW() AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM');
            UPDATE public.budgets 
            SET spent_amount = GREATEST(0.00, spent_amount - OLD.amount)
            WHERE user_id = OLD.user_id AND category_id = OLD.category_id AND month_period = v_old_month;
        ELSIF OLD.type IN ('income', 'pemasukan') THEN
            UPDATE public.wallets SET balance = balance - OLD.amount WHERE id = OLD.wallet_id;
        ELSIF OLD.type = 'transfer' AND OLD.target_wallet_id IS NOT NULL THEN
            UPDATE public.wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
            UPDATE public.wallets SET balance = balance - OLD.amount WHERE id = OLD.target_wallet_id;
        END IF;
        RETURN OLD;

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Revert OLD impact
        IF OLD.type IN ('expense', 'pengeluaran') THEN
            UPDATE public.wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
            v_old_month := TO_CHAR(COALESCE(OLD.transaction_date, NOW() AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM');
            UPDATE public.budgets 
            SET spent_amount = GREATEST(0.00, spent_amount - OLD.amount)
            WHERE user_id = OLD.user_id AND category_id = OLD.category_id AND month_period = v_old_month;
        ELSIF OLD.type IN ('income', 'pemasukan') THEN
            UPDATE public.wallets SET balance = balance - OLD.amount WHERE id = OLD.wallet_id;
        ELSIF OLD.type = 'transfer' AND OLD.target_wallet_id IS NOT NULL THEN
            UPDATE public.wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
            UPDATE public.wallets SET balance = balance - OLD.amount WHERE id = OLD.target_wallet_id;
        END IF;

        -- Apply NEW impact
        IF NEW.type IN ('expense', 'pengeluaran') THEN
            UPDATE public.wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
            v_month := TO_CHAR(COALESCE(NEW.transaction_date, NOW() AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM');
            UPDATE public.budgets 
            SET spent_amount = spent_amount + NEW.amount 
            WHERE user_id = NEW.user_id AND category_id = NEW.category_id AND month_period = v_month;
        ELSIF NEW.type IN ('income', 'pemasukan') THEN
            UPDATE public.wallets SET balance = balance + NEW.amount WHERE id = NEW.wallet_id;
        ELSIF NEW.type = 'transfer' AND NEW.target_wallet_id IS NOT NULL THEN
            UPDATE public.wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;
            UPDATE public.wallets SET balance = balance + NEW.amount WHERE id = NEW.target_wallet_id;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_wallet_balance ON public.transactions;
CREATE TRIGGER trg_sync_wallet_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_balance();

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_webhook_idempotency ENABLE ROW LEVEL SECURITY;


-- 4.1 Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR is_admin());

-- 4.2 Subscriptions Policies
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- 4.3 Wallets Policies
DROP POLICY IF EXISTS "Users can manage own wallets" ON public.wallets;
CREATE POLICY "Users can manage own wallets" ON public.wallets
    FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 4.4 Categories Policies (Allows reading system preset categories)
DROP POLICY IF EXISTS "Users can manage own categories" ON public.categories;
CREATE POLICY "Users can view categories" ON public.categories
    FOR SELECT USING (is_custom = false OR auth.uid() = user_id OR is_admin());

CREATE POLICY "Users can insert custom categories" ON public.categories
    FOR INSERT WITH CHECK ((auth.uid() = user_id AND is_custom = true) OR is_admin());

CREATE POLICY "Users can update custom categories" ON public.categories
    FOR UPDATE USING ((auth.uid() = user_id AND is_custom = true) OR is_admin());

CREATE POLICY "Users can delete custom categories" ON public.categories
    FOR DELETE USING ((auth.uid() = user_id AND is_custom = true) OR is_admin());

-- 4.5 Budgets Policies
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;
CREATE POLICY "Users can manage own budgets" ON public.budgets
    FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 4.6 Transactions Policies
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions" ON public.transactions
    FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 4.7 Receipt Items Policies
DROP POLICY IF EXISTS "Users can manage own receipt items" ON public.receipt_items;
CREATE POLICY "Users can manage own receipt items" ON public.receipt_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.transactions t
            WHERE t.id = public.receipt_items.transaction_id
            AND (t.user_id = auth.uid() OR is_admin())
        )
    );

-- 4.8 Telegram Sessions Policies
DROP POLICY IF EXISTS "Users can view and update own telegram session" ON public.telegram_sessions;
CREATE POLICY "Users can view and update own telegram session" ON public.telegram_sessions
    FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 4.9 Report Exports Policies
DROP POLICY IF EXISTS "Users can view and manage own report exports" ON public.report_exports;
CREATE POLICY "Users can view and manage own report exports" ON public.report_exports
    FOR ALL USING (auth.uid() = user_id OR is_admin());

-- 4.10 Admin-Only Audit & AI Tables
DROP POLICY IF EXISTS "Admin full access to AI Providers" ON public.ai_providers;
CREATE POLICY "Admin full access to AI Providers" ON public.ai_providers
    FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Admin view AI Logs" ON public.ai_logs;
CREATE POLICY "Admin view AI Logs" ON public.ai_logs
    FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admin view Audit Logs" ON public.admin_audit_logs;
CREATE POLICY "Admin view Audit Logs" ON public.admin_audit_logs
    FOR SELECT USING (is_admin());

-- 4.11 Payment Transactions Policies
DROP POLICY IF EXISTS "Users can view own payments" ON public.payment_transactions;
CREATE POLICY "Users can view own payments" ON public.payment_transactions
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "Users can insert own payments" ON public.payment_transactions;
CREATE POLICY "Users can insert own payments" ON public.payment_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "Admin full access to payments" ON public.payment_transactions;
CREATE POLICY "Admin full access to payments" ON public.payment_transactions
    FOR ALL USING (is_admin());

-- 4.12 Telegram Webhook Idempotency Policies
DROP POLICY IF EXISTS "Admin full access to webhook idempotency" ON public.telegram_webhook_idempotency;
CREATE POLICY "Admin full access to webhook idempotency" ON public.telegram_webhook_idempotency
    FOR ALL USING (is_admin());

