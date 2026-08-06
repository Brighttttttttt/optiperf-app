"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconChevronLeft, IconSend } from "./Icons";
import { formatDayRelative, toISODate } from "@/lib/dates";
import { initials } from "@/lib/initials";
import { LIMITS, type Message, type Profile } from "@/lib/types";

export function MessageThread({
  meId,
  partner,
  initialMessages,
}: {
  meId: string;
  partner: Profile;
  initialMessages: Message[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const markRead = useCallback(async () => {
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", meId)
      .eq("sender_id", partner.id)
      .is("read_at", null);
    router.refresh();
  }, [supabase, meId, partner.id, router]);

  useEffect(() => {
    markRead();
    const channel = supabase
      .channel(`thread:${partner.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${meId}`,
        },
        (payload) => {
          const m = payload.new as Message;
          if (m.sender_id !== partner.id) return;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
          markRead();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, meId, partner.id, markRead]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || content.length > LIMITS.message || sending) return;
    setSending(true);
    setSendError(null);
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: meId, recipient_id: partner.id, content })
      .select()
      .single<Message>();
    if (error) {
      // La base refuse au-delà de 20 messages par minute : le dire, plutôt
      // que de laisser le message disparaître sans explication.
      setSendError(
        /rate|minute|débit/i.test(error.message)
          ? "Trop de messages coup sur coup. Patiente une minute."
          : "Message non envoyé. Vérifie ta connexion et réessaie."
      );
    } else if (data) {
      setMessages((prev) => [...prev, data]);
      setText("");
    }
    setSending(false);
  }

  return (
    // S'arrête au-dessus de la barre de navigation, qui reste visible : le
    // fil garde son défilement propre, mais sans recouvrir les onglets.
    // Porte lui-même la zone sûre du haut, comme le reste des pages.
    <div className="fixed inset-x-0 top-0 bottom-28 z-40 bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto h-full w-full max-w-md flex flex-col">
        <header className="flex items-center gap-2.5 px-3 py-2.5 border-b border-line bg-card">
          <Link
            href="/messages"
            aria-label="Retour aux messages"
            className="p-1.5 -ml-1 rounded-full text-ink-soft hover:bg-line/60"
          >
            <IconChevronLeft className="size-6" />
          </Link>
          <span className="size-9 shrink-0 rounded-full bg-pine-soft text-pine font-display font-semibold text-[13px] flex items-center justify-center">
            {initials(partner.full_name)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-5 truncate">{partner.full_name}</p>
            <p className="text-[12px] text-ink-soft">
              {partner.role === "coach" ? "Coach" : "Athlète"}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-ink-soft py-8">
              Écris le premier message à {partner.full_name.split(" ")[0]}.
            </p>
          )}
          {messages.map((m, i) => {
            const day = toISODate(new Date(m.created_at));
            const prevDay =
              i > 0 ? toISODate(new Date(messages[i - 1].created_at)) : null;
            const mine = m.sender_id === meId;
            return (
              <Fragment key={m.id}>
                {day !== prevDay && (
                  <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-ink-soft my-3 first-letter:uppercase">
                    {formatDayRelative(day)}
                  </p>
                )}
                <div
                  className={`mb-1.5 max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    mine
                      ? "ml-auto bg-pine text-card rounded-br-sm"
                      : "mr-auto bg-card border border-line rounded-bl-sm"
                  }`}
                >
                  <p className="text-[15px] whitespace-pre-line break-words">
                    {m.content}
                  </p>
                  <p
                    className={`mt-0.5 text-right text-[10px] ${
                      mine ? "text-card/70" : "text-ink-soft"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {sendError && (
          <p
            role="alert"
            className="border-t border-line bg-rpe-max-soft px-4 py-2 text-[13px] font-medium text-rpe-max"
          >
            {sendError}
          </p>
        )}
        <form
          onSubmit={send}
          className="flex items-center gap-2 border-t border-line bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ton message…"
            aria-label="Ton message"
            maxLength={LIMITS.message}
            className="flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-[16px] focus:border-pine focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="Envoyer"
            className="size-11 shrink-0 rounded-full bg-pine text-card flex items-center justify-center transition-colors hover:bg-pine-deep disabled:opacity-50"
          >
            <IconSend className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
