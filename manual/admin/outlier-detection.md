# Outlier Detection Settings

Proxytrace flags captured calls that deviate from their agent's recent behaviour as
**outliers** (see [Finding Outliers](/guide/outliers) in the user guide). Operators tune how
sensitive that flagging is from the admin-only **Settings** hub — open **Settings** from the
sidebar, then choose **Outlier detection** (direct link: `/settings/outlier-detection`).

::: info Admin only
The Outlier detection settings page is accessible only to users with the Admin role. The
outliers themselves (the Traces **Outliers only** toggle and the agent **Recent outliers**
widget) are visible to every user.
:::

## How detection works

For each ingested call, Proxytrace compares four per-call metrics — total tokens, latency,
turn-2+ cache-hit rate, and tool-call count — against a baseline built from the agent's most
recent successful calls. A metric is flagged when it falls more than **N standard deviations**
from that baseline's mean (cache hit is flagged when it's far *below* the mean; the others when
far *above*). Detection is per agent, so each agent is judged against its own history.

## Fields

### Enable outlier detection

The master switch. When off, no new call is flagged (existing flags are left as they are).

### Sensitivity (standard deviations)

The **N** in *mean ± N·standard deviations*. **Lower is more sensitive** — more calls get
flagged; higher flags only the most extreme calls. The default is `3`.

### Minimum samples

How many recent calls an agent must have before a metric is judged. This guards the cold
start: with only a few calls the baseline is unstable, so detection waits until there's enough
history. The default is `30`.

### Baseline window (calls)

How many of the agent's most recent successful calls form the baseline. A larger window is
steadier but slower to adapt to a genuine change in the agent's behaviour. The default is
`200`.

## Notes

- Changes take effect for calls captured after you save; they don't re-flag existing traces.
- Only **successful** calls (those with a response) are flagged and contribute to a baseline —
  errors are excluded.
- Cost is intentionally folded into the **high token count** metric rather than tracked
  separately.
