"use client";

import { useCallback, useState } from "react";
import type { LatLng } from "@/lib/types";

export type GeoStatus = "idle" | "loading" | "ok" | "unavailable";

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [coords, setCoords] = useState<LatLng | undefined>();

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ latitude: c.latitude, longitude: c.longitude });
        setStatus("ok");
      },
      () => {
        setCoords(undefined);
        setStatus("unavailable");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(undefined);
    setStatus("idle");
  }, []);

  return { status, coords, request, clear };
}
