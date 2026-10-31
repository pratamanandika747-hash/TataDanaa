/**
 * Security & Cryptography Utilities for TataDana
 * Features:
 * - AES-256-GCM Encryption / Decryption for AI Provider API Keys
 * - Midtrans SHA-512 Signature Verification
 * - JWT Token Generation & Verification (with native crypto fallback)
 * - Password Hashing & Verification (with native PBKDF2 fallback)
 * - Indonesian E.164 Phone Number Normalization
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_SECRET = 'tatadana-super-secret-key-wib-2026-encryption-key-32chars!';

/**
 * Normalizes Indonesian phone numbers into standardized E.164 format (+628...).
 * Handles inputs like: "08123456789", "628123456789", "8123456789", "+62 812-3456-789"
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+62')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('62')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Remove leading zeros if any
  cleaned = cleaned.replace(/^0+/, '');

  return `+62${cleaned}`;
}

/**
 * Encrypts plain text using AES-256-GCM.
 * Output format: iv:authTag:encryptedHex
 */
export function encryptApiKey(text, secretKey = process.env.ENCRYPTION_KEY || DEFAULT_SECRET) {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(secretKey).digest(); // 32 bytes
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted text.
 */
export function decryptApiKey(encryptedData, secretKey = process.env.ENCRYPTION_KEY || DEFAULT_SECRET) {
  if (!encryptedData) return '';
  if (!encryptedData.includes(':')) return encryptedData; // fallback if plain text

  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return encryptedData;

    const [ivHex, tagHex, encryptedHex] = parts;
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[crypto] Decryption error:', err.message);
    return '';
  }
}

/**
 * Verifies Midtrans SHA-512 webhook signature.
 * expectedSignature = SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature({ orderId, statusCode, grossAmount, serverKey, signatureKey }) {
  if (!orderId || !statusCode || !grossAmount || !serverKey || !signatureKey) {
    return false;
  }

  // Note: gross_amount in Midtrans payload might be a decimal like "99000.00" or integer "99000"
  // Format exactly as received in Midtrans payload
  const rawInput = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const calculatedSignature = crypto.createHash('sha512').update(rawInput).digest('hex');

  return calculatedSignature.toLowerCase() === String(signatureKey).toLowerCase();
}

/**
 * Computes Midtrans SHA-512 signature string.
 */
export function generateMidtransSignature(orderId, statusCode, grossAmount, serverKey) {
  const rawInput = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(rawInput).digest('hex');
}

/**
 * JWT implementation with jsonwebtoken package and native HMAC-SHA256 fallback.
 */
let jwtLib = null;
try {
  jwtLib = await import('jsonwebtoken');
  if (jwtLib.default) jwtLib = jwtLib.default;
} catch {
  jwtLib = null;
}

export function generateJwtToken(payload, secret = process.env.JWT_SECRET || DEFAULT_SECRET, expiresIn = '7d') {
  if (jwtLib && typeof jwtLib.sign === 'function') {
    return jwtLib.sign(payload, secret, { expiresIn });
  }

  // Native HMAC-SHA256 JWT Fallback
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const expSec = expiresIn.endsWith('d') ? parseInt(expiresIn) * 86400 : 86400 * 7;
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expSec })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwtToken(token, secret = process.env.JWT_SECRET || DEFAULT_SECRET) {
  if (!token) return null;

  if (jwtLib && typeof jwtLib.verify === 'function') {
    try {
      return jwtLib.verify(token, secret);
    } catch {
      return null;
    }
  }

  // Native HMAC-SHA256 verify fallback
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Password hashing with bcryptjs and native PBKDF2 fallback.
 */
let bcryptLib = null;
try {
  bcryptLib = await import('bcryptjs');
  if (bcryptLib.default) bcryptLib = bcryptLib.default;
} catch {
  bcryptLib = null;
}

export async function hashPassword(plainPassword) {
  if (bcryptLib && typeof bcryptLib.hash === 'function') {
    return bcryptLib.hash(plainPassword, 10);
  }

  // Native PBKDF2 fallback
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plainPassword, salt, 10000, 32, 'sha256').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

export async function verifyPassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;

  if (hashedPassword.startsWith('pbkdf2:')) {
    const [, salt, hash] = hashedPassword.split(':');
    const computed = crypto.pbkdf2Sync(plainPassword, salt, 10000, 32, 'sha256').toString('hex');
    return computed === hash;
  }

  if (bcryptLib && typeof bcryptLib.compare === 'function') {
    return bcryptLib.compare(plainPassword, hashedPassword);
  }

  return false;
}

/**
 * Generates a clean UUID v4.
 */
export function generateUUID() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
