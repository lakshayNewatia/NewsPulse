/**
 * Simple in-memory job store.
 * For production this would be Redis, but for this assessment
 * in-memory is sufficient since jobs are short-lived (< 3 min).
 * Jobs are keyed by UUID; GC'd after 1 hour.
 */

const jobs = new Map();
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

export function createJob(id) {
  jobs.set(id, {
    id,
    status: "running",
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
    error: null,
  });
  // Auto-cleanup
  setTimeout(() => jobs.delete(id), JOB_TTL_MS);
  return jobs.get(id);
}

export function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}
