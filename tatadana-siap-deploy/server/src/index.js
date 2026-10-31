/**
 * TataDana Server Startup & Graceful Shutdown
 */

import app from './app.js';
import { env } from './config/env.js';
import { toWIBISOString } from './utils/wibDate.js';

const PORT = env.port;

const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  🚀 TataDana REST API Backend Server Started!         `);
  console.log(`  📍 Environment : ${env.nodeEnv}                      `);
  console.log(`  ⏰ Timezone    : Asia/Jakarta (WIB)                   `);
  console.log(`  🌐 Port        : ${PORT}                              `);
  console.log(`  🕒 Started At  : ${toWIBISOString()}                  `);
  console.log(`  🔗 Health Check: http://localhost:${PORT}/api/health  `);
  console.log(`=======================================================`);
});

// Handle graceful shutdown
const shutdown = (signal) => {
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
