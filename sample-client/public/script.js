// ─── Locale / i18n ─────────────────────────────────────────────────────────
// Small inline dictionary — two locales, no library, no build step.
// Only display-layer strings live here; system prompts, tool definitions, and
// X-Proxytrace-Agent headers are never translated (see binding constraints).

const STRINGS = {
  en: {
    appTitle: "Proxytrace Sample Chatbot",
    badgeText: "Routed through Proxytrace proxy — every message is captured in your traces",
    promptBtnLabel: "Prompt",
    emptyDefault: "Select an agent above and start chatting. All interactions will appear as traces in your Proxytrace dashboard.",
    emptyAgentSuffix: "Start chatting; all interactions will appear as traces in your Proxytrace dashboard.",
    inputPlaceholder: "Type a message… (Enter to send, Shift+Enter for new line)",
    inputPlaceholderAsk: "Ask the ",
    inputPlaceholderSuffix: "… (Enter to send, Shift+Enter for new line)",
    demoLabel: "Try a shortcut",
    playAll: "Play all",
    stop: "Stop",
    stopping: "Stopping…",
    playingProgress: (i, n) => `Playing ${i} / ${n}…`,
    settingsTitle: "Model Parameters",
    settingsHint: "Applied to every request. Saved in your browser.",
    tempHint: "0 = deterministic, 2 = creative",
    topPHint: "Nucleus sampling (0–1)",
    maxTokensPlaceholder: "default",
    maxTokensHint: "Leave blank for model default",
    freqPenHint: "Penalize repeated tokens (-2 to 2)",
    presPenHint: "Encourage new topics (-2 to 2)",
    resetToDefaults: "Reset to defaults",
    done: "Done",
    systemPromptTitle: "System Prompt",
    promptModalHint:
      "The <strong>default prompt</strong> is always shown below (read-only). Paste an improved "
      + "prompt in the <strong>Override</strong> textarea and click Apply — the next message will "
      + "use it. Reset restores the default and starts a fresh session.",
    defaultPromptLabel: "Default prompt",
    overrideLabel: "Override",
    overridePlaceholder: "Paste the optimizer’s improved prompt here…",
    resetToDefault: "Reset to default",
    apply: "Apply",
    you: "You",
    assistant: "Assistant",
    error: "Error",
    agentsLoadError: "Could not load agents",
    promptApplyError: "Could not apply prompt:",
    promptResetError: "Could not reset prompt:",
    promptDialogTitle: (name) => `System Prompt — ${name}`,
  },
  de: {
    appTitle: "Proxytrace Sample-Chatbot",
    badgeText: "Über den Proxytrace-Proxy geleitet — jede Nachricht wird in Ihren Traces erfasst",
    promptBtnLabel: "System-Prompt",
    emptyDefault: "Wählen Sie oben einen Agenten aus und starten Sie das Gespräch. Alle Interaktionen erscheinen als Traces in Ihrem Proxytrace-Dashboard.",
    emptyAgentSuffix: "Starten Sie das Gespräch – alle Interaktionen erscheinen als Traces in Ihrem Proxytrace-Dashboard.",
    inputPlaceholder: "Nachricht eingeben… (Enter zum Senden, Shift+Enter für neue Zeile)",
    inputPlaceholderAsk: "Fragen Sie den ",
    inputPlaceholderSuffix: "… (Enter zum Senden, Shift+Enter für neue Zeile)",
    demoLabel: "Shortcut ausprobieren",
    playAll: "Alle abspielen",
    stop: "Anhalten",
    stopping: "Wird angehalten…",
    playingProgress: (i, n) => `Spielt ${i} / ${n}…`,
    settingsTitle: "Modellparameter",
    settingsHint: "Gilt für jede Anfrage. Wird in Ihrem Browser gespeichert.",
    tempHint: "0 = deterministisch, 2 = kreativ",
    topPHint: "Nucleus-Sampling (0–1)",
    maxTokensPlaceholder: "Standard",
    maxTokensHint: "Leer lassen für den Modell-Standard",
    freqPenHint: "Wiederholungen bestrafen (−2 bis 2)",
    presPenHint: "Neue Themen fördern (−2 bis 2)",
    resetToDefaults: "Auf Standard zurücksetzen",
    done: "Fertig",
    systemPromptTitle: "System-Prompt",
    promptModalHint:
      "Der <strong>Standard-Prompt</strong> wird unten immer angezeigt (schreibgeschützt). "
      + "Fügen Sie einen verbesserten Prompt in das Feld <strong>Überschreiben</strong> ein "
      + "und klicken Sie auf „Ubernehmen“ — die nächste Nachricht verwendet ihn. "
      + "„Zurücksetzen“ stellt den Standard wieder her und startet eine neue Sitzung.",
    defaultPromptLabel: "Standard-Prompt",
    overrideLabel: "Überschreiben",
    overridePlaceholder: "Verbesserten Prompt des Optimierers hier einfügen…",
    resetToDefault: "Auf Standard zurücksetzen",
    apply: "Übernehmen",
    you: "Sie",
    assistant: "Assistent",
    error: "Fehler",
    agentsLoadError: "Agenten konnten nicht geladen werden",
    promptApplyError: "Prompt konnte nicht übernommen werden:",
    promptResetError: "Prompt konnte nicht zurückgesetzt werden:",
    promptDialogTitle: (name) => `System-Prompt — ${name}`,
  },
};

