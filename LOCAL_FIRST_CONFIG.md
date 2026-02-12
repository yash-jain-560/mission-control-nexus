# Local-First Configuration (Ollama Primary)

## Active Models

```
✅ llama3.2:3b (2.0 GB) - Active & Ready
   - Fast inference (<500ms)
   - Perfect for orchestration & implementation
   - Lightweight (3B params)
```

---

## Cost Model: LOCAL-FIRST (ZERO COST)

### Previous Stacks
- **Anthropic-only:** $900/month ❌
- **Multi-model (Gemini + Haiku):** $4.50/month
- **Local-first (Ollama primary):** $0/month ✅

---

## Architecture: Local-First Hybrid

```
TIER 1 - ORCHESTRATION & COORDINATION
├─ Primary:  llama3.2:3b (Ollama local)
│  └─ Cost: $0
│  └─ Latency: <200ms
│  └─ Use: Task routing, status checks, planning
│
└─ Fallback: Gemini 2.0-flash (cloud)
   └─ Cost: $0 (free tier)
   └─ Use: If local unavailable

TIER 2 - CODE IMPLEMENTATION
├─ Primary:  llama3.2:3b (Ollama local)
│  └─ Cost: $0
│  └─ Latency: 1-3s (code gen)
│  └─ Use: API endpoints, testing, documentation
│
└─ Fallback: Claude Haiku (cloud)
   └─ Cost: $0.016/task
   └─ Use: Complex code generation

TIER 3 - COMPLEX REASONING (RARE)
├─ Primary:  llama3.2:3b (Ollama local)
│  └─ Cost: $0
│  └─ Latency: 3-10s
│  └─ Use: First attempt at complex tasks
│
└─ Fallback: Claude Sonnet (cloud)
   └─ Cost: $0.50/task
   └─ Use: Only when needed
```

---

## Task Routing Matrix (Local-First)

| Task | Primary | Fallback | Latency | Cost |
|------|---------|----------|---------|------|
| Orchestration | Ollama | Gemini | <200ms | $0 |
| Code Generation | Ollama | Haiku | 1-3s | $0 |
| Testing | Ollama | Gemini | <500ms | $0 |
| Documentation | Ollama | Haiku | 1-2s | $0 |
| Complex Reasoning | Ollama | Sonnet | 3-10s | $0 |
| **Average** | — | — | <1s | **$0** |

---

## Environment Configuration

### Required
```bash
# Ollama local endpoint (already active)
OLLAMA_API_ENDPOINT=http://localhost:11434

# Cloud fallbacks (for redundancy only)
GEMINI_API_KEY=<already-configured>
ANTHROPIC_API_KEY=<existing>
```

### Optional
```bash
# Routing preferences
PREFER_LOCAL=true                    # Always try local first
LOCAL_TIMEOUT_MS=5000                # Fallback if Ollama slow
MODEL_PRIMARY_ORCHESTRATION=llama3.2:3b
MODEL_PRIMARY_IMPLEMENTATION=llama3.2:3b
MODEL_FALLBACK_REASONING=claude-sonnet-4-5
```

---

## Implementation Steps

### Step 1: Update ModelRouter.ts
- Add Ollama provider support
- Primary: llama3.2:3b
- Fallback: Cloud models (Gemini/Haiku)

### Step 2: Create Ollama Client
```typescript
// src/services/OllamaClient.ts
- Connect to http://localhost:11434
- Stream responses
- Error handling with cloud fallback
```

### Step 3: Update openclaw.json
```json
{
  "agents": {
    "main": {
      "model": "ollama/llama3.2:3b",
      "fallback": "gemini-2.0-flash"
    },
    "work": {
      "model": "ollama/llama3.2:3b",
      "fallback": "claude-haiku-4-5"
    }
  }
}
```

### Step 4: Test Routing
```bash
# Test local model
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "llama3.2:3b", "prompt": "test"}'

# Verify fallback chain
openai status --verbose
```

---

## Performance Expectations

### Ollama (Local)
- **Orchestration (5k tokens):** <200ms
- **Code generation (15k tokens):** 2-5s
- **Testing (8k tokens):** 1-3s
- **Daily throughput:** Unlimited
- **Quality:** Good for routine work (GPT-3.5 equivalent)

### Fallback (Cloud - Rare)
- Only triggered if:
  - Ollama offline
  - Task too complex for llama3.2
  - Explicit "use-best" flag
- Cost: $0 (free tier Gemini) or $0.016-0.50 (Anthropic)

---

## Monthly Cost Breakdown

```
Component           | Cost/Month
--------------------|----------
Ollama (local)      | $0
Gemini (free tier)  | $0
Haiku (fallback)    | $0-1
Sonnet (rare)       | $0-2
--------------------|----------
TOTAL               | $0-3/month
```

**Savings vs Cloud-Only: $897+/month**

---

## Advantages of Local-First

✅ **Zero API costs** for 95% of tasks
✅ **Instant latency** (<200ms orchestration)
✅ **Complete privacy** (data never leaves machine)
✅ **Unlimited tokens** (no rate limits)
✅ **No internet dependency** (works offline)
✅ **Predictable performance** (no cloud variability)

## Trade-offs

❌ Model quality (llama3.2 ≈ GPT-3.5, not GPT-4)
❌ Requires local compute (CPU/GPU)
❌ Limited to single machine scale

---

## Fallback Strategy

If Ollama fails:
1. Check Ollama service status
2. Automatically fallback to Gemini (free tier)
3. Log incident & alert
4. Resume normal operation

This ensures **99%+ uptime** while staying **$0/month**.

---

## Next Steps

✅ Ollama active with llama3.2:3b
⏳ Update ModelRouter with Ollama support
⏳ Create OllamaClient service
⏳ Update openclaw.json with local-first routing
⏳ Test Ticket 1 Phase 1 with local model
⏳ Monitor performance & accuracy
⏳ Archive cost metrics

---

## Success Metrics

- **Cost:** $0-3/month (vs $900 baseline)
- **Latency:** <1s avg (orchestration <200ms)
- **Reliability:** 99%+ with fallback
- **Quality:** Sufficient for implementation tasks
- **Throughput:** Unlimited

**Result: Mission Control Nexus at virtually zero cost.** 🚀
