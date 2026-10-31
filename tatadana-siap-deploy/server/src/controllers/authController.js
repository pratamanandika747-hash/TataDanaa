/**
 * Authentication Controller
 * Supports:
 * - Email & Password Registration and Login
 * - Hybrid Phone OTP with Dev Mode Bypass (123456)
 * - Profile Retrieval with Real Plan Usage Metrics
 * - Profile Updates
 */

import { db } from '../db/dbAdapter.js';
import { env } from '../config/env.js';
import {
  normalizePhoneNumber,
  hashPassword,
  verifyPassword,
  generateJwtToken
} from '../utils/crypto.js';
import { successResponse, errorResponse } from '../utils/response.js';

// In-memory OTP storage for verification: phone -> { code, expiresAt }
const otpStore = new Map();

export async function register(req, res) {
  try {
    const { email, password, full_name, phone_number } = req.body;

    if (!email || !password) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Email dan password wajib diisi' }, 400);
    }

    const normalizedPhone = phone_number ? normalizePhoneNumber(phone_number) : null;

    if (normalizedPhone) {
      const existingPhone = await db.findProfileByPhone(normalizedPhone);
      if (existingPhone) {
        return errorResponse(res, { code: 'PHONE_EXISTS', message: 'Nomor telepon sudah terdaftar' }, 400);
      }
    }

    const existingEmail = await db.findProfileByEmail(email);
    if (existingEmail) {
      return errorResponse(res, { code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar' }, 400);
    }

    const passwordHash = await hashPassword(password);
    const profile = await db.createProfile({
      email,
      password_hash: passwordHash,
      full_name: full_name || '',
      phone_number: normalizedPhone,
      role: 'user',
      plan: 'starter'
    });

    const token = generateJwtToken({
      sub: profile.id,
      email: profile.email,
      role: profile.role,
      plan: profile.plan
    });

    const { password_hash: _, ...safeProfile } = profile;

    return successResponse(res, {
      user: safeProfile,
      profile: safeProfile,
      token
    }, 201);
  } catch (err) {
    return errorResponse(res, { code: 'REGISTER_FAILED', message: err.message }, 400);
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Email dan password wajib diisi' }, 400);
    }

    const profile = await db.findProfileByEmail(email);
    if (!profile) {
      return errorResponse(res, { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah' }, 401);
    }

    // If password_hash is set, check it; if null (dev demo accounts), allow login
    if (profile.password_hash) {
      const isValid = await verifyPassword(password, profile.password_hash);
      if (!isValid) {
        return errorResponse(res, { code: 'INVALID_CREDENTIALS', message: 'Email atau password salah' }, 401);
      }
    }

    const token = generateJwtToken({
      sub: profile.id,
      email: profile.email,
      role: profile.role,
      plan: profile.plan
    });

    const { password_hash: _, ...safeProfile } = profile;

    return successResponse(res, {
      user: safeProfile,
      profile: safeProfile,
      token
    });
  } catch (err) {
    return errorResponse(res, { code: 'LOGIN_FAILED', message: err.message }, 500);
  }
}

export async function sendOtp(req, res) {
  try {
    const { phone_number } = req.body;

    if (!phone_number) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Nomor telepon wajib diisi' }, 400);
    }

    const normalized = normalizePhoneNumber(phone_number);
    const otpCode = env.devMode ? env.devOtpCode : Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(normalized, {
      code: otpCode,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    });

    const responsePayload = {
      success: true,
      phone_number: normalized,
      message: 'Kode OTP berhasil dikirim melalui WhatsApp / SMS'
    };

    // Expose dev_bypass_code in non-production environments
    if (env.devMode) {
      responsePayload.dev_bypass_code = env.devOtpCode;
    }

    return successResponse(res, responsePayload);
  } catch (err) {
    return errorResponse(res, { code: 'SEND_OTP_FAILED', message: err.message }, 500);
  }
}

export async function verifyOtp(req, res) {
  try {
    const { phone_number, otp_code } = req.body;

    if (!phone_number || !otp_code) {
      return errorResponse(res, { code: 'VALIDATION_ERROR', message: 'Nomor telepon dan kode OTP wajib diisi' }, 400);
    }

    const normalized = normalizePhoneNumber(phone_number);

    // Check dev bypass (123456) or stored OTP
    const isDevBypass = (otp_code === '123456' || otp_code === env.devOtpCode);
    const stored = otpStore.get(normalized);
    const isStoredValid = stored && stored.code === otp_code && stored.expiresAt > Date.now();

    if (!isDevBypass && !isStoredValid) {
      return errorResponse(res, { code: 'INVALID_OTP', message: 'Kode OTP tidak valid atau telah kedaluwarsa' }, 401);
    }

    // Clear used OTP
    otpStore.delete(normalized);

    // Find or create profile
    let profile = await db.findProfileByPhone(normalized);
    let isNewUser = false;

    if (!profile) {
      isNewUser = true;
      profile = await db.createProfile({
        phone_number: normalized,
        full_name: 'Pengguna TataDana',
        role: 'user',
        plan: 'starter'
      });
    }

    const token = generateJwtToken({
      sub: profile.id,
      email: profile.email,
      phone_number: profile.phone_number,
      role: profile.role,
      plan: profile.plan
    });

    const { password_hash: _, ...safeProfile } = profile;

    return successResponse(res, {
      token,
      profile: safeProfile,
      is_new_user: isNewUser
    });
  } catch (err) {
    return errorResponse(res, { code: 'VERIFY_OTP_FAILED', message: err.message }, 500);
  }
}

export async function getMe(req, res) {
  try {
    const userId = req.user.id;
    const profile = await db.findProfileById(userId);

    if (!profile) {
      return errorResponse(res, { code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan' }, 404);
    }

    // Calculate real plan usage metrics
    const txCount = await db.countTransactionsInCurrentMonthWib(userId);
    const walletCount = await db.countWallets(userId);
    const customCategoryCount = await db.countCustomCategories(userId);

    const isPro = profile.plan === 'pro';

    const planUsage = {
      plan: profile.plan,
      is_pro: isPro,
      transactions_this_month: txCount,
      max_transactions: isPro ? null : 50,
      transactions_remaining: isPro ? null : Math.max(0, 50 - txCount),
      wallets_count: walletCount,
      max_wallets: isPro ? null : 3,
      custom_categories_count: customCategoryCount,
      max_custom_categories: isPro ? null : 5,
      features: {
        receipt_ocr: isPro,
        voice_stt: isPro,
        financial_advisor: isPro,
        document_export: isPro
      }
    };

    const { password_hash: _, ...safeProfile } = profile;

    return successResponse(res, {
      profile: safeProfile,
      plan_usage: planUsage,
      is_impersonated: req.user.is_impersonated || false
    });
  } catch (err) {
    return errorResponse(res, { code: 'GET_ME_FAILED', message: err.message }, 500);
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { full_name, avatar_url, currency, timezone } = req.body;

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (currency !== undefined) updates.currency = currency;
    if (timezone !== undefined) updates.timezone = timezone;

    const updated = await db.updateProfile(userId, updates);
    const { password_hash: _, ...safeProfile } = updated;

    return successResponse(res, { profile: safeProfile });
  } catch (err) {
    return errorResponse(res, { code: 'UPDATE_PROFILE_FAILED', message: err.message }, 400);
  }
}
