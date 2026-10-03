# Grill With Me

**Turn separate AI conversations into one shared team agreement.**

Your team is building the same product, but everyone is working with their own
AI. One person assumes the search results include a description. Another builds
them with just a title. Both pieces look right on their own. The mismatch shows
up when you put them together.

Grill With Me helps you have those conversations earlier. Each teammate answers
focused questions about their part of the project, and the team brings the
answers together into a shared plan for building.

**[Open Grill With Me](https://grill-with-me.vercel.app)** ·
[Setup guide](doc/getting-started.md)

## What your team gets

- **Clear ownership.** Make it clear who is building what and where teammates
  depend on each other.
- **Better questions before coding.** Work through scope, decisions and open
  questions with your own AI agent.
- **One agreement to build against.** Bring each person's plan into a shared
  contract: a written agreement about how the pieces fit together.
- **A way to spot mismatches.** Ask your agent to compare the implementation
  with that agreement and show where things have drifted.
- **A record of changes.** Update the agreement as the project evolves and keep
  decisions awaiting a teammate's approval visible.

## Who it's for

Small teams building in parallel with AI coding agents: hackathon teams,
side projects and teams starting a new product or feature.

It's especially useful when each person understands their own part, but the
team hasn't yet agreed on the handoffs between them.

## The team experience

1. **Start with the project.** One person hosts the room. Their AI agent asks
   about the goal, what must work, what's out of scope and the roles the team needs.
2. **Invite the team.** Publish the project brief and share the room link.
   Teammates choose their roles.
3. **Talk through your part.** Each person works with their own agent to clarify
   what they will build, what they need from others and what's still undecided.
4. **Bring the plans together.** The host's agent reads everyone's plans and
   helps assemble the shared agreement. The team resolves conflicting answers.
5. **Keep it useful while building.** Review the code against the agreement.
   Fix a mismatch or update the agreement when the team changes direction.

The AI helps ask questions and compare plans. The people doing the work decide
what they agree to.

## A conversation you can have before integration

Imagine you're building a team directory.

The person building the screen needs a name, photo and job title for each
teammate. The person providing the data has planned for only names.

Grill With Me helps put both expectations in front of the team. You can agree
to supply the missing details or simplify the screen, then write down that
decision so both people build toward the same result.

## Get started with your team

**Starting a project?** Follow the [setup guide](doc/getting-started.md) to
prepare your host tools, define the project and share a room.

**Already have a room link?** Open it, choose your role and follow the member
steps in the [setup guide](doc/getting-started.md) to work with your agent.

The hosted app is live. Team setup currently uses a locally installed CLI;
the npm release is still pending. The setup guide covers the available route.

## Your own agent, your own project

You don't need a Grill With Me account. Interviews and code reviews happen
through your own configured AI agent.

The room service stores the project brief, roles and submitted display names.
Your code, role plans and shared contract stay in your team's checkout.
Anyone with the room link can read the brief and submit role claims, so share
it within your team. Rooms expire after 30 days.

Read [privacy and retention](doc/privacy-and-retention.md) for the details.

---

[Setup and technical guides](doc/getting-started.md) ·
[Examples](examples/) ·
[Feedback and issues](https://github.com/taizhenC/grill_with_me/issues)
