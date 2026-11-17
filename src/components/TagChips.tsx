import type { Tag } from "@/lib/types";

export const TAG_LABELS: Record<Tag, string> = {
  vegetariano: "🥕 vegetariano",
  vegano: "🌱 vegano",
  sem_gluten: "🌾 sem glúten",
  sem_lactose: "🥛 sem lactose",
  apimentado: "🌶️ apimentado",
};

export default function TagChips({ tags }: { tags: Tag[] }) {
  if (!tags.length) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <li key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-ink">
          {TAG_LABELS[t]}
        </li>
      ))}
    </ul>
  );
}
