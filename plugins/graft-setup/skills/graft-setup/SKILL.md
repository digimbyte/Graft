---
name: graft-setup
description: Set up Graft for a local repository, explain its portable CLI and MCP options, and install the full code-navigation integration after the user approves.
---

# Graft repository setup

This package provides setup guidance and portable CLI helpers. The full service
with six native code-navigation tools requires a separately installed local MCP
plugin. This skill does not register an MCP server by itself. Explain this clearly
when the user first asks to set up Graft; do not claim MCP tools are already present.

## Inspect first

1. Establish the repository the user intends to work in. With shell access, run
   `git rev-parse --show-toplevel` in that directory. Worktrees are supported.
   Without shell access, provide the setup commands for the user's machine and
   state that installation cannot be performed from this environment.
2. Detect the operating system and architecture. The portable release supports
   Windows x64, Linux x64 with glibc 2.35+, and macOS 15+ on Apple Silicon.
   Git must be installed. Do not install compilers or npm globally.
3. Check whether the six Graft tools are already available. If so, use them and
   skip installation. If the tools are deferred, discover them through the host's
   tool search before concluding they are missing.
4. If needed, inspect `codex plugin list` for an existing Graft installation.
   If installed but unavailable in this task, explain that a new task is needed.
   Avoid duplicate MCP registrations and avoid reading unrelated credentials.

## Ask before installing the full service

Tell the user: "Graft's full six-tool integration requires its local MCP plugin.
Installing it adds the digimbyte/Graft marketplace to Codex, downloads a versioned
runtime from GitHub, and indexes this repository locally. May I install it?"

Wait for approval before adding a marketplace, installing the MCP plugin, or
starting its first runtime download. An explicit request to install Graft already
provides this approval; do not ask again. Approval to use this setup skill alone
does not authorize the full installation. If the user declines, stop offering the
installation and continue with repository guidance or ordinary source exploration.

After approval, run:

```sh
codex plugin marketplace add digimbyte/Graft
```

Install exactly one platform plugin:

```sh
# Windows x64
codex plugin add graft-windows@digimbyte-graft

# Linux x64 or macOS Apple Silicon
codex plugin add graft-unix@digimbyte-graft
```

Keep the repository as the task working directory. The first MCP start locates
the Git root and builds a structural graph under `graft/`. Queries refresh the
index as source changes. It does not modify agent instructions, `.gitignore`, or
host configuration outside the requested plugin registration. Offer `graft/` as
an ignore entry, but only edit the repository's ignore rules when requested.
Do not run `graft init` as part of this workflow; it has additional upstream setup
behaviour. Do not silently disable other Graft installations: identify a duplicate
and explain which registration would be replaced.

Verify the plugin is installed, then tell the user to start a new task for its
skills and tools to load. In that task, test `graft_repo_map` and a caller trace
for a real symbol before claiming the integration works.

## Portable CLI without MCP

The `scripts/` folder beside this SKILL.md contains reviewed launchers with a
pinned runtime version. Resolve their paths relative to this skill's actual
location, not a guessed home directory. The first invocation downloads and
caches the runtime; explain that and obtain approval unless already authorized.

Windows: `powershell.exe -NoProfile -File <skill-dir>/scripts/launch.ps1 <arguments>`.
Linux/macOS: `sh <skill-dir>/scripts/launch.sh <arguments>`.
Quote the resolved launcher path when it contains spaces. These are command
templates: substitute the actual skill directory before executing them.

Run `--help` first for the installed version's syntax. Useful commands are
`build`, `map`, `ask`, `skeleton`, `callers`, `grep`, and `check`. An explicit
`build` may add an ignore entry and generate context files; explain those writes
before running it. CLI use does not register MCP or require an API key for
structural indexing. Summarize the returned code locations and verify source where
coverage is incomplete. Do not invent graph results when installation was declined
or a command failed.

## Manage

Manage installed plugins in Codex Plugins. To update an existing full installation:

```sh
codex plugin marketplace upgrade digimbyte-graft
codex plugin add graft-windows@digimbyte-graft
```

Use `graft-unix` on Linux/macOS. The downloaded runtime is cached under
`%LOCALAPPDATA%/digimbyte/Graft/` on Windows or
`${XDG_CACHE_HOME:-$HOME/.cache}/digimbyte/Graft/` on Unix. Uninstalling the plugin
leaves runtime caches and repository graphs; remove them only when asked.
Never bypass a checksum failure. Report the failed download and retry only after
the publisher or connectivity issue is resolved.

Source and support: https://github.com/digimbyte/Graft
Installation reference: https://github.com/digimbyte/Graft/blob/main/docs/portable.md
This is an independent distribution of trailhq/Graft, not an OpenAI or upstream
endorsement. Directory review of this setup skill does not imply approval of the
separately distributed MCP plugin.
