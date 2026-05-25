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

const MODEL = process.env.MODEL ?? "gpt-4o-mini";
const AGENTS = loadAgents();

// GET /agents — returns agent list with shortcuts (used by the UI on load)
app.get("/agents", (_req, res) => {
  const agents = Object.values(AGENTS).map(({ id, name, icon, description, shortcuts }) => ({
    id,
    name,
    icon,
    description,
    shortcuts,
  }));
  res.json(agents);
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
  const params = sanitizeModelParams(modelParams);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const sessionHeaders = sessionId ? { "x-proxytrace-session-id": sessionId } : {};
  const paramSummary = Object.keys(params).length ? ` params=${JSON.stringify(params)}` : "";
  console.log(`[chat] agent=${agent.id} session=${sessionId ?? "none"} → ${MODEL}  messages=${messages.length + 1}${paramSummary}`);

  try {
    await runChat({
      agent,
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
