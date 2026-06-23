# implement-issue dry-run — autonomous pick

Skill: `.claude/skills/implement-issue/SKILL.md` (worked in order, Phases 0–7).
Repo: `Proxytrace/Proxytrace` · default branch `master` · git user `JabbaKadabra`.

## 1. Selected issue

**#185 — "Non-streaming proxy response buffered fully into memory with no size cap"**
Priority: `priority:medium` (tier 2 — the highest tier present in the open backlog).

`pick_issue.sh` (REPO=Proxytrace/Proxytrace) returned 10 open issues across three tiers:
one tier-0 (unlabeled), one tier-1 (low), eight tier-2 (medium). No high/critical issues
exist, so the pick comes from the medium tier, oldest-first. The top 5:

| Rank | Issue | Tier / label | Title |
|------|-------|--------------|-------|
| **1 (picked)** | **#185** | tier 2 · priority:medium | **Non-streaming proxy response buffered fully into memory with no size cap** |
| 2 | #187 | tier 2 · priority:medium | Ingestion worker: failedAttempts dictionary leaks and messages are lost on the in-process transport |
| 3 | #188 | tier 2 · priority:medium | Synchronous StreamAcknowledge inside async consumer iterator can stall ingestion during a Redis blip |
| 4 | #189 | tier 2 · priority:medium | Ingestion worker has no backpressure: Parallel.ForEachAsync over infinite ConsumeAsync can grow memory unboundedly |
| 5 | #191 | tier 2 · priority:medium | Cascade-delete chain can wipe all traces when a ModelProvider/ModelEndpoint is hard-deleted |

