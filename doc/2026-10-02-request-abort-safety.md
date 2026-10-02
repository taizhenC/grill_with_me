# Queued body abort correction — 2026-10-02

Independent review of the bounded reader reproduced an already-aborted request succeeding when its stream had queued chunks. An already-fulfilled read could win the promise race over cancellation.

The reader now rejects pre-aborted requests before acquiring the stream and checks cancellation again after each read. A queued-stream regression verifies the reproduced failure returns 400. Reader and endpoint tests and typecheck passed. This corrects request reading; it does not cancel a database mutation after the body was accepted.
