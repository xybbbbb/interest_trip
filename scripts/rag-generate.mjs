/**
 * rag-generate.mjs —— RAG 第 3 步：单次「检索 + 模型生成」
 *
 * 用法：
 *   node scripts/rag-generate.mjs "想买 CORTIS 同款的手串"
 *   node scripts/rag-generate.mjs "想找个地方吃东西" --prompt v2
 *   node scripts/rag-generate.mjs "米其林三星求婚直升机" --show-prompt   # 只看会发给模型的提示词
 *   node scripts/rag-generate.mjs "汉江夜景" --k 5
 *
 * 需要 .env 里的 LLM_API_KEY（DeepSeek 等 OpenAI 兼容接口）。
 * 整份评估集的重跑见：node scripts/rag-eval.mjs --generator llm
 */

import { DEFAULT_CONFIG, ROOT, loadDocs, loadEvalSet } from "./lib/rag-eval-core.mjs";
import { search } from "./lib/rag.mjs";
import { buildRagPrompt, getLLMConfig, makeLlmGenerator, PROMPTS } from "./lib/llm.mjs";
import path from "node:path";

const args = process.argv.slice(2);
const query = args.find((a) => !a.startsWith("--"));
const kIndex = args.indexOf("--k");
const K = kIndex >= 0 ? Number(args[kIndex + 1]) || DEFAULT_CONFIG.k : DEFAULT_CONFIG.k;
const promptIndex = args.indexOf("--prompt");
const promptVersion = promptIndex >= 0 ? args[promptIndex + 1] : "v1";
const SHOW_PROMPT = args.includes("--show-prompt");
const poolIndex = args.indexOf("--pool");
const pool = poolIndex >= 0 ? args[poolIndex + 1] : null;

if (!query) {
  console.error('用法：node scripts/rag-generate.mjs "你的问题" [--k 5] [--prompt v1|v2] [--pool fan|sight] [--show-prompt]');
  process.exit(1);
}

const docs = await loadDocs();
const { hits, topScore } = search(query, docs, { ...DEFAULT_CONFIG, k: K, pool });

console.log(`问题：${query}`);
console.log(`检索：命中 ${hits.length} 条（最高分 ${topScore.toFixed(2)}）`);
for (const [i, h] of hits.entries()) {
  console.log(`  [来源${i + 1}] ${h.doc.name}（${h.doc.district}·置信度 ${h.doc.confidence}）${h.score.toFixed(2)}`);
}

if (!hits.length) {
  console.log("\n回答（检索层直接拒答，不调用模型）：资料里没有能回答这个问题的内容。");
  process.exit(0);
}

const cfg = await getLLMConfig();
if (SHOW_PROMPT || !cfg.configured) {
  const { system, user } = buildRagPrompt(query, hits);
  console.log(`\n${!cfg.configured ? "⚠ 没找到 LLM_API_KEY，只显示将发送的提示词" : "提示词预览"}（${PROMPTS[promptVersion]?.name ?? promptVersion}）：`);
  console.log("──── system ────\n" + system);
  console.log("──── user ────\n" + user);
  if (!cfg.configured) console.log(`\n（把 Key 写进 ${path.relative(process.cwd(), path.join(ROOT, ".env"))} 的 LLM_API_KEY 即可真实调用）`);
  process.exit(0);
}

const gen = makeLlmGenerator(cfg, { promptVersion });
const t0 = Date.now();
const out = await gen.generate(query, hits);
const ms = Date.now() - t0;

console.log(`\n回答（${cfg.model} / 提示词 ${promptVersion} / ${ms}ms${out.usage ? ` / ${out.usage.total_tokens} tokens` : ""}）：`);
console.log(out.text);
console.log(`\n引用：${out.citations.map((c) => `[来源${c.n}] ${c.name}`).join(" ") || "（无）"}`);
if (out.invalid?.length) console.log(`⚠ 编造的来源编号：${out.invalid.join(", ")}`);
console.log(`是否拒答：${out.refused ? "是" : "否"}`);
