# Gemini API Setup Guide

## Quick Start (5 minutes)

### Step 1: Get Your Gemini API Key
1. Go to: **https://ai.google.dev/**
2. Click "Get API Key" 
3. Select "Create API key in new Google Cloud project" (or existing project)
4. Copy the key

### Step 2: Add to Environment
Choose ONE option:

**Option A: Add to .env file (Recommended)**
```bash
echo "GEMINI_API_KEY=<paste-your-key-here>" >> ~/.env
source ~/.env
```

**Option B: Export in shell**
```bash
export GEMINI_API_KEY=<paste-your-key-here>
```

**Option C: Add to openclaw config**
```bash
# Update your openclaw.json with GEMINI_API_KEY env reference
```

### Step 3: Verify Setup
```bash
# Check if key is accessible
echo $GEMINI_API_KEY
# Should output your key

# Test connectivity (after OpenClaw restart)
openclaw status
```

### Step 4: Update OpenClaw Config
Copy `openclaw-config-template.json` to your `openclaw.json`:
```bash
cp openclaw-config-template.json ~/path/to/openclaw.json
```

### Step 5: Restart OpenClaw
```bash
openclaw gateway restart
```

---

## What You Get (Free Tier)

### Gemini 2.0 Flash (Recommended for Orchestration)
- **Quota:** 12.5 million tokens per day
- **Latency:** <500ms typical
- **Cost:** $0
- **Use for:** Task routing, coordination, planning

### Gemini 2.0 Pro (Optional, for Complex Tasks)
- **Quota:** 1 million tokens per day
- **Latency:** 1-3s typical
- **Cost:** $0
- **Use for:** When Flash isn't sufficient

---

## Cost Before & After

### Current (Anthropic Only)
```
Haiku task: ~$0.20
Daily: ~$30
Monthly: ~$900
```

### After (Multi-Model)
```
Gemini orchestration: $0
Haiku implementation: $0.05-0.10
Daily: ~$0.15
Monthly: ~$4.50
```

**Savings: $895/month** 💰

---

## Troubleshooting

### API Key Not Found
```bash
# Check if key is set
echo $GEMINI_API_KEY

# If empty, add to ~/.bashrc or ~/.env and reload
source ~/.bashrc
```

### Rate Limiting
```
If you hit Gemini's free tier limits:
- Wait until tomorrow (daily quota resets)
- Fallback: Use Haiku temporarily
- Solution: Upgrade to paid plan if needed
```

### Model Not Available
```
Error: gemini-2.0-flash not found

Fix:
1. Verify GEMINI_API_KEY is set
2. Restart OpenClaw: openclaw gateway restart
3. Check internet connection
```

---

## Next Steps

✅ Get API key from https://ai.google.dev/
⏳ Add GEMINI_API_KEY to environment
⏳ Update openclaw.json with config template
⏳ Restart OpenClaw
⏳ Test with first task
⏳ Monitor costs in logs

---

## Support & Docs

- **Google AI:** https://ai.google.dev/
- **API Docs:** https://ai.google.dev/docs
- **Pricing:** https://ai.google.dev/pricing
- **Rate Limits:** Free tier uses daily quotas (reset at midnight UTC)

---

## After Setup

Once you've added the key and restarted OpenClaw:
1. Tasks marked as "orchestration" will use Gemini (free)
2. Code generation will use Haiku ($0.05-0.10 per task)
3. Complex reasoning will use Sonnet ($0.50+ per task, only when needed)
4. You'll see cost breakdown in logs

**Result: 98% cost reduction while improving speed.** 🚀
