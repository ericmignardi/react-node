import { Router } from "express";
import { healthRouter } from "./health.routes.js";

// All API routes are registered here and mounted under /api in app.ts.
export const router = Router();

router.use("/health", healthRouter);
