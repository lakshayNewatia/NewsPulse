"use client";

import { useEffect, useState } from "react";
import { api, ClusterDetail } from "@/lib/api";
import SourceBadge from "./SourceBadge";
import { format } from "date-fns";

interface Props {
  clusterId: number | null;
  onClose: () => void;
}

export default function ClusterPanel({ clusterId, onClose }: Props) {
  const [data, setData]   = useState<ClusterDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusterId) { setData(null); return; }
    setLoading(true);
    setError(null);
    api.getCluster(clusterId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [clusterId]);

  if (!clusterId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/70 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-panel border-l border-border z-50 flex flex-col animate-slide-up overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex-1 pr-4">
            {data ? (
              <>
                <p className="text-xs text-accent font-mono uppercase tracking-widest mb-1">
                  Topic Cluster #{data.cluster.id}
                </p>
                <h2 className="text-xl font-display font-semibold text-text leading-tight">
                  {data.cluster.label}
                </h2>
                <div className="flex flex-wrap gap-1 mt-2">
                  {data.cluster.top_terms?.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-dim"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-6 bg-muted rounded animate-pulse w-48" />
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-dim hover:text-text"
          >
            ✕
          </button>
        </div>

        {/* Stats bar */}
        {data && (
          <div className="flex gap-6 px-6 py-3 bg-surface border-b border-border text-xs">
            <div>
              <span className="text-dim">Articles</span>
              <span className="ml-2 text-text font-mono font-medium">
                {data.articles.length}
              </span>
            </div>
            <div>
              <span className="text-dim">From</span>
              <span className="ml-2 text-text font-mono">
                {data.cluster.earliest_at
                  ? format(new Date(data.cluster.earliest_at), "dd MMM, HH:mm")
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-dim">To</span>
              <span className="ml-2 text-text font-mono">
                {data.cluster.latest_at
                  ? format(new Date(data.cluster.latest_at), "dd MMM, HH:mm")
                  : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Articles list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="p-6 text-red-400 text-sm font-mono">{error}</div>
          )}

          {data && !loading && (
            <div className="divide-y divide-border">
              {data.articles.map((article, idx) => (
                <a
                  key={article.article_id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 hover:bg-surface transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    {/* Index */}
                    <span className="text-xs font-mono text-muted mt-0.5 flex-shrink-0 w-5">
                      {String(idx + 1).padStart(2, "0")}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <SourceBadge source={article.source} />
                        {article.published_at && (
                          <span className="text-[10px] font-mono text-dim">
                            {format(new Date(article.published_at), "dd MMM · HH:mm")}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-medium text-text group-hover:text-accent transition-colors leading-snug mb-1.5">
                        {article.title}
                      </h3>

                      {article.summary && (
                        <p className="text-xs text-dim leading-relaxed line-clamp-2">
                          {article.summary}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-1 text-[10px] text-accent/60 group-hover:text-accent transition-colors font-mono">
                        Read article →
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
