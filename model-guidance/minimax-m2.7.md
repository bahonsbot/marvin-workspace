# MiniMax-M2.7 Prompt Guidance

Source: MiniMax Platform Documentation (platform.minimax.io/docs)

## Model Overview

| Attribute | Detail |
|---|---|
| Model | MiniMax-M2.7 |
| Context window | 204,800 tokens |
| Output speed | ~60 tps |
| Format | Anthropic API-compatible (recommended) or OpenAI SDK |
| Thinking/reasoning | Native interleaved thinking block |
| Tool use | Native, with reasoning between each tool interaction |
| Image/document input | Not supported via text chat; OpenClaw VLM endpoint available separately |
| Prompt caching | Automatic passive caching for repeated context |

---

## Model Strengths

M2.7 is strongest in:
- **Agentic, long-horizon tasks** — excels at multi-step workflows with tool interactions spread over many turns
- **Code understanding and reasoning** — recursive self-improvement framing; SOTA on SWE, BrowseCamp, xBench
- **Interleaved thinking** — reflects on current environment and tool outputs before deciding next action
- **Multi-turn tool conversations** — maintains reasoning chain across many tool-call rounds when message history is preserved correctly
- **Cost efficiency via caching** — automatic passive caching reduces latency and cost for repeated context without any code changes

---

## Where Explicit Prompting Still Helps

- Explicit tool routing and tool definitions at the start of agentic sessions
- Structuring message history correctly for multi-turn tool conversations
- Placing static/repeated content (system prompts, tool lists) early; dynamic user content late — maximizes cache hits
- Giving the model explicit termination signals when a task is complete, to avoid unnecessary further tool calls
- Verification steps on high-stakes or irreversible actions

---

## Key Patterns

### Thinking / Reasoning Block

M2.7 emits a `thinking` (Anthropic SDK) or `reasoning_details` (OpenAI SDK with `reasoning_split=True`) content block. This is the model's internal reasoning visible to the application.

**Do not discard it.** In multi-turn tool conversations, the full response.content list — including thinking blocks — must be appended to message history to maintain reasoning continuity.

```python
# Anthropic SDK
response = client.messages.create(model="MiniMax-M2.7", ...)
for block in response.content:
    if block.type == "thinking":
        print(f"Thinking: {block.thinking}")
    elif block.type == "text":
        print(f"Text: {block.text}")
    elif block.type == "tool_use":
        print(f"Tool: {block.name}({block.input})")

# Critical: append full content list to message history
messages.append({"role": "assistant", "content": response.content})
```

### Tool Use / Function Calling

M2.7 natively supports interleaved thinking — it reflects on the current environment and tool outputs before each tool call.

- Tool definitions go in the `tools` parameter (same as Anthropic API)
- The model can call multiple tools per response round
- Always return the tool result with the original `tool_use_id` so the model can match responses to calls

```python
# Execute tool and return result
tool_result = "24℃, sunny"
messages.append({
    "role": "user",
    "content": [{
        "type": "tool_result",
        "tool_use_id": tool_use_blocks[0].id,
        "content": tool_result
    }]
})
```

### Message History Integrity in Multi-Turn Tool Conversations

**This is the most critical operational rule for M2.7.**

In multi-turn function call conversations, the complete model response (the full `response.content` list) must be appended to conversation history. Missing this breaks the reasoning chain.

- **Append:** the full content list including thinking/text/tool_use blocks
- **Do not:** flatten thinking blocks into plain text, or discard them after reading
- **Do not:** append only the text output and discard tool_use blocks

### Prompt Caching

M2.7 uses automatic passive caching. Repeated context (system prompts, tool lists, conversation history) is cached transparently.

- Requires ≥512 input tokens to activate
- Uses prefix matching: order is "tool list → system prompts → user messages"
- Moving static content earlier and dynamic content later maximizes cache hits
- Cache hits appear in response usage as `cache_read_input_tokens`

```python
# Cache hits show in usage
print(f"Input tokens: {response.usage.input_tokens}")
print(f"Cache hit tokens: {response.usage.cache_read_input_tokens}")
```

### What M2.7 Does Not Support (via Anthropic SDK)

| Feature | Status |
|---|---|
| Image input (`type="image"`) | Not supported |
| Document input (`type="document"`) | Not supported |
| `top_k` parameter | Ignored |
| `stop_sequences` parameter | Ignored |
| `mcp_servers` parameter | Ignored |
| `context_management` parameter | Ignored |

For image understanding in OpenClaw, use the configured VLM endpoint separately.

---

## OpenClaw Routing Notes

- OpenClaw uses `minimax/MiniMax-M2.7` with the Anthropic-compatible transport
- Transport: `api: "anthropic-messages"`, `baseUrl: "https://api.minimax.io/anthropic"`
- When using M2.7 as the default lightweight model, it handles orchestration, delegation, and reasoning-heavy tasks
- For coding-heavy delegated work, prefer Codex; for higher-reasoning work, prefer Bailian models
- OpenClaw's VLM/image tool is served via a separate MiniMax Image Understanding MCP endpoint, not via the chat model

---

## Common Failure Modes

1. **Discarding thinking blocks in multi-turn tool conversations** — causes the model to lose reasoning context and restart from scratch on each turn
2. **Appending only text output to message history** — breaks the interleaved thinking chain
3. **Putting dynamic content before static content** — reduces prompt cache hit rate unnecessarily
4. **Assuming image/document input works via the chat endpoint** — it does not; use the VLM endpoint for images
5. **Not setting `max_tokens` large enough for long reasoning chains** — M2.7's thinking output counts against max_tokens; set generously for complex tasks

---

## Usage in OpenClaw

When model switches to `minimax/MiniMax-M2.7`, read this file first to apply the above patterns.

{
  "source": "platform.minimax.io/docs — text-intro, text-anthropic-api, text-m2-function-call-refer, text-prompt-caching, models-intro, text-ai-coding-refer"
}
