import { describe, expect, it } from "vitest";
import { extractPlaces } from "./places";

const chunk = (maps: Record<string, unknown>) => ({ maps });

describe("extractPlaces", () => {
  it("extrai lugares dos chunks maps", () => {
    const metadata = {
      groundingChunks: [
        chunk({ title: "Pizzaria X", uri: "https://maps.google.com/?cid=1", placeId: "places/abc" }),
      ],
    };
    expect(extractPlaces(metadata)).toEqual([
      { id: "places/abc", name: "Pizzaria X", mapsUrl: "https://maps.google.com/?cid=1" },
    ]);
  });

  it("ignora chunks sem maps ou sem uri/title", () => {
    const metadata = {
      groundingChunks: [
        { web: { uri: "https://x.com", title: "X" } },
        chunk({ title: "Só título" }),
        chunk({ uri: "https://maps.google.com/?cid=2" }),
      ],
    };
    expect(extractPlaces(metadata)).toEqual([]);
  });

  it.each([undefined, null, {}, { groundingChunks: "nope" }, "texto"])(
    "retorna [] para metadata inválida (%s)",
    (metadata) => {
      expect(extractPlaces(metadata)).toEqual([]);
    },
  );

  it("remove duplicados por placeId (ou por uri quando não há placeId)", () => {
    const metadata = {
      groundingChunks: [
        chunk({ title: "A", uri: "https://maps.google.com/?cid=1", placeId: "places/a" }),
        chunk({ title: "A de novo", uri: "https://maps.google.com/?cid=9", placeId: "places/a" }),
        chunk({ title: "B", uri: "https://maps.google.com/?cid=2" }),
        chunk({ title: "B de novo", uri: "https://maps.google.com/?cid=2" }),
      ],
    };
    expect(extractPlaces(metadata).map((p) => p.name)).toEqual(["A", "B"]);
  });

  it("aceita só uri http(s)", () => {
    const metadata = {
      groundingChunks: [chunk({ title: "Mal", uri: "javascript:alert(1)", placeId: "places/x" })],
    };
    expect(extractPlaces(metadata)).toEqual([]);
  });
});
