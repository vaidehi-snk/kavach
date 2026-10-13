# Kavach 🛡️ — an Alexa+ scam shield for older adults

> *"Alexa, a man from CBI says I'm under digital arrest and must transfer money."*
> **"This looks like a scam. Police never arrest anyone over a video call. Hang up now. Shall I let Rohan know?"**

Older adults lose billions every year to phone, text and video-call scams: grandparent scams and fake IRS calls in the US, "digital arrest" and fake electricity-bill scams in India. The moment of danger is short: someone is on the phone, frightened, being told not to tell anyone. Kavach puts a calm, trusted voice in the room at exactly that moment, and quietly brings the family in.

Kavach is a **self-hosted MCP server (spec 2025-11-25, Streamable HTTP)**, the open standard that powers Alexa+ integrations.

## What it does

| Tool | What it's for |
|---|---|
| `check_message` | Describe a call, text, WhatsApp or email in your own words → verdict, scam type, red flags, the one fact that breaks the scam, and a sentence to speak aloud. If it's a scam, offers to alert family. |
| `alert_family` | Push / email alert to family members. **Never sends without the person's consent**, collected through MCP elicitation. |
| `daily_checkin` | "I'm fine today" → logged for family; "not feeling well" → offers to ask family to call. |
| `family_digest` | For the son or daughter: "How's Mom doing?" → scams stopped, alerts, check-ins. |

**Resources:** `kavach://scam-patterns`, `kavach://scam-patterns/{id}` (template with completion), `kavach://activity`
**Prompts:** `scam_safety_check`, `weekly_family_update`

### MCP features used deliberately
- **Elicitation for consent.** The server asks the person directly before anyone is contacted. Clients without elicitation get a verbal-confirmation fallback, and the server refuses to alert without `confirmed=true`.
- **Structured output** (`outputSchema` + `structuredContent`), so an agent can act on the verdict, not just read it.
- **Tool annotations** (`readOnlyHint`, `openWorldHint`) so hosts can tell harmless lookups from actions that reach other people.
- **Resource templates with completion** for the scam knowledge base.
- **Stateful Streamable HTTP sessions**, required for server→client requests like elicitation. DNS-rebinding protection is on by default.

## How detection works

```
what the person says
   │
   ▼
rules engine (kavach-scam-patterns, ~1 ms, offline, explainable)
   │  very confident scam? ── yes ──► answer immediately
   ▼ no
Amazon Bedrock (Converse API) sees the text + the red flags the rules found
   │
   ▼
rules act as a floor: the model can raise concern, never clear an obvious scam
```

The rule layer is published separately as an MIT-licensed package, **[`kavach-scam-patterns`](packages/scam-patterns)**: 18 scam families (US, India, global) and 11 manipulation tactics (urgency, secrecy, odd payment methods, code requests, remote-access apps…). Each family carries plain-language "truth" and "advice" lines written to be spoken to a 75-year-old.

## Measured, not claimed

`eval/cases.js` has 107 labeled cases, written the way people actually describe these calls, including **hard genuine look-alikes**: real bank fraud alerts, a niece calling from hospital after a real accident, scheduled power-cut notices. The set is split deterministically: rules were tuned **only on `dev`**; `holdout` was never used for tuning.

| Engine | Split | Scams flagged | Scams called "scam" | Genuine messages wrongly flagged |
|---|---|---|---|---|
| Rules only | dev (tuned) | 100% | 90.9% | 0% |
| **Rules only** | **holdout (unseen)** | **69.2%** | **50.0%** | **0%** |
| Rules + Bedrock | holdout | *run `npm run eval -- --mode hybrid`* | | |

The holdout gap is the point: hand-written rules generalise poorly, which is why Kavach pairs them with a model. Rules are kept because they're instant, free, explainable and work offline. They never cried wolf on a genuine message.

```bash
npm run eval                               # rules, holdout split
npm run eval -- --split dev                # rules, dev split
KAVACH_LLM=bedrock npm run eval -- --mode hybrid   # rules + Bedrock
node eval/e2e.js                           # real MCP client ↔ server protocol test
```

## Run it

```bash
npm install
npm start                       # http://127.0.0.1:8787/mcp
node eval/e2e.js                # 13 protocol checks
```

Optional configuration (environment variables):

| Variable | Purpose |
|---|---|
| `KAVACH_LLM=bedrock` | Turn on Amazon Bedrock (off by default, so nothing bills unexpectedly) |
| `BEDROCK_MODEL_ID` | Default `us.amazon.nova-lite-v1:0` |
| `AWS_REGION` | Default `us-east-1` |
| `KAVACH_NTFY_TOPIC` | Family push notifications via [ntfy](https://ntfy.sh) (free app, no account) |
| `KAVACH_SNS_TOPIC_ARN` | Family email/SMS via Amazon SNS |
| `HOST`, `PORT`, `ALLOWED_HOSTS` | Network binding |

## AWS services used
- **Amazon Bedrock (Converse API)**: judgment on messages the rules aren't sure about.
- **Amazon SNS**: family email/SMS alerts.

## Project layout
```
packages/scam-patterns/   open-source detector (MIT)
server/                   MCP server: index.js (HTTP), mcp.js (tools/resources/prompts),
                          assess.js (rules + Bedrock), notify.js, store.js
eval/                     labeled cases, accuracy runner, end-to-end protocol test
```

## License
MIT
