---
version: 2
name: cross-cutting-diagnostic-warning-error-events-emitted-357c
description: "Standard Runtime Console Logging: Diagnostic Warning Error Events Emitted Through"
metadata:
  actual:
    adr_id: 357c3f11-f30e-4735-adb4-6f2dd8856a36
    status: accepted
    candidate_group_id: 2fbec34a-d477-4877-a9b8-4025240e1963
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - RaceBand/**
---

# Standard Runtime Console Logging: Diagnostic Warning Error Events Emitted Through

Scope: applies to `RaceBand/**`.

These rules are ALWAYS ACTIVE for operational error handling and warning reporting across runtime execution paths.

### Rules

- **R-LOG-001** MUST: Diagnostic warning and error events MUST be emitted through standard runtime console methods when reporting operational faults.

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