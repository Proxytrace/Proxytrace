---
layout: home
hero:
  name: Proxytrace
  text: Observe, evaluate, improve your AI agents.
  tagline: An OpenAI-compatible proxy that captures every LLM interaction, turns traces into benchmark suites, and proposes data-driven improvements.
  actions:
    - theme: brand
      text: User Guide
      link: /guide/getting-started
    - theme: alt
      text: Operations
      link: /admin/installation
features:
  - title: Capture every call
    details: Point any OpenAI-compatible client at the proxy. Messages, tools, parameters, provider, latency, and response are captured in full — no SDK changes.
  - title: Curate & benchmark
    details: Promote production traces into reproducible test suites, then run them against any agent version with configurable evaluators.
  - title: Close the loop
    details: Grounded in evaluation evidence, Proxytrace proposes concrete prompt and tooling improvements you can review, approve, or reject.
---

## Two ways to read this manual

- **[User Guide](/guide/getting-started)** — for people using the Proxytrace UI: setting up
  the proxy, capturing traces, curating test suites, running evaluations, and acting on
  optimization proposals.
- **[Operations](/admin/installation)** — for operators self-hosting Proxytrace: install,
  configure, choose a database, manage providers and API keys, and deploy.

> **Status:** Proxytrace is in an early architecture phase. This manual tracks the product
> as it is built out; some screens and options may change.
