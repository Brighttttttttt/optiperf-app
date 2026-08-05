import { Card } from "./ui";
import { CopyButton } from "./CopyButton";

export function InviteCode({ code }: { code: string }) {
  return (
    <Card className="p-4">
      <p className="font-semibold">Ton code coach</p>
      <p className="mt-0.5 text-[13px] text-ink-soft">
        Partage-le à tes athlètes : ils le saisissent à l&apos;inscription ou
        dans Réglages pour rejoindre ton groupe.
      </p>
      <div className="mt-3 flex items-center gap-2">
        {/* Le code se lit et se retape à la main : chasse fixe, bien espacée,
            et une taille qui s'adapte à sa longueur. */}
        <span
          className={`flex-1 text-center font-display font-bold bg-pine-soft text-pine-deep rounded-xl py-2.5 tabular-nums ${
            code.length > 8
              ? "text-[20px] tracking-[0.18em] pl-[0.18em]"
              : "text-[28px] tracking-[0.35em] pl-[0.35em]"
          }`}
        >
          {code}
        </span>
        <CopyButton text={code} />
      </div>
    </Card>
  );
}