// Display names / descriptions for each agent, keyed by locale then agent id.
// Only used in the UI — proxytraceName and everything sent to the API is unchanged.
const AGENT_DISPLAY = {
  en: {
    support: { name: "Customer Support Agent", description: "Order status, returns & refunds" },
    travel:  { name: "Travel Planner",         description: "Weather, attractions, flights & currency" },
    code:    { name: "Code Assistant",         description: "Bug detection, packages, errors & test generation" },
    data:    { name: "Data Analyst",           description: "Sales data, statistics, anomalies & forecasting" },
  },
  de: {
    support: { name: "Kundensupport-Agent",  description: "Bestellstatus, Rücksendungen & Erstattungen" },
    travel:  { name: "Reiseplaner",          description: "Wetter, Sehenswürdigkeiten, Flüge & Währung" },
    code:    { name: "Code-Assistent",       description: "Fehlersuche, Pakete, Fehlermeldungen & Testgenerierung" },
    data:    { name: "Datenanalyst",         description: "Verkaufsdaten, Statistiken, Anomalien & Prognosen" },
  },
};

const LANG_STORAGE_KEY = "proxytrace-sample-lang";

let currentLocale = (() => {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === "en" || saved === "de") return saved;
  } catch { /* ignore */ }
  return (navigator.language ?? "").startsWith("de") ? "de" : "en";
})();

function getAgentDisplay(agent) {
  const map = AGENT_DISPLAY[currentLocale] ?? AGENT_DISPLAY.en;
  return map[agent.id] ?? { name: agent.name, description: agent.description };
}

function getShortcuts(agent) {
  return currentLocale === "de" && agent.shortcutsDE ? agent.shortcutsDE : agent.shortcuts;
}

// ─── DOM refs ──────────────────────────────────────────────────────────────

const messagesEl = document.getElementById("messages");
const emptyEl = document.getElementById("empty");
const emptyTextEl = document.getElementById("empty-text");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const agentTabsEl = document.getElementById("agent-tabs");
const shortcutsListEl = document.getElementById("shortcuts-list");
const playBtn = document.getElementById("play-btn");
const playIcon = document.getElementById("play-icon");
const stopIcon = document.getElementById("stop-icon");
const playLabel = document.getElementById("play-label");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsCloseBtn = document.getElementById("settings-close");
const settingsDoneBtn = document.getElementById("settings-done");
const settingsResetBtn = document.getElementById("settings-reset");
const promptBtn = document.getElementById("prompt-btn");
const promptModal = document.getElementById("prompt-modal");
const promptCloseBtn = document.getElementById("prompt-close");
const promptDefaultEl = document.getElementById("prompt-default");
const promptOverrideInput = document.getElementById("prompt-override-input");
const promptApplyBtn = document.getElementById("prompt-apply");
const promptResetBtn = document.getElementById("prompt-reset");

