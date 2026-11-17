import ReactMarkdown from "react-markdown";
import type { UIMessage } from "@/hooks/useChat";
import PlaceCard from "./PlaceCard";

export default function MessageBubble({ message, pending }: { message: UIMessage; pending?: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-accent px-4 py-2 text-accent-ink">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`max-w-[92%] break-words rounded-2xl rounded-bl-sm px-4 py-3 ${
          message.error ? "border border-danger/40 bg-danger/10 text-danger" : "bg-card text-ink shadow-sm"
        }`}
      >
        {message.text ? (
          message.error ? (
            <p>{message.text}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown>{message.text}</ReactMarkdown>
            </div>
          )
        ) : pending ? (
          <span className="inline-flex gap-1" aria-label="Digitando">
            <span className="dot" />
            <span className="dot [animation-delay:150ms]" />
            <span className="dot [animation-delay:300ms]" />
          </span>
        ) : null}
      </div>

      {message.places && message.places.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {message.places.map((p) => (
              <PlaceCard key={p.id} place={p} />
            ))}
          </ul>
          <p className="text-xs text-muted">Dados de lugares: Google Maps</p>
        </div>
      )}
    </div>
  );
}