**Why #185 outranked the runners-up.** All eight medium issues share the same tier, so the
script's tie-break is `createdAt` ascending — #185 (created `2026-06-20T22:01:52Z`) is the
**oldest** in the tier, ahead of #187/#188/#189/#191. Beyond the mechanical ordering, #185 was
also the strongest actual pick: it names the exact file and line range
(`OpenAiProxyController.cs:315-318` vs the streaming bound at `:350`), gives a concrete repro
condition (a large/hostile non-streaming upstream response), and includes a precise suggested
fix. It had **no linked/open PR**, no in-flight branch, and required no product decision — fully
actionable. The runners-up (#187–#189) all live in the ingestion-worker transport and are more
entangled (backpressure, ack semantics, dictionary lifecycle); #191 needs a schema/cascade
decision. #185 is a clean, self-contained, well-scoped memory-safety fix — the best first slice.

Sanity checks performed: `gh issue view 185` (full body read), `gh pr list --state open` -> `[]`
(no in-flight PR), `git branch -a | grep 185` -> none. (`gh issue view --comments` errored on a
GitHub "Projects classic" deprecation, unrelated to the issue; the JSON body view was used
instead.)

## 2. Branch

```bash
# (done inside the isolated worktree, off a clean master at origin/master)
git switch -c fix/issue-185-buffered-response-size-cap
```

Branch name: **`fix/issue-185-buffered-response-size-cap`** — `fix/` type, issue number
embedded, short slug describing the change.

> Note: `git pull --ff-only` was intentionally skipped — the worktree was already at
> `a0583c8b` (= `origin/master` HEAD) and this is an offline dry-run; no network fetch was
> warranted. In a live run this step would be `git switch master && git pull --ff-only` first.

## 3. Diff

`git diff master...HEAD` (3 files, +94 / −4):

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 524688cf..54ea903e 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -224,6 +224,13 @@ follow [Semantic Versioning](https://semver.org). Ongoing work is collected unde
 
 ### Fixed
 
+- **A large upstream response can no longer exhaust proxy memory on non-streaming calls.** The
+  proxy's buffered (non-streaming) path read the entire upstream body into a string and re-encoded
+  it, leaving several full-size copies resident per in-flight request with no size cap — a large or
+  hostile upstream response could push the proxy to OOM. The buffered path now streams the body
+  straight through to the client (untruncated) and bounds the copy it captures for ingestion to the
+  same 16 MiB ceiling the streaming path already used.
+
 - **A hung model provider no longer stalls test and optimization runs indefinitely.** Internal model
   calls (optimizers, evaluators, the playground) were made with no request timeout and no retry
   policy, so a wedged or very slow upstream had no upper time bound and could pin a worker forever,
diff --git a/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs b/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs
index 458f1764..1f8d7b3f 100644
--- a/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs
+++ b/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs
@@ -157,6 +157,62 @@ public sealed class OpenAiProxyControllerTests
         await stream.Received(1).PublishAsync(Arg.Any<IngestMessage>(), CancellationToken.None);
     }
 
+    [TestMethod]
+    public async Task Proxy_BufferedOversizedResponse_ForwardsFullBody_ButBoundsCapturedCopy()
+    {
+        // Regression for #185: the non-streaming path used to ReadAsStringAsync the whole upstream
+        // body unbounded and capture it verbatim. The forwarded bytes must stay untruncated, but the
+        // captured transcript must be bounded the same way the streaming path bounds it
+        // (MaxCapturedResponseChars = 16 MiB). Build a body comfortably over the cap.
+        const int capChars = 16 * 1024 * 1024;
+        var oversized = new string('x', capChars + 4096);
+
+        IngestMessage? captured = null;
+        var stream = Substitute.For<IIngestionStream>();
+        stream.PublishAsync(Arg.Do<IngestMessage>(m => captured = m), Arg.Any<CancellationToken>())
+            .Returns(Task.CompletedTask);
+
+        var responseBody = new MemoryStream();
+        var controller = BuildController(
+            stream,
+            ResolverFor(ApiKey()),
+            new FakeHttpClientFactory(oversized));
+        controller.ControllerContext = BuildContext("Bearer valid", body: """{"model":"gpt-4o","messages":[]}""");
+        controller.ControllerContext.HttpContext.Response.Body = responseBody;
+
+        await controller.Proxy("chat/completions", project: null, CancellationToken.None);
+
+        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
+        responseBody.Length.Should().Be(oversized.Length, "the forwarded response body must never be truncated");
+        captured.Should().NotBeNull();
+        var capturedResponse = captured?.ResponseBody;
+        capturedResponse.Should().NotBeNull();
+        capturedResponse.Should().HaveLength(capChars, "the captured copy must be bounded at MaxCapturedResponseChars");
+    }
+
+    [TestMethod]
+    public async Task Proxy_BufferedResponse_CapturesFullBodyWhenUnderCap()
+    {
+        // A normal-sized response is captured in full — the bound only clips the pathological case.
+        var body = FakeHttpMessageHandler.BuildOpenAiResponse("hello world");
+
+        IngestMessage? captured = null;
+        var stream = Substitute.For<IIngestionStream>();
+        stream.PublishAsync(Arg.Do<IngestMessage>(m => captured = m), Arg.Any<CancellationToken>())
+            .Returns(Task.CompletedTask);
+
+        var controller = BuildController(
+            stream,
+            ResolverFor(ApiKey()),
+            new FakeHttpClientFactory(body));
+        controller.ControllerContext = BuildContext("Bearer valid", body: """{"model":"gpt-4o","messages":[]}""");
+
+        await controller.Proxy("chat/completions", project: null, CancellationToken.None);
+
+        captured.Should().NotBeNull();
+        captured?.ResponseBody.Should().Be(body, "an under-cap response is captured verbatim");
+    }
+
     [TestMethod]
     public async Task Proxy_StreamingClientDisconnect_StillPublishesAccumulatedTranscript()
     {
diff --git a/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs b/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs
index fdfd91b7..a17b3efc 100644
--- a/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs
+++ b/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs
@@ -312,19 +312,46 @@ public class OpenAiProxyController : ControllerBase
         string? agentName,
         CancellationToken cancellationToken)
     {
-        var responseBody = await upstreamResponse.Content.ReadAsStringAsync(cancellationToken);
-        sw.Stop();
+        // Stream the upstream body straight through to the client rather than materializing it as a
+        // string and re-encoding it — that held three full-size copies (the string, the GetBytes
+        // byte[], and the captured copy) resident per in-flight request, with no bound at all on the
+        // response side. The forwarded bytes are never truncated; only the captured transcript we
+        // accumulate for ingestion is bounded at MaxCapturedResponseChars, exactly as the streaming
+        // path does.
+        var accumulated = new StringBuilder();
+        var decoder = Encoding.UTF8.GetDecoder();
+        var buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);
+        var chars = ArrayPool<char>.Shared.Rent(Encoding.UTF8.GetMaxCharCount(buffer.Length));
 
         try
         {
-            await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(responseBody), cancellationToken);
+            await using var upstreamStream = await upstreamResponse.Content.ReadAsStreamAsync(cancellationToken);
+
+            int read;
+            while ((read = await upstreamStream.ReadAsync(buffer.AsMemory(), cancellationToken)) > 0)
+            {
+                await Response.Body.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
+
+                // Bound the captured copy: decode this chunk and append only while we are under the
+                // cap. A Decoder keeps multi-byte UTF-8 sequences split across chunk boundaries intact.
+                if (accumulated.Length < MaxCapturedResponseChars)
+                {
+                    var decoded = decoder.GetChars(buffer, 0, read, chars, 0);
+                    var remaining = MaxCapturedResponseChars - accumulated.Length;
+                    accumulated.Append(chars, 0, Math.Min(decoded, remaining));
+                }
+            }
         }
         finally
         {
+            ArrayPool<char>.Shared.Return(chars);
+            ArrayPool<byte>.Shared.Return(buffer);
+            sw.Stop();
+
             // Capture is decoupled from the client request lifetime: the upstream call has already
             // completed, so a client disconnect/timeout here must not drop the captured call.
             // Publish with CancellationToken.None rather than the request-aborted token.
-            await EnqueueSafeAsync(provider, project, requestBody, responseBody, sw.Elapsed, upstreamResponse.StatusCode, sessionId, agentName, CancellationToken.None);
+            await EnqueueSafeAsync(provider, project, requestBody, accumulated.ToString(), sw.Elapsed, upstreamResponse.StatusCode, sessionId, agentName, CancellationToken.None);
         }
     }
