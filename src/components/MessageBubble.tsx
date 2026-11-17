import ReactMarkdown, { type Components } from "react-markdown";
import type { UIMessage } from "@/hooks/useAgentChat";
import type { DishResult } from "@/lib/types";
import DishCard from "./DishCard";
import ThinkingSteps from "./ThinkingSteps";

// Links da IA abrem em nova aba (o histórico vive só na memória da página); imagens não são carregadas.
const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

interface Props {
  message: UIMessage;
  pending?: boolean;
  onAdd: (dish: DishResult) => void;
}

export default function MessageBubble({ message, pending, onAdd }: Props) {
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
      {message.steps && <ThinkingSteps steps={message.steps} live={pending} />}

      {(message.text || pending) && (
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
                <ReactMarkdown components={markdownComponents} disallowedElements={["img"]}>
                  {message.text}
                </ReactMarkdown>
              </div>
            )
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
              <span className="inline-flex gap-1" aria-hidden>
                <span className="dot" />
                <span className="dot [animation-delay:150ms]" />
                <span className="dot [animation-delay:300ms]" />
              </span>
              Pensando…
            </span>
          )}
        </div>
      )}

      {message.dishes && message.dishes.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {message.dishes.map((d) => (
            <DishCard key={d.itemId} dish={d} onAdd={onAdd} />
          ))}
        </ul>
      )}
    </div>
  );
}
