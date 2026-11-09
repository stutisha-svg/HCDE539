---
version: 2
name: cross-cutting-image-transformation-routines-decode-inc-5ddf
description: "PIL Library Adoption: Image Transformation Routines Decode Incoming Byte"
metadata:
  actual:
    adr_id: 5ddf834d-b373-4ed7-8550-5517740d9de8
    status: accepted
    candidate_group_id: f59fdeca-6ba7-45a4-8c55-52afcd3ee0cd
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# PIL Library Adoption: Image Transformation Routines Decode Incoming Byte

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for components responsible for ingesting remote image assets and transforming raw bytes into display-compatible matrices.

### Rules

- **R-PIL-001** MUST: Image transformation routines MUST decode incoming byte buffers into memory via Image.open wrapped around byte stream containers without writing intermediate files to disk.

### Verify

```bash
# Discover the project verification script from the repository manifest and execute the test suite to validate image conversion routines.
pytest
```

**Accept when:**
- Image transformation routines decode byte streams and output normalized pixel arrays without raising exceptions.
- Automated test suites pass without referencing temporary filesystem paths for graphical asset processing.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>