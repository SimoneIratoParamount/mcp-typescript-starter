# AI Tool Dependencies

Both Claude Code and Cursor must have the **superpowers** plugin enabled to work effectively in this repo. Superpowers provides skill-based workflows for brainstorming, planning, TDD, debugging, and code review.

## Claude Code

`superpowers` must be listed in `.claude/settings.local.json`:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  }
}
```

## Cursor

The superpowers agent must be present in `.cursor/agents/superpowers/`.

If it is missing, install it via the Cursor plugin marketplace before proceeding with any implementation work in this repo.
