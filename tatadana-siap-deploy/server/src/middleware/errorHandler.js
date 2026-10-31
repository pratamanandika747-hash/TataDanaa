/**
 * Global Error Handling Middleware
 * RFC 7807 compliant error responses with WIB timestamp metadata.
 */

import { errorResponse } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
  // Check for body-parser syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return errorResponse(res, {
      code: 'INVALID_JSON',
      message: 'Format request body JSON tidak valid'
    }, 400);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Terjadi kesalahan pada server';
  const code = err.code || (statusCode === 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');

  console.error(`[Error Handler] ${req.method} ${req.url} [${statusCode}]:`, err);

  return errorResponse(res, {
    code,
    message,
    details: err.details || undefined
  }, statusCode);
}
