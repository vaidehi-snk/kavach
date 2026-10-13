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
