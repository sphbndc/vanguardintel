import { useCallback, useEffect, useMemo, useState } from "react";
import { ThreatCard } from "@/components/dashboard/threat-card";
import { TriageModal } from "@/components/dashboard/triage-modal";
import LogoCloudMarquee from "@/components/ui/logo-cloud-marquee";
import type { Threat, ThreatResponse } from "@/types/threat";

const sourceLogos = [
  { name: "CISA KEV", image: "/sources/cisa.svg" },
  { name: "AlienVault OTX", image: "/sources/otx.svg" },
  { name: "GitHub Advisories", image: "/sources/github.svg" },
  { name: "MITRE ATT&CK", image: "/sources/mitre.svg" },
  { name: "NVD enrichment", image: "/sources/nvd.svg" },
];

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function formatDate(value?: string) {
  if (!value) return "Awaiting snapshot";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem("vanguard-theme") !== "light");
  const [data, setData] = useState<ThreatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(15);
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("vanguard-theme", dark ? "dark" : "light");
  }, [dark]);

  const loadThreats = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/threats`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      setData(await response.json() as ThreatResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reach the intelligence API");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadThreats(); }, [loadThreats]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.threats ?? []).filter((threat) =>
      (source === "all" || threat.source === source) &&
      (!needle || JSON.stringify([threat.external_id, threat.title, threat.vendor, threat.product, threat.description, threat.iocs]).toLowerCase().includes(needle)),
    );
  }, [data, query, source]);

  const operational = data?.sources.filter((item) => item.status === "operational").length ?? 0;
  const degraded = !data || data.status === "degraded";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <a href="#intelligence" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white transition-transform focus:translate-y-0">Skip to intelligence</a>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_90%,transparent)] backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
          <a href="#top" className="flex min-h-11 items-center gap-3 rounded-lg" aria-label="Vanguard Intel home"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--primary)] font-mono font-black text-white">V</span><span><strong className="block text-sm tracking-[.16em]">VANGUARD</strong><span className="block font-mono text-[10px] tracking-[.32em] text-[var(--primary)]">INTEL</span></span></a>
          <div className="flex items-center gap-2"><span className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold sm:flex" aria-live="polite"><span className={`h-2 w-2 rounded-full ${degraded ? "bg-amber-500" : "bg-emerald-500"}`} />{degraded ? "Partial coverage" : "Sources healthy"}</span><button type="button" onClick={() => setDark((value) => !value)} className="grid h-11 w-11 cursor-pointer place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)]" aria-label={`Switch to ${dark ? "light" : "dark"} theme`} aria-pressed={dark}>{dark ? <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg> : <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/></svg>}</button></div>
        </nav>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden border-b border-[var(--border)]">
          <div className="grid-field absolute inset-0 -z-10" aria-hidden="true" />
          <div className="mx-auto grid max-w-[1480px] gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[.14em] text-[var(--primary)]"><span className="h-2 w-2 rounded-full bg-current" />Open-source intelligence operations</div>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-[-.045em] sm:text-5xl lg:text-7xl">Threat intelligence that ends in <span className="text-[var(--primary)]">action.</span></h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted-foreground)] sm:text-lg">Vanguard Intel correlates CISA exploited vulnerabilities, AlienVault community indicators, and critical GitHub advisories—then builds the patch guidance, hunting query, and Tier 1 response plan.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href="#intelligence" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-bold text-white hover:opacity-90">Open actionability matrix</a><button type="button" disabled={loading} onClick={() => void loadThreats()} className="min-h-12 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60">{loading ? "Collecting intelligence…" : "Refresh snapshot"}</button></div>
              <p className="mt-4 font-mono text-[11px] text-[var(--muted-foreground)]">15-minute cache · read-only OSINT · analyst validation required</p>
            </div>

            <div className="surface overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--muted-foreground)]">Collection fabric</p><h2 className="mt-1 font-bold">OSINT source telemetry</h2></div><span className="rounded-md bg-[var(--muted)] px-2 py-1 font-mono text-xs">{operational} / {data?.sources.length ?? 3} online</span></div>
              <div className="divide-y divide-[var(--border)]" aria-busy={loading}>{loading ? [0,1,2].map((item) => <div key={item} className="h-[72px] animate-pulse bg-[var(--muted)]/50" />) : data?.sources.map((item) => <div key={item.source} className="flex items-start justify-between gap-4 p-5"><div><h3 className="text-sm font-bold">{item.source}</h3><p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{item.message || `${item.count} normalized signals`}</p></div><span className={`shrink-0 font-mono text-[10px] font-bold uppercase ${item.status === "operational" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-300"}`}>{item.status}</span></div>)}</div>
              <div className="border-t border-[var(--border)] bg-[var(--muted)]/50 px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{formatDate(data?.generated_at)} · cache {data?.cache.state ?? "pending"}</div>
            </div>
          </div>
        </section>

        <LogoCloudMarquee title="Open sources. One defensive picture." description="Public vulnerability catalogs, community telemetry, vendor advisories, and ATT&CK context are normalized into one analyst-ready workflow." data={sourceLogos} className="border-b border-[var(--border)] py-16 md:py-20" />

        <div className="mx-auto max-w-[1480px] px-4 pt-6 sm:px-6 lg:px-8"><div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs leading-5 text-cyan-900 dark:text-cyan-100" role="note"><strong>Prototype data policy:</strong> threat history is retained for {data?.storage?.retention_days ?? 90} days on a best-effort basis. Vercel and Render Free use ephemeral filesystems, so local SQLite history can reset after function replacement or service restart.</div></div>

        <section className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8" aria-label="Threat summary"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Total signals", data?.stats.total, ""],["Critical", data?.stats.critical, "text-[var(--primary)]"],["High priority", data?.stats.high, "text-amber-600 dark:text-amber-300"],["Sources online", data?.stats.sources_operational, "text-emerald-600 dark:text-emerald-400"]].map(([label,value,color]) => <article key={String(label)} className="surface rounded-xl p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{label}</p><p className={`mt-2 text-3xl font-extrabold ${color}`}>{loading ? "—" : Number(value ?? 0).toLocaleString()}</p></article>)}</div></section>

        <section id="intelligence" className="mx-auto max-w-[1480px] scroll-mt-24 px-4 pb-20 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-5 border-b border-[var(--border)] pb-6 xl:flex-row xl:items-end xl:justify-between"><div><p className="font-mono text-xs font-semibold uppercase tracking-[.16em] text-[var(--primary)]">Prioritized intelligence queue</p><h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">The Actionability Matrix</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">Threat context on the left. Containment, detection, and remediation evidence on the right.</p></div><div className="flex flex-col gap-3 sm:flex-row"><label><span className="sr-only">Search intelligence</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleLimit(15); }} placeholder="Search CVE, product, IoC…" className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-sm sm:w-64" /></label><label><span className="sr-only">Filter by source</span><select value={source} onChange={(event) => { setSource(event.target.value); setVisibleLimit(15); }} className="min-h-11 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm sm:w-48"><option value="all">All sources</option><option value="CISA KEV">CISA KEV</option><option value="AlienVault OTX">AlienVault OTX</option><option value="GitHub Advisory">GitHub Advisories</option></select></label></div></div>
          {(error || data?.status === "degraded") && <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" role="status">{error ? `The intelligence API could not be reached: ${error}` : data?.message || "Coverage is partial. Available intelligence remains actionable; review source telemetry for details."}</div>}
          <div className="space-y-4" aria-live="polite" aria-busy={loading}>{matches.slice(0, visibleLimit).map((threat) => <ThreatCard key={`${threat.source}-${threat.external_id}`} threat={threat} onSimulate={setSelectedThreat} />)}</div>
          {!loading && !matches.length && <div className="surface rounded-2xl px-6 py-16 text-center"><h3 className="font-bold">No matching intelligence</h3><p className="mt-2 text-sm text-[var(--muted-foreground)]">Adjust the search or source filter to widen the queue.</p></div>}
          {visibleLimit < matches.length && <div className="mt-6 flex justify-center"><button type="button" onClick={() => setVisibleLimit((value) => value + 15)} className="min-h-12 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-bold hover:bg-[var(--muted)]">Load more intelligence ({matches.length - visibleLimit} remaining)</button></div>}
        </section>
      </main>
      <footer className="border-t border-[var(--border)]"><div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-8 text-xs text-[var(--muted-foreground)] sm:flex-row sm:justify-between sm:px-6 lg:px-8"><p>Vanguard Intel · SOC automation prototype</p><p className="font-mono">CISA KEV · AlienVault OTX · GitHub Advisory Database</p></div></footer>
      <TriageModal threat={selectedThreat} onClose={() => setSelectedThreat(null)} />
    </div>
  );
}
