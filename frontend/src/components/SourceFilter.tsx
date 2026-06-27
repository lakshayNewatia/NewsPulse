"use client";

const SOURCES = [
  { id: "bbc",       label: "BBC News",    color: "#E01B24" },
  { id: "npr",       label: "NPR",         color: "#FF8000" },
  { id: "aljazeera", label: "Al Jazeera",  color: "#00A651" },
  { id: "guardian",  label: "The Guardian",color: "#00BFFF" },
];

interface Props {
  active: Set<string>;
  onChange: (sources: Set<string>) => void;
}

export default function SourceFilter({ active, onChange }: Props) {
  const toggle = (id: string) => {
    const next = new Set(active);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id); // keep at least one
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {SOURCES.map((s) => {
        const isActive = active.has(s.id);
        return (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200"
            style={{
              borderColor: isActive ? s.color : "rgba(255,255,255,0.08)",
              background:  isActive ? `${s.color}20` : "transparent",
              color:       isActive ? s.color : "#8888AA",
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: isActive ? s.color : "#8888AA" }}
            />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export { SOURCES };
