export const SUGGESTIONS = [
  "Sou vegetariana, quero algo até R$ 40",
  "Rodízio para hoje à noite",
  "Café com bolo que chegue rápido",
  "Feijoada até R$ 50, sem camarão",
];

export default function Suggestions({ onPick, extra = [] }: { onPick: (text: string) => void; extra?: string[] }) {
  return (
    <div className="flex flex-col items-center gap-5 py-8 text-center">
      <div className="text-5xl" aria-hidden>
        🍽️
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">O que vamos pedir hoje?</h1>
        <p className="max-w-md text-sm text-muted">
          Converse como com um amigo: diga o que quer, quanto quer gastar e suas restrições. Eu busco, lembro e monto o
          pedido.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {[...extra, ...SUGGESTIONS].map((s) => (
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
