# Runtime awareness and long tasks

The browser, installed PWA and mobile client using the same agent endpoint now receive an authoritative per-request capability inventory. A standalone Turkish capacity question is answered directly by the server, without asking the language model to guess. The runtime_status tool provides the same inventory and current budget. Other requests still use the model and ordinary tools.

- 100 root tool rounds by default; 8 accepted top-level calls per round (800 theoretical dispatches, not a completion promise).
- 30-minute root deadline by default; specialist budget 8 rounds, configurable 1–12, with 4 calls per round. Existing tool deadlines, provider quotas and cancellation still apply.
- Root run ledger has capacity for 2,048 task records; smaller existing callers retain their default.
- Tool names advertised and executed derive from one server context. A batch-limit or unadvertised call is rejected without execution, with a corresponding tool response.
- Identical mutations are never automatically replayed. runtime_status can refresh once per root round.
- Run outcome explicitly distinguishes an answer, tool failures, and an incomplete/interrupted result. A terminal summary after budget exhaustion does not prove a deliverable.
- SSE clients receive hafize-run-capabilities and hafize-run-outcome metadata; buffered clients receive capabilities and outcome fields. These are metadata, not a new progress panel.
- No credential values, repository contents, approvals or arbitrary command arguments are included in the capability snapshot.
- No blanket permission changes, automatic merge/deploy, or unrestricted shell access. The catalog is not an entitlement list.
- In-flight tool calls and model conversation remain request-scoped. Restart-resilient automatic resume of arbitrary development tasks is NOT implemented; no write is automatically replayed after a timeout. The existing orchestrator_resume is separate.

Verification: npm run typecheck:runtime; npm run test:modern; existing CI quality gates. New runtime-capabilities tests cover exact availability, count semantics, standalone question routing, cancellation and an 800-call ledger. To revert, revert this PR and redeploy the previous tested commit. Set HAFIZE_EXPERT_TOOL_ROUNDS=3 if required for resource constraints.
