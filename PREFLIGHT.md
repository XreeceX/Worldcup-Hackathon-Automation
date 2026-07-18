# PREFLIGHT.md — Tool & API Viability Spikes (Hour 0–5, before idea lock)

Every external dependency gets a row BEFORE the idea is locked. The point: convert every T-5h surprise into a T+5h known. Last event the platform's MCP server couldn't approve invoices, create accounts, or do bank transfers, and one documented tool was broken — every gap was discovered mid-build and became an emergency workaround.

## Spike log (one row per capability you DEPEND on)

| Tool / API | Capability we need | Proven with a REAL call? | Result / ID captured | Can't-do list & workaround |
|---|---|---|---|---|
| _e.g. platform MCP server_ | _create invoice_ | ☐ | | |
| _e.g. platform REST API_ | _authorise / approve_ | ☐ | | |
| _e.g. auth (client credentials)_ | _token with correct scopes_ | ☐ | | |
| _e.g. Make / n8n_ | _webhook trigger → write_ | ☐ | | |
| _e.g. deploy host_ | _serves app at real origin_ | ☐ | | |

**Rule:** a capability is only "proven" by a real call whose response you saved (an ID, a status code, a screenshot). Documentation claims and SDK type signatures do not count — the broken tool last time was documented as working.

## Standard spikes (run all five)

1. **One real WRITE** through the primary platform (create + read back). Capture the object ID.
2. **Auth path end-to-end** — exact token type + scope list that works. (A wrong scope *shape* cost a morning last time; findable in 10 minutes with one live call.)
3. **Deploy smoke** — hello-world on the real host, fetched from the real frontend origin. Record: CORS origins needed, base path, env vars, favicon behavior.
4. **Fixture invariant** — core domain invariant encoded as a test BEFORE the fixture exists; fixture passes it.
5. **Rate limits & quotas** — write down the numbers (calls/min, concurrent, daily). Design the demo to use <20% of them.

## Known-broken list (carry-over + fill per event)

| Tool | Broken/missing capability | Workaround |
|---|---|---|
| _fill from spikes_ | | |

## Environment invariants (check once, hour 0)

- [ ] Repo NOT inside iCloud/Dropbox/OneDrive (sync conflicts corrupted state files last time)
- [ ] `.gitignore` covers build artifacts BEFORE first commit (`__pycache__/`, `*.pyc`, `node_modules/`, `.env*`)
- [ ] `.env` in gitignore, `.env.example` committed instead
- [ ] Venue Wi-Fi failure plan: commit before any network-dependent step; local copies of deck + video