// Per-agent conversation history: agentId → message[]
const histories = {};
// Per-agent session ID sent as X-Proxytrace-Session-Id; null until the first message is sent
const sessionIds = {};
// Per-agent current effective system prompt override (null = using default)
// Mirrors the server's in-memory overrides so the panel can display without a round-trip.
const systemPromptOverrides = {};
let agents = [];
let activeAgentId = null;
let streaming = false;
// Auto-play: when true, ignore manual sends and disable tab switching while
// the playlist iterates the active agent's shortcuts.
let playing = false;
let stopRequested = false;
const PLAYLIST_DELAY_MS = 800;

// ─── Model parameters ──────────────────────────────────────────────────────

const PARAM_DEFAULTS = {
  temperature: 1,
  top_p: 1,
  max_tokens: null,
  frequency_penalty: 0,
  presence_penalty: 0,
};
const PARAM_STORAGE_KEY = "proxytrace-sample-model-params";

function loadModelParams() {
  try {
    const raw = localStorage.getItem(PARAM_STORAGE_KEY);
    if (!raw) return { ...PARAM_DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...PARAM_DEFAULTS, ...parsed };
  } catch {
    return { ...PARAM_DEFAULTS };
  }
}

function saveModelParams(params) {
  try { localStorage.setItem(PARAM_STORAGE_KEY, JSON.stringify(params)); } catch {}
}

let modelParams = loadModelParams();

const PARAM_INPUTS = [
  { key: "temperature",       inputId: "param-temperature",       valueId: "param-temperature-value",       parse: parseFloat, format: (v) => v.toFixed(2) },
  { key: "top_p",             inputId: "param-top-p",             valueId: "param-top-p-value",             parse: parseFloat, format: (v) => v.toFixed(2) },
  { key: "max_tokens",        inputId: "param-max-tokens",        valueId: null,                            parse: (s) => s === "" ? null : parseInt(s, 10), format: null },
  { key: "frequency_penalty", inputId: "param-frequency-penalty", valueId: "param-frequency-penalty-value", parse: parseFloat, format: (v) => v.toFixed(2) },
  { key: "presence_penalty",  inputId: "param-presence-penalty",  valueId: "param-presence-penalty-value",  parse: parseFloat, format: (v) => v.toFixed(2) },
];

function syncParamInputs() {
  for (const p of PARAM_INPUTS) {
    const input = document.getElementById(p.inputId);
    const value = modelParams[p.key];
    input.value = value == null ? "" : value;
    if (p.valueId) {
      const display = document.getElementById(p.valueId);
      display.textContent = p.format(typeof value === "number" ? value : 0);
    }
  }
}

function bindParamInputs() {
  for (const p of PARAM_INPUTS) {
    const input = document.getElementById(p.inputId);
    input.addEventListener("input", () => {
      const parsed = p.parse(input.value);
      modelParams[p.key] = Number.isNaN(parsed) ? null : parsed;
      if (p.valueId && typeof modelParams[p.key] === "number") {
        document.getElementById(p.valueId).textContent = p.format(modelParams[p.key]);
      }
      saveModelParams(modelParams);
    });
  }
}

function openSettings() { settingsModal.hidden = false; }
function closeSettings() { settingsModal.hidden = true; }
function resetSettings() {
  modelParams = { ...PARAM_DEFAULTS };
  saveModelParams(modelParams);
  syncParamInputs();
}

// ─── System-prompt panel ───────────────────────────────────────────────────

