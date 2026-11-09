---
version: 2
name: 198741a7-5cf5-427d-9272-236ddad3f87e-input-deserialization-via-json-parse-before-introducing-external-dependencies-payload-validation
description: "Input Deserialization via JSON.parse: Before Introducing External Dependencies Payload Validation"
metadata:
  actual:
    adr_id: 198741a7-5cf5-427d-9272-236ddad3f87e
    status: accepted
    candidate_group_id: 532ecfdb-96e8-4756-a794-f0b5071de4e4
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - RaceBand/**
---

# Input Deserialization via JSON.parse: Before Introducing External Dependencies Payload Validation

Status: proposed
Date: 2025-05-18
Deciders: Detection Pipeline (automated)

## Scope Paths

Root: `.` (whole repository)

Applies to:
- `RaceBand/**`

## Context

- The codebase ingests raw incoming string payloads and structured text lines from external runtime sources.
- Parsing unvalidated external payloads can cause uncaught runtime exceptions when data deviates from expected structure.
- Static evidence detects isolated direct invocations of built-in JSON.parse alongside custom field count validations without a centralized validation schema or framework.

## Problem Statement

External raw inputs ingested by the application require safe deserialization to prevent unhandled parse exceptions and malformed state propagation across runtime components.

## Decision

1. MUST: Before introducing external dependencies for payload validation, developers MUST discover the project dependency manifest and resolve the exact locked versions through the repository lock artifact.

## Policy Block

- MUST Before introducing external dependencies for payload validation, developers MUST discover the project dependency manifest and resolve the exact locked versions through the repository lock artifact.

In scope:
- Handling and parsing of unvalidated raw string inputs and serialized payloads from external streams or runtime boundaries.

Out of scope:
- Internal strongly-typed in-memory message exchanges between already validated components.

## Rationale

- Using built-in JSON.parse provides lightweight parsing of structured payloads without introducing external dependency overhead.
- Wrapping parsing operations in defensive validation and logging prevents malformed input data from crashing runtime processes.
- The codebase exhibits localized use of native parsing primitives for immediate external input handling.

## Consequences

Positive:
- Prevents unhandled runtime crashes when processing malformed external payload strings.
- Avoids external library dependencies by utilizing built-in runtime parsing capabilities.
- Provides explicit logging when inbound records fail field count expectations or syntax requirements.

Negative:
- Built-in parsing lacks declarative schema validation, requiring manual defensive property checking across consumer code.
- Scattered manual parsing logic increases the risk of inconsistent error handling across different input boundaries.

## Alternatives

- Adopt an external schema validation and parsing library (rejected)
  Rejected because: No external schema validation dependency is adopted or evidenced in the project codebase, and adding one introduces unnecessary bundle size and dependency management overhead for simple payloads.
  When valid: When payload structures grow highly complex and demand formal declarative contract enforcement.
- Direct unsanitized property access on unparsed raw strings (rejected)
  Rejected because: Treating unparsed strings directly or parsing without error boundaries leads to runtime exceptions and unpredictable state.
  When valid: Never valid when handling untrusted external inputs.

## Risks

- Uncaught JSON parsing syntax errors can terminate the runtime event loop if exception handling is omitted.
  Mitigation: Enforce defensive parsing boundaries and structured error logging at every raw input entry point.
  Owner: engineering team
- Lack of central schema validation may allow unexpected payload shapes to pass JSON parsing undetected.
  Mitigation: Complement parsing with post-parse field presence and boundary checks before downstream consumption.
  Owner: engineering team

## Implementation Notes

- DISCOVERY POLICY (MANDATORY): This ADR omits all tool names, file names, commands, package managers, and version numbers. The consumer MUST derive them from the project repository.

LOCK-VERSION GROUNDING (MANDATORY) — before writing code that uses a versioned library, execute in order:
1. Find the dependency manifest in the repo. It declares ranges, not installed versions.
2. Identify the build tool from the manifest.
3. Inspect the repository lock or resolution artifact to determine the exact resolved version. This artifact is authoritative; build-tool output only verifies the active environment matches it.
4. Look up the official documentation, changelog, or public API reference for that exact version. Do not use training-data recall — fetch or search the public internet for version-specific docs.
5. Confirm every API, class, or function you will call exists in that exact version's documentation before using it.
6. For version-sensitive behavior, re-run steps 3-5 per dependency at point of use.
- Wrap all native parsing invocations within structured error boundaries and route failures to diagnostic logging.
- Perform sequential validation checks on input segments before deserialization to verify expected minimum field counts.

## Continuation Context


Verify commands:
- Discover and run the project test runner script to verify input deserialization error handling.
- Discover and execute the repository static analysis suite to identify unprotected parsing calls.

Accept when:
- All unit and integration tests covering external input deserialization pass without unhandled exceptions.
- Malformed input payloads trigger diagnostic warnings or errors without causing runtime crashes.

## Enforcement

- Verified by: Automated test suite execution during continuous integration.
- Verified by: Peer code review of data ingestion boundaries.
- Violation handling: Pull requests containing unhandled parsing invocations must be revised prior to merge.
- Violation handling: Static analysis warnings regarding unguarded input deserialization block release pipeline promotion.
- Exception process: Exceptions require documented justification demonstrating that input sources are strictly internal, trusted, and verified upstream.