# Traces Table — Tools Column + Status De-duplication

## Goal

Two small refinements to the AgentCalls table on the Traces page (`frontend/src/features/traces/Traces.tsx`):

1. Add a **Tools** column showing the number of tool calls in each AgentCall.
2. Stop rendering the HTTP status code twice in the Status cell.

## Background

- `AgentCallDto.response.toolRequests: ToolRequestDto[]` is the assistant's tool calls in the response. That count is the value we want to surface.
- `StatusDot` (`frontend/src/components/ui/StatusDot.tsx`) already renders a colored dot **plus** the status number (default `showLabel = true`). `Traces.tsx` then renders another `<span>{trace.httpStatus}</span>` next to it — producing the duplicated "200 200".

## Changes

### Column layout

`COL_WIDTHS` grows from 7 to 8 entries. Tools sits between Status and Tokens:

```
['180px', '1fr', '140px', '72px', '70px', '130px', '120px', '80px']
   id      agent  model   status  tools  tokens  latency  time
```

Header label list adds `'Tools'` in the matching position. The right-align rule for the last cell stays on index 7 (Time).

### Tools cell

- **Flat row & child turn row:** `trace.response.toolRequests.length`. Render with the same mono-11px style used for Tokens. When the count is `0`, render a muted `—` (matches the `agentName` fallback pattern already in the file). When ≥ 1, render the number in `text-primary`.
- **Conversation group header:** sum across turns — `turns.reduce((n, t) => n + t.response.toolRequests.length, 0)`. Same render rules (muted `—` when 0).

### Status cell de-duplication

- **Flat row (`Traces.tsx:131-134`)** and **child turn row (`Traces.tsx:239-242`)**: drop the standalone `<span class="mono text-[11px] ...">{trace.httpStatus}</span>`. Keep `<StatusDot httpStatus={trace.httpStatus} />` — the dot's built-in label provides the number with the correct status color.
- **Conversation group header (`Traces.tsx:197-202`)**: keeps the custom `"2xx"` / `"mixed"` text. Switch `StatusDot` to `showLabel={false}` there so the dot doesn't also print `"200"` / `"500"` next to the custom text.

### Files touched

Only `frontend/src/features/traces/Traces.tsx`. `StatusDot` already supports `showLabel`; no component changes needed.

## Out of scope

- Backend / DTO changes — `toolRequests` already ships in `AgentCallDto`.
- Detail drawer (`TraceDetail.tsx`).
- Column reorder beyond inserting Tools.
- Tooltip listing tool names (could be a follow-up; not requested).
