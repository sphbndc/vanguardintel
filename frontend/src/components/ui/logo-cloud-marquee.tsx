"use client";

import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { FlowingLogos } from "@/components/ui/logo-cloud-marquee-utils/flowing-logos";
import { cn } from "@/lib/utils";

interface Logo {
  name: string;
  image: string;
}

interface LogoCloudMarqueeProps {
  title?: string;
  description?: string;
  data?: Logo[];
  className?: string;
}

const defaultLogos: Logo[] = [
  {
    image: "https://cdn.21st.dev/assets/localized/516a7fa4afe42d07cafad5ba8b7b56b7a56ab67da65ee266570e889c6c766ac3.svg",
    name: "Phoenix",
  },
  {
    image: "https://cdn.21st.dev/assets/localized/122afd662757e7d2a4a543ddd3bc338f1327fa6c43de21901a37d25d4a1de18f.svg",
    name: "Oslo",
  },
  {
    image: "https://cdn.21st.dev/assets/localized/459715ed01db097ae5374685a01be402de24d5ca2036e659fd8167f4bd1fc1a0.svg",
    name: "Theo",
  },
  {
    image: "https://cdn.21st.dev/assets/localized/38ee0fbd73d4af5f27eb3c7dd44dba82774daa6be0fc00b0a355648f5dff3d06.svg",
    name: "Kansas",
  },
  {
    image: "https://cdn.21st.dev/assets/localized/97b7a987106206f54e1756842b38ff76361763b824c634e27209fc525315a1e6.svg",
    name: "Cairo",
  },
];

export default function LogoCloudMarquee({
  title = "Built with technologies trusted by",
  description = "ScrollX UI aligns with the ecosystem powering the world’s most ambitious products.",
  data = defaultLogos,
  className,
}: LogoCloudMarqueeProps) {
  const words = title.split(" ");
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);

  return (
    <section className={cn("relative w-full overflow-hidden py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="relative z-10 mx-auto max-w-4xl text-center text-3xl font-bold tracking-tight text-[var(--foreground)] md:text-4xl lg:text-5xl">
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="mr-2 inline-block"
            >
              {word}
            </span>
          ))}
        </h2>
        <p className="relative z-10 mx-auto mt-5 max-w-2xl text-center text-base text-[var(--muted-foreground)] md:text-lg">
          {description}
        </p>
        <div className="relative mt-14">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-20 bg-linear-to-r from-[var(--background)] via-[color-mix(in_srgb,var(--background)_72%,transparent)] to-transparent sm:w-32" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-20 bg-linear-to-l from-[var(--background)] via-[color-mix(in_srgb,var(--background)_72%,transparent)] to-transparent sm:w-32" />
          <FlowingLogos data={data} variant="wide" className="[--duration:35s]" paused={paused} />
        </div>
        {!reducedMotion && (
          <div className="mt-3 flex justify-center">
            <button type="button" onClick={() => setPaused((value) => !value)} className="min-h-11 cursor-pointer rounded-lg px-4 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]" aria-pressed={paused}>
              {paused ? "Resume source movement" : "Pause source movement"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
