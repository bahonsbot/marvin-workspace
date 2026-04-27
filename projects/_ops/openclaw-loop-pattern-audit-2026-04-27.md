# OpenClaw loop-pattern audit - 2026-04-27

## Summary
A concrete loop appeared in the current autonomous task session after a missing local docs path triggered a failed read. Instead of pivoting immediately to the prepared research packet or a known-good doc URL, the agent repeated near-identical `exec` log-probe scripts that returned no useful evidence and repeated the same planning intent in its reasoning text.

## Evidence
### Session examined
- Session log: `/data/.openclaw/agents/main/sessions/mc-auto-9d78ef426f-1777296819800.jsonl`
- Trajectory: `/data/.openclaw/agents/main/sessions/mc-auto-9d78ef426f-1777296819800.trajectory.jsonl`

### Concrete repeated behavior
1. The agent attempted a local docs read that failed:
   - `read {"path":"/data/.openclaw/workspace/docs/tools/loop-detection.md"}`
   - Result: `ENOENT: no such file or directory` (`mc-auto-9d78ef426f-1777296819800.jsonl`, line 18)
2. After that failure, the agent ran a sequence of similar analysis scripts that produced no signal:
   - repeated-trajectory scan, result `files 40` only (lines 19-20)
   - repeated JSONL text-pattern scan, result `(no output)` (lines 21-22)
   - repeated tool-call frequency scan, result `(no output)` (lines 27-30)
3. Between those tool calls, the reasoning text kept restating the same intent in slightly different words:
   - “I need to inspect the logs...” (line 16)
   - “I need to check the actual documentation...” (line 19)
   - “I think I need to look at the logs...” (line 21)
   - “I’m noticing a potential repetitive loop...” (line 27)
   - “I want to better identify potential loops...” (line 29)

### Why this qualifies as a loop
This is not an infinite hard loop, but it is a real no-progress retry cluster: same goal, same evidence source class, same weak result, no meaningful strategy change until later manual inspection of the session JSONL.

## Root-cause hypothesis
Primary cause: the agent hit a missing local-doc path and lacked a strong post-failure gate that says, in effect, “same evidence class failed twice, pivot now.”

Contributing factors:
- the model kept treating “recent logs” as a broad search problem instead of narrowing to the current session where failure was already visible;
- empty-success `exec` outputs, especially `(no output)`, were not treated as a no-progress event requiring a different tool or tighter query;
- the prompt did not explicitly tell the agent to prefer the prepared research packet and current-session transcript before broad log mining.

## Recommended bounded guard
### Best fix: add a no-progress pivot gate for repeated diagnostic probes
A bounded runtime/prompt guard would be:

> If 2 consecutive diagnostic tool calls aimed at the same question return empty or near-empty signal (`(no output)`, trivial counts like `files 40`, or known file-not-found on the reference doc path), do not issue a third same-class probe until you pivot evidence source, narrow scope, or explain the blocker.

Recommended scope:
- apply to `exec`, `read`, and known search/probe tools during investigation-style runs;
- treat `ENOENT`, empty grep/scan output, and low-information aggregate output as no-progress signals;
- require one of these pivots before another same-class probe:
  1. inspect the current session log directly;
  2. use the prepared research packet / cited URL;
  3. narrow the file set or query materially;
  4. state a blocker.

## Recommended prompt fix
For autonomous audit/research tasks, add one line such as:

> When a reference file is missing or two diagnostic probes return empty/low-information output, pivot immediately to the prepared research packet, current-session transcript, or a narrower target; do not keep rephrasing the same inspection intent.

## Optional tool-definition improvement
OpenClaw’s loop-detection docs already describe detection for repeated same-tool patterns and no-progress polling, and note that loop detection is disabled by default:
- https://docs.openclaw.ai/tools/loop-detection
- https://github.com/openclaw/docs/blob/main/docs/tools/loop-detection.md

A useful extension would be to classify low-information diagnostic outputs as no-progress for `exec` investigative probes, not just literal identical repeats. That matters here because the commands were not byte-identical in purpose, but functionally equivalent.

## Recommendation
Implement the prompt fix first, then add the bounded no-progress pivot gate. That is the smallest guard likely to reduce this class of waste without overblocking legitimate investigation.