function openPromptPanel() {
  const agent = agents.find((a) => a.id === activeAgentId);
  if (!agent) return;

  // Always show the built-in default (read-only)
  promptDefaultEl.textContent = agent.baseSystemPrompt ?? "";

  // Pre-fill the textarea with the current override (empty if none is set)
  promptOverrideInput.value = systemPromptOverrides[activeAgentId] ?? "";

  // Update dialog title to show which agent we're editing (localized display name)
  const s = STRINGS[currentLocale];
  document.getElementById("prompt-title").textContent = s.promptDialogTitle(getAgentDisplay(agent).name);

  promptModal.hidden = false;
  promptOverrideInput.focus();
}

function closePromptPanel() {
  promptModal.hidden = true;
}

async function applyPromptOverride() {
  const agent = agents.find((a) => a.id === activeAgentId);
  if (!agent) return;

  // Trim only trailing whitespace/newlines — no other normalisation
  const raw = promptOverrideInput.value.replace(/\s+$/, "");
  if (!raw) {
    promptOverrideInput.classList.add("prompt-textarea--error");
    setTimeout(() => promptOverrideInput.classList.remove("prompt-textarea--error"), 1000);
    return;
  }

  try {
    const res = await fetch(`/agents/${agent.id}/system-prompt`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt: raw }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const { systemPrompt } = await res.json();
    systemPromptOverrides[agent.id] = systemPrompt;
    agent.systemPrompt = systemPrompt; // keep local cache in sync
    closePromptPanel();
  } catch (err) {
    alert(`${STRINGS[currentLocale].promptApplyError} ${err.message}`);
  }
}

async function resetPromptOverride() {
  const agent = agents.find((a) => a.id === activeAgentId);
  if (!agent) return;

  try {
    const res = await fetch(`/agents/${agent.id}/system-prompt`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    const { systemPrompt } = await res.json();
    delete systemPromptOverrides[agent.id];
    agent.systemPrompt = systemPrompt; // restore to default
    // Reset also clears the conversation and starts a new session so back-to-back
    // demos compare clean before/after runs.
    histories[agent.id] = [];
    sessionIds[agent.id] = null;
    if (activeAgentId === agent.id) renderHistory();
    closePromptPanel();
  } catch (err) {
    alert(`${STRINGS[currentLocale].promptResetError} ${err.message}`);
  }
}

function buildParamPayload() {
  const out = {};
  for (const p of PARAM_INPUTS) {
    const v = modelParams[p.key];
    if (v == null || Number.isNaN(v)) continue;
    out[p.key] = v;
  }
  return out;
}

// ─── Apply locale (updates all translatable DOM elements) ──────────────────

function applyLocale() {
  const s = STRINGS[currentLocale];

  // Header
  document.getElementById("app-title").textContent = s.appTitle;
  document.getElementById("badge-text").textContent = s.badgeText;
  document.getElementById("lang-label").textContent = currentLocale.toUpperCase();
  document.getElementById("prompt-btn-label").textContent = s.promptBtnLabel;

  // Empty state (no-agent state)
  if (!activeAgentId) {
    emptyTextEl.textContent = s.emptyDefault;
    inputEl.placeholder = s.inputPlaceholder;
  }

  // Shortcuts row
  document.querySelector(".demo-label").textContent = s.demoLabel;

  // Play button — only update text when not mid-play
  if (!playing) playLabel.textContent = s.playAll;

  // Settings modal
  document.getElementById("settings-title").textContent = s.settingsTitle;
  document.getElementById("settings-modal-hint").textContent = s.settingsHint;
  document.getElementById("param-temp-hint").textContent = s.tempHint;
  document.getElementById("param-top-p-hint").textContent = s.topPHint;
  document.getElementById("param-max-tokens").placeholder = s.maxTokensPlaceholder;
  document.getElementById("param-max-tokens-hint").textContent = s.maxTokensHint;
  document.getElementById("param-freq-pen-hint").textContent = s.freqPenHint;
  document.getElementById("param-pres-pen-hint").textContent = s.presPenHint;
  settingsResetBtn.textContent = s.resetToDefaults;
  settingsDoneBtn.textContent = s.done;

  // Prompt modal (static parts; title set dynamically in openPromptPanel)
  document.getElementById("prompt-modal-hint").innerHTML = s.promptModalHint;
  document.getElementById("prompt-default-label").textContent = s.defaultPromptLabel;
  document.getElementById("prompt-override-label").textContent = s.overrideLabel;
  promptOverrideInput.placeholder = s.overridePlaceholder;
  promptResetBtn.textContent = s.resetToDefault;
  promptApplyBtn.textContent = s.apply;

  // Re-render agent tabs and shortcuts when agents are available
  if (agents.length > 0) {
    renderAgentTabs();
    if (activeAgentId) {
      // Restore active highlight after re-render
      agentTabsEl.querySelectorAll(".agent-tab").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.agentId === activeAgentId);
      });
      // Update empty-state text and input placeholder for the current agent
      const agent = agents.find((a) => a.id === activeAgentId);
      if (agent) {
        const display = getAgentDisplay(agent);
        emptyTextEl.textContent = `${agent.icon} ${display.name} — ${display.description}. ${s.emptyAgentSuffix}`;
        inputEl.placeholder = `${s.inputPlaceholderAsk}${display.name}${s.inputPlaceholderSuffix}`;
      }
      renderShortcuts();
    }
  }
}

