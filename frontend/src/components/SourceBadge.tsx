const SOURCE_META: Record<string, { label: string; color: string }> = {
  bbc:       { label: "BBC",      color: "#E01B24" },
  npr:       { label: "NPR",      color: "#FF8000" },
  aljazeera: { label: "Al Jazeera", color: "#00A651" },
  guardian:  { label: "Guardian", color: "#00BFFF" },
};

export default function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source] || { label: source.toUpperCase(), color: "#8888AA" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border uppercase tracking-wide"
      style={{
        color:       meta.color,
        borderColor: `${meta.color}44`,
        background:  `${meta.color}18`,
      }}
    >
      {meta.label}
    </span>
  );
}
