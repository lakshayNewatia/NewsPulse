import { Router } from "express";
import { spawn } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { createJob, updateJob, getJob } from "../jobStore.js";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to Python pipeline — resolved from env or relative to repo
const SCRAPER_DIR = process.env.SCRAPER_DIR || path.resolve(__dirname, "../../../scraper");
const PYTHON_BIN  = process.env.PYTHON_BIN  || "python3";

/**
 * POST /ingest/trigger
 * Spawns the Python pipeline as a child process.
 * Returns { jobId } immediately so the frontend can poll.
 */
router.post("/trigger", (req, res) => {
  const jobId = uuidv4();
  createJob(jobId);

  res.status(202).json({ jobId, status: "running" });

  // Spawn pipeline asynchronously
  const proc = spawn(PYTHON_BIN, ["pipeline.py"], {
    cwd: SCRAPER_DIR,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (d) => {
    const chunk = d.toString();
    stdout += chunk;
    process.stdout.write(`[pipeline] ${chunk}`);
  });

  proc.stderr.on("data", (d) => {
    const chunk = d.toString();
    stderr += chunk;
    process.stderr.write(`[pipeline:err] ${chunk}`);
  });

  proc.on("close", (code) => {
    if (code === 0) {
      // Try to extract JSON result line
      const match = stdout.match(/RESULT:(\{.*\})/);
      const result = match ? JSON.parse(match[1]) : { status: "complete" };
      updateJob(jobId, {
        status: "complete",
        finishedAt: new Date().toISOString(),
        result,
      });
    } else {
      updateJob(jobId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: stderr.slice(-500) || "Pipeline exited with code " + code,
      });
    }
  });

  proc.on("error", (err) => {
    updateJob(jobId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      error: err.message,
    });
  });
});

/**
 * GET /ingest/status/:jobId
 * Returns current job status for polling.
 */
router.get("/status/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  return res.json(job);
});

export default router;
