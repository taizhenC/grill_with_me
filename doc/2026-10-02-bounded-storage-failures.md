# Bounded storage failures and operator diagnostics

Completed 2026-10-02 for P0-04 and P1-06. Legacy Supabase methods previously
included raw backend messages in exceptions and lacked request deadlines.
Framework logging could therefore expose private database details and stall.

All room reads/mutations now bound headers and body to five seconds, including
recoverable creation and deletion. Known room-key collision retries share the
creation deadline; unknown failures are never automatically retried. Requests
are aborted on failure. A timeout can follow a committed mutation: the fixed
503 response asks callers to check the previous outcome before retrying a write.
Use publication recovery for a lost creation acknowledgement.

Failures carry a fixed cross-bundle code and a closed operation name. API
responses use no-store and Retry-After: 5. Structured operator events contain
only `event: room_storage_unavailable` and the operation or `configuration`.
Backend exception text, causes, credentials, briefs, IPs and keys are excluded.
Domain 403/404 and publication 400/409/410 behavior remains distinct.

## Verification and limits

Typecheck and 45 focused checks passed, including the additional recovery drill.
Tests drive the real Supabase/PostgREST client with private sentinel error
details through five actual route handlers and inspect both responses and logs.
A real JSON body is held open by a transport that ignores abort; the deadline
still rejects it. A local provider-response drill restores a failed republish
and requires its committed version acknowledgement. This emulates a provider
failure; it does not establish hosted outage diagnosis or production recovery.

Combined main verification follows merge, as requested. Actual deployment monitoring,
service credentials, migration verification and hosted failure drills remain
release gates in the operations runbook.
