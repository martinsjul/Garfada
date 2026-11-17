"use client";

import { useCallback, useRef, useState } from "react";
import { readEvents } from "@/lib/readEvents";
import type { ChatMessage, LatLng, Place } from "@/lib/types";

export type UIMessage = ChatMessage & { places?: Place[]; error?: boolean };

const OFFLINE = "Sem conexão. Verifique sua internet e tente de novo.";
const GENERIC = "Ops, algo deu errado. Tente de novo.";

export function useChat(location?: LatLng) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const history = useRef<UIMessage[]>([]);

  const update = useCallback((next: UIMessage[]) => {
    history.current = next;
    setMessages(next);
  }, []);

  const patchLast = useCallback(
    (patch: (m: UIMessage) => UIMessage) => {
      const list = history.current;
      update([...list.slice(0, -1), patch(list[list.length - 1])]);
    },
    [update],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busy.current) return;
      busy.current = true;
      setLoading(true);

      // Mensagens de erro não voltam para a IA como contexto.
      const payload: ChatMessage[] = [...history.current, { role: "user" as const, text }]
        .filter((m) => !m.error)
        .map(({ role, text }) => ({ role, text }));

      update([...history.current, { role: "user", text }, { role: "assistant", text: "" }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(location ? { messages: payload, location } : { messages: payload }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          patchLast((m) => ({ ...m, text: typeof data.error === "string" ? data.error : GENERIC, error: true }));
          return;
        }

        for await (const event of readEvents(res.body)) {
          if (event.type === "text") patchLast((m) => ({ ...m, text: m.text + event.text }));
          else if (event.type === "places") patchLast((m) => ({ ...m, places: event.places }));
          else if (event.type === "error") patchLast((m) => ({ ...m, text: event.message, error: true, places: undefined }));
        }

        patchLast((m) => (m.text || m.error ? m : { ...m, text: GENERIC, error: true }));
      } catch {
        patchLast((m) => ({ ...m, text: m.text ? m.text : OFFLINE, error: !m.text }));
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [location, patchLast, update],
  );

  return { messages, send, loading };
}
