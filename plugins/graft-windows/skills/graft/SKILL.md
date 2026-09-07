---
name: graft
description: Search code, inspect APIs, map repositories, and trace callers using the Graft tools.
---

Use the six Graft MCP tools for targeted code exploration. The first start indexes
the current Git repository locally, including worktrees. Later queries refresh
the graph as source changes. No model API key is needed for structural indexing.

Use graft_repo_map to orient, graft_find_code to find definitions, graft_file_api
to inspect signatures, graft_trace_calls to trace dependencies, graft_find_all
for indexed text search, and graft_check_freshness to inspect drift. Check source
and use ordinary file search where graph coverage is incomplete. Respect the
repository's existing instructions and requested change scope.

If the task has no Git repository, Graft may expose no tools. Start a task in the
intended repository; do not index a broad parent folder automatically.

The runtime downloads once per plugin release and is cached locally. Updating the
plugin selects its pinned runtime; do not run npm upgrade or graft init to manage
this plugin. It does not install global hooks or rewrite agent instruction files.
For manual CLI use, run this plugin's launch.ps1 with normal Graft arguments.
Windows uses PowerShell -File; Unix uses sh. Keep the task working directory.

Disable or uninstall through Codex Plugins. Runtime caches and repository graphs
remain on disk for reuse; remove only the specific cache when requested.
