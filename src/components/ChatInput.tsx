"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/limits";

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  leading?: ReactNode;
}

export default function ChatInput({ onSend, disabled, leading }: Props) {
  const [text, setText] = useState("");
  const canSend = !disabled && text.trim().length > 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    onSend(text);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      {leading}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Pergunte algo… ex: rodízio até R$ 80"
        aria-label="Mensagem"
        className="h-11 min-w-0 flex-1 rounded-full border border-line bg-card px-4 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Enviar"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition hover:brightness-110 disabled:opacity-40"
      >
        <span aria-hidden>➤</span>
      </button>
    </form>
  );
}
