import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

// Express recognises error handlers by their 4 parameters, so keep all of them.
// In Express 5, errors thrown inside async route handlers end up here automatically.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(err);

  const message =
    env.nodeEnv === "production" || !(err instanceof Error)
      ? "Internal server error"
      : err.message;

  res.status(500).json({ error: message });
}
