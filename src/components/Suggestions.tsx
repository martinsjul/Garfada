export const SUGGESTIONS = [
  "Rodízio de pizza perto de mim",
  "Café com bolo até R$ 30",
  "Onde comer uma boa feijoada?",
  "Japonês barato no centro",
];

export default function Suggestions({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="text-5xl" aria-hidden>
        🍽️
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Onde vamos comer hoje?</h2>
        <p className="text-sm text-muted">Peça por preço, prato, tipo de serviço ou bairro.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-full border border-line bg-card px-4 py-2 text-sm text-ink transition hover:border-accent hover:text-accent"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
