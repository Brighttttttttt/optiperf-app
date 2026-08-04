import type { ReactNode } from "react";
import { IconPulse } from "@/components/Icons";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh w-full max-w-md mx-auto flex flex-col justify-center px-6 py-10">
      <div className="mb-10 flex items-center gap-2.5">
        <span className="inline-flex items-center justify-center size-10 rounded-xl bg-pine text-card">
          <IconPulse className="size-6" />
        </span>
        <div>
          <p className="font-display text-2xl leading-6 font-bold uppercase tracking-[0.08em]">
            Optiperf
          </p>
          <p className="text-[12px] text-ink-soft">
            Le carnet d&apos;entraînement partagé
          </p>
        </div>
      </div>
      {children}
    </main>
  );
}
