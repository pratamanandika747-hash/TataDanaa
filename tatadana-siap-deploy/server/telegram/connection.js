// server/telegram/connection.js
// Handles Telegram getMe test connection & automatic setWebhook registration
// Matches Part 5 specifications

const https = require('https');
const config = require('../config');

/**
 * Perform HTTPS request helper
 */
function fetchTelegramAPI(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.telegram.org${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 8000
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid JSON from Telegram: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Koneksi ke Telegram API timeout (8s)'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Test Bot Token via getMe and setWebhook
 */
async function testAndRegisterWebhook(botToken, webhookBaseUrl = null) {
  if (!botToken || typeof botToken !== 'string') {
    return {
      success: false,
      message: 'Token bot Telegram tidak boleh kosong.'
    };
  }

  const cleanToken = botToken.trim();
  const baseUrl = webhookBaseUrl || config.WEBHOOK_BASE_URL;

  try {
    // 1. Call getMe
    const meRes = await fetchTelegramAPI(`/bot${cleanToken}/getMe`);
    if (!meRes.ok) {
      return {
        success: false,
        message: meRes.description || 'Token tidak valid menurut Telegram API.'
      };
    }

    const botInfo = meRes.result;

    // 2. Automatically register setWebhook
    const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;
    const setWebhookRes = await fetchTelegramAPI(`/bot${cleanToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);

    return {
      success: true,
      bot: {
        id: botInfo.id,
        firstName: botInfo.first_name,
        username: botInfo.username
      },
      webhook: {
        url: webhookUrl,
        registered: setWebhookRes.ok,
        description: setWebhookRes.description || 'Webhook berhasil didaftarkan'
      },
      message: `🟢 Berhasil terhubung dengan @${botInfo.username}`
    };
  } catch (err) {
    return {
      success: false,
      message: `Gagal menguji koneksi bot: ${err.message}`
    };
  }
}

/**
 * Send Telegram message
 */
async function sendTelegramMessage(botToken, chatId, text, parseMode = 'Markdown') {
  if (!botToken || !chatId) return { ok: false, error: 'Missing token or chatId' };
  try {
    const res = await fetchTelegramAPI(`/bot${botToken}/sendMessage`, 'POST', {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode
    });
    return res;
  } catch (err) {
    console.warn('[Telegram send error]:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = {
  fetchTelegramAPI,
  testAndRegisterWebhook,
  sendTelegramMessage
};
