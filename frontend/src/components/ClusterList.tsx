"use client";

import { TimelineEntry } from "@/lib/api";
import { format } from "date-fns";
import SourceBadge from "./SourceBadge";

interface Props {
  entries: TimelineEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function ClusterList({ entries, selectedId, onSelect }: Props) {
  if (!entries.length) return null;

  // Deduplicate by id in case API returns duplicates
  const seen = new Set<string>();
  const unique = entries.filter((e) => {
    const key = String(e.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <div className="space-y-1">
      {unique.map((entry) => {
        const isSelected = selectedId === entry.id;
        return (
          <button
            key={String(entry.id)}
            onClick={() => onSelect(entry.id)}
            className={`w-full text-left p-4 rounded-lg border transition-all duration-150 group ${
              isSelected
                ? "border-accent/60 bg-accent/10"
                : "border-border hover:border-border/80 hover:bg-surface"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: isSelected ? "#6C6FFF" : "#8888AA",
                      opacity: 0.4 + entry.intensity * 0.06,
                    }}
                  />
                  <p
                    className={`text-sm font-display font-medium leading-snug truncate ${
                      isSelected ? "text-accent" : "text-text group-hover:text-accent"
                    } transition-colors`}
                  >
                    {entry.label}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap ml-3.5">
                  {entry.sources?.slice(0, 3).map((s) => (
                    <SourceBadge key={s} source={s} />
                  ))}
                  <span className="text-[10px] font-mono text-dim">
                    {entry.start
                      ? format(new Date(entry.start), "dd MMM, HH:mm")
                      : ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-lg font-mono font-semibold text-text">
                  {entry.article_count}
                </span>
                <span className="text-[9px] font-mono text-dim uppercase">articles</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
