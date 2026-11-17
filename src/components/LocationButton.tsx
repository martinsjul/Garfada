import type { GeoStatus } from "@/hooks/useGeolocation";

interface Props {
  status: GeoStatus;
  onRequest: () => void;
  onClear: () => void;
}

export default function LocationButton({ status, onRequest, onClear }: Props) {
  const active = status === "ok";
  const label = active ? "Localização ativada" : "Usar minha localização";

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={active ? onClear : onRequest}
        disabled={status === "loading"}
        aria-label={label}
        aria-pressed={active}
        title={active ? "Localização ativada (clique para desativar)" : label}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border text-lg transition ${
          active ? "border-accent bg-accent/15" : "border-line bg-card hover:border-accent"
        } disabled:opacity-50`}
      >
        <span aria-hidden>{status === "loading" ? "⏳" : "📍"}</span>
      </button>
    </div>
  );
}
