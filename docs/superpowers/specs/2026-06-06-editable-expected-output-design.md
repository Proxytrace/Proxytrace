# Editable Expected Output for Test Cases

## Problem

When promoting a trace to a test case, the captured assistant response becomes the
expected output verbatim. If the traced output does not match what we *want* the agent to
produce (we intend to change the agent to hit a target), there is no way to edit it. We
need to edit the expected output — both its text content and its **type** (e.g. switch a
plain text response into a tool request).

## Decisions

- **Surfaces:** editing lives in both `PromoteModal` (trace → test case) and the existing
  test cases in `EditSuiteDialog`.
- **Editable scope:** expected output only. Input conversation stays as captured.
- **Type model:** exclusive toggle — **Text response** OR **Tool request** (not both at once).
- **Tool mode:** a *list* of tool requests (add/remove), each `{ name, arguments }`.
- **Tool name input:** combobox — `<datalist>` of the agent's declared tools
  (`trace.tools` / suite agent tools) plus free text.
- **DTO approach:** extend the existing `TestSuiteMessageDto` with an optional
  `ToolRequests` field (smallest diff, symmetric with current reuse).

## Frontend

### `ExpectedOutputEditor` (reusable)
- Props: `value: { content: string; toolRequests: ToolRequestInputDto[] }`,
  `tools: ToolSpecDto[]`, `onChange`, `onValidityChange`.
- Exclusive mode segmented control: Text | Tool. Initial mode inferred — tool requests
  present → Tool, else Text.
- Text mode: single textarea.
- Tool mode: rows of `{ name, arguments }`. Name = `<input>` + `<datalist>` of tool names
  (free text allowed). Arguments = mono textarea (JSON). Add/remove rows.
- Validation: `JSON.parse` each args; invalid → inline error + `onValidityChange(false)`.
  Require non-empty text OR ≥1 tool request.
- Emits the `expectedOutput` DTO shape.

### Wiring
- **PromoteModal:** replace read-only expected block with the editor, seeded from
  `trace.response` + `trace.tools`. Submit → `addTestCase(suiteId, trace.id, expectedOutput)`
  → body `{ fromAgentCallId, expectedOutput }`. Disable submit while editor invalid.
- **EditSuiteDialog:** inline **Edit expected output** affordance on the selected case →
  same editor → `PUT /api/test-cases/{id}` → invalidate `['test-suites']`.

### Models
- Add `ToolRequestInputDto { name, arguments }`.
- Test-case message type gains optional `toolRequests`.
- `testCasesApi.update(id, { expectedOutput })`; `addTestCase` gains optional `expectedOutput`.

## Backend

- DTO: `TestSuiteMessageDto(string Role, string Content, IReadOnlyList<ToolRequestInputDto>? ToolRequests = null)`;
  new `record ToolRequestInputDto(string Name, string Arguments)`.
- `TestSuiteDtoMapper.BuildAssistantMessage`: build text `Content` (when non-empty) +
  `ToolRequest`s from `ToolRequests`, server generates `Id = Guid.NewGuid().ToString()`.
- Read side: `TestCaseDto.expectedOutput` and `TestCasesController.Get` populate
  `ToolRequests` from `tc.ExpectedOutput.ToolRequests` (stop flattening to text).
- `TestSuitesController.BuildTestCase`: new branch — `fromAgentCallId` AND
  `expectedOutput != null` → `createTestCase(call.Request, BuildAssistantMessage(expectedOutput))`
  (input from the call, output overridden). System messages stripped by the factory.
- New `PUT /api/test-cases/{id}` in `TestCasesController`: body
  `UpdateTestCaseRequest(TestSuiteMessageDto ExpectedOutput)`; inject mapper +
  `ITestCase.CreateExisting`; rebuild with same `Input`, new expected output;
  `repository.UpdateAsync`.

## Tests
- Backend: `BuildAssistantMessage` with tool requests; `BuildTestCase` override branch;
  `PUT` update roundtrip.
- Frontend: `ExpectedOutputEditor.spec` — mode switch, JSON validation, emitted shape.

## Manual
- Update `manual/guide/` pages for trace-promote and suite editing to document editing
  expected output and switching to a tool request.
