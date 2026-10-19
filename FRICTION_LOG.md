# Friction log

Submissions with friction logs can earn up to a 10% judging bonus. Add an entry the moment something slows you down. Fill in every field; vague entries don't help the product teams.

---

### 1. Choosing a track without hardware or US residency
- **Task:** Pick a track as a student in India with no Amazon devices.
- **Steps:** Read the Ring developer guide → Test section.
- **Expected:** The hackathon page says Ring projects can use "simulators" and a device is not required.
- **Actual:** Ring staging tests require a Ring account with an active Ring Protection subscription, and currently only support devices located in the US. No official Ring simulator is linked from the docs or the Resources page.
- **Severity:** High (blocks a whole track for most non-US participants)
- **Workaround:** Switched to the Alexa+ track.
- **Suggestion:** Publish an official Ring API sandbox with simulated devices and webhook replay, or state the US/device requirement on the hackathon page.

### 2. No way to connect a self-hosted MCP server to a real Alexa+ device
- **Task:** Show the Kavach MCP server running inside Alexa+.
- **Steps:** Read the Alexa+ resources (MCP spec, Agent Skills links).
- **Expected:** A developer preview or test console where an outside developer can register an MCP endpoint and talk to it through Alexa+.
- **Actual:** Only the MCP spec and Agent Skills docs are linked; outside developers have to simulate the Alexa+ experience.
- **Severity:** Medium
- **Workaround:** Built a simulated Alexa+ voice client in a web app that connects to the real MCP server.
- **Suggestion:** An Alexa+ MCP test console (text or voice) that accepts a Streamable HTTP URL, even if limited to the developer's own account.

### 3. AWS credit codes ran out mid-hackathon
- **Task:** Get AWS credits for Bedrock.
- **Expected:** Credits available for the whole submission window.
- **Actual:** On Oct 7, the Resources page announced that credit codes ran out, with more than two weeks left.
- **Severity:** Medium for students
- **Workaround:** Free tier; Bedrock is opt-in and rules handle most cases for free.
- **Suggestion:** Reserve a pool for late joiners, or give a per-participant Bedrock quota.

### 4. Account verification silently blocked Bedrock for days
- **Task:** Make the first Amazon Bedrock call from a new AWS account (Free plan, India).
- **Steps:** Created an IAM user limited to `bedrock:InvokeModel` on `amazon.nova-lite-v1:0`, ran a Converse call from Node.js in us-east-1.
- **Expected:** Either the call works, or the console clearly shows what is still pending.
- **Actual:** `AccessDeniedException: Your account is currently being verified` three days after sign-up. The console home page looked normal; the pending step (email verification) was only visible on a separate "Complete your account setup" page.
- **Severity:** High (blocked the hackathon's recommended AI service for days)
- **Workaround:** Found and completed the pending step; verification then cleared.
- **Suggestion:** Show a persistent banner in the console while the account has pending verification steps, and name the missing step in the API error message.

### 5. "ValidationException: Operation not allowed" on every Bedrock call from an AWS India (AISPL) account
- **Task:** Call Amazon Nova Lite through the Bedrock Converse API after verification.
- **Steps:** Same IAM user and code as above, region us-east-1, single-region model ID (the Free plan doesn't allow cross-Region inference).
- **Expected:** A model response, or an error that says what is not allowed and why.
- **Actual:** `ValidationException: Operation not allowed`, with no further detail. Other developers on AISPL accounts report the same error on re:Post with no documented fix.
- **Severity:** Critical for participants in India: the AWS Builder mini challenge depends on it.
- **Workaround:** Opened AWS Support case 179216079300809. On Oct 19, AWS replied: *"We've reviewed your request and are unable to approve Bedrock model access for this account at this time. This decision was made as part of our standard account review process."* No reason given, no appeal path offered. Built the product so Bedrock is fully optional — `check_message`, `call_guardian`, `verify_caller` and every other tool run entirely on the offline rules engine, and `routeBedrock()` in `server/alexa.js` now catches a Bedrock failure and falls back to the offline router automatically rather than erroring out.
- **Suggestion:** Document which Bedrock models are available to AISPL / Free plan accounts *before* sign-up, return a specific error code instead of a blanket denial, and give hackathon participants a fast, time-boxed review path given the submission deadline.

<!-- Template:
### N. Title
- **Task:**
- **Steps:**
- **Expected:**
- **Actual:**
- **Severity:** Critical / High / Medium / Low
- **Workaround:**
- **Suggestion:**
-->
