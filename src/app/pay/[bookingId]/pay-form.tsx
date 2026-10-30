"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { inr } from "@/lib/format";

export function PayForm({ action, idem, total }: { action: (fd: FormData) => Promise<void>; idem: string; total: number }) {
  const [method, setMethod] = useState<"upi" | "card">("upi");
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="idem" value={idem} />
      <input type="hidden" name="method" value={method} />
      <div className="grid grid-cols-2 gap-2">
        {(["upi", "card"] as const).map((m) => (
          <button type="button" key={m} onClick={() => setMethod(m)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${method === m ? "border-brand bg-brand/10" : "border-line bg-bg-2"}`}>{m === "upi" ? "UPI" : "Card"}</button>
        ))}
      </div>
      {method === "upi" ? (
        <div className="mt-4"><label className="label" htmlFor="vpa">UPI ID</label><input id="vpa" className="input" defaultValue="demo@showpay" /><p className="mt-1 text-xs text-muted">Any ID works in test mode.</p></div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label" htmlFor="cc">Card number</label><input id="cc" className="input num" defaultValue="4242 4242 4242 4242" inputMode="numeric" /></div>
          <div><label className="label" htmlFor="exp">Expiry</label><input id="exp" className="input num" defaultValue="12/29" /></div>
          <div><label className="label" htmlFor="cvv">CVV</label><input id="cvv" className="input num" defaultValue="123" inputMode="numeric" /></div>
        </div>
      )}
      <Buttons total={total} />
    </form>
  );
}

function Buttons({ total }: { total: number }) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-5 flex flex-col gap-2">
      <button name="outcome" value="ok" className="btn btn-primary w-full" disabled={pending}>{pending ? "Processing…" : `Pay ${inr(total)}`}</button>
      <button name="outcome" value="fail" className="btn btn-ghost btn-sm w-full" disabled={pending}>Simulate a failed payment</button>
    </div>
  );
}
