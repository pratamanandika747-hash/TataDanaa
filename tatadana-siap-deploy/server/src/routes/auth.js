/**
 * Auth Routes for TataDana
 * Supports Email/Password, Phone OTP with Dev mode bypass, and Superadmin Impersonation
 */

import { Router } from 'express';
import { inMemoryStore } from '../store/inMemoryStore.js';
import { authMiddleware, requireAdmin } from '../middlewares/auth.js';
import { toWIBISOString } from '../utils/timezone.js';

const router = Router();

// Send OTP to phone number
router.post('/send-otp', (req, res) => {
  const { phoneNumber, isDevMode = false } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, error: 'Nomor HP wajib diisi' });
  }

  // Find or create profile
  let user = inMemoryStore.profiles.find(p => p.phone_number === phoneNumber);
  const otpCode = isDevMode ? '123456' : String(Math.floor(100000 + Math.random() * 900000));

  if (!user) {
    user = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      phone_number: phoneNumber,
      full_name: 'Pengguna Baru',
      email: `${phoneNumber}@tatadana.id`,
      role: 'user',
      plan: 'starter',
      monthly_tx_count: 0,
      is_phone_verified: false,
      otp_code: otpCode,
      otp_expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
      created_at: toWIBISOString()
    };
    inMemoryStore.profiles.push(user);
    // Create default wallet for new user
    inMemoryStore.wallets.push({
      id: 'w_' + Math.random().toString(36).substring(2, 9),
      user_id: user.id,
      name: 'Dompet Utama',
      type: 'cash',
      balance: 0,
      currency: 'IDR',
      is_default: true,
      color: '#FF5B00',
      created_at: toWIBISOString()
    });
  } else {
    user.otp_code = otpCode;
    user.otp_expires_at = new Date(Date.now() + 5 * 60000).toISOString();
  }

  return res.json({
    success: true,
    message: isDevMode ? 'Kode OTP simulasi dikirim (Dev Mode: 123456)' : 'Kode OTP berhasil dikirim via SMS/WhatsApp',
    devOtpCode: isDevMode ? '123456' : undefined
  });
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
  const { phoneNumber, otpCode, isDevMode = false } = req.body;
  const user = inMemoryStore.profiles.find(p => p.phone_number === phoneNumber);

  if (!user) {
    return res.status(404).json({ success: false, error: 'Nomor HP tidak ditemukan' });
  }

  // Allow bypass in dev mode or exact match
  if (isDevMode && otpCode === '123456') {
    user.is_phone_verified = true;
    user.otp_code = null;
    return res.json({
      success: true,
      token: user.id,
      user
    });
  }

  if (user.otp_code !== otpCode) {
    return res.status(400).json({ success: false, error: 'Kode OTP tidak valid atau sudah kedaluwarsa' });
  }

  user.is_phone_verified = true;
  user.otp_code = null;

  return res.json({
    success: true,
    token: user.id,
    user
  });
});

// Email login / demo instant login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = inMemoryStore.profiles.find(p => p.email === email || p.id === email);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Email atau kata sandi salah' });
  }

  return res.json({
    success: true,
    token: user.id,
    user
  });
});

// Get current profile
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    isImpersonating: req.isImpersonating || false,
    originalAdmin: req.originalAdmin || null
  });
});

// Superadmin Impersonate User
router.post('/impersonate/:targetUserId', authMiddleware, requireAdmin, (req, res) => {
  const { targetUserId } = req.params;
  const targetUser = inMemoryStore.profiles.find(p => p.id === targetUserId);

  if (!targetUser) {
    return res.status(404).json({ success: false, error: 'Pengguna target tidak ditemukan' });
  }

  // Record audit log
  inMemoryStore.adminAuditLogs.unshift({
    id: 'al' + Math.random().toString(36).substring(2, 9),
    admin_id: req.user.id,
    action: 'impersonate_user',
    target_user_id: targetUserId,
    details: { targetUserName: targetUser.full_name, targetEmail: targetUser.email },
    created_at: toWIBISOString()
  });

  res.json({
    success: true,
    message: `Mode Impersonasi Aktif: Anda sekarang mengakses akun ${targetUser.full_name}`,
    targetUser,
    impersonateToken: targetUser.id
  });
});

export default router;
