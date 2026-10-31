/**
 * Telegram Webhook Idempotency Manager
 * Prevents double-processing of Telegram updates when Telegram retries or network glitched
 */

export class IdempotencyManager {
  constructor(dbClient = null) {
    this.dbClient = dbClient;
    // In-memory cache for ultra-fast check & fallback if DB is offline
    this.memoryCache = new Map();
  }

  /**
   * Check if an update_id has already been processed or is being processed
   * @param {number|string} updateId
   * @returns {Promise<{ isDuplicate: boolean, status?: string }>}
   */
  async check(updateId) {
    const key = String(updateId);
    
    // Check in-memory first
    if (this.memoryCache.has(key)) {
      return { isDuplicate: true, status: this.memoryCache.get(key).status };
    }

    // Check DB if client available
    if (this.dbClient) {
      try {
        const { data, error } = await this.dbClient
          .from('telegram_webhook_idempotency')
          .select('status')
          .eq('update_id', updateId)
          .maybeSingle();

        if (data) {
          this.memoryCache.set(key, { status: data.status, time: Date.now() });
          return { isDuplicate: true, status: data.status };
        }
      } catch (err) {
        console.warn('Idempotency DB check error, falling back to memory:', err.message);
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Mark an update_id as processing
   * @param {number|string} updateId
   * @param {number|string} chatId
   * @param {string} snippet
   */
  async markProcessing(updateId, chatId = null, snippet = '') {
    const key = String(updateId);
    this.memoryCache.set(key, { status: 'processing', time: Date.now(), chatId, snippet });

    if (this.dbClient) {
      try {
        await this.dbClient
          .from('telegram_webhook_idempotency')
          .upsert({
            update_id: Number(updateId),
            status: 'processing',
            chat_id: chatId ? Number(chatId) : null,
            message_snippet: snippet ? snippet.slice(0, 150) : null
          }, { onConflict: 'update_id' });
      } catch (err) {
        console.warn('Idempotency markProcessing DB error:', err.message);
      }
    }
  }

  /**
   * Mark an update_id as completed
   * @param {number|string} updateId
   */
  async markCompleted(updateId) {
    const key = String(updateId);
    const cached = this.memoryCache.get(key) || {};
    this.memoryCache.set(key, { ...cached, status: 'completed' });

    if (this.dbClient) {
      try {
        await this.dbClient
          .from('telegram_webhook_idempotency')
          .update({ status: 'completed' })
          .eq('update_id', Number(updateId));
      } catch (err) {
        console.warn('Idempotency markCompleted DB error:', err.message);
      }
    }
  }

  /**
   * Mark an update_id as failed
   * @param {number|string} updateId
   */
  async markFailed(updateId) {
    const key = String(updateId);
    const cached = this.memoryCache.get(key) || {};
    this.memoryCache.set(key, { ...cached, status: 'failed' });

    if (this.dbClient) {
      try {
        await this.dbClient
          .from('telegram_webhook_idempotency')
          .update({ status: 'failed' })
          .eq('update_id', Number(updateId));
      } catch (err) {
        console.warn('Idempotency markFailed DB error:', err.message);
      }
    }
  }
}

export const idempotencyManager = new IdempotencyManager();
