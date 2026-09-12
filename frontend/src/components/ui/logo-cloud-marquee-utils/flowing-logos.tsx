import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface Logo {
  name: string;
  image: string;
}

interface FlowingLogosProps {
  data: Logo[];
  variant?: "wide" | "compact";
  className?: string;
  paused?: boolean;
}

export function FlowingLogos({ data, variant = "wide", className, paused = false }: FlowingLogosProps) {
  const reducedMotion = useReducedMotion();
  const logos = data.length ? data : [];

  return (
    <div
      className={cn("overflow-hidden [--gap:1.5rem]", variant === "compact" ? "py-2" : "py-4", className)}
      role="list"
      aria-label="Technology and intelligence sources"
    >
      <motion.div
        className="flex w-max items-center gap-[var(--gap)]"
        animate={reducedMotion || paused ? { x: 0 } : { x: ["0%", "calc(-50% - (var(--gap) / 2))"] }}
        transition={{ duration: 35, ease: "linear", repeat: reducedMotion || paused ? 0 : Infinity }}
      >
        {[...logos, ...logos].map((logo, index) => (
          <div
            key={`${logo.name}-${index}`}
            role="listitem"
            aria-hidden={index >= logos.length}
            className="flex h-16 min-w-52 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 shadow-sm transition-colors hover:border-[color:var(--primary)]"
          >
            <img src={logo.image} alt="" loading="lazy" className="h-8 w-8 object-contain" />
            <span className="whitespace-nowrap text-sm font-semibold text-[var(--foreground)]">{logo.name}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