// ─── Agent management ──────────────────────────────────────────────────────

async function loadAgents() {
  try {
    const res = await fetch("/agents");
    agents = await res.json();
    agents.forEach((a) => {
      histories[a.id] = [];
      sessionIds[a.id] = null;
      // baseSystemPrompt: the agent's built-in default (server starts clean, no overrides).
      // Always shown read-only in the prompt panel regardless of what override is active.
      a.baseSystemPrompt = a.systemPrompt;
    });
    renderAgentTabs();
    selectAgent(agents[0].id);
  } catch {
    agentTabsEl.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">${STRINGS[currentLocale].agentsLoadError}</span>`;
  }
}

function renderAgentTabs() {
  agentTabsEl.innerHTML = "";
  for (const agent of agents) {
    const display = getAgentDisplay(agent);
    const btn = document.createElement("button");
    btn.className = "agent-tab";
    btn.dataset.agentId = agent.id;
    btn.title = display.description;
    btn.innerHTML = `<span class="agent-icon">${agent.icon}</span><span class="agent-name">${display.name}</span>`;
    btn.addEventListener("click", () => selectAgent(agent.id));
    agentTabsEl.appendChild(btn);
  }
}

function selectAgent(id) {
  if (playing || activeAgentId === id) return;
  activeAgentId = id;
  // Close the prompt panel so it can never silently target a different agent than
  // the one it was opened for.
  if (!promptModal.hidden) closePromptPanel();

  // Update tab active state
  agentTabsEl.querySelectorAll(".agent-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.agentId === id);
  });

  // Restore this agent's conversation
  renderHistory();
  renderShortcuts();

  const agent = agents.find((a) => a.id === id);
  if (agent) {
    const display = getAgentDisplay(agent);
    const s = STRINGS[currentLocale];
    emptyTextEl.textContent = `${agent.icon} ${display.name} — ${display.description}. ${s.emptyAgentSuffix}`;
    inputEl.placeholder = `${s.inputPlaceholderAsk}${display.name}${s.inputPlaceholderSuffix}`;
  }
  inputEl.focus();
}

// ─── Shortcut chips ────────────────────────────────────────────────────────

function renderShortcuts() {
  shortcutsListEl.innerHTML = "";
  const agent = agents.find((a) => a.id === activeAgentId);
  if (!agent) return;
  for (const shortcut of getShortcuts(agent)) {
    const chip = document.createElement("button");
    chip.className = "demo-chip";
    chip.textContent = shortcut.label;
    chip.addEventListener("click", () => {
      inputEl.value = shortcut.prompt;
      autoResize();
      inputEl.focus();
    });
    shortcutsListEl.appendChild(chip);
  }
}

// ─── Message rendering ─────────────────────────────────────────────────────

