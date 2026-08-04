"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  className = "",
  pendingText = "Un instant…",
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-pine text-card font-semibold px-4 py-3 transition-colors hover:bg-pine-deep disabled:opacity-60 ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
