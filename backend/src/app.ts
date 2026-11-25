import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { router } from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Builds and configures the Express app. Kept separate from index.ts
// so the app can be imported on its own (e.g. in tests) without starting a server.
export const app = express();

app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Hello World");
});

app.use("/api", router);

// These must come after all routes.
app.use(notFound);
app.use(errorHandler);
