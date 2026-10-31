-- ====================================================================
-- Migration: 20261031000001_harden_user_registration_approval.sql
-- Description: Harden User Registration, Password Hash, Approval Status, and Super Admin Indexing
-- Engine: PostgreSQL 14+ (Supabase)
-- Timezone: Asia/Jakarta (WIB, UTC+7)
-- ====================================================================

-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Add safe, non-destructive columns to public.profiles if not existing
DO $$
BEGIN
    -- Add password_hash column (scrypt / pgcrypto hash)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN password_hash TEXT;
    END IF;

    -- Add approval_status column with pending/approved/rejected workflow
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;

    -- Add whatsapp_verified column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'whatsapp_verified'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN whatsapp_verified BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add plan_tier column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan_tier'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN plan_tier TEXT DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'pro'));
    END IF;
END $$;

-- 3. Synchronize existing verified users to have approval_status = 'approved'
UPDATE public.profiles
SET approval_status = 'approved',
    whatsapp_verified = true
WHERE phone_verified = true AND (approval_status IS NULL OR approval_status = 'pending');

-- 4. High-Performance Indexes for Super Admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_approval_status ON public.profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at_desc ON public.profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 5. Stored Procedure for atomic user registration with pending status
CREATE OR REPLACE FUNCTION public.register_new_user(
    p_full_name TEXT,
    p_phone_number TEXT,
    p_email TEXT,
    p_password_hash TEXT,
    p_role TEXT DEFAULT 'user'
)
RETURNS TABLE (
    user_id UUID,
    full_name TEXT,
    phone_number TEXT,
    email TEXT,
    role TEXT,
    approval_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_user_id UUID;
    v_created_at TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'Asia/Jakarta');
BEGIN
    -- Check unique email if provided
    IF p_email IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(p_email)) THEN
        RAISE EXCEPTION 'Email % sudah terdaftar', p_email USING ERRCODE = '23505';
    END IF;

    -- Check unique phone number
    IF EXISTS (SELECT 1 FROM public.profiles WHERE phone_number = p_phone_number) THEN
        RAISE EXCEPTION 'Nomor telepon % sudah terdaftar', p_phone_number USING ERRCODE = '23505';
    END IF;

    -- Insert profile with pending approval status
    INSERT INTO public.profiles (
        full_name,
        phone_number,
        email,
        password_hash,
        role,
        plan_tier,
        phone_verified,
        whatsapp_verified,
        approval_status,
        created_at,
        updated_at
    ) VALUES (
        p_full_name,
        p_phone_number,
        LOWER(p_email),
        p_password_hash,
        p_role,
        'starter',
        FALSE,
        FALSE,
        'pending',
        v_created_at,
        v_created_at
    )
    RETURNING id INTO v_user_id;

    -- Initialize starter wallet with 0 balance
    INSERT INTO public.wallets (
        user_id,
        name,
        wallet_type,
        balance,
        is_default_telegram,
        color,
        icon,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        'Dompet Utama',
        'cash',
        0.00,
        TRUE,
        '#FF5B00',
        '💵',
        v_created_at,
        v_created_at
    );

    -- Log audit trail for registration
    INSERT INTO public.admin_audit_logs (
        admin_id,
        target_user_id,
        action_type,
        reason,
        created_at
    ) VALUES (
        NULL,
        v_user_id,
        'impersonate',
        'User registration queued for superadmin approval: ' || p_full_name || ' (' || p_phone_number || ')',
        v_created_at
    );

    RETURN QUERY
    SELECT 
        p.id AS user_id,
        p.full_name,
        p.phone_number,
        p.email,
        p.role,
        p.approval_status,
        p.created_at
    FROM public.profiles p
    WHERE p.id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 6. Stored Procedure for Super Admin Approval
CREATE OR REPLACE FUNCTION public.approve_registered_user(
    p_admin_id UUID,
    p_target_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_superadmin BOOLEAN;
BEGIN
    -- Verify caller is superadmin
    SELECT (role = 'superadmin') INTO v_is_superadmin 
    FROM public.profiles 
    WHERE id = p_admin_id;

    IF v_is_superadmin IS NOT TRUE THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Super Admin yang berhak menyetujui pengguna.' USING ERRCODE = '42501';
    END IF;

    -- Update user status
    UPDATE public.profiles
    SET phone_verified = TRUE,
        whatsapp_verified = TRUE,
        approval_status = 'approved',
        updated_at = (NOW() AT TIME ZONE 'Asia/Jakarta')
    WHERE id = p_target_user_id;

    -- Log audit trail
    INSERT INTO public.admin_audit_logs (
        admin_id,
        target_user_id,
        action_type,
        reason,
        created_at
    ) VALUES (
        p_admin_id,
        p_target_user_id,
        'approve_payment',
        'Superadmin menyetujui pendaftaran dan mengaktifkan akun.',
        (NOW() AT TIME ZONE 'Asia/Jakarta')
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ====================================================================
-- ROLLBACK SCRIPT (Execute only if rolling back this migration):
-- DROP FUNCTION IF EXISTS public.approve_registered_user(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.register_new_user(TEXT, TEXT, TEXT, TEXT, TEXT);
-- DROP INDEX IF EXISTS public.idx_profiles_approval_status;
-- DROP INDEX IF EXISTS public.idx_profiles_role;
-- DROP INDEX IF EXISTS public.idx_profiles_created_at_desc;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS approval_status;
-- ====================================================================
