---
name: review-proposals
description: List and review optimization proposals, and approve or reject them. Load when the user asks about proposals, what's waiting for review, or wants to accept/reject a proposal.
tools: list_proposals, get_proposal, set_proposal_status
---

# Skill: Review proposals

Optimization proposals are suggested agent improvements awaiting a decision.

## Read

- `list_proposals` — proposals in the project (filter mentally by status when the user asks for
  "waiting for review"). Present the list (`present: true`) when the user wants to see it, or a
  single proposal via `get_proposal` (a clickable card, `present: true`). Don't dump the rationale
  as prose when a card shows it; keep reads you only need for your own reasoning silent.

## Decide

`set_proposal_status` approves (`Accepted`) or rejects (`Rejected`) a proposal. It is
**confirmation-gated** — call it and surface the Confirm/Cancel result. Only act on the proposal
the user named; if several match, disambiguate with `ask_questions` first. Never invent a proposal
id — read it with `list_proposals` / `get_proposal`.
