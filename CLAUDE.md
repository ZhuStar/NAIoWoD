# NAIoWoD — session bootstrap

World of Darkness (Dark Ages) rules engine for NovelAI scripting; the AI will
be the Storyteller. TypeScript, run/tested with **Bun** (no npm install).

## FIRST: restore your memory

**Read `docs/memory.md` before doing anything else.** It is the project's
externalized memory: the fine-grained map of every module/class/function, all
persistent state (storage keys, lorebook entries), every design decision WITH
its rationale, the command surface, testing conventions, and the full roadmap
of what is not yet built. This repo has outlived its original conversation;
that file is the only complete record.

## THE STANDING RULE: keep the memory current

Any commit that changes behavior, architecture, commands, data shapes, or the
roadmap **must update `docs/memory.md` in the same commit** (including its
"Last synced" commit reference). If `git log` shows commits newer than that
reference, reconcile the memory file before starting new work.

## Commands

```bash
bun test            # full suite (includes the dist-sync test)
bun run typecheck   # tsc --noEmit
bun run build       # regenerate dist/naiowod.ts (REQUIRED after any src/ change)
```

## Non-negotiables (details & rationale in docs/memory.md §2–3)

- `dist/naiowod.ts` is a committed, readable, paste-ready single-file build;
  `bun run build` before pushing or the suite fails. It must start with `//`
  comments — never `/*---` frontmatter.
- Verification before every push: build → test → typecheck → standalone
  type-check of the artifact → import-purity check (`import ./src/index.ts`
  prints nothing) → a live `init()` e2e.
- Work lands on `main` via fast-forward push (owner's explicit workflow).
  No PRs unless asked. Commit trailers as in the existing git log.
- Everything is data: game rules live in `src/rules.ts` and player-editable
  lorebook entries (instructions above the `=====` marker, data below).
  When a needed subsystem doesn't exist (turns, targeting), store the config,
  surface it, and mark it "(ST-enforced)" — never block on it.
- Mark back-compat shims `@deprecated`; plan work in plan mode and confirm
  genuine forks with the user before big passes.
