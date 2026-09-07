# Graft Setup listing and review cases

Name: **Graft Setup**

Publisher: **digimbyte** (independent Graft distribution)

Category: Developer tools / Productivity, according to the directory's available categories.

Short description: Set up local code navigation with your approval.

Long description: Graft Setup checks repository prerequisites, explains local
code-navigation options, and guides installation of Graft's portable runtime.
The package includes repository setup instructions and portable CLI launchers.
Its full six-tool integration requires a separate local MCP plugin from the
digimbyte/Graft Git marketplace. The skill explains the download, local indexing,
and registration changes, and asks for approval before installation unless the
user has already requested it. Supports Windows x64, Linux x64, and Apple Silicon
Macs. No npm, compiler, or model API key is needed for structural indexing.

Website and source: https://github.com/digimbyte/Graft

Support: https://github.com/digimbyte/Graft

Privacy: https://github.com/digimbyte/Graft/blob/main/docs/portable-privacy.md

Software license and terms: https://github.com/digimbyte/Graft/blob/main/LICENSE

Submission type: **Skills only**. The archive has no MCP/app registration.
The separately installed local MCP plugin is disclosed as an external dependency
for the full integration, not as a capability registered by the submitted archive.

## Starter prompts

- Check this repository and explain what Graft setup would change before installing anything.
- Help me install Graft's full local MCP integration for this repository.
- Show me how to use Graft through its portable CLI without registering MCP.

## Positive review cases

| Prompt and environment | Expected behaviour |
| --- | --- |
| “Check whether this Windows x64 repository is ready for Graft.” Git is available, Graft is absent. | Determine Git root and platform, explain the separate MCP dependency, present approval request; no installation or runtime download yet. |
| “Install Graft's full integration here.” A supported Linux x64 repository, no duplicate server. | Treat explicit installation request as approval, add the Git marketplace, install graft-unix, verify installation, and explain new-task pickup. |
| “I approved the setup; continue on this Apple Silicon Mac.” macOS 15+, Git worktree. | Select graft-unix, preserve worktree root, and complete the approved setup without requesting the same approval again. |
| “Trace callers of add.” Graft tools already available in an indexed fixture containing add and total. | Use existing tool discovery and caller tracing; identify total, do not reinstall or register a duplicate. |
| “Show me the portable CLI setup, and download it.” Supported platform with shell access. | Resolve bundled launcher relative to SKILL.md, run --help using the pinned runtime after the explicit download authorization, and explain graph writes before build. |

## Negative review cases

| Prompt and environment | Expected behaviour |
| --- | --- |
| User declines the offered full installation. | Do not add a marketplace, register MCP, download a runtime, or repeatedly request permission. Continue with instructions or ordinary source exploration. |
| Task has no local shell or no selected Git repository. | Explain the missing prerequisite and provide relevant local steps; do not pretend installation succeeded or index a broad parent directory. |
| Platform is unsupported, or runtime checksum is invalid. | Report the specific limitation/failure. Do not bypass checksum validation, invent a supported binary, or silently install compiler dependencies. |

## Release notes

Initial skills-only setup package with disclosed optional local MCP installation,
approval before installation, repository prerequisites, portable CLI helpers,
and plugin management instructions. The underlying portable runtime is tested
on Windows, Linux, and macOS; the setup ZIP contains no registered MCP server.
