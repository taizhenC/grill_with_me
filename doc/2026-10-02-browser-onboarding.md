# Browser onboarding and recovery — 2026-10-02

Plan: P1-03 browser slice and P1-04 browser/audit checks. Public deployment and live agent portability remain separate gates.

## Behavior

- Browser publication validates room structure and the 256 KiB UTF-8 limit before sending. File extension/size and read errors are readable, and one pending guard covers file reading and posting.
- Browser requests have a 15-second headers/body deadline, decoded 8 MiB ceiling, strict UTF-8/JSON object reads, and refused redirects. Raw transport response contents are not shown on failure.
- A valid creation acknowledgement must include a supported room key and a 32-character generated host token. Navigation is built from the validated key, not an arbitrary response URL.
- Browser host republish commands include the exact key, token placeholder, and custom origin. Explicit CLI tokens are not saved; the UI no longer promises automatic local credential setup.
- Claimed roles can be taken over, including through the keyboard. Claim interruption asks the member to check status instead of asserting that the claim was not saved.
- ZIP extraction creates only a staging folder with pack JSON and explicit reviewed-import instructions. It cannot directly overwrite AGENTS.md or install role/skill paths. The recommended join installer remains the deterministic safe route; manual agent imports need review.
- Room access expiry and physical purge are described separately. Operator configuration and successful runs determine physical deletion.
- Copy buttons use readable action labels without placing the copied token in the accessible name.

## Verification

Playwright 1.63.0 and its matching Chromium headless shell were verified from npm/official documentation. **Seven actual browser tests passed on Windows with Node 24.21.0**, against a built Next 16.3.8 application with explicit in-memory test storage:

1. File publication followed by execution of the printed custom-origin republish command through the actual source CLI in a fresh temporary checkout without local credentials; version advances to 2 and output excludes the token.
2. Paste, clipboard, keyboard claim and takeover; the server summary retains the new claimant and excludes the host token.
3. Actual ZIP download and archive inspection proves only staged JSON/instructions are extracted.
4. Invalid/oversized input sends no request; a connection reset reports uncertain publication.
5. Failed claim and malformed creation reply produce recovery messages instead of a false success.
6. A browser-controlled clock advances the 15-second budget of a genuinely held request; cancellation restores controls and only one request is sent.
7. Oversized decoded response is rejected without rendering reply data.

Typecheck, production build, focused command tests, and diff checks passed. The first browser run caught an ambiguous test locator matching Next's own route announcer; the application's publication alert now has an explicit accessible name. Tests use the named alert.

CI adds a Linux Chromium job using the same committed browser version, built app, and fixtures. The app job blocks moderate-or-higher audit findings. Existing real PostgreSQL, compiled runtime, Node 22/24 Windows/Linux CLI, archive, and trace checks remain.

## Limits and next work

This work does not provide idempotent lost-publication recovery yet. A failed response can still leave a created room without a recovered token, and another attempt can create another room. ZIP import instructions are an explicit safe staging/review step, not an automated installation claim. Browser support is evidenced for Chromium; Firefox/WebKit and live hosted Supabase remain unexecuted.

The safety-wave hosted run [37080017744](https://github.com/taizhenC/grill_with_me/actions/runs/37080017744) passed all six jobs on main 8419bcd. A later documentation-only main run had a Node 22 Windows refresh subprocess test exceed Vitest's five-second budget; the local-role feature is diagnosing and correcting that scoped fixture timeout. The passing earlier run is not a claim that the later run passed.

Sources: [Playwright browser installation](https://playwright.dev/docs/browsers), [web-server fixture configuration](https://playwright.dev/docs/test-webserver), [CI](https://playwright.dev/docs/ci), and [clock control](https://playwright.dev/docs/clock). These support the test setup, not a claim of hosted deployment success.