```

### What the fix does
`ProxyBufferedResponseAsync` no longer calls `ReadAsStringAsync` (one unbounded full-size string)
followed by `Encoding.UTF8.GetBytes` (a second full-size byte[]). Instead it reads the upstream
content as a stream and copies it to the client in 64 KiB chunks from a pooled buffer (untruncated),
while accumulating a **bounded** captured transcript capped at `MaxCapturedResponseChars` (16 MiB) —
the exact ceiling the streaming path already enforces. A UTF-8 `Decoder` is used so a multi-byte
UTF-8 sequence split across two chunk reads is decoded correctly rather than producing replacement
chars. Pooled buffers are returned in `finally`; the existing capture-decoupling semantics
(`sw.Stop()` + publish on `CancellationToken.None`) are preserved.

## 4. Commit

One commit on `fix/issue-185-buffered-response-size-cap` (`7544049c`):

```
fix(proxy): bound captured copy on the non-streaming proxy path

The buffered (non-streaming) response path called ReadAsStringAsync to
materialize the entire upstream body, then Encoding.UTF8.GetBytes to
re-encode it for the client — leaving three full-size copies (string +
byte[] + captured copy) resident per in-flight request, with no size cap
on the response side at all. A large or hostile/compromised upstream
response could drive the proxy to OOM on the hot path.

Stream the upstream body straight through to the client (untruncated)
and accumulate only a bounded captured transcript, capped at
MaxCapturedResponseChars (16 MiB) exactly as the streaming path already
does. A UTF-8 Decoder keeps multi-byte sequences split across chunk
boundaries intact.

Adds two regression tests: an oversized response is forwarded in full
but its captured copy is bounded at the cap, and an under-cap response
is still captured verbatim.

Refs #185

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

Follows Conventional Commits (`fix(proxy): …`), references `Refs #185` in the body (the
`Closes` keyword is reserved for the PR), and carries the repo-mandated
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.

## 5. Verification

Run from the worktree root; .NET SDK `10.0.109` present.

| Step | Command | Result |
|------|---------|--------|
| Build | `dotnet build Proxytrace.Proxy.Tests/Proxytrace.Proxy.Tests.csproj` | **Build succeeded — 0 warnings, 0 errors** (transitively compiles `Proxytrace.Proxy`). One real warnings-as-errors break was caught mid-iteration — an un-awaited `PublishAsync` (`CS4014`) — and fixed by chaining `.Returns(Task.CompletedTask)`. |
| Tests | `dotnet test Proxytrace.Proxy.Tests/Proxytrace.Proxy.Tests.csproj` | **Passed — 26/26**, 0 failed, 0 skipped (~410 ms). Includes the 2 new tests. |
| Regression proof | stash the controller fix, rebuild, run `Proxy_BufferedOversizedResponse_…` on the OLD code | **Failed as expected** — `Expected capturedResponse with length 16777216 … but found string` of full oversized length. Confirms the test genuinely catches the bug. Fix restored (`git stash pop`); suite green again 26/26. |
| Docs / changelog | repo `CLAUDE.md` rules | **CHANGELOG.md** `[Unreleased] > Fixed` entry added (operator-facing memory-safety fix). Searched `docs/` and `manual/` for any page describing the proxy size caps / buffered path (`MaxCapturedResponseChars`, `ProxyBufferedResponse`, `non-streaming`) — **no matches**, so no `docs/` or manual page documents this internal behavior; none to update. No user-facing UI string → no i18n/Lingui step. The mandatory `test` skill was read and followed before writing tests. |

