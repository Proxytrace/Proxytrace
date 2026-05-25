// Shared agent definitions, tool simulator, and chat-loop helper.
// Used by both the Express server (server.js) and the headless playlist
// runner (playlist.js) so the same Turn 1 / Turn 2 tool-calling flow is
// exercised in both modes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Agent definitions ─────────────────────────────────────────────────────
// Examples (a.k.a. shortcuts) live in examples/<id>.json and are merged in
// by `loadAgents()` so the prompt catalogue can grow without bloating this
// file.
export const AGENTS = {
  travel: {
    id: "travel",
    name: "Travel Planner",
    icon: "✈️",
    description: "Weather, attractions, flights & currency",
    systemPrompt:
      "You are an expert travel planner and weather assistant. Use the provided tools to help users plan trips, check weather, find attractions, look up flight prices, and convert currencies. Be concise and practical.",
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

// Reads examples/<id>.json for every agent and attaches them as `shortcuts`
// (name preserved for backwards compatibility with the existing UI). Throws
// loudly if a file is missing or malformed — callers depend on every agent
// having a populated playlist.
export function loadAgents() {
  for (const agent of Object.values(AGENTS)) {
    const file = path.join(__dirname, "examples", `${agent.id}.json`);
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`examples/${agent.id}.json must be a non-empty array`);
    }
    agent.shortcuts = parsed;
  }
  return AGENTS;
}

