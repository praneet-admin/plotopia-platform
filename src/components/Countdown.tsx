"use client";
import { useEffect, useState } from "react";

export function Countdown({ until, onExpire, className = "" }: { until: number; onExpire?: () => void; className?: string }) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, until - Date.now());
      setLeft(l);
      if (l === 0) { clearInterval(t); onExpire?.(); }
    }, 500);
    return () => clearInterval(t);
  }, [until, onExpire]);
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return <span className={`num ${left < 60000 ? "text-bad" : ""} ${className}`}>{m}:{String(s).padStart(2, "0")}</span>;
}
