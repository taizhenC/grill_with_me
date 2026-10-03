# Product README — 2026-10-02

The root README is now written for someone deciding whether Grill With Me
fits their team. It leads with the problem and benefits, names the audience,
describes the team experience in plain language and gives a concrete example.
It ends with host/member next steps and a short explanation of room sharing
and the use of each person's own AI agent.

## Documentation changes

- Replaced command listings, file inventories and deployment details in the
  README with product explanations and links to next steps.
- Preserved the previous detailed walkthrough as `doc/getting-started.md`,
  adjusting relative links for its new location.
- Pointed the CLI package README to that setup guide.
- Retained the live hosted app, locally installed CLI requirement and pending
  npm release status, without promising automatic agreement or AI correctness.

The technical implementation is unchanged. The copy is grounded in the existing
host, member, merge, check and amendment workflows. Documentation links and
structure are verified on the merged checkpoint; the existing CI remains the
regression check for the application and CLI.
