"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";

interface Props {
  onComplete: () => void;
}

export default function RefreshButton({ onComplete }: Props) {
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefresh = async () => {
    if (state === "running") return;
    setState("running");
    setProgress("Starting pipeline…");

    try {
      const { jobId } = await api.triggerIngest();

      // Poll every 3 seconds
      const poll = async () => {
        try {
          const job = await api.getJobStatus(jobId);
          if (job.status === "complete") {
            setState("done");
            setProgress("Data refreshed!");
            onComplete();
            setTimeout(() => { setState("idle"); setProgress(""); }, 3000);
          } else if (job.status === "failed") {
            setState("error");
            setProgress(job.error || "Pipeline failed");
            setTimeout(() => { setState("idle"); setProgress(""); }, 4000);
          } else {
            setProgress("Scraping & clustering…");
            pollRef.current = setTimeout(poll, 3000);
          }
        } catch {
          setState("error");
          setProgress("Could not reach API");
          setTimeout(() => { setState("idle"); setProgress(""); }, 3000);
        }
      };

      pollRef.current = setTimeout(poll, 3000);
    } catch (err) {
      setState("error");
      setProgress("Failed to start pipeline");
      setTimeout(() => { setState("idle"); setProgress(""); }, 3000);
    }
  };

  const icons = {
    idle:    "↻",
    running: "⏳",
    done:    "✓",
    error:   "✕",
  };

  const colours = {
    idle:    "border-border hover:border-accent hover:text-accent",
    running: "border-accent/50 text-accent animate-pulse cursor-not-allowed",
    done:    "border-green-500/50 text-green-400",
    error:   "border-red-500/50 text-red-400",
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRefresh}
        disabled={state === "running"}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium
          transition-all duration-200 font-display
          ${colours[state]}
          bg-surface
        `}
      >
        <span className={state === "running" ? "animate-spin inline-block" : ""}>
          {icons[state]}
        </span>
        Refresh Data
      </button>
      {progress && (
        <span className="text-xs text-dim font-mono animate-fade-in">
          {progress}
        </span>
      )}
    </div>
  );
}
