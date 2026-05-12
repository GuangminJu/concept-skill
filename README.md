# concept-mcp-monorepo

Concept MCP is a vendor-neutral MCP server for concept-governed AI workflows.
It is not only a Codex skill: the root `SKILL.md` is a lightweight Codex wrapper,
while the primary runtime is the MCP stdio server in `@concept-mcp/server`.

Publishable monorepo layout for a vendor-neutral concept ontology MCP system.

## Packages

- `@concept-mcp/core`
  - concept types
  - conflict detection
  - review contract schemas
  - concept-aware task preparation contracts
- `@concept-mcp/server`
  - MCP stdio server and writable concept record tools
  - tool wiring
  - repository abstraction
- `@concept-mcp/host-adapters`
  - Claude / Codex / Copilot host launch request builders
- `@concept-mcp/storage-file`
  - file-backed ontology repository
- `@concept-mcp/storage-sqlite`
  - SQLite-backed ontology repository

## Install

```bash
npm install
```

## Build all packages

```bash
npm run build
```

## Start the MCP server

```bash
npm run dev:server
```

## Self concept registry

The server includes a self-describing concept registry:

```text
packages/server/data/concept-skill.json
```

Use project id `concept-skill` with `CONCEPT_MCP_REPOSITORY=demo` to inspect the
Concept MCP system with its own concept-governed workflow.

## Codex MCP setup

This repository can be registered as a local Codex MCP server after dependencies
are installed and the TypeScript packages are built.

Use Node.js 22 LTS for the install/build step. Newer Node releases may require
building `better-sqlite3` from source if a prebuilt binary is not available.

```bash
npm install
npm run build
```

Example Codex config:

```toml
[mcp_servers.concept-skill]
command = "node"
args = ["D:/XXSimSource/xxsim2/concept-skill/packages/server/dist/index.js"]
type = "stdio"
enabled = true
env = { CONCEPT_MCP_REPOSITORY = "demo" }
```

Restart Codex after updating the MCP config.

## Repository backends

The server supports three repository modes:

- `demo` - built-in demo dataset
- `file` - JSON file repository
- `sqlite` - SQLite repository

Examples:

```bash
CONCEPT_MCP_REPOSITORY=file CONCEPT_MCP_FILE_ROOT=./ontology npm run dev:server
```

```bash
CONCEPT_MCP_REPOSITORY=sqlite CONCEPT_MCP_SQLITE_PATH=./ontology.db npm run dev:server
```

## Release flow

The monorepo is prepared for Changesets-based versioning and publish automation.

- create a release note with `npm run changeset`
- update versions with `npm run version-packages`
- publish with `npm run release`

CI and release workflow skeletons are provided under:

```text
.github/workflows/
```

## Design rule

The MCP server never launches analysis agents itself. It returns a structured
`agent_review_request`, and the host AI is responsible for opening an
independent agent/context to perform semantic conflict analysis.

## Concept-aware workflow

Use `concept_task_prepare` before design, reasoning, or implementation when you
want the host AI to stay aligned with the engine ontology.

The tool returns:

- the relevant concept snapshot
- a required workflow for concept-first reasoning
- an execution prompt that forces the host AI to:
  - map the task to existing concepts first
  - propose missing concepts explicitly before using them
  - surface concept ambiguity instead of silently collapsing boundaries
  - implement only after concept ownership is clear

`concept_conflict_validate` detects structural conflict candidates. Treat its
output as candidate detection plus optional independent semantic review, not as
the final architecture decision by itself.

Recommended flow:

1. If the project exposes concept files, call `concept_governance_activate`.
2. Use the returned policy to enter concept-governed mode.
3. Call `concept_task_prepare` for each concrete design / analysis / implementation task.
4. Run the returned prompt in the host AI or a delegated agent.
5. If new or overlapping concepts appear, call `concept_conflict_validate`.
6. Only then proceed with architecture or code changes.

### Concept-file trigger

When a project contains concept files, the host AI should treat them as
authoritative and switch into concept-governed mode.

In that mode, the host AI must:

- read concept files first
- call `concept_task_prepare` before design / analysis / implementation
- propose missing concepts explicitly before using them
- call `concept_conflict_validate` when concept ownership is ambiguous
- avoid silently inventing or overloading concepts in code
