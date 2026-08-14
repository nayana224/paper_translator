# AGENTS.md

## Purpose

Keep changes simple, reviewable, and safe. Treat this file as the map: follow
its core rules, then open only the guide directly relevant to the task.

Canonical instruction repository:
`https://github.com/nayana224/my_instruction`

## Priority

When rules conflict, follow this order:

1. Safety and correctness
2. Existing project conventions and public interfaces
3. This file
4. Relevant guides in `nayana224/my_instruction`
5. Formatter defaults

## Core workflow

- Inspect the relevant code and existing conventions before editing.
- Make the smallest change that satisfies the request.
- Do not refactor, rename, reformat, or clean up unrelated code.
- Preserve public interfaces and saved-data formats unless every affected user is updated together.
- For non-trivial or multi-file work, state the plan and likely files first.
- After editing, report changes, validation, behavior impact, and remaining risk.

## Scope and simplicity

- Prefer explicit code with the fewest concepts needed for the current task.
- Add abstractions only when they reduce total reasoning, testing, or change cost.
- Do not design for hypothetical future reuse.
- Keep cohesive code together; do not extract trivial pass-through helpers.
- Validate untrusted data once at a clear boundary.
- Do not commit credentials, tokens, private keys, passwords, or sensitive URLs.

## Code and documentation

- Follow existing project style before introducing a new convention.
- Keep identifiers, API names, units, and technical terms in English.
- Write comments and docstrings in concise, natural Korean.
- Explain reasons, constraints, ordering, workarounds, or safety implications; do not repeat obvious code.
- Use the latest `docs/code-style.md`, `docs/python-docstring-style.md`, and
  `docs/documentation-style.md` from the canonical instruction repository when relevant.
- Keep one detailed canonical document per topic and link to it instead of copying details.

## Validation

- Run the most relevant checks already available in the project environment.
- Start with the smallest useful validation scope and expand only when needed.
- Test relevant behavior, boundaries, state transitions, and failure paths.
- Do not weaken assertions only to make tests pass.
- Record checks that could not run and the remaining risk.

## Commits and reviews

- Use `<type>: <한글 요약>` for commits.
- Keep one logical change per commit.
- Review actual behavior and concrete risks before style-only issues.
