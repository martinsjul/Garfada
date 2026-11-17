import type { Place } from "@/lib/types";

export default function PlaceCard({ place }: { place: Place }) {
  return (
    <li className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-card p-3 shadow-sm">
      <p className="font-semibold leading-snug text-ink">{place.name}</p>
      <a
        href={place.mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        Ver no Google Maps <span aria-hidden>↗</span>
      </a>
    </li>
  );
}
