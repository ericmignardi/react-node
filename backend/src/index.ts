import express from "express";
import cors from "cors";

const PORT = Number(process.env.PORT) || 3000;
export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Hello World");
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
