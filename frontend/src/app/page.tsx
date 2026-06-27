"use client";

import { useEffect, useState, useCallback } from "react";
import { api, TimelineEntry, TimelineResponse } from "@/lib/api";
import Timeline from "@/components/Timeline";
import ClusterPanel from "@/components/ClusterPanel";
import ClusterList from "@/components/ClusterList";
import SourceFilter from "@/components/SourceFilter";
import RefreshButton from "@/components/RefreshButton";
import { format } from "date-fns";

const ALL_SOURCES = new Set(["bbc", "npr", "aljazeera", "guardian"]);

export default function HomePage() {
  const [data,          setData]          = useState<TimelineResponse | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set(ALL_SOURCES));
  const [selectedId,    setSelectedId]    = useState<number | null>(null);
  const [view,          setView]          = useState<"timeline" | "list">("timeline");

  const fetchData = useCallback(async (sources: Set<string>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTimeline([...sources].join(","));
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(activeSources);
    const interval = setInterval(() => fetchData(activeSources), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeSources, fetchData]);

  const handleSourceChange = (next: Set<string>) => {
    setActiveSources(next);
    fetchData(next);
  };

  const entries: TimelineEntry[] = data?.timeline || [];
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-ink text-text">

      {/* ── Header ── */}
      <header className="border-b border-border bg-surface/60 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-4 h-4">
              <div className="absolute w-4 h-4 rounded-full bg-pulse/20 animate-ping" />
              <div className="w-2 h-2 rounded-full bg-pulse" />
            </div>
            <span className="font-display font-semibold text-base tracking-tight">
              News<span className="text-accent">Pulse</span>
            </span>
            <span className="text-[10px] font-mono text-dim border border-border rounded px-1.5 py-0.5 hidden sm:inline">
              LIVE
            </span>
          </div>
          <RefreshButton onComplete={() => fetchData(activeSources)} />
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="border-b border-border bg-surface/30">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">

          {/* Left — title */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono text-accent uppercase tracking-[0.2em]">
                Real-time · 4 sources · TF-IDF clustering
              </span>
            </div>
            <h1
              className="font-display font-semibold leading-none tracking-tight mb-3"
              style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)" }}
            >
              Topic{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #6C6FFF, #A78BFA)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Timeline
              </span>
            </h1>
            <p className="text-sm text-dim max-w-lg leading-relaxed">
              Live news articles automatically grouped into topic clusters
              by cosine similarity. Each bar spans the story's active window.{" "}
              <span className="text-text/60">Click any cluster to read its articles.</span>
            </p>
          </div>

          {/* Right — 4-stat grid (single source of truth, no duplication) */}
          {stats && !loading && (
            <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden border border-border flex-shrink-0">
              {[
                { label: "Clusters",      value: stats.totalClusters },
                { label: "Articles",      value: stats.totalArticles },
                {
                  label: "From",
                  value: stats.earliestDate
                    ? format(new Date(stats.earliestDate), "dd MMM, HH:mm")
                    : "—",
                },
                {
                  label: "To",
                  value: stats.latestDate
                    ? format(new Date(stats.latestDate), "dd MMM, HH:mm")
                    : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-panel px-5 py-3 min-w-[110px]">
                  <p className="text-[9px] font-mono text-dim uppercase tracking-widest mb-1">
                    {label}
                  </p>
                  <p className="text-xl font-display font-semibold text-text leading-none">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <SourceFilter active={activeSources} onChange={handleSourceChange} />
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 self-start sm:self-auto">
            {(["timeline", "list"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium font-display transition-all ${
                  view === v ? "bg-panel text-text shadow-sm" : "text-dim hover:text-text"
                }`}
              >
                {v === "timeline" ? "⏱ Timeline" : "≡ List"}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <p className="text-sm text-dim font-mono">Loading clusters…</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <button
              onClick={() => fetchData(activeSources)}
              className="mt-4 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          view === "timeline" ? (
            <div className="bg-panel border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-mono text-dim uppercase tracking-widest">
                    Cluster Activity Map
                  </h2>      
                </div>
                <span className="text-xs font-mono text-dim">
                  {entries.length} clusters shown
                </span>
              </div>
              <Timeline
                entries={entries}
                onSelectCluster={setSelectedId}
                selectedId={selectedId}
              />
            </div>
          ) : (
            <div className="bg-panel border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono text-dim uppercase tracking-widest">
                  All Clusters
                </h2>
                <span className="text-xs font-mono text-dim">sorted by recency</span>
              </div>
              <ClusterList
                entries={entries}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
          )
        )}

        
      </main>

      <ClusterPanel
        clusterId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
