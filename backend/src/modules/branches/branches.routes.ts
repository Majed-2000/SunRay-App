import { Router } from 'express';
import { asyncHandler } from '../../common/errors';
import { ok } from '../../common/response';
import * as service from './branches.service';

export const branchesRouter = Router();

// GET /api/branches
branchesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, await service.listBranches());
  }),
);
