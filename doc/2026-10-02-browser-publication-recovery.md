# Browser publication recovery

Prepared 2026-10-02 for P1-03. This feature uses the shared publication
protocol and backend rather than creating another recovery identity format.

## Behavior

Before sending a valid brief, the browser saves its exact original text,
service origin and a private timestamped capability in this tab's session
storage. If storage fails, no publication request is sent. A reply must
contain a valid key/token, the exact capability expiry and a replay flag.

After an interrupted or malformed reply, recover the saved publication.
Reloading the same tab preserves that choice. Recovery sends the original
body and capability, including when the paste box changes. It retrieves the
original room/token within 24 hours. Deleted, expired or conflicting attempts
remain visible; the application never silently mints a new capability.

Starting another publication requires an explicit discard. Discarding
recovery does not delete a room, and the warning explains that another
publication can create a duplicate. After success, save the host token and
use **I saved my host token** to clear the local attempt.

The brief and capability remain in session storage until explicitly cleared
or discarded by the browser; expiration alone does not erase local storage.
Closing a tab can lose recovery. Shared browser sessions can expose it.
The capability is never placed in links or visible output. These are browser
storage properties, not an account-based recovery service.

## Verification

The browser suite adds actual lost-reply recovery after a committed server
write, reload and equality of room/token; explicit local cleanup; storage
failure with zero requests; expiry with zero requests and explicit discard;
and recovery after host deletion returning 410 without a replacement.
The stalled-request regression now keeps fresh publication disabled and
offers recovery. Existing file/paste/clipboard/claim/ZIP/byte-limit flows remain.

`git diff --check` passed. Combined build and Chromium verification will run
after the shared backend and this UI feature are merged, as requested.
No unexecuted browser result or public deployment is claimed here.

The preceding fixture correction passed all seven hosted jobs on exact main
`3809689e58838f5e5bc1ee84d20371aa73112ec7`:
[CI run 37081858377](https://github.com/taizhenC/grill_with_me/actions/runs/37081858377).
That result does not include this feature.
