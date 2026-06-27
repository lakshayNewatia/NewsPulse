"use client";

import { useMemo, useState, useRef } from "react";
import { TimelineEntry } from "@/lib/api";
import { format, parseISO } from "date-fns";

interface Props {
  entries: TimelineEntry[];
  onSelectCluster: (id: number) => void;
  selectedId: number | null;
}

const SOURCE_COLORS: Record<string, string> = {
  bbc:       "#E01B24",
  npr:       "#FF8000",
  aljazeera: "#00C897",
  guardian:  "#00BFFF",
  default:   "#6C6FFF",
};

const SOURCE_LABELS: Record<string, string> = {
  bbc:       "BBC",
  npr:       "NPR",
  aljazeera: "Al Jazeera",
  guardian:  "Guardian",
};

function getSourceColor(sources: string[]): string {
  if (sources.length === 1) return SOURCE_COLORS[sources[0]] || SOURCE_COLORS.default;
  return SOURCE_COLORS.default;
}

interface TooltipData {
  entry: TimelineEntry;
  barLeftPct: number;
  barWidthPct: number;
  barTopPx: number;
}

export default function Timeline({ entries, onSelectCluster, selectedId }: Props) {
  const [tooltip, setTooltip]   = useState<TooltipData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const LANE_HEIGHT  = 52;
  const PADDING_TOP  = 16;
  const AXIS_HEIGHT  = 56;
  const MIN_WIDTH    = 800;

  const { timeMin, timeMax, rows, numLanes } = useMemo(() => {
    if (!entries.length) return { timeMin: 0, timeMax: 1, rows: [], numLanes: 1 };

    const times = entries.flatMap((e) => [
      new Date(e.start).getTime(),
      new Date(e.end).getTime(),
    ]);
    const timeMin = Math.min(...times);
    const timeMax = Math.max(...times);
    const span    = timeMax - timeMin || 1;

    const lanes: number[] = [];
    const withLane = entries.map((entry) => {
      const startMs  = new Date(entry.start).getTime();
      const endMs    = new Date(entry.end).getTime();
      const leftPct  = ((startMs - timeMin) / span) * 100;
      const rightPct = ((endMs   - timeMin) / span) * 100;
      const widthPct = Math.max(rightPct - leftPct, 0.8);

      let lane = lanes.findIndex((laneEnd) => startMs > laneEnd + 30 * 60 * 1000);
      if (lane === -1) lane = lanes.length;
      lanes[lane] = endMs;

      return { ...entry, leftPct, widthPct, lane };
    });

    const numLanes = Math.max(...withLane.map((e) => e.lane)) + 1;
    return { timeMin, timeMax, rows: withLane, numLanes };
  }, [entries]);

  const span = timeMax - timeMin || 1;

  const TICK_COUNT = 8;
  const ticks = useMemo(() => {
    return Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
      const ms = timeMin + (span * i) / TICK_COUNT;
      return {
        pct:   (i / TICK_COUNT) * 100,
        line1: format(new Date(ms), "dd MMM"),
        line2: format(new Date(ms), "HH:mm"),
        isFirst: i === 0,
        isLast:  i === TICK_COUNT,
      };
    });
  }, [timeMin, span]);

  const chartHeight = PADDING_TOP + numLanes * LANE_HEIGHT;
  const totalHeight = chartHeight + AXIS_HEIGHT;

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: "#8888AA" }}>
        <div className="text-4xl mb-3 opacity-20">◌</div>
        <p className="text-sm">No clusters yet — click Refresh Data to ingest articles.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <div
          ref={containerRef}
          className="relative"
          style={{ minWidth: MIN_WIDTH, height: totalHeight }}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid lines */}
          {ticks.map((tick, i) =>
            i > 0 && i < ticks.length - 1 ? (
              <div
                key={`grid-${i}`}
                className="absolute pointer-events-none"
                style={{
                  left:       `${tick.pct}%`,
                  top:        PADDING_TOP,
                  height:     numLanes * LANE_HEIGHT,
                  width:      1,
                  background: "rgba(255,255,255,0.05)",
                }}
              />
            ) : null
          )}

          {/* Lane shading */}
          {Array.from({ length: numLanes }).map((_, i) =>
            i % 2 === 0 ? (
              <div
                key={`lane-bg-${i}`}
                className="absolute left-0 right-0"
                style={{
                  top:        PADDING_TOP + i * LANE_HEIGHT,
                  height:     LANE_HEIGHT,
                  background: "rgba(255,255,255,0.013)",
                }}
              />
            ) : null
          )}

          {/* Cluster bars */}
          {rows.map((entry) => {
            const isSelected = selectedId === entry.id;
            const color      = getSourceColor(entry.sources || []);
            const barH       = Math.max(16, 12 + entry.intensity * 2.8);
            const top        = PADDING_TOP + entry.lane * LANE_HEIGHT + (LANE_HEIGHT - barH) / 2;

            return (
              <div
                key={entry.id}
                className="absolute cursor-pointer"
                style={{
                  left:   `${entry.leftPct}%`,
                  width:  `${entry.widthPct}%`,
                  top,
                  height: barH,
                }}
                onMouseEnter={() => {
                  setTooltip({
                    entry,
                    barLeftPct:  entry.leftPct,
                    barWidthPct: entry.widthPct,
                    barTopPx:    top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => onSelectCluster(entry.id)}
              >
                <div
                  className="w-full h-full rounded transition-all duration-100"
                  style={{
                    background: isSelected
                      ? color
                      : `linear-gradient(90deg, ${color}AA, ${color}DD)`,
                    boxShadow:  isSelected
                      ? `0 0 18px ${color}88, 0 0 5px ${color}BB`
                      : `0 1px 6px ${color}33`,
                    border:     `1px solid ${color}${isSelected ? "FF" : "55"}`,
                    opacity:    isSelected ? 1 : 0.78,
                    transform:  isSelected ? "scaleY(1.1)" : "scaleY(1)",
                  }}
                />
                {entry.widthPct > 7 && (
                  <div className="absolute inset-0 flex items-center px-2 pointer-events-none overflow-hidden">
                    <span
                      className="text-[10px] font-display font-semibold truncate"
                      style={{ color: "#fff", opacity: 0.9, textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
                    >
                      {entry.label}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Axis line */}
          <div
            className="absolute left-0 right-0"
            style={{ top: chartHeight, height: 1, background: "rgba(255,255,255,0.12)" }}
          />

          {/* Axis ticks + labels */}
          {ticks.map((tick, i) => {
            // Alignment: first = left-align, last = right-align, others = center
            const align = tick.isFirst ? "left" : tick.isLast ? "right" : "center";
            const transform =
              tick.isFirst ? "translateX(0)"
              : tick.isLast ? "translateX(-100%)"
              : "translateX(-50%)";

            return (
              <div
                key={`tick-${i}`}
                className="absolute"
                style={{
                  left:      `${tick.pct}%`,
                  top:       chartHeight,
                  transform,
                }}
              >
                <div
                  style={{
                    width:    1,
                    height:   6,
                    background: "rgba(255,255,255,0.25)",
                    // For center-aligned ticks, center the tick mark
                    margin: align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0",
                  }}
                />
                <div
                  className="flex flex-col mt-1.5"
                  style={{ textAlign: align as "left" | "right" | "center" }}
                >
                  <span style={{ fontSize: 9, color: "rgba(180,180,210,0.9)", fontFamily: "monospace", lineHeight: 1.4, whiteSpace: "nowrap" }}>
                    {tick.line1}
                  </span>
                  <span style={{ fontSize: 9, color: "rgba(136,136,170,0.8)", fontFamily: "monospace", lineHeight: 1.4, whiteSpace: "nowrap" }}>
                    {tick.line2}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Tooltip — computed in % space, rendered with px via containerRef */}
          {tooltip && (() => {
            const containerW = containerRef.current?.clientWidth || MIN_WIDTH;
            const TIP_W      = 240;
            // Center tooltip over bar midpoint, clamp to container edges
            let tipLeft = ((tooltip.barLeftPct + tooltip.barWidthPct / 2) / 100) * containerW - TIP_W / 2;
            if (tipLeft + TIP_W > containerW - 8) tipLeft = containerW - TIP_W - 8;
            if (tipLeft < 8) tipLeft = 8;
            const tipTop = Math.max(4, tooltip.barTopPx - 118);

            return (
              <div
                className="absolute z-50 pointer-events-none"
                style={{ left: tipLeft, top: tipTop, width: TIP_W }}
              >
                <div
                  style={{
                    background:     "rgba(14,14,28,0.97)",
                    border:         "1px solid rgba(108,111,255,0.5)",
                    borderRadius:   10,
                    padding:        "12px 14px",
                    boxShadow:      "0 8px 40px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <p
                    className="font-display font-semibold mb-2 leading-snug"
                    style={{ fontSize: 12, color: "#E2E2F0" }}
                  >
                    {tooltip.entry.label}
                  </p>
                  <div className="space-y-1.5">
                    {([
                      ["Articles",  String(tooltip.entry.article_count), "#E2E2F0"],
                      ["Intensity", `${tooltip.entry.intensity}/10`,     "#6C6FFF"],
                      ["Sources",   (tooltip.entry.sources || []).map((s) => SOURCE_LABELS[s] || s).join(", "), "#E2E2F0"],
                    ] as [string, string, string][]).map(([k, v, c]) => (
                      <div key={k} className="flex justify-between items-baseline gap-2">
                        <span style={{ fontSize: 10, color: "#8888AA" }}>{k}</span>
                        <span style={{ fontSize: 10, color: c }} className="font-mono font-medium">{v}</span>
                      </div>
                    ))}
                    <div
                      style={{
                        fontSize:   9,
                        color:      "#8888AA",
                        fontFamily: "monospace",
                        borderTop:  "1px solid rgba(255,255,255,0.07)",
                        paddingTop: 6,
                        marginTop:  4,
                      }}
                    >
                      {format(parseISO(tooltip.entry.start), "dd MMM HH:mm")}
                      {" → "}
                      {format(parseISO(tooltip.entry.end), "dd MMM HH:mm")}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono" style={{ fontSize: 10, color: "#8888AA" }}>
        <span>↔ Width = time span</span>
        <span>↕ Height = article volume</span>
        <span>Color = dominant source</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {Object.entries(SOURCE_LABELS).map(([id, label]) => (
          <div key={id} className="flex items-center gap-1.5 font-mono" style={{ fontSize: 10, color: "#8888AA" }}>
            <div className="rounded-sm" style={{ width: 12, height: 8, background: SOURCE_COLORS[id] }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 font-mono" style={{ fontSize: 10, color: "#8888AA" }}>
          <div className="rounded-sm" style={{ width: 12, height: 8, background: SOURCE_COLORS.default }} />
          Multi-source
        </div>
      </div>
    </div>
  );
}
