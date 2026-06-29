/**
 * Adds the authenticated identity to Express's Request type. The `authenticate`
 * middleware populates `req.auth` after verifying the access token + session.
 */
import 'express';

declare global {
  namespace Express {
    interface Request {
      auth?: { customerId: string; sessionId: string };
    }
  }
}

export {};
