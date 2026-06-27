const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface Cluster {
  id: number;
  label: string;
  top_terms: string[];
  article_count: number;
  earliest_at: string;
  latest_at: string;
  sources: string[];
  intensity?: number;
}

export interface TimelineEntry extends Cluster {
  start: string;
  end: string;
  duration_hours: string;
  intensity: number;
}

export interface Article {
  id: number;
  article_id: string;
  source: string;
  title: string;
  summary: string;
  url: string;
  published_at: string;
}

export interface ClusterDetail {
  cluster: Cluster;
  articles: Article[];
}

export interface TimelineResponse {
  timeline: TimelineEntry[];
  stats: {
    totalClusters: number;
    totalArticles: number;
    earliestDate: string | null;
    latestDate: string | null;
  };
}

export interface Job {
  id: string;
  status: "running" | "complete" | "failed";
  startedAt: string;
  finishedAt: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
}

// ── API functions ─────────────────────────────────────────────────────────────

export const api = {
  getTimeline: (source?: string) =>
    apiFetch<TimelineResponse>(`/timeline${source ? `?source=${source}` : ""}`),

  getClusters: (source?: string) =>
    apiFetch<{ clusters: Cluster[]; total: number }>(
      `/clusters${source ? `?source=${source}` : ""}`
    ),

  getCluster: (id: number) =>
    apiFetch<ClusterDetail>(`/clusters/${id}`),

  triggerIngest: () =>
    apiFetch<{ jobId: string; status: string }>(`/ingest/trigger`, { method: "POST" }),

  getJobStatus: (jobId: string) =>
    apiFetch<Job>(`/ingest/status/${jobId}`),
};
