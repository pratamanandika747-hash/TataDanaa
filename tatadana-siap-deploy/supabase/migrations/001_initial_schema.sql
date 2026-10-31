-- ====================================================================
-- Migration: 001_initial_schema.sql
-- Status: Consolidated into canonical migration 20261010000001_initial_schema.sql
-- Timezone: Asia/Jakarta (WIB, UTC+7)
-- ====================================================================

-- Ensure required PostgreSQL extensions are enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Timezone default session setting
SET timezone = 'Asia/Jakarta';
