---
name: concept-skill
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

## New Project Concept Inventory

When applying Concept MCP to a new project that has no concept repository yet,
produce a concept inventory before proposing architecture or code changes.

Workflow:

1. Identify domain nouns, lifecycle states, actions, events, storage objects,
   runtime boundaries, editor/UI boundaries, and cross-cutting services.
2. Group repeated names and aliases into one candidate canonical concept.
3. Reject implementation details that do not own behavior or meaning.
4. For every candidate concept, write `id`, `name`, `kind`, `definition`,
   `boundary`, `layer`, `aliases`, `abstraction_level`, and `source_refs`.
5. Add relations that explain support, dependency, specialization, ownership,
   loading, serialization, validation, or interface exposure.
6. Mark uncertain concepts as `candidate` or `review-required`, not `accepted`.
7. Use `concept_proposal_record` to persist each concept when a writable
   repository is configured.

Inventory output should separate:

- accepted concepts with clear owners and source evidence
- candidate concepts that need more source evidence
- rejected terms that are only labels, implementation details, or aliases
- missing concepts required to explain current behavior

## Concept Authenticity Check

Before accepting a proposed concept, test whether it is a real project concept
or only a convenient label.

A real concept should pass most of these checks:

- It has a stable owner or boundary in the code, data model, workflow, or user
  domain.
- It explains behavior, lifecycle, state, identity, or responsibility that would
  otherwise be ambiguous.
- It has source evidence, not only a prompt-time invention.
- It is not just a concrete specialization that can be composed from generic
  lower-level concepts.
- It does not duplicate an existing canonical concept or alias.
- It can name supporting lower-level concepts when it is composite.
- Removing the concept name would make design discussion or implementation
  responsibility less clear.

If a concept fails these checks, record it as a rejected term or unresolved
candidate. Do not register it as accepted without human review.
