---
version: 2
name: cross-cutting-modules-not-invoke-imaging-library-6591
description: "PIL Library Adoption: Modules Not Invoke Imaging Library Functions"
metadata:
  actual:
    adr_id: 65912839-f7ea-4bde-b624-6dce0369597b
    status: accepted
    candidate_group_id: f59fdeca-6ba7-45a4-8c55-52afcd3ee0cd
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# PIL Library Adoption: Modules Not Invoke Imaging Library Functions

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for components responsible for ingesting remote image assets and transforming raw bytes into display-compatible matrices.

### Rules

- **R-PIL-001** MUST_NOT: Modules MUST NOT invoke imaging library functions directly outside of designated image processing boundaries, ensuring display formatting logic remains decoupled from external ingestion clients.

### Verify

```bash
# Discover and execute project verification script
# Inspect project dependency configuration for locked imaging library dependency
```

**Accept when:**
- Image transformation routines decode byte streams and output normalized RGBA pixel arrays without raising exceptions.
- Automated test suites pass without referencing temporary filesystem paths for graphical asset processing.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>