// 16px minimum : en dessous, Safari iOS zoome automatiquement sur le champ
// au focus, et ne dézoome pas toujours après.
export const inputClass =
  "w-full rounded-xl border border-line bg-card px-3.5 py-3 text-[16px] text-ink placeholder:text-ink-soft/60 focus:border-pine focus:outline-none";

export const labelClass = "block text-[13px] font-semibold text-ink-soft mb-1.5";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-pine text-card font-semibold px-4 py-3 transition-colors hover:bg-pine-deep disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-pine/50";
