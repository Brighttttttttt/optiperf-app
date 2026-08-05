"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Confirme la création groupée. L'affichage découle du paramètre d'URL ;
 * l'effet se contente de le retirer, ce qui fait disparaître le message.
 */
export function PlanningToast() {
  const params = useSearchParams();
  const router = useRouter();
  const count = Number(params.get("planifiees"));
  const show = Number.isFinite(count) && count > 0;

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => router.replace("/"), 4000);
    return () => clearTimeout(timer);
  }, [show, router]);

  if (!show) return null;

  return (
    <div
      role="status"
      className="mx-5 mb-3 rounded-xl bg-pine-soft px-3.5 py-2.5 text-sm font-medium text-pine-deep"
    >
      {count} séance{count > 1 ? "s" : ""} planifiée{count > 1 ? "s" : ""}. Tes
      athlètes ont été notifiés.
    </div>
  );
}
