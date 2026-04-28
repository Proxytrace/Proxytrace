import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ─── The only change needed to route through Trsr ──────────────────────────
// Replace `baseURL` with your Trsr proxy URL. Every chat request will be
// captured automatically — no other code changes required.
//
// Proxy URL format: http://<trsr-host>/<org>/<project>/openai/v1
// To call OpenAI directly instead, set TRSR_BASE_URL=https://api.openai.com/v1
// ───────────────────────────────────────────────────────────────────────────
const openai = new OpenAI({
  apiKey: process.env.TRSR_API_KEY,
  baseURL: process.env.TRSR_BASE_URL ?? "https://api.openai.com/v1",
});

const MODEL = process.env.MODEL ?? "gpt-4o-mini";
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ?? "You are a helpful assistant.";

// POST /chat  — streams the assistant reply back as SSE
app.post("/chat", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    console.log(`[chat] → ${MODEL}  messages=${messages.length}`);
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
      }
    }
    console.log(`[chat] ✓ done`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[chat] ✗ ${err?.constructor?.name}: ${message}`);
    if (err?.status) console.error(`[chat]   HTTP ${err.status} from ${openai.baseURL}`);
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  const trsrUrl = process.env.TRSR_BASE_URL ?? "(not set — using OpenAI directly)";
  console.log(`Chatbot running at http://localhost:${PORT}`);
  console.log(`Trsr proxy: ${trsrUrl}`);
  console.log(`Model: ${MODEL}`);
});
