"use client";

import { useCallback, useEffect, useState } from "react";
import { loadImported, saveImported } from "@/lib/storage";
import { MAX_IMPORTED } from "@/lib/validate";
import type { Restaurant } from "@/lib/types";

export function useImportedRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  useEffect(() => {
    // Lido depois da montagem para não divergir do HTML do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestaurants(loadImported());
  }, []);

  const update = useCallback((next: Restaurant[]) => {
    setRestaurants(next);
    saveImported(next);
  }, []);

  const add = useCallback(
    (r: Restaurant) => update([r, ...loadImported().filter((x) => x.id !== r.id)].slice(0, MAX_IMPORTED)),
    [update],
  );
  const remove = useCallback((id: string) => update(loadImported().filter((x) => x.id !== id)), [update]);

  return { restaurants, add, remove };
}
