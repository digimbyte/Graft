# Graft Setup privacy

Graft Setup is distributed by digimbyte as a local setup skill and portable
distribution of [Graft](https://github.com/trailhq/Graft).

The setup skill contains instructions and scripts. Installing the skill alone
does not start an MCP server, download the portable runtime, or index a repository.
It explains those actions and requests approval before installing the full local
MCP integration or initiating a first runtime download, unless the user already
explicitly requested that installation.

After approval, GitHub serves the marketplace files and versioned runtime assets.
These network requests disclose ordinary connection information to GitHub, such
as the requesting IP address and requested resource. GitHub's own privacy terms
apply to those requests. No repository upload is required for structural indexing.

Graft reads source files in the selected local repository and stores a structural
index under its `graft/` directory. The portable runtime is cached in the user's
local cache directory. Code search and caller tracing return source excerpts,
file locations, and relationships to the assistant host running the task. That
host's own data handling and privacy terms apply to material included in the
conversation or sent to its model.

The portable launchers set `DO_NOT_TRACK=1`. This distribution does not operate
a hosted code-indexing service or collect repository contents through a publisher
telemetry endpoint. Explicit upstream CLI features beyond structural indexing
may use services configured by the user; their behaviour should be reviewed
before use.

Uninstalling the plugin removes the plugin registration/cache managed by Codex.
Runtime downloads and repository graphs remain locally until the user removes
them. See [installation and management](portable.md) for their locations.

Support and source: https://github.com/digimbyte/Graft
