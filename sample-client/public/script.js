const messagesEl = document.getElementById("messages");
const emptyEl = document.getElementById("empty");
const emptyTextEl = document.getElementById("empty-text");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const agentTabsEl = document.getElementById("agent-tabs");
const shortcutsListEl = document.getElementById("shortcuts-list");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsCloseBtn = document.getElementById("settings-close");
const settingsDoneBtn = document.getElementById("settings-done");
const settingsResetBtn = document.getElementById("settings-reset");

// Per-agent conversation history: agentId → message[]
const histories = {};
// Per-agent session ID sent as X-Trsr-Session-Id; null until the first message is sent
const sessionIds = {};
let agents = [];
let activeAgentId = null;
let streaming = false;

// ─── Model parameters ──────────────────────────────────────────────────────

const PARAM_DEFAULTS = {
  temperature: 1,
  top_p: 1,
  max_tokens: null,
  frequency_penalty: 0,
  presence_penalty: 0,
};
const PARAM_STORAGE_KEY = "trsr-sample-model-params";

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

function buildParamPayload() {
  const out = {};
  for (const p of PARAM_INPUTS) {
    const v = modelParams[p.key];
    if (v == null || Number.isNaN(v)) continue;
    out[p.key] = v;
  }
  return out;
}

// ─── Agent management ──────────────────────────────────────────────────────

async function loadAgents() {
  try {
    const res = await fetch("/agents");
    agents = await res.json();
    agents.forEach((a) => { histories[a.id] = []; sessionIds[a.id] = null; });
    renderAgentTabs();
    selectAgent(agents[0].id);
  } catch {
    agentTabsEl.innerHTML = `<span style="color:var(--text-muted);font-size:.8rem">Could not load agents</span>`;
  }
}

function renderAgentTabs() {
  agentTabsEl.innerHTML = "";
  for (const agent of agents) {
    const btn = document.createElement("button");
    btn.className = "agent-tab";
    btn.dataset.agentId = agent.id;
    btn.title = agent.description;
    btn.innerHTML = `<span class="agent-icon">${agent.icon}</span><span class="agent-name">${agent.name}</span>`;
    btn.addEventListener("click", () => selectAgent(agent.id));
    agentTabsEl.appendChild(btn);
  }
}

function selectAgent(id) {
  if (activeAgentId === id) return;
  activeAgentId = id;

  // Update tab active state
  agentTabsEl.querySelectorAll(".agent-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.agentId === id);
  });

  // Restore this agent's conversation
  renderHistory();
  renderShortcuts();

  const agent = agents.find((a) => a.id === id);
  if (agent) {
    emptyTextEl.textContent = `${agent.icon} ${agent.name} — ${agent.description}. Start chatting; all interactions will appear as traces in your Trsr dashboard.`;
    inputEl.placeholder = `Ask the ${agent.name}… (Enter to send, Shift+Enter for new line)`;
  }
  inputEl.focus();
}

// ─── Shortcut chips ────────────────────────────────────────────────────────

function renderShortcuts() {
  shortcutsListEl.innerHTML = "";
  const agent = agents.find((a) => a.id === activeAgentId);
  if (!agent) return;
  for (const shortcut of agent.shortcuts) {
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
  label.textContent = role === "user" ? "You" : "Assistant";

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
  label.textContent = "Error";

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

async function send() {
  const text = inputEl.value.trim();
  if (!text || streaming || !activeAgentId) return;

  inputEl.value = "";
  autoResize();
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
  } finally {
    assistantBubble.classList.remove("cursor");
    streaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
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

settingsBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsDoneBtn.addEventListener("click", closeSettings);
settingsResetBtn.addEventListener("click", resetSettings);
settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettings(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !settingsModal.hidden) closeSettings();
});

// ─── Boot ──────────────────────────────────────────────────────────────────

syncParamInputs();
bindParamInputs();
loadAgents();
