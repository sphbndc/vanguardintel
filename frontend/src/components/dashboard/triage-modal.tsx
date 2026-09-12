import { useEffect, useRef } from "react";
import type { Threat } from "@/types/threat";

interface TriageModalProps { threat: Threat | null; onClose: () => void }

export function TriageModal({ threat, onClose }: TriageModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threat) return;
    previousFocus.current = document.activeElement as HTMLElement;
    closeButton.current?.focus(); document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel.current) return;
      const controls = [...panel.current.querySelectorAll<HTMLElement>("button, a[href]")];
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; previousFocus.current?.focus(); };
  }, [threat, onClose]);

  if (!threat) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="triage-title" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div ref={panel} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:px-6"><div><p className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-[var(--primary)]">Tier 1 response simulation</p><h2 id="triage-title" className="mt-1 text-lg font-bold">Analyst triage checklist</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">{threat.external_id} · {threat.product}</p></div><button ref={closeButton} type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-[var(--border)] text-xl hover:bg-[var(--muted)]" aria-label="Close triage simulator">×</button></div>
        <div className="space-y-3 px-5 py-6 sm:px-6">{threat.playbook.map((step, index) => <section key={step.phase} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-xl border border-[var(--border)] p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-red-500/10 font-mono text-sm font-bold text-[var(--primary)]">0{index + 1}</span><div><p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">{step.phase}</p><h3 className="mt-1 font-bold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{step.action}</p>{step.query && <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-200">{step.query}</pre>}{step.link && <a href={step.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-[var(--primary)]">Open remediation reference →</a>}</div></section>)}<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-5 text-amber-800 dark:text-amber-200"><strong>Simulation only.</strong> Validate scope, evidence, and change controls before taking production action.</div></div>
      </div>
    </div>
  );
}
