import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { loadAgents, runChat } from "./chat.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ─── The only change needed to route through Proxytrace ──────────────────────────
// Replace `baseURL` with your Proxytrace proxy URL. Every chat request will be
// captured automatically — no other code changes required.
//
// Proxy URL format: http://<proxytrace-host>/<org>/<project>/openai/v1
// To call OpenAI directly instead, set PROXYTRACE_BASE_URL=https://api.openai.com/v1
// ───────────────────────────────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.PROXYTRACE_API_KEY,
  baseURL: process.env.PROXYTRACE_BASE_URL ?? "https://api.openai.com/v1",
});

// `||` (not `??`) so the compose's empty-string MODEL default falls back too — `??` only replaces
// null/undefined and would leave MODEL="" when the kiosk stack runs without a live endpoint.
const MODEL = process.env.MODEL || "gpt-4o-mini";
const AGENTS = loadAgents();

// ── In-memory system-prompt overrides (keyed by agentId) ──────────────────────────────────
// Cleared on server restart so every demo starts clean.
const systemPromptOverrides = {};

// GET /agents — returns agent list with shortcuts and effective system prompt (used by the UI on load).
// shortcutsDE is the German locale variant of the shortcut set; falls back to shortcuts when absent.
// Language selection is a pure client concern — the server serves both sets and does not know the locale.
app.get("/agents", (_req, res) => {
  const agents = Object.values(AGENTS).map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    description: a.description,
    shortcuts: a.shortcuts,
    shortcutsDE: a.shortcutsDE ?? a.shortcuts,
    // Effective prompt: the in-memory override if set, otherwise the agent's default
    systemPrompt: systemPromptOverrides[a.id] ?? a.systemPrompt,
  }));
  res.json(agents);
});

// PUT /agents/:id/system-prompt — set an in-memory system-prompt override for an agent
// Body: { "systemPrompt": "..." }
// Trailing whitespace is trimmed; otherwise the string is stored verbatim.
app.put("/agents/:id/system-prompt", (req, res) => {
  const agent = AGENTS[req.params.id];
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const { systemPrompt } = req.body;
  if (typeof systemPrompt !== "string") {
    return res.status(400).json({ error: "systemPrompt must be a string" });
  }
  const trimmed = systemPrompt.replace(/\s+$/, "");
  if (!trimmed) return res.status(400).json({ error: "systemPrompt cannot be empty after trimming" });
  systemPromptOverrides[req.params.id] = trimmed;
  console.log(`[prompt] override set for agent=${req.params.id} (${trimmed.length} chars)`);
  res.json({ systemPrompt: trimmed });
});

// DELETE /agents/:id/system-prompt — clear the override, restore the agent's default prompt
app.delete("/agents/:id/system-prompt", (req, res) => {
  const agent = AGENTS[req.params.id];
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  delete systemPromptOverrides[req.params.id];
  console.log(`[prompt] override cleared for agent=${req.params.id}`);
  res.json({ systemPrompt: agent.systemPrompt });
});

// POST /chat  — streams the assistant reply back as SSE
//
// Body: { messages: [...], agentId?: string, sessionId?: string, modelParams?: {...} }
//
// SSE event types:
//   { text: "..." }                         — assistant text delta
//   { toolCall: { name, arguments } }       — model is invoking a tool
//   { toolResult: { name, result } }        — tool execution result
//   { error: "..." }                        — error message
const ALLOWED_PARAMS = ["temperature", "top_p", "max_tokens", "frequency_penalty", "presence_penalty"];

function sanitizeModelParams(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of ALLOWED_PARAMS) {
    const v = raw[key];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    out[key] = v;
  }
  return out;
}

app.post("/chat", async (req, res) => {
  const { messages, agentId, sessionId, modelParams } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const agent = AGENTS[agentId] ?? AGENTS.travel;

  // Apply an in-memory system-prompt override when set (e.g. via the prompt panel)
  const effectiveAgent = systemPromptOverrides[agentId]
    ? { ...agent, systemPrompt: systemPromptOverrides[agentId] }
    : agent;

  // Agent defaultParams (e.g. temperature: 0.3 for the support agent) always win so the
  // seeded agent-version attribution stays correct — user UI params act as the base.
  const userParams = sanitizeModelParams(modelParams);
  const params = { ...userParams, ...(agent.defaultParams ?? {}) };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Send X-Proxytrace-Agent for agents that define a proxytraceName so ingestion can
  // attribute directly to the seeded agent version (skipping the prompt/tool matcher).
  const sessionHeaders = {
    ...(sessionId ? { "x-proxytrace-session-id": sessionId } : {}),
    ...(agent.proxytraceName ? { "x-proxytrace-agent": agent.proxytraceName } : {}),
  };
  const paramSummary = Object.keys(params).length ? ` params=${JSON.stringify(params)}` : "";
  const hasOverride = Boolean(systemPromptOverrides[agentId]);
  console.log(`[chat] agent=${agent.id} session=${sessionId ?? "none"} → ${MODEL}  messages=${messages.length + 1}${paramSummary}${hasOverride ? " [prompt-override]" : ""}`);

  try {
    await runChat({
      agent: effectiveAgent,
      messages,
      openai,
      model: MODEL,
      params,
      sessionHeaders,
      onEvent: (event) => {
        send(event);
        if (event.toolCall) console.log(`[chat]   tool call: ${event.toolCall.name}(${event.toolCall.arguments})`);
        else if (event.toolResult) console.log(`[chat]   tool result: ${event.toolResult.result.slice(0, 120)}`);
      },
    });
    console.log(`[chat] ✓ done`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat] ✗ ${err?.constructor?.name}: ${message}`);
    if (err?.status) console.error(`[chat]   HTTP ${err.status} from ${openai.baseURL}`);
    send({ error: message });
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  const proxytraceUrl = process.env.PROXYTRACE_BASE_URL ?? "(not set — using OpenAI directly)";
  console.log(`Chatbot running at http://localhost:${PORT}`);
  console.log(`Proxytrace proxy: ${proxytraceUrl}`);
  console.log(`Model: ${MODEL}`);
});
