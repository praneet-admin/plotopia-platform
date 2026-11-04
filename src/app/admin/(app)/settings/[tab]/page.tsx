import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/admin";
import { fmtDateTime } from "@/lib/format";
import { renderSample } from "@/lib/notify";
import { getSettings, SECTIONS, settingsMeta, type SectionKey } from "@/lib/settings";
import { deleteCinema, resetSettings, saveCinema, saveHallMap, saveSettings } from "../actions";
import { FIELDS, PLACEHOLDERS, TABS, type Field } from "../fields";

export default async function SettingsTab({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireStaff(["admin", "manager"]);
  const { tab } = await params;
  const sp = await searchParams;
  if (!SECTIONS.includes(tab as SectionKey)) notFound();
  const key = tab as SectionKey;
  const [all, meta] = await Promise.all([getSettings(), settingsMeta()]);
  const values = all[key] as Record<string, unknown>;
  const t = TABS.find((x) => x.key === key)!;
  const save = saveSettings.bind(null, key);
  const reset = resetSettings.bind(null, key);

  // Tab-specific extras.
  const movies = key === "home" ? await db.query.movies.findMany({ where: and(eq(schema.movies.status, "now_showing"), isNull(schema.movies.deletedAt)), orderBy: asc(schema.movies.title) }) : [];
  const cinemas = key === "cinema" ? await db.query.cinemas.findMany({ orderBy: asc(schema.cinemas.name) }) : [];
  const screens = key === "simulator" ? await db.query.screens.findMany({ where: isNull(schema.screens.deletedAt), orderBy: asc(schema.screens.sortOrder) }) : [];
  const samples = key === "messages" ? Object.fromEntries(await Promise.all(FIELDS.messages.map(async (f) => [f.key, await renderSample(String(values[f.key] ?? ""))]))) : {};
  let preview = t.preview;
  if (key === "booking") { const m = await db.query.movies.findFirst({ where: and(eq(schema.movies.status, "now_showing"), isNull(schema.movies.deletedAt)) }); preview = m ? `/movies/${m.slug}#showtimes` : "/"; }
  if (key === "payment") { const b = await db.query.bookings.findFirst({ where: eq(schema.bookings.status, "pending"), orderBy: desc(schema.bookings.createdAt) }); preview = b ? `/pay/${b.id}` : null; }
  if (key === "simulator") preview = all.simulator.url;
  const m = meta[key];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Settings</h1><div className="text-sm text-muted">Everything the public site shows, editable here. Changes are live on the next page load.</div></div>
        <Link href="/admin/activity" className="btn btn-ghost btn-sm">Activity log</Link>
      </div>
      <nav className="scroll-x -mx-4 flex gap-1 border-b border-line px-4 pb-px">
        {TABS.map((x) => <Link key={x.key} href={`/admin/settings/${x.key}`} className={`flex-none border-b-2 px-3 py-2 text-sm ${x.key === key ? "border-brand font-semibold text-text" : "border-transparent text-muted hover:text-text"}`}>{x.label}</Link>)}
      </nav>
      {sp.ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-green-100">{sp.ok}</div>}
      {sp.error && <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">{sp.error}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <form action={save} className="card space-y-5 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-semibold">{t.label}</h2><span className="text-xs text-muted">{t.blurb}</span></div>
          {key === "messages" && <p className="rounded-lg bg-bg-2 px-3 py-2 text-xs text-muted">Placeholders: <code className="font-mono">{PLACEHOLDERS}</code></p>}
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS[key].map((f) => <FieldInput key={f.key} f={f} value={values[f.key]} movies={movies} sample={samples[f.key]} featured={key === "home" ? (values.featured as string[]) : []} />)}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button className="btn btn-primary">Save {t.label.toLowerCase()}</button>
            {me.role === "admin" && <button formAction={reset} className="btn btn-ghost btn-sm" formNoValidate>Reset to defaults</button>}
            {m && <span className="ml-auto text-xs text-muted">Last saved {fmtDateTime(m.updatedAt)}</span>}
          </div>
        </form>

        <aside className="space-y-4">
          <div className="card p-4 text-sm">
            <div className="font-semibold">Live preview</div>
            <p className="mt-1 text-xs text-muted">Opens the public page this tab controls, in a new tab. Reload it after saving.</p>
            {preview ? <a href={preview} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-3 w-full">{t.previewLabel} ↗</a> : <p className="mt-3 text-xs text-muted">{key === "payment" ? "No pending payment right now. Start a booking on the site to see the pay page." : "Nothing to preview."}</p>}
          </div>
          {key === "payment" && <div className="card p-4 text-xs text-muted">The QR on the pay page encodes <code className="font-mono text-text">upi://pay?pa={all.payment.upiId}&amp;pn={all.payment.payeeName}</code> plus the amount and booking id, so changing the UPI ID here changes where the money goes.</div>}
          {key === "booking" && <div className="card p-4 text-xs text-muted">Hold time and seat limits apply to new picks at once. Fees and GST apply to new checkouts; existing pending bookings keep their total. The refund policy is evaluated at cancellation time.</div>}
        </aside>
      </div>

      {key === "cinema" && (
        <section className="card space-y-4 p-5">
          <div><h2 className="font-semibold">Theatres</h2><p className="text-xs text-muted">Shown on the Theatres page, in filters and on tickets. Halls belong to a theatre.</p></div>
          <div className="space-y-3">
            {cinemas.map((c) => (
              <form key={c.id} action={saveCinema} className="grid gap-2 rounded-xl border border-line bg-bg-2 p-3 sm:grid-cols-6">
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} className="input h-9 sm:col-span-2" placeholder="Name" required />
                <input name="city" defaultValue={c.city} className="input h-9" placeholder="City" />
                <input name="address" defaultValue={c.address} className="input h-9 sm:col-span-3" placeholder="Address" />
                <input name="phone" defaultValue={c.phone ?? ""} className="input h-9" placeholder="Phone" />
                <input name="hours" defaultValue={c.hours ?? ""} className="input h-9 sm:col-span-2" placeholder="Opening hours, e.g. 9 am – 1 am" />
                <input name="mapUrl" defaultValue={c.mapUrl ?? ""} className="input h-9 sm:col-span-2" placeholder="Map link (https://maps…)" />
                <div className="flex gap-1"><button className="btn btn-primary btn-sm h-9 flex-1">Save</button>{me.role === "admin" && <button formAction={deleteCinema} className="btn btn-danger btn-sm h-9" formNoValidate>Delete</button>}</div>
              </form>
            ))}
          </div>
          <form action={saveCinema} className="grid gap-2 rounded-xl border border-dashed border-line p-3 sm:grid-cols-6">
            <input name="name" className="input h-9 sm:col-span-2" placeholder="New theatre name" required />
            <input name="city" defaultValue={all.cinema.city} className="input h-9" placeholder="City" />
            <input name="address" className="input h-9 sm:col-span-2" placeholder="Address" />
            <button className="btn btn-ghost btn-sm h-9">Add theatre</button>
          </form>
        </section>
      )}

      {key === "simulator" && (
        <form action={saveHallMap} className="card space-y-3 p-5">
          <div><h2 className="font-semibold">Hall mapping</h2><p className="text-xs text-muted">The simulator ships three 3D halls: <code className="font-mono">audi3</code>, <code className="font-mono">audi1</code> and <code className="font-mono">imax</code>. Each screen here opens in one of them; seat labels must exist in that hall.</p></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {screens.map((s) => (
              <label key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg-2 px-3 py-2 text-sm"><span>{s.name} <span className="font-mono text-xs text-muted">{s.id}</span></span>
                <select name={`sim_${s.id}`} defaultValue={s.layout.simId ?? ""} className="input h-8 w-28 px-2 text-xs"><option value="">same id</option><option value="audi3">audi3</option><option value="audi1">audi1</option><option value="imax">imax</option></select></label>
            ))}
          </div>
          <button className="btn btn-primary btn-sm">Save mapping</button>
        </form>
      )}
    </div>
  );
}

function FieldInput({ f, value, movies, sample, featured }: { f: Field; value: unknown; movies: { id: string; title: string }[]; sample?: string; featured: string[] }) {
  const wide = f.type === "textarea" || f.type === "featured" || f.type === "image" || f.type === "list";
  const hint = f.hint && <p className="mt-1 text-[11px] text-muted">{f.hint}</p>;
  const id = `f_${f.key}`;
  if (f.type === "bool") return <label className="flex items-start gap-3 rounded-lg border border-line bg-bg-2 px-3 py-2.5 text-sm"><input type="checkbox" name={f.key} defaultChecked={!!value} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" /><span><span className="font-medium">{f.label}</span>{hint}</span></label>;
  if (f.type === "textarea") return <div className="sm:col-span-2"><label className="label" htmlFor={id}>{f.label}</label><textarea id={id} name={f.key} rows={4} defaultValue={String(value ?? "")} className="input font-mono text-[13px]" />{hint}{sample !== undefined && <details className="mt-1 text-xs text-muted"><summary className="cursor-pointer">Sample</summary><pre className="mt-1 whitespace-pre-wrap rounded-lg bg-bg-2 p-2 font-sans">{sample}</pre></details>}</div>;
  if (f.type === "list") return <div className="sm:col-span-2"><label className="label" htmlFor={id}>{f.label}</label><textarea id={id} name={f.key} rows={3} defaultValue={(value as string[] ?? []).join("\n")} className="input" />{hint}</div>;
  if (f.type === "color") return <div><label className="label" htmlFor={id}>{f.label}</label><div className="flex items-center gap-2"><input id={id} name={f.key} type="color" defaultValue={String(value ?? "#ffc20e")} className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-bg-2" /><span className="font-mono text-xs text-muted">{String(value ?? "")}</span></div>{hint}</div>;
  if (f.type === "image") {
    const v = String(value ?? "");
    return (
      <div className="sm:col-span-2">
        <label className="label" htmlFor={id}>{f.label}</label>
        <div className="flex flex-wrap items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {v ? <img src={v} alt="" className="h-14 max-w-[160px] rounded-lg border border-line bg-bg-2 object-contain p-1" /> : <div className="flex h-14 w-20 items-center justify-center rounded-lg border border-dashed border-line text-[10px] text-muted">built-in</div>}
          <div className="min-w-0 flex-1 space-y-2">
            <input id={id} name={f.key} defaultValue={v.startsWith("data:") ? "" : v} className="input h-9" placeholder="https://… (or upload below)" />
            <div className="flex flex-wrap items-center gap-3 text-xs"><input type="file" name={`${f.key}_file`} accept="image/*" className="text-muted file:mr-2 file:rounded-md file:border file:border-line file:bg-bg-2 file:px-2 file:py-1 file:text-xs file:text-text" />{v && <label className="flex items-center gap-1 text-muted"><input type="checkbox" name={`${f.key}_clear`} /> Remove</label>}</div>
          </div>
        </div>
        {hint}
      </div>
    );
  }
  if (f.type === "featured") return (
    <div className="sm:col-span-2">
      <div className="label">{f.label}</div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {movies.map((mv) => { const pos = featured.indexOf(mv.id); return <label key={mv.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-bg-2 px-3 py-1.5 text-sm"><span className="truncate">{mv.title}</span><input type="number" name={`featured_${mv.id}`} min={1} max={99} defaultValue={pos >= 0 ? pos + 1 : ""} placeholder="–" className="input h-8 w-16 px-2 text-center" /></label>; })}
      </div>
      {hint}
    </div>
  );
  if (f.type === "select") return <div><label className="label" htmlFor={id}>{f.label}</label><select id={id} name={f.key} defaultValue={String(value ?? "")} className="input">{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>{hint}</div>;
  return <div className={wide ? "sm:col-span-2" : ""}><label className="label" htmlFor={id}>{f.label}</label><input id={id} name={f.key} type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} step={f.type === "number" ? f.step ?? 1 : undefined} min={f.type === "number" ? f.min : undefined} max={f.type === "number" ? f.max : undefined} defaultValue={String(value ?? "")} className="input" />{hint}</div>;
}
