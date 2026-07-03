# Finding Outliers

Some traces are worth a closer look the moment they land — a call that burned far more
tokens than usual, took much longer than normal, stopped hitting the prompt cache, or fired
an unusual number of tool calls. Proxytrace flags these **outliers** automatically as each
call is captured, so you don't have to scroll the [Traces](/guide/capturing-traces) list
hunting for them.

## What counts as an outlier

Outlier detection is **per agent** and **adaptive**: every call is compared to that agent's
own recent behaviour, not to a fixed global threshold. A cheap, fast agent and an expensive
reasoning agent each have their own idea of "normal". A call is flagged when any of these
per-call metrics is far from the agent's recent average:

- **High token count** — unusually large input + output. (This also stands in for cost: more
  tokens means more spend.)
- **High latency** — the response took much longer than usual.
- **Low cache hit** — on a follow-up turn in a conversation, far less of the prompt was served
  from the provider cache than usual. (The first turn of a conversation can't be a cache hit,
  so it's never flagged for this.)
- **Many tool calls** — the response requested an unusual number of tools.

"Far from the average" means more than a configurable number of standard deviations from the
agent's recent mean. An agent needs a handful of recent calls before detection kicks in, so
brand-new agents won't be flagged until they've built up a baseline. Administrators tune the
sensitivity — see [Outlier detection settings](/admin/outlier-detection) in the operator guide.

::: info Going forward only
Flagging happens at capture time. Traces recorded before this feature was enabled — or before
an agent built up its baseline — are not retroactively flagged.
:::

## In the Traces list

The Traces list has a dedicated **Anomalies** column (marked with a warning triangle in the
header, just before the timestamp). A flagged call shows a small **amber warning chip** in that
column — normal calls leave it empty, so flagged calls stand out as you scan the list. Hover the
chip to see which characteristics tripped (for example, *High latency, Many tool calls*). For a
grouped conversation, the chip on the collapsed row covers any turn that was flagged; expand it to
see which turns.

To focus on just the flagged calls, switch on the **Outliers only** toggle in the Traces
toolbar. It combines with every other filter — agent, time range, search — so you can ask
questions like "show me the outliers for this agent in the last 24 hours". Toggle it back off
to return to the full list.

## On the agent page

Each agent's detail page has a **Recent outliers** widget listing that agent's most recently
flagged calls, with the reason for each. Click a row to open the trace, or **View all** to
jump to the Traces list. It updates live as new calls are captured.

## See the whole picture

To watch anomalies across *every* agent at once — a live timeline, a "needs help" ranking of the
noisiest agents, and a feed of recently flagged calls — open the
[Anomaly dashboard](/guide/anomaly-dashboard). It also hosts **custom anomaly detectors**, where an
LLM reviews calls against instructions you write (an Enterprise feature).
