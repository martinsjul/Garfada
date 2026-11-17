"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/useChat";
import { useGeolocation } from "@/hooks/useGeolocation";
import ChatInput from "./ChatInput";
import LocationButton from "./LocationButton";
import MessageBubble from "./MessageBubble";
import Suggestions from "./Suggestions";

export default function Chat() {
  const geo = useGeolocation();
  const { messages, send, loading } = useChat(geo.coords);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="text-2xl" aria-hidden>
          🍽️
        </span>
        <div>
          <h1 className="font-semibold leading-tight text-ink">Garfada</h1>
          <p className="text-xs text-muted">Seu guia de restaurantes e cafés com IA</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <Suggestions onPick={send} />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} pending={loading && i === messages.length - 1} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </main>

      <div className="border-t border-line px-4 pb-3 pt-3">
        <ChatInput
          onSend={send}
          disabled={loading}
          leading={<LocationButton status={geo.status} onRequest={geo.request} onClear={geo.clear} />}
        />
        {geo.status === "unavailable" && (
          <p className="mt-1.5 text-xs text-muted">Localização indisponível</p>
        )}
        <p className="mt-2 text-center text-[11px] leading-snug text-muted">
          Protótipo. Não digite dados pessoais. Preços e cardápios são aproximados — confirme com o local.
        </p>
      </div>
    </div>
  );
}
