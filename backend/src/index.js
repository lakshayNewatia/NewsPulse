import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import clustersRouter from "./routes/clusters.js";
import timelineRouter from "./routes/timeline.js";
import ingestRouter  from "./routes/ingest.js";

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
}));
app.use(express.json());

// Request logger (dev-friendly)
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/clusters", clustersRouter);
app.use("/timeline", timelineRouter);
app.use("/ingest",   ingestRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`News Pulse API running on port ${PORT}`);
  console.log(`  /clusters   — topic clusters`);
  console.log(`  /timeline   — timeline data`);
  console.log(`  /ingest     — pipeline trigger`);
});
