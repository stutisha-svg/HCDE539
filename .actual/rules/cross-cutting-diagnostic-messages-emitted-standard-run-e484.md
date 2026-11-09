---
version: 2
name: cross-cutting-diagnostic-messages-emitted-standard-run-e484
description: "Standard Runtime Console Logging: Diagnostic Messages Emitted Standard Runtime Console"
metadata:
  actual:
    adr_id: e4843da7-ef5c-485e-a4cb-9f0d22813810
    status: accepted
    candidate_group_id: 2fbec34a-d477-4877-a9b8-4025240e1963
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - RaceBand/**
---

# Standard Runtime Console Logging: Diagnostic Messages Emitted Standard Runtime Console

Scope: applies to `RaceBand/**`.

These rules are ALWAYS ACTIVE for operational error handling and warning reporting across runtime execution paths.

### Rules

- **R-SRC-001** SHOULD: Diagnostic messages emitted to standard runtime console streams SHOULD include contextual descriptions alongside captured error references.

### Verify

```bash
# Discover and run the project code linter to verify standard console usage conforms to repository guidelines.
# Discover and execute the repository test suite to ensure error logging branches execute as expected without runtime exceptions.
```

**Accept when:**
- Static verification scripts complete with zero violations regarding unhandled or disallowed log emissions.
- Test suites pass successfully across all diagnostic and error-handling code paths.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>