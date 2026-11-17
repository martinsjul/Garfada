export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  text: string;
}

export interface Place {
  id: string;
  name: string;
  mapsUrl: string;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "places"; places: Place[] }
  | { type: "error"; message: string }
  | { type: "done" };
