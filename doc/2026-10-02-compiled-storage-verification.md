# Compiled storage failure verification

Completed 2026-10-02. The actual built Next application now exercises room
storage failures after the shared quota backend permits traffic. Controlled
PostgREST replies include private sentinel data in their message/details.

The compiled create/read/claim/republish/delete handlers all returned 503,
Retry-After: 5 and no-store without the private input. Recoverable publication
also returned 503 without its capability. Captured child-process stderr
contained the fixed operation event and excluded both brief/token and capability.
The existing quota, domain403/404, physical memory deletion/retention and
production configuration checks also passed. Production build passed.

This is a real compiled-runtime transport check with controlled provider replies,
not an actual hosted Supabase outage. SQL fixtures separately test database
transactions, and deployed credentials/migrations/monitoring remain unverified.

Independent review found one report wording mismatch: the installed PostgREST
client may retry idempotent reads within the shared deadline. The earlier report
now correctly states that unknown failed **mutations** are never automatically
retried. No runtime policy was changed to make that wording true.

Combined main verification will run after merge. The twelve browser flows had
already passed on main `7673bff`; those results do not include later changes.
