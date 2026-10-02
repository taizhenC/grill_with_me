# CLI network bounds completion — 2026-10-02

Feature: bounded transport for CLI room/skill requests and role claims.

Every CLI service request now has a fifteen-second deadline covering both
headers and body, an 8 MiB decoded UTF-8 response ceiling, strict JSON object
validation, HTTPS/loopback transport validation, and redirect refusal. Failed
mutations report that the outcome may be unknown. Failed claim confirmation
suggests checking status rather than asserting the claim never reached storage.

Validation: Node 24 full suite passed 277 tests with seven Windows platform skips;
sixteen dedicated transport/subprocess checks passed on Node 22.15.0 and
24.21.0. Typecheck and installed beta archive checks passed. Fixtures exercise
stalled headers/bodies, chunked and compressed oversized responses, redirects,
malformed replies, pre-aborted requests, and no installed files after a rejected
download. No unhandled rejection remains in the abort tests.

A lost publication response can still leave a room without locally saved host
credentials. Idempotent publication recovery remains a separate onboarding
upgrade. Database work has separate server timeouts; this feature bounds the
CLI's waiting and memory use.
