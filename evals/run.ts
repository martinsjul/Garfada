/**
 * Evals do agente com a API real do Gemini.
 * Uso: GEMINI_API_KEY=... npm run evals   (opcional: EVAL_DELAY_MS, EVAL_ONLY=id1,id2)
 */
import { writeFileSync } from "node:fs";
import { CATALOG } from "../src/data/catalog";
import { defaultModels } from "../src/lib/ai/models";
import { getAgentClient, runAgent } from "../src/lib/agent/runAgent";
import { EMPTY_STATE, type DishResult, type ToolStep } from "../src/lib/types";
import { CASES, type EvalResult } from "./cases";

const delay = Number(process.env.EVAL_DELAY_MS ?? 4000);
const only = process.env.EVAL_ONLY?.split(",");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runCase(c: (typeof CASES)[number]): Promise<EvalResult & { ms: number }> {
  const t = Date.now();
  const r: EvalResult = { steps: [] as ToolStep[], dishes: [] as DishResult[], state: c.state ?? EMPTY_STATE, text: "" };
  for await (const e of runAgent(getAgentClient(), { messages: c.messages, state: r.state, catalog: CATALOG })) {
    if (e.type === "tool") r.steps.push(e.step);
    if (e.type === "dishes") r.dishes.push(...e.dishes);
    if (e.type === "state") r.state = e.state;
    if (e.type === "text") r.text = e.text;
    if (e.type === "error") r.error = e.message;
  }
  return { ...r, ms: Date.now() - t };
}

(async () => {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Defina GEMINI_API_KEY para rodar os evals.");
    process.exit(1);
  }
  const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;
  const rows: { id: string; descricao: string; ok: boolean; falhas: string[]; ferramentas: string; ms: number }[] = [];

  for (const [n, c] of cases.entries()) {
    if (n > 0) await sleep(delay);
    const r = await runCase(c);
    const falhas = c.checks.map((check) => check(r)).filter((x): x is string => x !== null);
    rows.push({ id: c.id, descricao: c.descricao, ok: falhas.length === 0, falhas, ferramentas: r.steps.map((s) => s.name).join(" → ") || "—", ms: r.ms });
    console.log(`${falhas.length ? "✗" : "✓"} ${c.id} (${r.ms} ms) ${falhas.join("; ")}`);
  }

  const passed = rows.filter((r) => r.ok).length;
  const pct = Math.round((passed / rows.length) * 100);
  const avg = Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length);
  console.log(`\n${passed}/${rows.length} casos passaram (${pct}%) · latência média ${avg} ms`);

  const md = [
    "# Resultados dos evals",
    "",
    `- **Data:** ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    `- **Modelos:** ${defaultModels().join(" → ")}`,
    `- **Resultado:** ${passed}/${rows.length} (${pct}%) · latência média ${(avg / 1000).toFixed(1)} s`,
    "",
    "| Caso | O que verifica | Resultado | Ferramentas chamadas | Tempo |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| \`${r.id}\` | ${r.descricao} | ${r.ok ? "✅" : `❌ ${r.falhas.join("; ")}`} | ${r.ferramentas} | ${(r.ms / 1000).toFixed(1)} s |`),
    "",
    "Gerado por `npm run evals`. Os casos e as verificações estão em `evals/cases.ts`.",
    "",
  ].join("\n");
  if (!only) writeFileSync(new URL("./RESULTS.md", import.meta.url), md);
})();
