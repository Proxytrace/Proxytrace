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
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ??
  "You are a helpful travel and weather assistant. Use the provided tools when relevant to answer the user's questions.";

// ─── Tool definitions ──────────────────────────────────────────────────────
// Trsr captures these alongside every request, letting you inspect which tools
// each agent version exposes and how arguments are structured over time.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_current_weather",
      description: "Returns current weather conditions for a given city.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name, e.g. Vienna, AT" },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_attractions",
      description: "Returns a list of top tourist attractions for a given city.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City to search attractions for" },
          limit: { type: "integer", description: "Maximum number of results (default 5)" },
        },
        required: ["city"],
      },
    },
  },
];

// ─── Simulated tool implementations ───────────────────────────────────────
function executeTool(name, argsJson) {
  try {
    const args = JSON.parse(argsJson);
    switch (name) {
      case "get_current_weather": {
        const unit = args.unit ?? "celsius";
        return JSON.stringify({
          location: args.location,
          temperature: unit === "fahrenheit" ? "54°F" : "12°C",
          condition: "Partly cloudy",
          humidity: "65%",
          wind: "15 km/h NW",
        });
      }
      case "search_attractions": {
        const all = [
          { name: "Schönbrunn Palace", rating: 4.8, category: "Historic Site" },
          { name: "St. Stephen's Cathedral", rating: 4.7, category: "Religious Site" },
          { name: "Belvedere Museum", rating: 4.7, category: "Museum" },
          { name: "Vienna State Opera", rating: 4.6, category: "Performing Arts" },
          { name: "Naschmarkt", rating: 4.5, category: "Market" },
        ];
        return JSON.stringify({
          city: args.city,
          attractions: all.slice(0, Math.max(1, args.limit ?? 5)),
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch {
    return JSON.stringify({ error: `Failed to execute tool ${name}` });
  }
}

// POST /chat  — streams the assistant reply back as SSE
//
// SSE event types:
//   { text: "..." }                         — assistant text delta
//   { toolCall: { name, arguments } }       — model is invoking a tool
//   { toolResult: { name, result } }        — tool execution result
//   { error: "..." }                        — error message
app.post("/chat", async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const fullMessages = [{ role: "system", content: SYSTEM_PROMPT }, ...messages];
    console.log(`[chat] → ${MODEL}  messages=${fullMessages.length}`);

    // Turn 1: non-streaming with tools so tool_calls can be detected
    const turn1 = await openai.chat.completions.create({
      model: MODEL,
      messages: fullMessages,
      tools: TOOLS,
      stream: false,
    });

    const choice = turn1.choices[0];
    const toolCalls = choice.message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      // Model answered directly — emit the text and finish
      send({ text: choice.message.content ?? "" });
    } else {
      // Execute each tool, forwarding events to the client so the UI can show them
      const toolMessages = [{ role: "assistant", content: null, tool_calls: toolCalls }];

      for (const tc of toolCalls) {
        const args = tc.function.arguments;
        send({ toolCall: { name: tc.function.name, arguments: args } });
        console.log(`[chat]   tool call: ${tc.function.name}(${args})`);

        const result = executeTool(tc.function.name, args);
        send({ toolResult: { name: tc.function.name, result } });
        console.log(`[chat]   tool result: ${result.slice(0, 120)}`);

        toolMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      // Turn 2: stream the final answer with full context including tool results
      const stream = await openai.chat.completions.create({
        model: MODEL,
        messages: [...fullMessages, ...toolMessages],
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) send({ text: delta });
      }
    }

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
  const trsrUrl = process.env.TRSR_BASE_URL ?? "(not set — using OpenAI directly)";
  console.log(`Chatbot running at http://localhost:${PORT}`);
  console.log(`Trsr proxy: ${trsrUrl}`);
  console.log(`Model: ${MODEL}`);
});
