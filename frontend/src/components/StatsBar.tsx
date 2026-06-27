interface Props {
  totalClusters: number;
  totalArticles: number;
  earliestDate: string | null;
  latestDate: string | null;
  sources: string[];
}

import { format } from "date-fns";

export default function StatsBar({
  totalClusters,
  totalArticles,
  earliestDate,
  latestDate,
  sources,
}: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
      {[
        { label: "Topic Clusters", value: totalClusters, mono: true },
        { label: "Total Articles", value: totalArticles, mono: true },
        {
          label: "Coverage From",
          value: earliestDate
            ? format(new Date(earliestDate), "dd MMM, HH:mm")
            : "—",
          mono: false,
        },
        {
          label: "Coverage To",
          value: latestDate
            ? format(new Date(latestDate), "dd MMM, HH:mm")
            : "—",
          mono: false,
        },
      ].map(({ label, value, mono }) => (
        <div key={label} className="bg-panel px-5 py-4">
          <p className="text-[10px] font-mono text-dim uppercase tracking-widest mb-1">
            {label}
          </p>
          <p
            className={`text-2xl font-display font-semibold text-text ${
              mono ? "font-mono" : ""
            }`}
          >
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
