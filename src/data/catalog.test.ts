import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { TAGS } from "@/lib/types";

describe("CATALOG", () => {
  it("tem 12 restaurantes com ids únicos de restaurante e de item", () => {
    expect(CATALOG).toHaveLength(12);
    const ids = CATALOG.flatMap((r) => [r.id, ...r.itens.map((i) => i.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("todos os itens têm preço positivo e tags válidas; vegano sempre também é vegetariano", () => {
    for (const item of CATALOG.flatMap((r) => r.itens)) {
      expect(item.preco).toBeGreaterThan(0);
      item.tags.forEach((t) => expect(TAGS).toContain(t));
      if (item.tags.includes("vegano")) expect(item.tags).toContain("vegetariano");
    }
  });
});