// ─── Simulated tool implementations ───────────────────────────────────────
export function executeTool(name, argsJson) {
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
          paris: { temp_c: 11, temp_f: 52, condition: "Light rain", humidity: "78%", wind: "18 km/h W" },
          rome: { temp_c: 19, temp_f: 66, condition: "Sunny", humidity: "52%", wind: "9 km/h S" },
          lisbon: { temp_c: 20, temp_f: 68, condition: "Mostly sunny", humidity: "58%", wind: "14 km/h NW" },
          reykjavik: { temp_c: 4, temp_f: 39, condition: "Windy", humidity: "82%", wind: "32 km/h N" },
          bangkok: { temp_c: 33, temp_f: 91, condition: "Humid, scattered storms", humidity: "85%", wind: "7 km/h SE" },
          sydney: { temp_c: 24, temp_f: 75, condition: "Clear", humidity: "60%", wind: "16 km/h E" },
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
          paris: [
            { name: "Eiffel Tower", rating: 4.7, category: "Landmark" },
            { name: "Louvre Museum", rating: 4.8, category: "Museum" },
            { name: "Notre-Dame Cathedral", rating: 4.7, category: "Religious Site" },
            { name: "Montmartre", rating: 4.6, category: "Historic District" },
            { name: "Musée d'Orsay", rating: 4.7, category: "Museum" },
          ],
          rome: [
            { name: "Colosseum", rating: 4.8, category: "Historic Site" },
            { name: "Vatican Museums", rating: 4.8, category: "Museum" },
            { name: "Trevi Fountain", rating: 4.7, category: "Landmark" },
            { name: "Pantheon", rating: 4.8, category: "Historic Site" },
            { name: "Roman Forum", rating: 4.6, category: "Historic Site" },
          ],
          lisbon: [
            { name: "Belém Tower", rating: 4.6, category: "Historic Site" },
            { name: "Jerónimos Monastery", rating: 4.7, category: "Religious Site" },
            { name: "Alfama District", rating: 4.7, category: "Historic District" },
            { name: "Tram 28", rating: 4.5, category: "Landmark" },
            { name: "LX Factory", rating: 4.4, category: "Cultural Hub" },
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
          "new york-paris": { economy: 540, business: 2400 },
          "new york-rome": { economy: 660, business: 2700 },
          "london-lisbon": { economy: 110, business: 410 },
          "new york-reykjavik": { economy: 420, business: 1600 },
          "los angeles-sydney": { economy: 1100, business: 4500 },
          "london-bangkok": { economy: 720, business: 3100 },
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
        if (code.match(/await\s+.*\.forEach/)) issues.push({ severity: "error", message: "`await` inside `forEach` doesn't await — use `for...of` or `Promise.all(map)`", line: null });
        if (code.match(/setInterval\b/) && !code.match(/clearInterval\b/)) issues.push({ severity: "warning", message: "setInterval without matching clearInterval — potential leak", line: null });
        if (code.match(/==[^=]/)) issues.push({ severity: "info", message: "Loose equality (`==`) — prefer strict equality (`===`)", line: null });
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
        } else if (msg.includes("maximum call stack")) {
          explanation = {
            title: "Stack overflow / runaway recursion",
            cause: "A function is calling itself (directly or indirectly) without ever hitting a base case.",
            fix: "Add a termination condition, or convert recursion to iteration. For tree walks, watch for cycles.",
          };
        } else if (msg.includes("econnrefused") || msg.includes("connection refused")) {
          explanation = {
            title: "Connection refused",
            cause: "Nothing is listening on the host:port you tried to connect to.",
            fix: "Verify the service is running, the port matches, and no firewall is blocking the connection.",
          };
        } else if (msg.includes("memory") || msg.includes("heap out of memory")) {
          explanation = {
            title: "Out of memory",
            cause: "The Node process exceeded the V8 heap limit, often from unbounded array growth or retained closures.",
            fix: "Profile heap usage, drop references to large objects, or raise --max-old-space-size as a stopgap.",
          };
        } else if (msg.includes("nameerror") || msg.includes("is not defined")) {
          explanation = {
            title: "Undefined identifier",
            cause: "A variable or function name is referenced before declaration or after a typo.",
            fix: "Check spelling, ensure the import is in scope, and confirm declaration order.",
          };
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
          dayjs: { version: "1.11.13", weekly_downloads: "24M", bundle_size_kb: 7, description: "Minimalist date library with a Moment-compatible API.", license: "MIT" },
          "date-fns": { version: "3.6.0", weekly_downloads: "23M", bundle_size_kb: 18, description: "Modular date utility library with tree-shakeable functions.", license: "MIT" },
          luxon: { version: "3.5.0", weekly_downloads: "8M", bundle_size_kb: 71, description: "Modern date/time library with first-class timezone support.", license: "MIT" },
          moment: { version: "2.30.1", weekly_downloads: "21M", bundle_size_kb: 232, description: "Mature but heavy date library; mostly in maintenance mode.", license: "MIT" },
          zod: { version: "3.23.8", weekly_downloads: "20M", bundle_size_kb: 14, description: "TypeScript-first schema validation with static type inference.", license: "MIT" },
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

// Runs one chat exchange against the OpenAI-compatible endpoint, replicating
// the Proxytrace-friendly two-turn tool-call flow:
//   Turn 1 — non-streaming with tools so tool_calls can be detected
//   Turn 2 — streaming, with executed tool results appended (only if tools
//            were called)
//
// `onEvent` is invoked synchronously for each user-visible event:
//   { text }                     — assistant text delta (or full message
//                                  when no tools were called)
//   { toolCall: { name, arguments } }
//   { toolResult: { name, result } }
//
// Throws on transport / API errors; the caller decides how to surface them.
export async function runChat({ agent, messages, openai, model, params = {}, sessionHeaders = {}, onEvent }) {
  const fullMessages = [{ role: "system", content: agent.systemPrompt }, ...messages];

  const turn1 = await openai.chat.completions.create(
    { model, messages: fullMessages, tools: agent.tools, stream: false, ...params },
    { headers: sessionHeaders },
  );

  const choice = turn1.choices[0];
  const toolCalls = choice.message.tool_calls ?? [];

  if (toolCalls.length === 0) {
    onEvent({ text: choice.message.content ?? "" });
    return;
  }

  const toolMessages = [{ role: "assistant", content: null, tool_calls: toolCalls }];
  for (const tc of toolCalls) {
    const argsJson = tc.function.arguments;
    onEvent({ toolCall: { name: tc.function.name, arguments: argsJson } });
    const result = executeTool(tc.function.name, argsJson);
    onEvent({ toolResult: { name: tc.function.name, result } });
    toolMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
  }

  // Turn 2: stream the final answer with tool results in context. Tools are
  // re-sent so the model can chain another call if needed.
  const stream = await openai.chat.completions.create(
    { model, messages: [...fullMessages, ...toolMessages], tools: agent.tools, stream: true, ...params },
    { headers: sessionHeaders },
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) onEvent({ text: delta });
  }
}
