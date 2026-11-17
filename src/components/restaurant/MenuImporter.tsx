"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useImportedRestaurants } from "@/hooks/useImportedRestaurants";
import { formatBRL } from "@/lib/cart";
import { resizeImage } from "@/lib/image";
import { buildRestaurant } from "@/lib/menu/publish";
import type { Combo, MenuDraft } from "@/lib/menu/types";
import { TAGS, type Tag } from "@/lib/types";
import { TAG_LABELS } from "../TagChips";

export const SAMPLES = [
  { slug: "boteco-seu-lima", nome: "Boteco do Seu Lima" },
  { slug: "cantina-nonna-rosa", nome: "Cantina Nonna Rosa" },
  { slug: "padaria-flor-de-lis", nome: "Padaria Flor de Lis" },
];

interface Row {
  key: number;
  nome: string;
  descricao: string;
  descricaoOriginal: string;
  preco: string;
  categoria: string;
  tags: Tag[];
}

type Status = { kind: "idle" } | { kind: "loading"; label: string } | { kind: "error"; message: string } | { kind: "published"; nome: string };

let rowKey = 0;
const toRow = (i: MenuDraft["itens"][number]): Row => ({ ...i, key: ++rowKey, preco: String(i.preco) });

const input = "w-full rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none";

export default function MenuImporter() {
  const { restaurants, add, remove } = useImportedRestaurants();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [preview, setPreview] = useState<string>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [form, setForm] = useState({ nome: "", culinaria: "", bairro: "", tempoEntregaMin: "40", taxaEntrega: "5", rodizio: false });
  const [formError, setFormError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  async function read(source: File | string, label: string) {
    setStatus({ kind: "loading", label });
    setRows(null);
    setFormError(undefined);
    try {
      const image = await resizeImage(source);
      setPreview(image);
      const res = await fetch("/api/menu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.draft) {
        setStatus({ kind: "error", message: typeof data.error === "string" ? data.error : "Não consegui ler o cardápio. Tente de novo." });
        return;
      }
      const draft = data.draft as MenuDraft;
      setRows(draft.itens.map(toRow));
      setCombos(draft.combos);
      setForm((f) => ({ ...f, nome: draft.restaurante.nome, culinaria: draft.restaurante.culinaria }));
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "Não consegui abrir essa imagem ou falar com o servidor. Tente de novo." });
    }
  }

  const patchRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  function addCombo(c: Combo) {
    setRows((rs) => [
      ...(rs ?? []),
      { key: ++rowKey, nome: c.nome, descricao: c.itens.join(" + "), descricaoOriginal: "", preco: String(c.precoSugerido || ""), categoria: "combos", tags: [] },
    ]);
    setCombos((cs) => cs.filter((x) => x !== c));
  }

  function publish() {
    const itens = (rows ?? [])
      .map((r) => ({ ...r, preco: Number(r.preco.replace(",", ".")) }))
      .filter((r) => r.nome.trim() && Number.isFinite(r.preco) && r.preco > 0);
    if (!form.nome.trim()) return setFormError("Preencha o nome do restaurante.");
    if (itens.length === 0) return setFormError("Inclua pelo menos um item com nome e preço.");
    const restaurant = buildRestaurant(
      {
        nome: form.nome,
        culinaria: form.culinaria,
        bairro: form.bairro,
        tempoEntregaMin: Math.min(180, Math.max(5, Number(form.tempoEntregaMin) || 40)),
        taxaEntrega: Math.min(50, Math.max(0, Number(form.taxaEntrega.replace(",", ".")) || 0)),
        rodizio: form.rodizio,
      },
      itens,
    );
    add(restaurant);
    setFormError(undefined);
    setRows(null);
    setCombos([]);
    setPreview(undefined);
    setStatus({ kind: "published", nome: restaurant.nome });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Copiloto do restaurante</h1>
        <p className="max-w-2xl text-muted">
          Envie uma foto do seu cardápio de papel. A IA lê os pratos e preços, sugere descrições que dão vontade e combos, e
          você publica em segundos. Depois é só testar: o agente de pedidos já passa a conhecer seus pratos.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 font-semibold text-ink">1. Escolha o cardápio</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={status.kind === "loading"}
            className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-3 text-sm text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <span className="text-3xl" aria-hidden>
              📷
            </span>
            Enviar foto do cardápio
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            aria-label="Foto do cardápio"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) read(file, file.name);
              e.target.value = "";
            }}
          />
          {SAMPLES.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => read(`/menus/${s.slug}.jpg`, s.nome)}
              disabled={status.kind === "loading"}
              className="group overflow-hidden rounded-xl border border-line text-left text-sm transition hover:border-accent disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/menus/${s.slug}.jpg`} alt="" className="h-24 w-full object-cover object-top transition group-hover:scale-105" />
              <span className="block px-2 py-1.5 text-ink">Usar exemplo: {s.nome}</span>
            </button>
          ))}
        </div>

        {status.kind === "loading" && (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted" role="status">
            <span className="inline-flex gap-1" aria-hidden>
              <span className="dot" />
              <span className="dot [animation-delay:150ms]" />
              <span className="dot [animation-delay:300ms]" />
            </span>
            Lendo &quot;{status.label}&quot; com IA… leva uns 5 segundos.
          </p>
        )}
        {status.kind === "error" && (
          <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
            {status.message}
          </p>
        )}
        {status.kind === "published" && (
          <p className="mt-4 rounded-xl bg-accent/10 p-3 text-sm text-ink" role="status">
            ✅ {status.nome} publicado no catálogo deste navegador.{" "}
            <Link href="/" className="font-medium text-accent underline">
              Testar no chat →
            </Link>
          </p>
        )}
      </section>

      {rows && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="mb-3 font-semibold text-ink">2. Revise o que a IA leu</h2>
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Cardápio enviado" className="max-h-80 w-full rounded-xl border border-line object-contain lg:max-h-none" />
            )}
            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm text-muted">
                  Nome do restaurante
                  <input className={input} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  Culinária
                  <input className={input} value={form.culinaria} onChange={(e) => setForm({ ...form, culinaria: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  Bairro
                  <input className={input} value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  Tempo de entrega (min)
                  <input className={input} inputMode="numeric" value={form.tempoEntregaMin} onChange={(e) => setForm({ ...form, tempoEntregaMin: e.target.value })} />
                </label>
                <label className="text-sm text-muted">
                  Taxa de entrega (R$)
                  <input className={input} inputMode="decimal" value={form.taxaEntrega} onChange={(e) => setForm({ ...form, taxaEntrega: e.target.value })} />
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
                  <input type="checkbox" checked={form.rodizio} onChange={(e) => setForm({ ...form, rodizio: e.target.checked })} />
                  Tem rodízio
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-1">Item</th>
                      <th className="w-24 px-1">Preço (R$)</th>
                      <th className="w-28 px-1">Categoria</th>
                      <th className="px-1">Tags</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="align-top">
                        <td className="px-1">
                          <input className={`${input} font-medium`} aria-label="Nome do item" value={r.nome} onChange={(e) => patchRow(r.key, { nome: e.target.value })} />
                          <textarea
                            className={`${input} mt-1 resize-y text-xs`}
                            rows={2}
                            aria-label="Descrição sugerida"
                            value={r.descricao}
                            onChange={(e) => patchRow(r.key, { descricao: e.target.value })}
                          />
                          {r.descricaoOriginal && <p className="mt-0.5 text-[11px] text-muted">Original: {r.descricaoOriginal}</p>}
                        </td>
                        <td className="px-1">
                          <input className={input} aria-label="Preço" inputMode="decimal" value={r.preco} onChange={(e) => patchRow(r.key, { preco: e.target.value })} />
                        </td>
                        <td className="px-1">
                          <input className={input} aria-label="Categoria" value={r.categoria} onChange={(e) => patchRow(r.key, { categoria: e.target.value })} />
                        </td>
                        <td className="px-1">
                          <div className="flex flex-wrap gap-1">
                            {TAGS.map((t) => {
                              const on = r.tags.includes(t);
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => patchRow(r.key, { tags: on ? r.tags.filter((x) => x !== t) : [...r.tags, t] })}
                                  className={`rounded-full px-2 py-0.5 text-[11px] transition ${on ? "bg-accent text-accent-ink" : "bg-bg text-muted hover:text-ink"}`}
                                >
                                  {TAG_LABELS[t]}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-1">
                          <button type="button" aria-label={`Remover ${r.nome}`} onClick={() => setRows((rs) => rs?.filter((x) => x.key !== r.key) ?? null)} className="px-2 py-1 text-muted hover:text-danger">
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {combos.length > 0 && (
                <div className="rounded-xl bg-accent/10 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-ink">💡 Combos sugeridos pela IA</h3>
                  <ul className="space-y-2">
                    {combos.map((c, i) => (
                      <li key={`${i}-${c.nome}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          <span className="font-medium text-ink">{c.nome}</span>
                          <span className="text-muted">
                            {" "}
                            · {c.itens.join(" + ")} · {formatBRL(c.precoSugerido)} · {c.motivo}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => addCombo(c)}
                          aria-label={`Adicionar ${c.nome} ao cardápio`}
                          className="rounded-full border border-accent px-3 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-accent-ink"
                        >
                          + Adicionar ao cardápio
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {formError && (
                <p role="alert" className="text-sm text-danger">
                  {formError}
                </p>
              )}
              <button type="button" onClick={publish} className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink transition hover:brightness-110">
                Publicar no catálogo
              </button>
            </div>
          </div>
        </section>
      )}

      {restaurants.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="mb-3 font-semibold text-ink">Seus restaurantes publicados</h2>
          <ul aria-label="Restaurantes publicados" className="divide-y divide-line">
            {restaurants.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium text-ink">{r.nome}</span>
                  <span className="text-muted">
                    {" "}
                    · {r.culinaria} · {r.itens.length} itens
                  </span>
                </span>
                <button type="button" onClick={() => remove(r.id)} aria-label={`Remover ${r.nome}`} className="text-muted hover:text-danger">
                  Remover
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Ficam salvos só neste navegador (protótipo sem banco de dados).</p>
        </section>
      )}
    </div>
  );
}