function renderHistory() {
  // Clear existing messages except the empty state
  const existing = messagesEl.querySelectorAll(".message, .tool-card");
  existing.forEach((el) => el.remove());

  const history = histories[activeAgentId] ?? [];
  emptyEl.style.display = history.length === 0 ? "" : "none";

  for (const msg of history) {
    if (msg.role === "user") {
      addMessage("user", msg.content);
    } else if (msg.role === "assistant") {
      addMessage("assistant", msg.content);
    }
    // Tool cards are not re-rendered from history (they're ephemeral UI)
  }
}

function autoResize() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + "px";
}

function addMessage(role, text = "") {
  emptyEl.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const label = document.createElement("div");
  label.className = "message-label";
  const s = STRINGS[currentLocale];
  label.textContent = role === "user" ? s.you : s.assistant;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return bubble;
}

function addError(text) {
  const wrapper = document.createElement("div");
  wrapper.className = "message assistant error";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = STRINGS[currentLocale].error;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.appendChild(label);
  wrapper.appendChild(bubble);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Renders a tool-call card. Returns the card element so the result can be
// injected into it when the toolResult event arrives.
function addToolCard(name, argsJson) {
  emptyEl.style.display = "none";

  let args;
  try { args = JSON.parse(argsJson); } catch { args = argsJson; }
  const argsText = typeof args === "object"
    ? Object.entries(args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ")
    : String(args);

  const card = document.createElement("div");
  card.className = "tool-card";

  card.innerHTML = `
    <div class="tool-card-header">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <span class="tool-name">${name}</span>
      <span class="tool-args">${argsText}</span>
      <span class="tool-status pending">calling…</span>
    </div>
    <div class="tool-result" hidden></div>
  `;

  messagesEl.appendChild(card);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return card;
}

// Fills in the result section of a previously created tool card.
function resolveToolCard(card, resultJson) {
  const status = card.querySelector(".tool-status");
  status.textContent = "done";
  status.className = "tool-status done";

  let result;
  try { result = JSON.parse(resultJson); } catch { result = resultJson; }
  const pretty = typeof result === "object"
    ? JSON.stringify(result, null, 2)
    : String(result);

  const resultEl = card.querySelector(".tool-result");
  resultEl.textContent = pretty;
  resultEl.hidden = false;

  const header = card.querySelector(".tool-card-header");
  header.style.cursor = "pointer";
  header.addEventListener("click", () => { resultEl.hidden = !resultEl.hidden; });
}

// ─── Send message ──────────────────────────────────────────────────────────

// Posts one user turn to /chat and consumes the SSE stream until [DONE].
// Resolves on success, rejects on transport / API errors. Used directly by
// the manual Send button and by the auto-play playlist runner.
async function sendPrompt(text) {
  if (!text || !activeAgentId) return;

  streaming = true;
  sendBtn.disabled = true;

  const history = histories[activeAgentId];
  if (!sessionIds[activeAgentId]) sessionIds[activeAgentId] = crypto.randomUUID();
  history.push({ role: "user", content: text });
  addMessage("user", text);

  const assistantBubble = addMessage("assistant");
  assistantBubble.classList.add("cursor");
  let assistantText = "";

  const pendingCards = new Map();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, agentId: activeAgentId, sessionId: sessionIds[activeAgentId], modelParams: buildParamPayload() }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6);
        if (payload === "[DONE]") break;

        const json = JSON.parse(payload);

        if (json.error) throw new Error(json.error);

        if (json.toolCall) {
          const card = addToolCard(json.toolCall.name, json.toolCall.arguments);
          assistantBubble.closest(".message").before(card);
          pendingCards.set(json.toolCall.name, card);
          continue;
        }

        if (json.toolResult) {
          const card = pendingCards.get(json.toolResult.name);
          if (card) resolveToolCard(card, json.toolResult.result);
          continue;
        }

        assistantText += json.text ?? "";
        assistantBubble.textContent = assistantText;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    history.push({ role: "assistant", content: assistantText });
  } catch (err) {
    assistantBubble.closest(".message").remove();
    addError(err.message);
    throw err;
  } finally {
    assistantBubble.classList.remove("cursor");
    streaming = false;
    if (!playing) sendBtn.disabled = false;
  }
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || streaming || playing || !activeAgentId) return;
  inputEl.value = "";
  autoResize();
  try {
    await sendPrompt(text);
  } catch {
    // sendPrompt already surfaced the error in the message list
  } finally {
    inputEl.focus();
  }
}

