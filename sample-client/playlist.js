import "dotenv/config";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { loadAgents, runChat } from "./chat.js";

// CLI flags:
//   --agent <id>      run only this agent (default: all)
//   --delay <ms>      pause between examples (default: 500)
//   --limit <n>       cap examples per agent (default: all)
//
// Exit codes: 0 if every example succeeded, 1 if any failed.

function parseArgs(argv) {
  const args = { agent: null, delay: 500, limit: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === "--agent" && next) { args.agent = next; i++; }
    else if (flag === "--delay" && next) { args.delay = Number(next); i++; }
    else if (flag === "--limit" && next) { args.limit = Number(next); i++; }
    else if (flag === "--help" || flag === "-h") {
      console.log("Usage: node playlist.js [--agent <id>] [--delay <ms>] [--limit <n>]");
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.delay) || args.delay < 0) throw new Error("--delay must be a non-negative number");
  if (args.limit != null && (!Number.isFinite(args.limit) || args.limit < 1)) throw new Error("--limit must be a positive integer");
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const agents = loadAgents();

  const targets = args.agent
    ? [agents[args.agent]].filter(Boolean)
    : Object.values(agents);
  if (args.agent && targets.length === 0) {
    console.error(`Unknown agent "${args.agent}". Available: ${Object.keys(agents).join(", ")}`);
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: process.env.PROXYTRACE_API_KEY,
    baseURL: process.env.PROXYTRACE_BASE_URL ?? "https://api.openai.com/v1",
  });
  const model = process.env.MODEL ?? "gpt-4o-mini";

  const proxytraceUrl = process.env.PROXYTRACE_BASE_URL ?? "(not set — using OpenAI directly)";
  console.log(`Proxytrace proxy: ${proxytraceUrl}`);
  console.log(`Model:      ${model}`);
  console.log(`Agents:     ${targets.map((a) => a.id).join(", ")}`);
  console.log(`Delay:      ${args.delay}ms between examples`);
  if (args.limit) console.log(`Limit:      ${args.limit} per agent`);
  console.log("");

  let totalOk = 0;
  let totalFail = 0;

  for (const agent of targets) {
    const examples = args.limit ? agent.shortcuts.slice(0, args.limit) : agent.shortcuts;
    console.log(`── ${agent.icon} ${agent.name} (${examples.length} example${examples.length === 1 ? "" : "s"}) ──`);

    for (let i = 0; i < examples.length; i++) {
      const ex = examples[i];
      const sessionId = randomUUID();
      const preview = ex.prompt.replace(/\s+/g, " ").slice(0, 80);
      const tools = [];
      const start = Date.now();

      process.stdout.write(`▶ ${agent.id}/${i + 1} "${preview}${ex.prompt.length > 80 ? "…" : ""}"\n`);

      try {
        await runChat({
          agent,
          messages: [{ role: "user", content: ex.prompt }],
          openai,
          model,
          sessionHeaders: { "x-proxytrace-session-id": sessionId },
          onEvent: (event) => {
            if (event.toolCall) {
              tools.push(event.toolCall.name);
              console.log(`   tool: ${event.toolCall.name}(${event.toolCall.arguments})`);
            }
          },
        });
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const toolSummary = tools.length ? ` [${tools.join(", ")}]` : "";
        console.log(`   ✓ done in ${elapsed}s${toolSummary}`);
        totalOk++;
      } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        const message = err instanceof Error ? err.message : String(err);
        console.error(`   ✗ failed after ${elapsed}s: ${message}`);
        totalFail++;
      }

      if (i < examples.length - 1 && args.delay > 0) await sleep(args.delay);
    }
    console.log("");
  }

  console.log(`Done. ${totalOk} succeeded, ${totalFail} failed.`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
