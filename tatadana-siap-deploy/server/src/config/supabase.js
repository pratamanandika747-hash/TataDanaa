/**
 * Supabase Client Configuration
 * Supports service role client for backend administrative tasks.
 */

import { env } from './env.js';

let createClientFn = null;
try {
  const supabaseModule = await import('@supabase/supabase-js');
  createClientFn = supabaseModule.createClient;
} catch {
  createClientFn = null;
}

const keyToUse = env.supabaseServiceRoleKey || env.supabaseAnonKey;
export const isSupabaseConfigured = Boolean(
  createClientFn && env.supabaseUrl && keyToUse && env.supabaseUrl.startsWith('http')
);

export const supabase = isSupabaseConfigured
  ? createClientFn(env.supabaseUrl, keyToUse, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;
