"use client";
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Result = { ok: boolean; reason?: string; booking?: { id: string; seats: string[]; status: string } | null; show?: { title: string; screen: string; time: string } | null };

export function Scanner() {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"idle" | "on" | "denied">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Result[]>([]);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const submit = async (c: string) => {
    if (!c || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/checkin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: c }) });
      const j: Result = await r.json();
      setResult(j);
      setHistory((h) => [j, ...h].slice(0, 8));
      if (navigator.vibrate) navigator.vibrate(j.ok ? 80 : [60, 40, 60]);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    let stream: MediaStream | null = null, raf = 0;
    const canvas = document.createElement("canvas");
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera("on");
        const tick = () => {
          const v = video.current;
          if (v && v.readyState === 4) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const q = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
            if (q?.data && (q.data !== lastRef.current.code || Date.now() - lastRef.current.at > 4000)) {
              lastRef.current = { code: q.data, at: Date.now() };
              submit(q.data);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch { setCamera("denied"); }
    };
    start();
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="relative aspect-[4/3] bg-black">
          <video ref={video} className="h-full w-full object-cover" muted playsInline />
          {camera !== "on" && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">{camera === "denied" ? "Camera not available here. Type the booking id below." : "Starting camera…"}</div>}
          {camera === "on" && <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/60 shadow-[0_0_0_999px_rgba(0,0,0,.35)]" />}
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit(code.trim()); setCode(""); }} className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} className="input font-mono uppercase" placeholder="PLT-XXXXXX" autoCapitalize="characters" />
        <button className="btn btn-primary" disabled={busy}>Check in</button>
      </form>
      {result && (
        <div className={`fade-up rounded-2xl border p-5 ${result.ok ? "border-ok/50 bg-ok/10" : "border-bad/50 bg-bad/10"}`}>
          <div className={`text-2xl font-black ${result.ok ? "text-ok" : "text-bad"}`}>{result.ok ? "✓ Welcome in" : "✕ Not admitted"}</div>
          {!result.ok && <div className="mt-1 text-sm">{result.reason}</div>}
          {result.show && <div className="mt-2 text-sm"><div className="font-semibold">{result.show.title} · {result.show.time}</div><div className="text-muted">{result.show.screen}</div></div>}
          {result.booking && <div className="mt-2 text-lg font-bold">Seats {result.booking.seats.join(", ")} <span className="ml-2 font-mono text-xs text-muted">{result.booking.id}</span></div>}
        </div>
      )}
      {history.length > 1 && (
        <ul className="divide-y divide-line text-xs text-muted">{history.slice(1).map((h, i) => <li key={i} className="flex justify-between py-1.5"><span className={h.ok ? "text-ok" : "text-bad"}>{h.ok ? "in" : "refused"}</span><span>{h.booking?.id ?? "?"} · {h.booking?.seats.join(", ")}</span><span>{h.reason ?? h.show?.title}</span></li>)}</ul>
      )}
    </div>
  );
}
