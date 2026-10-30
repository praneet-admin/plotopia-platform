"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { inr } from "@/lib/format";

export function PayForm({ action, idem, total, upiId, upiLink, gpayLink, qrSvg }: { action: (fd: FormData) => Promise<void>; idem: string; total: number; upiId: string; upiLink: string; gpayLink: string; qrSvg: string }) {
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const gpay = () => {
    if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) { setHint("Open Google Pay on your phone, tap Scan, and point it at this code."); return; }
    const t = Date.now();
    location.href = gpayLink;
    setTimeout(() => { if (document.visibilityState === "visible" && Date.now() - t < 2500) location.href = upiLink; }, 1200);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(upiId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="idem" value={idem} />
      <input type="hidden" name="method" value="upi" />
      <div className="mx-auto w-fit rounded-2xl bg-white p-3">
        <div className="relative h-[220px] w-[220px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-bg-2 px-3 py-2 text-sm">
        <span className="text-muted">UPI ID</span>
        <code className="min-w-0 flex-1 truncate text-center font-mono">{upiId}</code>
        <button type="button" onClick={copy} className="btn btn-ghost btn-sm h-8">{copied ? "Copied" : "Copy"}</button>
      </div>
      <button type="button" onClick={gpay} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-[15px] font-semibold text-[#1f1f1f] hover:bg-gray-100">
        <GLogo /> Pay with Google Pay
      </button>
      {hint && <p className="mt-2 text-center text-xs text-muted">{hint}</p>}
      <Buttons total={total} />
    </form>
  );
}

function GLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.8-.4-4.1H24v7.5h12.1c-.3 2-1.6 5-4.6 7l7 5.4c4.1-3.8 6.6-9.4 6.6-15.8z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7-5.4c-1.9 1.3-4.4 2.2-7.5 2.2-5.8 0-10.7-3.9-12.4-9.2l-7.3 5.6C7.9 40.8 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.3c-.5-1.3-.7-2.8-.7-4.3s.3-3 .7-4.3l-7.3-5.6C2.9 17.1 2 20.4 2 24s.9 6.9 2.3 9.9l7.3-5.6z"/><path fill="#EA4335" d="M24 10.5c3.3 0 5.5 1.4 6.8 2.6l5-4.9C32.7 5.3 28.9 3 24 3 15.4 3 7.9 8.2 4.3 14.1l7.3 5.6c1.7-5.3 6.6-9.2 12.4-9.2z"/></svg>
  );
}

function Buttons({ total }: { total: number }) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-4 flex flex-col gap-2">
      <button name="outcome" value="ok" className="btn btn-primary w-full" disabled={pending}>{pending ? "Confirming…" : `I've paid ${inr(total)}`}</button>
      <button name="outcome" value="fail" className="btn btn-ghost btn-sm w-full" disabled={pending}>Payment didn&apos;t go through</button>
    </div>
  );
}
