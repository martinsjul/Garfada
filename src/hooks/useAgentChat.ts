"use client";

import { useCallback, useRef, useState } from "react";
import { readEvents } from "@/lib/readEvents";
import { EMPTY_CART, EMPTY_PREFS, type AgentState, type ChatMessage, type DishResult, type Restaurant, type ToolStep } from "@/lib/types";

export type UIMessage = ChatMessage & { steps?: ToolStep[]; dishes?: DishResult[]; error?: boolean };

const OFFLINE = "Sem conexão. Verifique sua internet e tente de novo.";
const GENERIC = "Ops, algo deu errado. Tente de novo.";

export function useAgentChat(imported: Restaurant[]) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [agentState, setAgentStateRaw] = useState<AgentState>({ prefs: EMPTY_PREFS, cart: EMPTY_CART });
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const history = useRef<UIMessage[]>([]);
  const stateRef = useRef(agentState);

  const setAgentState = useCallback((next: AgentState | ((s: AgentState) => AgentState)) => {
    const value = typeof next === "function" ? next(stateRef.current) : next;
    stateRef.current = value;
    setAgentStateRaw(value);
  }, []);

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

      const payload: ChatMessage[] = [...history.current, { role: "user" as const, text }]
        .filter((m) => !m.error && m.text)
        .map(({ role, text }) => ({ role, text }));

      update([...history.current, { role: "user", text }, { role: "assistant", text: "", steps: [] }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload, state: stateRef.current, restaurantes: imported }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          patchLast((m) => ({ ...m, text: typeof data.error === "string" ? data.error : GENERIC, error: true }));
          return;
        }

        let finished = false;
        for await (const event of readEvents(res.body)) {
          if (event.type === "tool") patchLast((m) => ({ ...m, steps: [...(m.steps ?? []), event.step] }));
          else if (event.type === "dishes") patchLast((m) => ({ ...m, dishes: event.dishes }));
          else if (event.type === "state") setAgentState(event.state);
          else if (event.type === "text") patchLast((m) => ({ ...m, text: event.text }));
          else if (event.type === "error") patchLast((m) => ({ ...m, text: event.message, error: true }));
          if (event.type === "done" || event.type === "error") finished = true;
        }
        if (!finished) patchLast((m) => (m.text ? m : { ...m, text: GENERIC, error: true }));
      } catch {
        patchLast((m) => (m.text ? m : { ...m, text: OFFLINE, error: true }));
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [imported, patchLast, setAgentState, update],
  );

  return { messages, send, loading, agentState, setAgentState };
}
