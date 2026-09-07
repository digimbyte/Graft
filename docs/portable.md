# Portable Graft for Codex

This fork adds a Codex plugin marketplace and versioned runtimes to
[trailhq/Graft](https://github.com/trailhq/Graft). Node and compiled parser
dependencies travel with the runtime. Installing the plugin does not require npm,
Python, a compiler, an API key, or an existing Graft installation.

## Install

Add this GitHub marketplace once on each Codex installation:

```sh
codex plugin marketplace add digimbyte/Graft
```

Then install **one** plugin for the machine running the task:

```sh
# Windows x64
codex plugin add graft-windows@digimbyte-graft

# Linux x64 or macOS Apple Silicon
codex plugin add graft-unix@digimbyte-graft
```

The entries also appear in Codex's Plugins interface after adding the marketplace.
Disable any previous Graft MCP registration or plugin to avoid duplicate servers.
Start a new task in a Git repository to load the tools. The first start downloads
the pinned release, checks its SHA-256 checksum, and builds a local structural
index. Subsequent starts reuse the runtime; queries refresh changed code.

Supported targets are Windows x64, Linux x64 with glibc 2.35 or newer, and macOS
15 or newer on Apple Silicon. Git must be available. Windows uses built-in
PowerShell and tar; Unix uses sh, curl, tar, and sha256sum or shasum. Alpine/musl,
Linux ARM64, Windows ARM64, and Intel Macs do not have release bundles yet.
The initial download requires access to GitHub Releases. Structural indexing
and queries run locally after that download.

## Manage and update

Use Codex **Plugins** to inspect or uninstall the installed plugin. To fetch a
new marketplace release from the command line:

```sh
codex plugin marketplace upgrade digimbyte-graft
codex plugin add graft-windows@digimbyte-graft
```

Use `graft-unix` in the second command on Linux/macOS. Start a new task after
updating. Plugin versions pin an immutable runtime release; launchers never
select an unreviewed "latest" binary or update the global npm package.

Runtime caches are separate from Codex's plugin registry:

| Platform | Runtime cache |
| --- | --- |
| Windows | `%LOCALAPPDATA%/digimbyte/Graft/<release>/` |
| Linux/macOS | `${XDG_CACHE_HOME:-$HOME/.cache}/digimbyte/Graft/<release>/` |

Set `GRAFT_PORTABLE_CACHE` to choose another cache base. A repository's structural
index lives under `graft/`. Uninstalling the plugin leaves those caches in place;
they can be removed separately when no Graft process is using them. If an install
reports an incomplete runtime, move that specific release's runtime directory
aside and retry. The next launch downloads it again.

## Behaviour

The plugin exposes Graft's six MCP tools for code search, file APIs, caller
tracing, repository maps, indexed text search, and freshness checks. It locates
the nearest Git root, including worktrees, when a task starts in a subdirectory.
Without a Git repository it does not create an index automatically.

The portable MCP entry point performs structural indexing only. It does not
install global hooks or update `.gitignore`, agent instructions, or other host
configurations. Add `graft/` to your repository's ignore rules if desired.
Telemetry is disabled by the launchers. Normal upstream CLI commands remain
available by passing their arguments to `launch.ps1` or `launch.sh`; explicit
commands such as `init` retain their upstream behaviour.

## Build and release

Maintainers need Node **24.11.1**, Git, and the platform's C++ build tools.

```sh
npm ci
node scripts/portable/generate-plugins.mjs
node scripts/portable/build.mjs
node scripts/portable/test.mjs
```

Builds include production dependencies, their license files, the upstream MIT
license and credits, and Node's license. Source dependencies remain pinned by
`package-lock.json`. Runtime metadata records the source commit and Node version.
Checksums detect corrupted downloads; they are delivered by the same GitHub
release and are not an independent publisher signature.

The **Portable runtimes** workflow builds and tests all three platform bundles.
A manual run on `main` publishes the tag in `scripts/portable/config.json` only
after every platform passes. Release assets are not overwritten: change the
plugin version/tag and release notes before the next release, regenerate the
plugins, and commit the result. Keep the Node version in the workflow and build
configuration aligned. Rebuild in a new output directory if a stage already
exists (pass a directory to `build.mjs` and its runtime path to `test.mjs`).

This is a third-party Git marketplace. Inclusion in OpenAI's curated plugin
directory is a separate submission and review process.
