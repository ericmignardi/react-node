// Reads environment variables in one place so the rest of the app
// gets typed values with sensible defaults.
// Variables are loaded from .env by Node's --env-file flag (see package.json).

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
};
