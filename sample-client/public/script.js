const messagesEl = document.getElementById("messages");
const emptyEl = document.getElementById("empty");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");

const history = [];   // { role: "user"|"assistant", content: string }[]
let streaming = false;

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

async function send() {
  const text = inputEl.value.trim();
  if (!text || streaming) return;

  inputEl.value = "";
  autoResize();
  streaming = true;
  sendBtn.disabled = true;

  history.push({ role: "user", content: text });
  addMessage("user", text);

  const assistantBubble = addMessage("assistant");
  assistantBubble.classList.add("cursor");
  let assistantText = "";

  // Track pending tool cards keyed by tool name (one at a time per name)
  const pendingCards = new Map();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
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
          // Insert card before the assistant bubble's parent
          const card = addToolCard(json.toolCall.name, json.toolCall.arguments);
          // Move the card above the assistant message
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

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

inputEl.addEventListener("input", autoResize);
sendBtn.addEventListener("click", send);

// Demo chip — fills the input with a question that triggers both demo tools
document.getElementById("demo-chip")?.addEventListener("click", () => {
  inputEl.value = "What's the weather in Vienna right now, and what are the top 3 tourist attractions there?";
  autoResize();
  inputEl.focus();
});

inputEl.focus();
