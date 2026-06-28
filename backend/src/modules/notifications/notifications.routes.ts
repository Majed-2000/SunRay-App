import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import * as service from './notifications.service';

// Customer-scoped: /api/customers/:id/notifications ...
export const notificationsRouter = Router({ mergeParams: true });

// GET /api/customers/:id/notifications
notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await service.list(req.params.id));
  }),
);

// PATCH /api/customers/:id/notifications/read-all
notificationsRouter.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    ok(res, await service.markAllRead(req.params.id));
  }),
);
