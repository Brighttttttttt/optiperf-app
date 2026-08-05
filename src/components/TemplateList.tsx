import { Card } from "./ui";
import { deleteTemplate } from "@/app/(app)/actions";
import { formatDuration } from "@/lib/dates";
import { sessionTypeLabel, type SessionTemplate } from "@/lib/types";

/** Bibliothèque de séances du coach, gérée depuis les réglages. */
export function TemplateList({ templates }: { templates: SessionTemplate[] }) {
  return (
    <Card className="p-4">
      <p className="font-semibold">Mes modèles de séance</p>
      <p className="mt-0.5 text-[13px] text-ink-soft">
        {templates.length === 0
          ? "Coche « garder comme modèle » en planifiant une séance : elle sera réutilisable en un tap."
          : "Réutilisables depuis l'écran de planification."}
      </p>
      {templates.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{t.title}</p>
                <p className="text-[13px] text-ink-soft">
                  {sessionTypeLabel(t.type)}
                  {t.duration_planned_min
                    ? ` · ${formatDuration(t.duration_planned_min)}`
                    : ""}
                </p>
              </div>
              <form action={deleteTemplate}>
                <input type="hidden" name="template_id" value={t.id} />
                <button
                  type="submit"
                  className="text-[13px] font-semibold text-ink-soft hover:text-rpe-max"
                >
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
