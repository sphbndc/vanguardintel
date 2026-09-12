import { useState } from "react";
import type { Threat } from "@/types/threat";

interface ThreatCardProps { threat: Threat; onSimulate: (threat: Threat) => void }

function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export function ThreatCard({ threat, onSimulate }: ThreatCardProps) {
  const [copyLabel, setCopyLabel] = useState("Copy rule");
  const [mediaFailed, setMediaFailed] = useState(false);
  const critical = threat.severity === "critical";
  const sourceVisual = {
    "CISA KEV": { image: "/sources/cisa.svg", label: "CISA exploited-vulnerability catalog", glow: "from-red-500/20" },
    "AlienVault OTX": { image: "/sources/otx.svg", label: "AlienVault community threat pulse", glow: "from-cyan-500/20" },
    "GitHub Advisory": { image: "/sources/github.svg", label: "GitHub reviewed security advisory", glow: "from-violet-500/20" },
  }[threat.source] ?? { image: "/sources/nvd.svg", label: "Open-source intelligence record", glow: "from-amber-500/20" };
  const showMedia = Boolean(threat.media_url) && !mediaFailed;

  async function copyDetection() {
    try { await navigator.clipboard.writeText(threat.detection_starter); setCopyLabel("Copied"); }
    catch { setCopyLabel("Copy failed"); }
    window.setTimeout(() => setCopyLabel("Copy rule"), 1800);
  }

  return (
    <article className="surface overflow-hidden rounded-2xl border-t-2 border-t-[var(--primary)] transition-transform duration-200 hover:-translate-y-px">
      <div className="grid lg:grid-cols-2">
        <div className="p-5 sm:p-6">
          <div className="relative mb-5 h-36 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted)]">
            {showMedia ? (
              <img src={threat.media_url!} alt={`Media supplied with ${threat.title} by ${threat.source}`} width="800" height="360" loading="lazy" onError={() => setMediaFailed(true)} className="h-full w-full object-cover" />
            ) : (
              <div className={`relative flex h-full items-center gap-4 bg-linear-to-br ${sourceVisual.glow} via-[var(--card)] to-[var(--muted)] px-5`}>
                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:24px_24px]" aria-hidden="true" />
                <img src={sourceVisual.image} alt="" width="56" height="56" className="relative h-14 w-14 rounded-xl shadow-lg" />
                <div className="relative min-w-0"><p className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--primary)]">Source intelligence</p><p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">{sourceVisual.label}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Structured feed · no source media attached</p></div>
              </div>
            )}
            {showMedia && <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-linear-to-t from-slate-950/90 to-transparent px-4 pb-3 pt-8 text-white"><img src={sourceVisual.image} alt="" width="28" height="28" className="h-7 w-7 rounded-md" /><div><p className="text-xs font-bold">{threat.source}</p><p className="font-mono text-[9px] uppercase tracking-wider text-slate-300">Source-provided media</p></div></div>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase ${critical ? "border-red-300 bg-red-500/10 text-red-700 dark:border-red-900 dark:text-red-300" : "border-amber-300 bg-amber-500/10 text-amber-700 dark:border-amber-900 dark:text-amber-300"}`}>{threat.severity}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">{threat.source} · {threat.external_id || threat.kind}</span>
          </div>
          <h3 className="mt-4 text-lg font-bold leading-snug text-[var(--foreground)] sm:text-xl">{threat.title}</h3>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]"><span>{threat.vendor} / {threat.product}</span><span>Added {formatDate(threat.date_added)}</span></div>
          <p className="line-clamp-4 mt-5 text-sm leading-6 text-[var(--muted-foreground)]">{threat.description}</p>
          <div className="mt-5"><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">MITRE ATT&amp;CK mapping</p><div className="flex flex-wrap gap-2">{threat.mitre_techniques.length ? threat.mitre_techniques.map((technique) => <span key={technique.id} className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">{technique.id} · {technique.name}</span>) : <span className="text-xs text-[var(--muted-foreground)]">No keyword-derived techniques</span>}</div></div>
        </div>
        <div className="border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_30%,transparent)] p-5 sm:p-6 lg:border-l lg:border-t-0">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--primary)]">Actionable remediation</p><p className="mt-3 text-sm leading-6 text-[var(--foreground)]">{threat.remediation}</p>
          <a href={threat.patch_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-bold text-[var(--foreground)] transition-colors hover:border-red-400">Open vendor guidance <span aria-hidden="true">↗</span></a>
          <div className="mt-5"><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Extracted indicators</p><div className="flex flex-wrap gap-2">{threat.iocs.length ? threat.iocs.map((ioc) => <span key={`${ioc.type}-${ioc.value}`} title={ioc.value} className="max-w-full truncate rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 font-mono text-[10px] text-[var(--foreground)]">{ioc.type}: {ioc.value}</span>) : <span className="text-xs text-[var(--muted-foreground)]">No indicators published with this record</span>}</div></div>
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-3"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Detection starter</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Experimental Sigma scaffold</p></div><button type="button" onClick={copyDetection} className="min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-xs font-semibold text-[var(--primary)] hover:bg-red-500/10">{copyLabel}</button></div>
          <button type="button" onClick={() => onSimulate(threat)} className="mt-4 min-h-12 w-full cursor-pointer rounded-xl bg-[var(--secondary)] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90">Simulate Incident Response</button>
        </div>
      </div>
    </article>
  );
}
