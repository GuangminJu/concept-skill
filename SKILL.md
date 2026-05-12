---
name: concept-mcp
description: Use a local Concept MCP server to align AI design and implementation work with a project's registered concepts, boundaries, and conflict-review workflow.
---

# Concept MCP

This repository is primarily an MCP server, with this skill file acting as a
Codex-facing wrapper for the concept-governed workflow.

Use the MCP tools in this order when a project exposes concept files or a
concept repository:

1. Call `concept_governance_activate` with the project id and concept files.
2. Call `concept_task_prepare` before design, analysis, or implementation.
3. If ownership or boundary conflicts appear, call `concept_conflict_validate`.
4. Record accepted proposed concepts with `concept_proposal_record`.
5. Record review outcomes with `concept_validation_decision_record`.

Treat `concept_conflict_validate` as candidate detection plus optional
independent semantic review. It is not a final architecture authority by itself.
