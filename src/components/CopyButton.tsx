"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "./Icons";
import { btnGhost } from "@/lib/styles";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label="Copier le code"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`${btnGhost} h-[52px] px-3.5`}
    >
      {copied ? (
        <IconCheck className="size-5 text-pine" />
      ) : (
        <IconCopy className="size-5" />
      )}
    </button>
  );
}
