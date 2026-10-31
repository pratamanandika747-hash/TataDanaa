/**
 * Standardized API Response Helpers
 * Follows TataDana Interface Contracts specified in PROJECT.md:
 * - Success: { success: true, data: ..., error: null }
 * - Error: { success: false, error: { code, message, ... } }
 */

import { toWIBISOString } from './wibDate.js';

export function successResponse(res, data = {}, statusCode = 200, meta = undefined) {
  const payload = {
    success: true,
    data,
    error: null
  };

  if (meta !== undefined) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

export function errorResponse(res, errorInput, statusCode = 400) {
  let errObject;

  if (typeof errorInput === 'string') {
    errObject = {
      code: 'BAD_REQUEST',
      message: errorInput
    };
  } else if (errorInput && typeof errorInput === 'object') {
    errObject = {
      code: errorInput.code || 'ERROR',
      message: errorInput.message || 'An error occurred',
      ...errorInput
    };
  } else {
    errObject = {
      code: 'INTERNAL_ERROR',
      message: 'Unknown error occurred'
    };
  }

  // Include WIB timestamp on errors
  errObject.timestamp = toWIBISOString();

  return res.status(statusCode).json({
    success: false,
    error: errObject
  });
}
