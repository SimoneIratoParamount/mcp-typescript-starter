# Review Orchestrator — Design Spec

## Overview

An event-driven code review orchestrator that runs as a persistent Claude session. It polls GitHub for PRs requesting your review on the current repo, and spawns dedicated review agents in cmux panes — each running `/review` to present findings and await your instructions.

## Entry Point

A standalone shell script `review-orchestrator`, run from within a project directory:

```bash
#!/bin/bash
POLL_INTERVAL="${REVIEW_POLL_INTERVAL:-6}" \
MAX_CONCURRENCY="${REVIEW_MAX_CONCURRENCY:-3}" \
cmux claude-teams --prompt "/start_reviewing_team"
```

### Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `REVIEW_POLL_INTERVAL` | `6` | Minutes between GitHub API polls |
| `REVIEW_MAX_CONCURRENCY` | `3` | Max concurrent review agent panes |

## Orchestrator Skill: `/start_reviewing_team`

A Claude Code skill that drives the orchestrator session.

### Initialization

1. Detect current repo via `gh repo view --json nameWithOwner`
2. Detect GitHub user via `gh api user --jq '.login'`
3. Initialize in-memory state: active reviews map, queue, completed list
4. Load existing review log from `.claude/review-log.json` if present (to avoid re-dispatching completed reviews)
5. Print startup banner with repo name, poll interval, max concurrency

### Polling Loop

Every `POLL_INTERVAL` minutes:

1. Run `gh api` to fetch PRs where the user is a requested reviewer, filtered to the current repo
2. Compare against dispatched + completed sets
3. For each new PR:
   - If active review count < `MAX_CONCURRENCY`: spawn a review agent
   - Otherwise: add to queue, print queued status
4. Sleep for `POLL_INTERVAL` minutes
5. Repeat

### Spawning a Review Agent

1. Open a new cmux pane with cwd set to the current project directory
2. Start a Claude session with a prompt:
   - Identifies the PR (number, URL, title, author)
   - Instructs the agent to run `/review` on the PR
   - Instructs the agent to **present findings only** — no comments posted, no code changes, no fixes applied
   - Instructs the agent to wait for user instructions before taking any action
   - Instructs the agent to `SendMessage` back to the orchestrator with a summary when the user indicates the review is complete
3. Track the pane ID and dispatch time in active reviews map

### Completion Flow

1. Review agent receives user signal that review is complete (e.g., "review complete", "done")
2. Agent sends `SendMessage` to orchestrator with:
   - PR number
   - Outcome (approved, changes requested, etc.)
   - Key findings summary
3. Orchestrator receives message, then:
   - Logs the review to `.claude/review-log.json`
   - Removes PR from active reviews
   - Auto-closes the cmux pane
   - If queue is non-empty, dispatches the next queued PR
   - Prints status update

### Concurrency Management

- Active reviews tracked by PR number -> pane ID mapping
- When active count reaches `MAX_CONCURRENCY`, new PRs are queued (FIFO)
- When a slot frees up (review completed + pane closed), next queued PR is dispatched
- Orchestrator prints queue status when PRs are queued or dequeued

## Review Log

Written to `.claude/review-log.json` in the project directory. Array of entries:

```json
{
  "pr": 42,
  "repo": "owner/repo",
  "title": "Add feature X",
  "url": "https://github.com/owner/repo/pull/42",
  "author": "username",
  "dispatched_at": "2026-04-01T10:30:00Z",
  "completed_at": "2026-04-01T11:15:00Z",
  "outcome": "approved",
  "summary": "Clean implementation, minor suggestion on error handling"
}
```

## Orchestrator Status Output

The orchestrator prints to its own pane:

- Startup: repo name, config, loaded log
- Each poll cycle: number of new PRs found, dispatched, queued
- Spawn events: PR number, title, pane ID
- Completion events: PR number, outcome, summary
- Queue changes: PR added/removed from queue

## Components

| Component | Type | Location |
|-----------|------|----------|
| `review-orchestrator` | Shell script | `~/bin/` or project root |
| `/start_reviewing_team` | Claude Code skill | `.claude/skills/start_reviewing_team.md` |
| Review agent prompt | Inline in skill | Generated per-PR by orchestrator |
| Review log | JSON file | `.claude/review-log.json` |

## Out of Scope

- Watching multiple repos from a single orchestrator
- Auto-posting review comments
- Auto-applying fixes
- Webhook-based triggers
