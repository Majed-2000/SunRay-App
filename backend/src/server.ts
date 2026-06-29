/**
 * Server entry point. This is the file that actually starts the backend.
 * Run it in development with:  npm run dev
 *
 * The Express app itself is built in `app.ts` (and exported there so tests can
 * use it without opening a port). Here we just listen and handle shutdown.
 */
import { app } from './app';
import { env } from './config/env';
import { logger } from './common/logger';
import { prisma } from './database/prisma';
import { stopCache } from './common/cache';

const server = app.listen(env.PORT, () => {
  logger.info(`Sun Ray backend running at http://localhost:${env.PORT}`);
  logger.info(`Try: http://localhost:${env.PORT}/health`);
});

/** Close connections cleanly so timers/sockets don't keep the process alive. */
async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down…`);
  server.close(() => logger.info('HTTP server closed'));
  stopCache();
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error('Error disconnecting Prisma during shutdown', err);
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
