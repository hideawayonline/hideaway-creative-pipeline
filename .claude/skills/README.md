# Vendored Claude Code skills

Project-level skills for the Hideaway creative pipeline. Claude Code picks
these up automatically for anyone working in this repo. All upstream sources
are MIT-licensed.

| Skill | Source | Vendored commit |
|---|---|---|
| `higgsfield/` (dispatcher + ~28 sub-skills) | [OSideMedia/higgsfield-ai-prompt-skill](https://github.com/OSideMedia/higgsfield-ai-prompt-skill) | `58c0542` |
| `threads-carousel/` | [itchernetski/threads-carousel-claude-skill](https://github.com/itchernetski/threads-carousel-claude-skill) | `cc775b6` |
| `ad-creative/`, `ads/`, `image/`, `copywriting/`, `copy-editing/`, `social/`, `video/`, `marketing-psychology/` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (creative-relevant subset of 46 skills) | `30dbd7f` |

Licenses: `higgsfield/LICENSE` and `threads-carousel/LICENSE` ship with their
skills; the marketingskills subset is covered by `MARKETINGSKILLS-LICENSE`.

To update a skill, re-clone its upstream repo and re-copy (drop `.git`).
For the full 46-skill marketingskills set on a personal machine, prefer the
plugin install instead of vendoring:
`/plugin marketplace add coreyhaines31/marketingskills` then
`/plugin install marketing-skills`.

Notes:
- `threads-carousel` needs a one-time `bun install` (or npm/pnpm) inside
  `threads-carousel/template/` before first use.
- The Higgsfield skill is the prompt-construction layer only; prompts are
  pasted into higgsfield.ai (or executed via Higgsfield's official CLI/MCP,
  see `higgsfield/README.md`).
