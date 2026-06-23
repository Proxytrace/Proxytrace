# Implement-issue dry run — report

## 1. Selected issue

**#185 — "Non-streaming proxy response buffered fully into memory with no size cap"** (label `bug`, `priority:medium`).

**Why it won:** `scripts/pick_issue.sh` ranked the open issues; #185 is the **oldest** issue in the
highest open tier (tier 2 = `priority:medium`; no `priority:high`/P0/critical issues were open), so
it sorts to position `[0]`. It is also a clean, self-contained bug: the issue names the exact file,
line range, root cause, and a suggested fix, with no open comments, no linked/in-flight PR, and no
product decision required — ideal for an autonomous end-to-end fix.

**Runners-up bypassed** (all tier-2 `priority:medium`, ranked by age behind #185):
- #187 — Ingestion worker: `failedAttempts` dictionary leaks and messages are lost on the in-process transport.
- #188 — Synchronous `StreamAcknowledge` inside async consumer iterator can stall ingestion during a Redis blip.
- #189 — Ingestion worker has no backpressure: `Parallel.ForEachAsync` over infinite `ConsumeAsync` can grow memory unboundedly.
- #191 — Cascade-delete chain can wipe all traces when a `ModelProvider`/`ModelEndpoint` is hard-deleted.
- #192 — Evaluator stats load the entire `TestResultEntity` table into memory and deserialize JSON per row.

## 2. Branch

```bash
git switch master && git pull --ff-only          # base = master @ a0583c8b
git switch -c fix/issue-185-buffered-response-cap
```

Exact branch name: **`fix/issue-185-buffered-response-cap`**

Note: the canonical name `fix/issue-185-buffered-response-size-cap` was already checked out in the
user's *main* worktree (`/home/daniel/Proxytrace`) from a prior dry-run iteration and could not be
reused/deleted, so this iteration used the distinct, non-colliding name above. Branch was cut from a
clean `master` HEAD (`a0583c8b`) with no other changes.

## 3. Diff

Full `git diff master...HEAD`:

```diff
diff --git a/CHANGELOG.md b/CHANGELOG.md
index 524688cf..5f3604a6 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -224,6 +224,14 @@ follow [Semantic Versioning](https://semver.org). Ongoing work is collected unde
 
 ### Fixed
 
+- **A large upstream response can no longer exhaust the ingestion proxy's memory.** For
+  non-streaming (buffered) proxied calls, the proxy previously read the entire upstream response into
+  a string and then copied it again to bytes, with no size limit on the response side — so a very
+  large or hostile upstream reply produced multiple full-size copies per in-flight request and could
+  OOM the proxy. The buffered response is now streamed to the client in chunks (still forwarded
+  untruncated), and only the copy captured for ingestion is bounded — the same cap the streaming path
+  already applied.
+
 - **A hung model provider no longer stalls test and optimization runs indefinitely.** Internal model
   calls (optimizers, evaluators, the playground) were made with no request timeout and no retry
   policy, so a wedged or very slow upstream had no upper time bound and could pin a worker forever,
diff --git a/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs b/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs
index 458f1764..39734105 100644
--- a/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs
+++ b/Proxytrace.Proxy.Tests/OpenAiProxyControllerTests.cs
@@ -157,6 +157,33 @@ public sealed class OpenAiProxyControllerTests
         await stream.Received(1).PublishAsync(Arg.Any<IngestMessage>(), CancellationToken.None);
     }
 
+    [TestMethod]
+    public async Task Proxy_BufferedResponse_StreamsFullBodyToClient_AndCapturesIt()
+    {
+        // The buffered path forwards the upstream body untruncated and captures the same bytes for
+        // ingestion (under the cap). A large body must not be lost or corrupted by the chunked copy.
+        var largeBody = "{\"x\":\"" + new string('a', 512 * 1024) + "\"}";
+        IngestMessage? published = null;
+        var stream = Substitute.For<IIngestionStream>();
+        stream.PublishAsync(Arg.Do<IngestMessage>(m => published = m), Arg.Any<CancellationToken>())
+            .Returns(Task.CompletedTask);
+
+        var controller = BuildController(
+            stream,
+            ResolverFor(ApiKey()),
+            new FakeHttpClientFactory(largeBody));
+        controller.ControllerContext = BuildContext("Bearer valid", body: """{"model":"gpt-4o","messages":[]}""");
+        var responseBody = new MemoryStream();
+        controller.ControllerContext.HttpContext.Response.Body = responseBody;
+
+        await controller.Proxy("chat/completions", project: null, CancellationToken.None);
+
+        controller.Response.StatusCode.Should().Be((int)HttpStatusCode.OK);
+        Encoding.UTF8.GetString(responseBody.ToArray()).Should().Be(largeBody, "the forwarded body is never truncated");
+        published.Should().NotBeNull();
+        published.ResponseBody.Should().Be(largeBody, "a sub-cap response is captured in full");
+    }
+
     [TestMethod]
     public async Task Proxy_StreamingClientDisconnect_StillPublishesAccumulatedTranscript()
     {
diff --git a/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs b/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs
index fdfd91b7..cffb9eb0 100644
--- a/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs
+++ b/Proxytrace.Proxy/Controllers/OpenAiProxyController.cs
@@ -312,19 +312,45 @@ public class OpenAiProxyController : ControllerBase
         string? agentName,
         CancellationToken cancellationToken)
     {
-        var responseBody = await upstreamResponse.Content.ReadAsStringAsync(cancellationToken);
-        sw.Stop();
+        // Stream the upstream body straight to the client in chunks instead of materializing it whole
+        // (ReadAsStringAsync + GetBytes was two unbounded full-size copies per in-flight request → an
+        // OOM vector on a large/hostile upstream response). The forwarded bytes are never truncated;
+        // only the captured copy we accumulate for ingestion is bounded at MaxCapturedResponseChars,
+        // matching the streaming path's contract.
+        var captured = new StringBuilder();
 
+        await using var upstreamStream = await upstreamResponse.Content.ReadAsStreamAsync(cancellationToken);
+        using var reader = new StreamReader(upstreamStream, Encoding.UTF8, leaveOpen: true);
+        var buffer = ArrayPool<char>.Shared.Rent(8192);
         try
         {
-            await Response.Body.WriteAsync(Encoding.UTF8.GetBytes(responseBody), cancellationToken);
+            while (true)
+            {
+                var read = await reader.ReadAsync(buffer, cancellationToken);
+                if (read == 0)
+                {
+                    break;
+                }
+
+                // Bound the captured copy; the forwarded bytes below are never truncated.
+                if (captured.Length < MaxCapturedResponseChars)
+                {
+                    captured.Append(buffer, 0, Math.Min(read, MaxCapturedResponseChars - captured.Length));
+                }
+
+                await WriteResponseChunkAsync(buffer.AsMemory(0, read), cancellationToken);
+            }
         }
         finally
         {
+            ArrayPool<char>.Shared.Return(buffer);
+
+            sw.Stop();
+
             // Capture is decoupled from the client request lifetime: the upstream call has already
             // completed, so a client disconnect/timeout here must not drop the captured call.
             // Publish with CancellationToken.None rather than the request-aborted token.
-            await EnqueueSafeAsync(provider, project, requestBody, responseBody, sw.Elapsed, upstreamResponse.StatusCode, sessionId, agentName, CancellationToken.None);
+            await EnqueueSafeAsync(provider, project, requestBody, captured.ToString(), sw.Elapsed, upstreamResponse.StatusCode, sessionId, agentName, CancellationToken.None);
         }
     }
 
@@ -378,6 +404,23 @@ public class OpenAiProxyController : ControllerBase
 
     // ── Helpers ───────────────────────────────────────────────────────────────
 
+    // Forwards a chunk of the buffered (non-streaming) response to the client. Encodes into a pooled
+    // buffer to avoid a throwaway byte[] per chunk; no flush per chunk — the buffered path has no
+    // latency contract, so the framework decides when to flush.
+    private async Task WriteResponseChunkAsync(ReadOnlyMemory<char> chunk, CancellationToken cancellationToken)
+    {
+        var buffer = ArrayPool<byte>.Shared.Rent(Encoding.UTF8.GetMaxByteCount(chunk.Length));
+        try
+        {
+            var count = Encoding.UTF8.GetBytes(chunk.Span, buffer);
+            await Response.Body.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
+        }
+        finally
+        {
+            ArrayPool<byte>.Shared.Return(buffer);
+        }
+    }
+
     // Forwards one streamed line plus its '\n' terminator and flushes so the token reaches the
     // client immediately. Encodes into a pooled buffer to avoid the per-line string concat and
     // throwaway byte[] that a token-by-token completion would otherwise allocate thousands of.
```

## 4. Commit

Single commit `22b51ed2`:

```
fix(proxy): bound buffered upstream response to avoid OOM

The non-streaming proxy path read the entire upstream response into a string
(ReadAsStringAsync) and then copied it again to bytes (Encoding.UTF8.GetBytes)
with no size limit on the response side — two full-size copies per in-flight
request. A large or hostile/compromised upstream reply could therefore exhaust
proxy memory. The request side already capped at 64 MB and the streaming path
already bounded its captured copy; only the buffered response side was unbounded.

Stream the buffered response to the client in chunks (forwarded untruncated)
and bound only the copy captured for ingestion at MaxCapturedResponseChars,
mirroring the streaming path's contract. Adds a regression test asserting the
full body reaches the client and is captured intact through the chunked path.

Refs #185

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

## 5. Verification

All run in the worktree (`/home/daniel/Proxytrace/.claude/worktrees/agent-a84be97a2784343d3`).

| Step | Command | Result |
|---|---|---|
| Build (proxy + deps) | `dotnet build Proxytrace.Proxy.Tests/Proxytrace.Proxy.Tests.csproj` | **Build succeeded — 0 Warning(s), 0 Error(s)** (warnings-as-errors solution-wide) |
| Build (full solution) | `dotnet build Proxytrace.sln` | **Build succeeded — 0 Warning(s), 0 Error(s)** |
| Tests (proxy suite) | `dotnet test Proxytrace.Proxy.Tests/Proxytrace.Proxy.Tests.csproj --no-build` | **Passed! Failed: 0, Passed: 25, Skipped: 0** (was 24; +1 new) |
| New test in isolation | `dotnet test … --filter Proxy_BufferedResponse_StreamsFullBodyToClient_AndCapturesIt` | **Passed! 1/1** |
| Docs / changelog | CHANGELOG `### Fixed` entry added under `[Unreleased]` | Done |

**Docs note:** No `docs/` or `manual/` page documents the proxy's internal request/response size caps
(they are private `const`s — `MaxRequestBodyBytes`, `MaxCapturedResponseChars`), so the only
documentation touchpoint required by the repo's hard rules is the CHANGELOG, which was updated. The
"memory" hits in `manual/admin/*` are about kiosk in-memory mode, not proxy buffering, so no manual
change was warranted. No i18n/frontend impact (backend-only).

## 6. Planned PR (NOT executed — dry run)

Commands that **would** have been run:

```bash
git push -u origin HEAD

gh pr create \
  --repo Proxytrace/Proxytrace \
  --base master \
  --fill=false \
  --title "fix(proxy): bound buffered upstream response to avoid OOM (#185)" \
  --body "$(cat <<'BODY'
## Summary
For non-streaming (buffered) proxied calls, `ProxyBufferedResponseAsync` read the entire upstream
response into a string (`ReadAsStringAsync`) and then copied it again to bytes
(`Encoding.UTF8.GetBytes`) with no size limit on the response side — two full-size copies per
in-flight request, an OOM vector on a large or hostile/compromised upstream reply. The request side
already capped at 64 MB and the streaming path already bounded its captured copy; only the buffered
response side was unbounded. This streams the buffered response to the client in chunks (forwarded
untruncated) and bounds only the copy captured for ingestion at `MaxCapturedResponseChars`, matching
the streaming path's existing contract.

Closes #185

## Changes
- `OpenAiProxyController.ProxyBufferedResponseAsync`: replace the `ReadAsStringAsync` + `GetBytes`
  full-materialization with a pooled-buffer chunked read/forward loop that bounds the captured copy
  at `MaxCapturedResponseChars` (the streaming path's cap), forwarding bytes untruncated.
- Add `WriteResponseChunkAsync` helper (pooled UTF-8 encode per chunk, mirrors `WriteSseLineAsync`).
- Add regression test `Proxy_BufferedResponse_StreamsFullBodyToClient_AndCapturesIt` (512 KB body:
  client receives the full body untruncated; ingestion captures it intact through the chunked path).
- CHANGELOG: `### Fixed` entry under `[Unreleased]`.

## Verification
- build: `dotnet build Proxytrace.sln` — succeeded, 0 warnings / 0 errors (warnings-as-errors on).
- tests: `dotnet test Proxytrace.Proxy.Tests` — 25/25 passed (added 1).
- docs/changelog: CHANGELOG updated; no `docs/`/`manual/` page describes these internal caps.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

## 7. Notes / judgment calls

- **Branch name collision (environmental).** The natural name
  `fix/issue-185-buffered-response-size-cap` was already checked out in the user's main worktree from
  a prior dry-run iteration, so git refused to delete/reuse it. I deliberately did **not** touch the
  user's worktree and used the distinct name `fix/issue-185-buffered-response-cap` instead. The PR
  title/body still reference #185 correctly, so this is cosmetic.
- **`--comments` gh flag is broken on this repo.** `gh issue view <n> --comments` errors with a
  GraphQL "Projects (classic) deprecated" failure. Worked around it via
  `gh issue view <n> --json number,title,body,labels,state,comments`. Repo-wide tooling annoyance,
  out of scope here; the `--json` path is a clean substitute, so I did not file a separate issue.
- **Behavioral parity, not a behavior change.** The new code decodes upstream bytes → chars
  (`StreamReader`) and re-encodes chars → UTF-8 bytes for the client. The *old* code did the exact
  same UTF-8 round-trip (`ReadAsStringAsync` then `Encoding.UTF8.GetBytes`), so there is no new
  lossiness for malformed bytes — behavior is preserved; only the unbounded double-copy is removed.
- **Cap honesty.** `MaxCapturedResponseChars` is 16 MB and stays a private `const` (matching the
  streaming path, whose cap is also not unit-tested at the boundary). The regression test proves the
  chunked forward/capture is byte-exact for a sub-cap 512 KB body rather than allocating 16 MB+ to
  hit the truncation branch directly; the truncation arithmetic (`Math.Min(read, headroom)`) is
  simple and symmetric with the streaming path. Intentional cost/coverage tradeoff, called out so it
  isn't mistaken for full boundary coverage.
- **Scope discipline.** Kept the change to the buffered path only; the sibling ingestion-worker /
  memory issues (#187–#192) were left untouched as separate tickets.
