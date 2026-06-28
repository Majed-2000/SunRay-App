/**
 * Server entry point. This is the file that actually starts the backend.
 * Run it in development with:  npm run dev
 *
 * The order of middleware matters — requests flow top to bottom:
 *   CORS → JSON body parsing → request logging → routes → 404 → error handler.
 */
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger, requestLogger } from './common/logger';
import { errorHandler, notFoundHandler } from './common/errors';
import { rootRouter } from './routes';

const app = express();

// Allow the mobile app / browser to call this API from another origin.
app.use(cors());

// Parse JSON request bodies into req.body.
app.use(express.json());

// Log each request (method, path, status, time).
app.use(requestLogger);

// All our routes (/health and /api/*).
app.use(rootRouter);

// Unknown route → 404 in our standard JSON shape.
app.use(notFoundHandler);

// Any error thrown anywhere ends up here.
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Sun Ray backend running at http://localhost:${env.PORT}`);
  logger.info(`Try: http://localhost:${env.PORT}/health`);
});
