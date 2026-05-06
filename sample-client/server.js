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

// ─── Agent definitions ─────────────────────────────────────────────────────
// Each agent has its own system prompt, tool set, and demo shortcuts.
// Trsr captures agent identity alongside every trace, so you can compare
// how different agents behave across the same conversation topics.
const AGENTS = {
  travel: {
    id: "travel",
    name: "Travel Planner",
    icon: "✈️",
    description: "Weather, attractions, flights & currency",
    systemPrompt:
      "You are an expert travel planner and weather assistant. Use the provided tools to help users plan trips, check weather, find attractions, look up flight prices, and convert currencies. Be concise and practical.",
    shortcuts: [
      { label: "Vienna: weather + top sights", prompt: "What's the weather in Vienna right now, and what are the top 3 tourist attractions?" },
      { label: "3-day Tokyo trip under $2k", prompt: "Help me plan a 3-day trip to Tokyo. What's the weather like, what are the must-see attractions, and what would flights from New York roughly cost?" },
      { label: "Barcelona best season + costs", prompt: "What's the best time of year to visit Barcelona for good weather? Also convert €500 to USD so I know my budget." },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Returns current weather conditions for a given city.",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name, e.g. Vienna, AT" },
              unit: { type: "string", enum: ["celsius", "fahrenheit"], description: "Temperature unit" },
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
      {
        type: "function",
        function: {
          name: "get_flight_prices",
          description: "Returns estimated round-trip flight prices between two cities.",
          parameters: {
            type: "object",
            properties: {
              origin: { type: "string", description: "Departure city or airport code" },
              destination: { type: "string", description: "Destination city or airport code" },
              departure_date: { type: "string", description: "Departure date in YYYY-MM-DD format (optional)" },
            },
            required: ["origin", "destination"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "convert_currency",
          description: "Converts an amount from one currency to another using live-ish exchange rates.",
          parameters: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Amount to convert" },
              from_currency: { type: "string", description: "Source currency code, e.g. EUR" },
              to_currency: { type: "string", description: "Target currency code, e.g. USD" },
            },
            required: ["amount", "from_currency", "to_currency"],
          },
        },
      },
    ],
  },

  code: {
    id: "code",
    name: "Code Assistant",
    icon: "💻",
    description: "Bug detection, packages, errors & test generation",
    systemPrompt:
      "You are a senior software engineer and code review assistant. Use the provided tools to analyze code quality, explain errors, look up npm packages, and generate test stubs. Be precise and educational.",
    shortcuts: [
      { label: "Review a recursive function", prompt: "Review this Python function for bugs and performance issues:\n\ndef fib(n):\n    return fib(n-1) + fib(n-2)" },
      { label: "Explain a common JS error", prompt: "What does this JavaScript error mean and how do I fix it?\n\nTypeError: Cannot read properties of undefined (reading 'map')" },
      { label: "Compare two npm packages", prompt: "Compare the 'lodash' and 'ramda' npm packages — downloads, bundle size, and which to choose for a React project." },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "analyze_code",
          description: "Analyzes a code snippet for bugs, style issues, and complexity. Returns a structured report.",
          parameters: {
            type: "object",
            properties: {
              code: { type: "string", description: "The code snippet to analyze" },
              language: { type: "string", description: "Programming language (e.g. python, javascript, typescript)" },
            },
            required: ["code"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "explain_error",
          description: "Explains a runtime or compile-time error message and suggests fixes.",
          parameters: {
            type: "object",
            properties: {
              error_message: { type: "string", description: "The full error message or stack trace" },
              language: { type: "string", description: "Programming language context" },
            },
            required: ["error_message"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "lookup_npm_package",
          description: "Returns metadata for an npm package: weekly downloads, latest version, bundle size, and a short description.",
          parameters: {
            type: "object",
            properties: {
              package_name: { type: "string", description: "The npm package name" },
            },
            required: ["package_name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "generate_test_stubs",
          description: "Generates unit test stubs for a given function signature.",
          parameters: {
            type: "object",
            properties: {
              function_signature: { type: "string", description: "The function signature or implementation to generate tests for" },
              framework: { type: "string", description: "Test framework: jest, vitest, pytest, etc." },
            },
            required: ["function_signature"],
          },
        },
      },
    ],
  },

  data: {
    id: "data",
    name: "Data Analyst",
    icon: "📊",
    description: "Sales data, statistics, anomalies & forecasting",
    systemPrompt:
      "You are a data analyst assistant. Use the provided tools to query sales datasets, compute statistics, detect anomalies, and forecast trends. Present findings clearly with numbers and context.",
    shortcuts: [
      { label: "Q1 2024 sales performance", prompt: "Give me a breakdown of sales performance for Q1 2024 — total revenue, top products, and month-over-month growth." },
      { label: "Detect revenue anomalies", prompt: "Are there any anomalies or unexpected spikes/dips in last month's daily revenue data?" },
      { label: "Forecast next quarter", prompt: "Based on the last 4 quarters of sales data, forecast next quarter's revenue and highlight any seasonal trends." },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "query_sales_data",
          description: "Queries the sales database for aggregated metrics within a date range.",
          parameters: {
            type: "object",
            properties: {
              start_date: { type: "string", description: "Start date YYYY-MM-DD" },
              end_date: { type: "string", description: "End date YYYY-MM-DD" },
              granularity: { type: "string", enum: ["daily", "weekly", "monthly", "quarterly"], description: "Time granularity" },
              metric: { type: "string", enum: ["revenue", "orders", "units", "aov"], description: "Metric to retrieve" },
            },
            required: ["start_date", "end_date"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "calculate_statistics",
          description: "Computes descriptive statistics (mean, median, std dev, percentiles) for a named dataset.",
          parameters: {
            type: "object",
            properties: {
              dataset: { type: "string", description: "Named dataset: revenue, orders, aov, conversion_rate" },
              period: { type: "string", description: "Time period, e.g. 'last_30_days', 'Q1_2024', 'last_quarter'" },
            },
            required: ["dataset", "period"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "detect_anomalies",
          description: "Runs anomaly detection on a time-series metric and returns outlier dates with z-scores.",
          parameters: {
            type: "object",
            properties: {
              metric: { type: "string", description: "Metric to analyze: revenue, orders, refund_rate, etc." },
              period: { type: "string", description: "Time period to scan, e.g. 'last_30_days'" },
              sensitivity: { type: "string", enum: ["low", "medium", "high"], description: "Detection sensitivity (default medium)" },
            },
            required: ["metric", "period"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "forecast_trend",
          description: "Generates a short-term forecast for a metric using historical data.",
          parameters: {
            type: "object",
            properties: {
              metric: { type: "string", description: "Metric to forecast: revenue, orders, etc." },
              horizon_days: { type: "integer", description: "Number of days to forecast ahead (max 90)" },
              model: { type: "string", enum: ["linear", "seasonal", "arima"], description: "Forecasting model (default seasonal)" },
            },
            required: ["metric", "horizon_days"],
          },
        },
      },
    ],
  },
};

// ─── Simulated tool implementations ───────────────────────────────────────
function executeTool(name, argsJson) {
  try {
    const args = JSON.parse(argsJson);
    switch (name) {
      // ── Travel tools ──
      case "get_current_weather": {
        const unit = args.unit ?? "celsius";
        const cityData = {
          vienna: { temp_c: 12, temp_f: 54, condition: "Partly cloudy", humidity: "65%", wind: "15 km/h NW" },
          tokyo: { temp_c: 18, temp_f: 64, condition: "Sunny", humidity: "55%", wind: "10 km/h SE" },
          barcelona: { temp_c: 22, temp_f: 72, condition: "Clear", humidity: "60%", wind: "8 km/h SW" },
          "new york": { temp_c: 8, temp_f: 46, condition: "Overcast", humidity: "70%", wind: "20 km/h NE" },
        };
        const key = args.location.toLowerCase().split(",")[0].trim();
        const d = cityData[key] ?? { temp_c: 15, temp_f: 59, condition: "Mostly sunny", humidity: "58%", wind: "12 km/h W" };
        return JSON.stringify({
          location: args.location,
          temperature: unit === "fahrenheit" ? `${d.temp_f}°F` : `${d.temp_c}°C`,
          condition: d.condition,
          humidity: d.humidity,
          wind: d.wind,
        });
      }
      case "search_attractions": {
        const cityAttractions = {
          vienna: [
            { name: "Schönbrunn Palace", rating: 4.8, category: "Historic Site" },
            { name: "St. Stephen's Cathedral", rating: 4.7, category: "Religious Site" },
            { name: "Belvedere Museum", rating: 4.7, category: "Museum" },
            { name: "Vienna State Opera", rating: 4.6, category: "Performing Arts" },
            { name: "Naschmarkt", rating: 4.5, category: "Market" },
          ],
          tokyo: [
            { name: "Senso-ji Temple", rating: 4.8, category: "Religious Site" },
            { name: "Shibuya Crossing", rating: 4.7, category: "Landmark" },
            { name: "teamLab Borderless", rating: 4.9, category: "Art & Technology" },
            { name: "Tsukiji Outer Market", rating: 4.6, category: "Market" },
            { name: "Shinjuku Gyoen", rating: 4.7, category: "Park" },
          ],
          barcelona: [
            { name: "Sagrada Família", rating: 4.9, category: "Landmark" },
            { name: "Park Güell", rating: 4.7, category: "Park" },
            { name: "La Boqueria Market", rating: 4.5, category: "Market" },
            { name: "Casa Batlló", rating: 4.8, category: "Architecture" },
            { name: "Gothic Quarter", rating: 4.6, category: "Historic District" },
          ],
        };
        const key = (args.city ?? "").toLowerCase().split(",")[0].trim();
        const all = cityAttractions[key] ?? [
          { name: "Old Town Historic Center", rating: 4.7, category: "Historic District" },
          { name: "National Museum", rating: 4.5, category: "Museum" },
          { name: "City Park", rating: 4.4, category: "Park" },
          { name: "Central Market", rating: 4.3, category: "Market" },
          { name: "Waterfront Promenade", rating: 4.6, category: "Landmark" },
        ];
        return JSON.stringify({ city: args.city, attractions: all.slice(0, Math.max(1, args.limit ?? 5)) });
      }
      case "get_flight_prices": {
        const routes = {
          "new york-tokyo": { economy: 850, business: 3200 },
          "london-barcelona": { economy: 95, business: 380 },
          "new york-vienna": { economy: 720, business: 2800 },
          "los angeles-tokyo": { economy: 780, business: 2950 },
        };
        const key = `${args.origin.toLowerCase()}-${args.destination.toLowerCase()}`;
        const reverseKey = `${args.destination.toLowerCase()}-${args.origin.toLowerCase()}`;
        const prices = routes[key] ?? routes[reverseKey] ?? { economy: 650, business: 2400 };
        return JSON.stringify({
          origin: args.origin,
          destination: args.destination,
          departure_date: args.departure_date ?? "flexible",
          currency: "USD",
          round_trip: { economy: `$${prices.economy}`, business: `$${prices.business}` },
          note: "Prices are estimates; book early for best rates.",
        });
      }
      case "convert_currency": {
        const rates = { EUR: 1.08, GBP: 1.27, JPY: 0.0067, CAD: 0.74, AUD: 0.65, CHF: 1.13 };
        const from = args.from_currency.toUpperCase();
        const to = args.to_currency.toUpperCase();
        const toUSD = from === "USD" ? 1 : (rates[from] ?? 1);
        const fromUSD = to === "USD" ? 1 : 1 / (rates[to] ?? 1);
        const converted = args.amount * toUSD * fromUSD;
        return JSON.stringify({
          amount: args.amount,
          from: from,
          to: to,
          result: Math.round(converted * 100) / 100,
          rate: Math.round(toUSD * fromUSD * 10000) / 10000,
          note: "Exchange rate is approximate.",
        });
      }

      // ── Code tools ──
      case "analyze_code": {
        const lang = (args.language ?? "unknown").toLowerCase();
        const code = args.code ?? "";
        const issues = [];
        if (code.includes("fib(n-1)") && code.includes("fib(n-2)")) {
          issues.push({ severity: "error", message: "Missing base case — infinite recursion for n <= 0", line: 2 });
          issues.push({ severity: "warning", message: "Exponential time complexity O(2^n) — use memoization or iteration", line: 2 });
        }
        if (code.includes("var ")) issues.push({ severity: "info", message: "Prefer 'const'/'let' over 'var' in modern JS", line: 1 });
        if (code.includes("console.log")) issues.push({ severity: "info", message: "Remove debug console.log before committing", line: null });
        if (issues.length === 0) issues.push({ severity: "info", message: "No obvious issues detected — consider adding type hints and docstrings", line: null });
        return JSON.stringify({ language: lang, lines: code.split("\n").length, issues, complexity: issues.some(i => i.severity === "error") ? "high" : "low" });
      }
      case "explain_error": {
        const msg = (args.error_message ?? "").toLowerCase();
        let explanation = { title: "Unknown error", cause: "Could not determine cause.", fix: "Check the stack trace for more context." };
        if (msg.includes("cannot read properties of undefined") || msg.includes("cannot read property")) {
          explanation = {
            title: "Null/undefined property access",
            cause: "You're trying to access a property (like .map, .length, .data) on a value that is undefined or null at runtime.",
            fix: "Add a null check before accessing the property: `if (value) { value.map(...) }` or use optional chaining: `value?.map(...)`.",
            common_causes: ["API response not yet loaded", "Array initialization missing", "Async data accessed before it resolves"],
          };
        } else if (msg.includes("syntaxerror")) {
          explanation = { title: "Syntax error", cause: "The JavaScript parser encountered unexpected characters.", fix: "Check for missing brackets, commas, or closing braces near the indicated line." };
        }
        return JSON.stringify(explanation);
      }
      case "lookup_npm_package": {
        const pkgs = {
          lodash: { version: "4.17.21", weekly_downloads: "52M", bundle_size_kb: 73, description: "Utility library with functional helpers for arrays, objects, and strings.", license: "MIT" },
          ramda: { version: "0.29.1", weekly_downloads: "3.2M", bundle_size_kb: 46, description: "Functional programming library with auto-curry and immutable style.", license: "MIT" },
          axios: { version: "1.7.9", weekly_downloads: "48M", bundle_size_kb: 12, description: "Promise-based HTTP client for browser and Node.js.", license: "MIT" },
          express: { version: "4.21.2", weekly_downloads: "35M", bundle_size_kb: "N/A (server)", description: "Fast, unopinionated web framework for Node.js.", license: "MIT" },
          typescript: { version: "5.7.3", weekly_downloads: "55M", bundle_size_kb: "N/A (dev)", description: "Typed superset of JavaScript that compiles to plain JS.", license: "Apache-2.0" },
        };
        const pkg = pkgs[args.package_name.toLowerCase()] ?? { version: "latest", weekly_downloads: "varies", bundle_size_kb: "unknown", description: "Package found in npm registry.", license: "varies" };
        return JSON.stringify({ name: args.package_name, ...pkg });
      }
      case "generate_test_stubs": {
        const fw = args.framework ?? "jest";
        const sig = args.function_signature ?? "myFunction";
        const stubs = {
          jest: `describe('${sig.split("(")[0].trim()}', () => {\n  it('should return expected output for valid input', () => {\n    // TODO: implement\n  });\n  it('should handle edge cases (null, empty, boundary)', () => {\n    // TODO: implement\n  });\n  it('should throw on invalid input', () => {\n    // TODO: implement\n  });\n});`,
          vitest: `import { describe, it, expect } from 'vitest';\n\ndescribe('${sig.split("(")[0].trim()}', () => {\n  it('returns expected output for valid input', () => {\n    expect(true).toBe(true); // TODO\n  });\n  it('handles edge cases', () => {\n    expect(true).toBe(true); // TODO\n  });\n});`,
          pytest: `import pytest\n\ndef test_${sig.split("(")[0].trim()}_valid_input():\n    # TODO: implement\n    pass\n\ndef test_${sig.split("(")[0].trim()}_edge_cases():\n    # TODO: implement\n    pass\n\ndef test_${sig.split("(")[0].trim()}_invalid_raises():\n    with pytest.raises(ValueError):\n        pass  # TODO`,
        };
        return JSON.stringify({ framework: fw, stubs: stubs[fw] ?? stubs.jest });
      }

      // ── Data tools ──
      case "query_sales_data": {
        const granularity = args.granularity ?? "monthly";
        const metric = args.metric ?? "revenue";
        const rows = {
          monthly: [
            { period: "2024-01", value: 142300 },
            { period: "2024-02", value: 138900 },
            { period: "2024-03", value: 157400 },
            { period: "2024-04", value: 161200 },
            { period: "2024-05", value: 153800 },
          ],
          quarterly: [
            { period: "Q1 2024", value: 438600 },
            { period: "Q2 2024", value: 472100 },
            { period: "Q3 2024", value: 451900 },
            { period: "Q4 2024", value: 498400 },
          ],
          daily: Array.from({ length: 7 }, (_, i) => ({ period: `2024-04-${String(i + 24).padStart(2, "0")}`, value: Math.floor(4500 + Math.random() * 2000) })),
        };
        return JSON.stringify({
          metric,
          start_date: args.start_date,
          end_date: args.end_date,
          granularity,
          data: rows[granularity] ?? rows.monthly,
          unit: metric === "revenue" ? "USD" : "count",
        });
      }
      case "calculate_statistics": {
        const values = [142300, 138900, 157400, 161200, 153800, 148700];
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const stddev = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
        return JSON.stringify({
          dataset: args.dataset,
          period: args.period,
          n: values.length,
          mean: Math.round(mean),
          median,
          std_dev: Math.round(stddev),
          min: Math.min(...values),
          max: Math.max(...values),
          p25: sorted[Math.floor(sorted.length * 0.25)],
          p75: sorted[Math.floor(sorted.length * 0.75)],
        });
      }
      case "detect_anomalies": {
        const anomalies = [
          { date: "2024-03-15", value: 8900, z_score: 3.2, type: "spike", note: "Flash sale event" },
          { date: "2024-03-28", value: 1200, z_score: -2.8, type: "dip", note: "Payment gateway outage" },
        ];
        return JSON.stringify({
          metric: args.metric,
          period: args.period,
          sensitivity: args.sensitivity ?? "medium",
          anomalies_found: anomalies.length,
          anomalies,
          baseline_mean: 4750,
          baseline_std: 620,
        });
      }
      case "forecast_trend": {
        const base = 155000;
        const horizon = Math.min(args.horizon_days ?? 30, 90);
        const points = Array.from({ length: Math.ceil(horizon / 7) }, (_, i) => ({
          week: `Week ${i + 1}`,
          forecast: Math.round(base * (1 + i * 0.02 + (Math.random() - 0.5) * 0.03)),
          lower_bound: Math.round(base * (1 + i * 0.02 - 0.05)),
          upper_bound: Math.round(base * (1 + i * 0.02 + 0.05)),
        }));
        return JSON.stringify({
          metric: args.metric,
          horizon_days: horizon,
          model: args.model ?? "seasonal",
          forecast: points,
          trend: "upward",
          confidence: "medium",
          note: "Forecast assumes no major promotional events.",
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch {
    return JSON.stringify({ error: `Failed to execute tool ${name}` });
  }
}

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
// Body: { messages: [...], agentId?: string }
//
// SSE event types:
//   { text: "..." }                         — assistant text delta
//   { toolCall: { name, arguments } }       — model is invoking a tool
//   { toolResult: { name, result } }        — tool execution result
//   { error: "..." }                        — error message
app.post("/chat", async (req, res) => {
  const { messages, agentId, sessionId } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const agent = AGENTS[agentId] ?? AGENTS.travel;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const fullMessages = [{ role: "system", content: agent.systemPrompt }, ...messages];
    const sessionHeaders = sessionId ? { "x-trsr-session-id": sessionId } : {};
    console.log(`[chat] agent=${agent.id} session=${sessionId ?? "none"} → ${MODEL}  messages=${fullMessages.length}`);

    // Turn 1: non-streaming with tools so tool_calls can be detected
    const turn1 = await openai.chat.completions.create({
      model: MODEL,
      messages: fullMessages,
      tools: agent.tools,
      stream: false,
    }, { headers: sessionHeaders });

    const choice = turn1.choices[0];
    const toolCalls = choice.message.tool_calls ?? [];

    if (toolCalls.length === 0) {
      send({ text: choice.message.content ?? "" });
    } else {
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

      // Turn 2: stream the final answer with full context including tool results.
      // Tools are re-sent so the model can call another tool if needed (multi-step use).
      const stream = await openai.chat.completions.create({
        model: MODEL,
        messages: [...fullMessages, ...toolMessages],
        tools: agent.tools,
        stream: true,
      }, { headers: sessionHeaders });

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