Backend tests scoped to the affected project only (the change is local to one controller method;
the proxy suite is its direct gate). The full-solution `dotnet test Proxytrace.sln` was **not** run
(timebox) — it would be the next step before merge; no cross-cutting change makes a broad failure
likely here.

## 6. Planned PR  *(NOT executed — dry-run guard)*

In a live run, Phase 6 would push and open the PR with:

```bash
git push -u origin HEAD
gh pr create \
  --repo Proxytrace/Proxytrace \
  --base master \
  --fill=false \
  --title "fix(proxy): cap non-streaming proxy response capture to prevent OOM (#185)" \
  --body "$(cat <<'BODY'
## Summary
The proxy's non-streaming (buffered) path read the entire upstream response into a string via
`ReadAsStringAsync` and then re-encoded it with `Encoding.UTF8.GetBytes`, leaving three full-size
copies resident per in-flight request with no size cap on the response side at all (the request side
already has a 64 MiB cap; the `MaxCapturedResponseChars` cap was only applied on the streaming path).
A large or hostile/compromised upstream response could drive the proxy to OOM on the hot path. This
streams the body straight through to the client untruncated and bounds only the captured copy to the
same 16 MiB ceiling the streaming path already uses.

Closes #185

## Changes
- `OpenAiProxyController.ProxyBufferedResponseAsync` now reads the upstream content as a stream and
  copies it to the client in 64 KiB chunks from a pooled buffer (forwarded bytes untruncated),
  accumulating a captured transcript bounded at `MaxCapturedResponseChars` (16 MiB) — mirroring the
  streaming path. A UTF-8 `Decoder` keeps multi-byte sequences split across chunk boundaries intact;
  pooled buffers are returned in `finally`. Existing capture-decoupling (`CancellationToken.None`
  publish) is unchanged.
- Added two regression tests: an oversized response is forwarded in full while its captured copy is
  bounded at the cap; an under-cap response is captured verbatim.
- CHANGELOG `[Unreleased] > Fixed` entry.

## Verification
- build: `dotnet build Proxytrace.Proxy.Tests` — succeeded, 0 warnings/0 errors.
- tests: `dotnet test Proxytrace.Proxy.Tests` — 26/26 passed. New oversized test verified to FAIL on
  the pre-fix code (captured length was the full body, not the 16 MiB cap), proving the regression.
- docs/changelog: CHANGELOG updated; no `docs/`/manual page documents the proxy size caps, so none
  needed updating; no user-facing string → no i18n.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

`Closes #185` is in the PR body (auto-closes the issue on merge). Per the dry-run guards, **no
`git push`, no `gh pr create`, no real PR/comment/label** was executed.

## 7. Notes

- **Worktree path correction.** The first `git switch -c` accidentally landed in the *shared*
  checkout (`/home/daniel/Proxytrace`) because an early `Bash cd` targeted it rather than the
  isolated worktree. Caught immediately (the Edit tool refused to touch the shared path); restored
  the shared checkout to `master` and deleted the stray branch, then re-created the branch and did
  **all** work inside the worktree `agent-ae1a2ac6b5f277417`. The user's main checkout is left clean
  on `master`.
- **`gh issue view --comments` failure.** Returned a GitHub "Projects (classic) is being deprecated"
  GraphQL error — environmental, not specific to #185. Worked around with the JSON body view; no
  discussion was lost (the issue body was self-contained, with no linked PR).
- **Scope discipline.** Stayed within the buffered path. The sibling ingestion-worker issues
  (#187–#189) and the cascade-delete issue (#191) are separate concerns and were left untouched. No
  new stumbles worth a `file-issue` were encountered — the surrounding code (`ArrayPool`, the
  streaming-path bounding pattern, the capture-decoupling comment) was clean and directly reusable.
- **Timebox.** Ran the targeted proxy build + suite (fast); deliberately did not run the full
  `dotnet test Proxytrace.sln`, which would be the pre-merge step in a real run.
- **`git pull --ff-only` skipped** for the offline dry-run (already at `origin/master`); flagged in
  the Branch section.
