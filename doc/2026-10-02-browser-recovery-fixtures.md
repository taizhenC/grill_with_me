# Browser recovery fixture follow-up

Completed 2026-10-02. Combined main `5a4077d` passed typecheck and production
build. Actual Chromium execution passed ten flows and exposed two fixture
assumptions introduced by private publication recovery.

The malformed-acknowledgement flow had already published a room in that tab.
It now explicitly confirms the host token was saved before starting its next
publication. This follows the new rule that existing recovery must be cleared.

The lost-reply flow checked a button inside a collapsed paste disclosure after
reload. It now opens the disclosure before asserting the button is disabled.
The actual original write had committed and its reply was dropped, but the
earlier fixture stopped before testing recovery; that run does not establish
successful lost-reply recovery.

These changes retain all application assertions and introduce no timeout
increase or retry. Diff checks passed. The corrected twelve-flow suite will run
after this follow-up is merged, as requested.
