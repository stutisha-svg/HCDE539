---
version: 2
name: cross-cutting-modules-performing-outbound-http-client-3095
description: "Adoption of requests for Synchronous HTTP Client Communication: Modules Performing Outbound Http Client Operations"
metadata:
  actual:
    adr_id: 30954c3c-70e5-4911-9044-9a77e0c162d5
    status: accepted
    candidate_group_id: 28a98258-1e39-4e38-ba1d-3860837761ca
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# Adoption of requests for Synchronous HTTP Client Communication: Modules Performing Outbound Http Client Operations

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for modules performing outbound HTTP client operations and data ingestion routines retrieving remote assets or payload records.

### Rules

- **R-REQ-001** MUST: Modules performing outbound HTTP client operations MUST use the requests library for synchronous request execution.
- **R-REQ-002** MUST: All requests invocations MUST configure explicit timeout arguments to prevent system hangs and isolate network degradation.
- **R-REQ-003** MUST: Encapsulate requests.get invocations within dedicated boundary functions that isolate remote resource access and response extraction from core business logic.
- **R-REQ-004** MUST: Ensure response payloads are received into bounded byte streams or parsed data structures before invoking downstream transformation routines.
- **R-REQ-005** MUST: Ground dependency versions via the repository lockfile and official documentation prior to utilizing library features.

### Verify

```bash
# Discover and execute the project test runner to validate outbound HTTP client timeout behavior and mock endpoint interactions.
# Discover and run the project linter and static analyzer to verify that all invocations of requests.get specify an explicit timeout argument.
```

**Accept when:**
- All automated test suites pass with simulated external HTTP responses and verified timeout assertions.
- Static analysis confirms zero instances of unconstrained HTTP requests without configured timeouts.

<enforcement>
Claude Code MUST NOT skip or defer verification. Violation handling: Pull requests containing unconstrained requests invocations without timeouts are rejected, and build pipelines fail when unhandled transport errors or missing timeout arguments are detected.
</enforcement>