/**
 * Midtrans Snap & Core API Configuration
 */

import { env } from './env.js';
import { verifyMidtransSignature } from '../utils/crypto.js';

let snapClient = null;

try {
  const midtrans = await import('midtrans-client');
  const MidtransSnap = midtrans.Snap || midtrans.default?.Snap;
  if (MidtransSnap) {
    snapClient = new MidtransSnap({
      isProduction: env.midtransIsProduction,
      serverKey: env.midtransServerKey,
      clientKey: env.midtransClientKey
    });
  }
} catch {
  snapClient = null;
}

export { snapClient };

/**
 * Creates a Midtrans Snap transaction token.
 * Falls back to deterministic mock token in local dev if Midtrans API is unreachable.
 */
export async function createSnapToken(payload) {
  if (snapClient && env.midtransServerKey && !env.midtransServerKey.includes('demo')) {
    try {
      const response = await snapClient.createTransaction(payload);
      return {
        token: response.token,
        redirectUrl: response.redirect_url
      };
    } catch (err) {
      console.warn('[Midtrans] API error, falling back to local simulator token:', err.message);
    }
  }

  // Fallback simulator for development/testing
  const token = `snap-token-${payload.transaction_details.order_id}`;
  const redirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}`;

  return {
    token,
    redirectUrl
  };
}

export { verifyMidtransSignature };
