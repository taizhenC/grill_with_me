# Public origin safety — 2026-10-02

An independent browser-feature review identified an existing gap: forwarded
host/protocol strings were copied directly into links and printed shell commands.
This follow-up constrains those origins before rendering.

## Changes

- Prefer the explicit `GRILL_PUBLIC_ORIGIN` deployment setting, validating a
  canonical origin without userinfo, path, query, or fragment.
- Otherwise use the request Host. Ignore forwarded host/protocol by default;
  explicit `GRILL_TRUST_PROXY=1` permits only a sanitized ingress that overwrites
  all forwarded identity/origin headers.
- Normalize through URL parsing and require DNS label grammar or a valid IP
  address, with bounded hostname length. Reject shell syntax and unsafe host
  forms before producing commands.
- Require HTTPS for public hosts; HTTP remains available for literal loopback
  development. An invalid/missing origin fails without reflecting raw headers or
  configuration in the error.
- Make isolated browser fixtures clear inherited public-origin/cron settings.

## Verification

Node 24.21.0 on Windows: **31 focused tests passed** (27 origin cases and four
command cases). They cover untrusted forwarded injection, explicit configuration,
IPv4/IPv6 loopback, sanitized trusted ingress, invalid host labels, userinfo,
paths/query/fragments, shell syntax, invalid protocol lists, and absent hosts.

Production build/typecheck passed. **Eight actual Chromium tests passed**, adding
a compiled-server request with malicious forwarded host/protocol values: the
response keeps the real loopback origin and contains neither the supplied host
nor shell expression. The earlier seven browser onboarding/recovery cases remain.

## Limits

The default validated Host still describes the origin received by the application;
operators with internal reverse-proxy hosts should pin GRILL_PUBLIC_ORIGIN. Enabling
trusted forwarded headers is an explicit deployment responsibility, not proof that
an ingress actually sanitizes them. No public deployment configuration was changed.
