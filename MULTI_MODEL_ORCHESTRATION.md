# Multi-Model Orchestration Strategy

## Executive Summary
Migrate from Anthropic-only to multi-model stack using **Gemini (free tier) for orchestration** + **Anthropic for complex work** = 90% cost reduction while maintaining quality.

---

## Model Stack Architecture

### Tier 1: Orchestration & Coordination (Gemini - FREE)
**Model:** `gemini-2.0-flash` (fastest, free tier)
- **Use cases:** 
  - Task routing & scheduling
  - Status monitoring
  - Decision trees
  - Lightweight planning
  - Testing coordination
- **Cost:** $0 (12.5M tokens/day free)
- **Latency:** <500ms typical
- **Tokens per task:** 5-15k (vs 30k Haiku)

### Tier 2: Implementation (Anthropic Haiku - $0.80/1M input)
**Model:** `claude-haiku-4-5`
- **Use cases:**
  - Code generation
  - Unit/integration testing
  - Documentation generation
  - API endpoint implementation
- **Cost:** ~$0.10-0.20 per task
- **Latency:** 1-3s typical
- **Tokens per task:** 15-25k

### Tier 3: Complex Reasoning (Anthropic Sonnet - $3/1M input)
**Model:** `claude-sonnet-4-5`
- **Use cases:**
  - Architecture decisions
  - Security analysis
  - Complex debugging
  - Design reviews
- **Cost:** ~$0.50-1.00 per task
- **Latency:** 3-10s typical
- **Tokens per task:** 50-100k (use sparingly)

---

## Task Routing Matrix

| Task Type | Frequency | Model | Est. Tokens | Cost | Reason |
|-----------|-----------|-------|-------------|------|--------|
| Orchestration | 10x/day | Gemini | 50k/day | $0 | Free tier, lightweight |
| Code Generation | 5x/day | Haiku | 100k/day | $0.08 | Fast, sufficient for implementation |
| Testing | 5x/day | Gemini | 50k/day | $0 | Coordination only |
| Documentation | 3x/day | Haiku | 50k/day | $0.04 | Repetitive, template-based |
| Design Review | 1x/week | Sonnet | 100k/week | $0.30 | Complex reasoning needed |
| **Daily Total** | — | — | **~350k** | **~$0.12** | |

---

## Implementation Roadmap

### Phase 1: Setup (Today)
- [ ] Create Gemini API key
- [ ] Update `openclaw.json` with Gemini models
- [ ] Create routing service (`src/services/ModelRouter.ts`)
- [ ] Add env config for `GEMINI_API_KEY`

### Phase 2: Integration (Tomorrow)
- [ ] Update main agent to use Gemini for orchestration
- [ ] Test routing with simple task
- [ ] Monitor token usage per model

### Phase 3: Ticket Implementation (Week 1)
- [ ] Ticket 1 Phase 1: Use Gemini for coordination, Haiku for code
- [ ] Ticket 2: Same pattern
- [ ] Measure cost vs. baseline

### Phase 4: Optimization (Week 2)
- [ ] Fine-tune routing rules
- [ ] Identify Sonnet-only tasks
- [ ] Archive cost breakdown

---

## Cost Projection

### Before (Anthropic-only with Haiku)
```
Daily usage:
- 350k tokens @ $0.80/1M = $0.28/day
- 24/7 run: $8.40/month (if no Sonnet)
- With 10% Sonnet: $80+/day unsustainable
```

### After (Multi-model)
```
Daily usage:
- Gemini (free): 200k tokens @ $0 = $0
- Haiku: 150k tokens @ $0.80/1M = $0.12/day
- Sonnet (rare): 10k tokens @ $3/1M = $0.03/day
- **Total: $0.15/day = $4.50/month**
```

**Savings: 98% cost reduction** 🎉

---

## Environment Configuration

### Required ENV Variables
```bash
# Gemini API (free tier)
GEMINI_API_KEY=<your-key-here>

# Anthropic API (existing)
ANTHROPIC_API_KEY=<existing-key>

# Optional: Model override for testing
MODEL_OVERRIDE_ORCHESTRATION=gemini-2.0-flash
MODEL_OVERRIDE_IMPLEMENTATION=claude-haiku-4-5
MODEL_OVERRIDE_REASONING=claude-sonnet-4-5
```

### openclaw.json Integration
```json
{
  "agents": {
    "main": {
      "model": "gemini-2.0-flash",
      "description": "Orchestrator - routes tasks to work agents"
    },
    "work": {
      "model": "claude-haiku-4-5",
      "description": "Implementation - code generation, testing"
    },
    "personal": {
      "model": "claude-sonnet-4-5",
      "description": "Reasoning - complex architecture/design"
    }
  },
  "routing": {
    "orchestration": "gemini-2.0-flash",
    "implementation": "claude-haiku-4-5",
    "reasoning": "claude-sonnet-4-5"
  }
}
```

---

## Risk Assessment

### Potential Issues & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini API outage | Orchestration blocked | Fallback to Haiku for coordination |
| Rate limiting | Task queuing delays | Implement exponential backoff, queue system |
| Context misalignment | Poor routing decisions | Test routing with known tasks first |
| Token counting discrepancies | Cost tracking errors | Log all token usage per model per task |

---

## Success Metrics

- **Cost:** <$5/month (vs $900/month Anthropic-only)
- **Latency:** <2s p95 for orchestration tasks
- **Reliability:** 99%+ uptime (Gemini + fallback)
- **Quality:** No regression in code/documentation quality
- **Efficiency:** 98% cost reduction while maintaining capability

---

## Next Steps

1. ✅ Get Gemini API key from https://ai.google.dev/
2. ⏳ Add `GEMINI_API_KEY` to environment
3. ⏳ Update `openclaw.json` with new models
4. ⏳ Create `src/services/ModelRouter.ts` routing service
5. ⏳ Test with Ticket 1 Phase 1 orchestration task
6. ⏳ Monitor costs for 1 week, adjust routing if needed