// ─── Auto-play playlist ────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setPlayingState(isPlaying, progress = "") {
  playing = isPlaying;
  inputEl.disabled = isPlaying;
  sendBtn.disabled = isPlaying || streaming;
  playIcon.hidden = isPlaying;
  stopIcon.hidden = !isPlaying;
  const s = STRINGS[currentLocale];
  playLabel.textContent = isPlaying ? (progress || s.stop) : s.playAll;
  playBtn.classList.toggle("playing", isPlaying);
  agentTabsEl.querySelectorAll(".agent-tab").forEach((btn) => {
    btn.disabled = isPlaying;
    btn.classList.toggle("disabled", isPlaying);
  });
}

// Reset the active agent's transcript + session so playlist runs ingest as
// fresh single-turn traces rather than stacking into one long conversation.
function resetActiveAgent() {
  histories[activeAgentId] = [];
  sessionIds[activeAgentId] = null;
  renderHistory();
}

async function playPlaylist() {
  const agent = agents.find((a) => a.id === activeAgentId);
  if (!agent) return;

  // Use the locale-appropriate shortcut set for the entire playlist run.
  const shortcuts = getShortcuts(agent);
  if (!shortcuts?.length) return;

  stopRequested = false;
  const s = STRINGS[currentLocale];
  setPlayingState(true, s.playingProgress(0, shortcuts.length));

  try {
    for (let i = 0; i < shortcuts.length; i++) {
      if (stopRequested) break;
      setPlayingState(true, s.playingProgress(i + 1, shortcuts.length));
      // Each example starts with a clean transcript + fresh session so traces
      // appear as distinct conversations in the Proxytrace dashboard. sendPrompt
      // assigns a new sessionId on the first turn after the reset.
      resetActiveAgent();
      try {
        await sendPrompt(shortcuts[i].prompt);
      } catch {
        // sendPrompt already rendered the error inline; keep going so a
        // single failure doesn't abort the whole playlist.
      }
      if (stopRequested) break;
      if (i < shortcuts.length - 1) await sleep(PLAYLIST_DELAY_MS);
    }
  } finally {
    setPlayingState(false);
    stopRequested = false;
    inputEl.focus();
  }
}

function togglePlay() {
  if (playing) {
    stopRequested = true;
    playLabel.textContent = STRINGS[currentLocale].stopping;
  } else {
    playPlaylist();
  }
}

// ─── Event listeners ───────────────────────────────────────────────────────

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

inputEl.addEventListener("input", autoResize);
sendBtn.addEventListener("click", send);
playBtn.addEventListener("click", togglePlay);

settingsBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsDoneBtn.addEventListener("click", closeSettings);
settingsResetBtn.addEventListener("click", resetSettings);
settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettings(); });

promptBtn.addEventListener("click", openPromptPanel);
promptCloseBtn.addEventListener("click", closePromptPanel);
promptApplyBtn.addEventListener("click", applyPromptOverride);
promptResetBtn.addEventListener("click", resetPromptOverride);
promptModal.addEventListener("click", (e) => { if (e.target === promptModal) closePromptPanel(); });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!settingsModal.hidden) closeSettings();
    if (!promptModal.hidden) closePromptPanel();
  }
});

document.getElementById("lang-btn").addEventListener("click", () => {
  currentLocale = currentLocale === "en" ? "de" : "en";
  try { localStorage.setItem(LANG_STORAGE_KEY, currentLocale); } catch {}
  applyLocale();
});

// ─── Boot ──────────────────────────────────────────────────────────────────

syncParamInputs();
bindParamInputs();
applyLocale();   // apply locale before agents load (updates static strings)
loadAgents();    // renderAgentTabs / selectAgent inside already use currentLocale
