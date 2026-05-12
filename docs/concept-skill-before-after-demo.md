# Concept Skill Before/After Demo

Date: 2026-05-12
Repository under test: `D:\XXSimSource\xxsim2\concept-skill`
Concept file under test: `packages/server/data/concept-skill.json`

This is a functionality reality check for the repository's own concept-governed workflow. It uses the real `SKILL.md`, the real `packages/server/data/concept-skill.json` registry, and the real server/storage code paths for record persistence.

## Scenario under test

Task used for the demo:

```text
Plan adding a writable review-status dashboard and a new persistent decision API for conflict reviews.
Constraint: Do not collapse host adapter responsibilities into server persistence.
```

This scenario is intentionally risky because a normal feature-planning pass could treat dashboard, persistent decision API, host launch/review, and recording as one feature surface. In this repo those are separate concepts and boundaries.

## BEFORE: normal agent or code-review pass without concept governance

A conventional planning or review pass would likely infer this plan:

1. Add a new server endpoint or MCP tool for review status.
2. Store review decisions in the repository backend.
3. Update host adapters to expose the dashboard-oriented workflow.
4. Add docs and tests around the new behavior.

What that pass would miss:

1. It would not necessarily identify `host-adapter` as an interface concept that renders prompts and launch requests, not an MCP runtime launcher or persistence owner.
2. It could silently invent a concept such as `Review Status Dashboard` without checking whether it is a real domain concept, a UI feature, or a composition of existing lower-level concepts.
3. It could collapse `concept-recording` and `concept-repository` into one responsibility, even though recording is the action/workflow and repository is the storage boundary.
4. It might miss that independent semantic review is deliberately host-owned. The README says the MCP server returns `agent_review_request`; it does not launch analysis agents itself.
5. It would probably not record whether a new concept was accepted, rejected, or human-review-required.

Concrete miss found during the governed run: when `concept_task_prepare` was called with a requested id named `concept-validation-decision`, the tool returned only the three existing concepts: `concept-repository`, `concept-recording`, and `host-adapter`. The current implementation filters unknown ids out without reporting them. A normal pass could proceed as if that concept existed.

## AFTER: concept-skill workflow applied

The repository's `SKILL.md` requires this order:

1. Activate concept governance with concept files.
2. Call `concept_task_prepare` before design, analysis, or implementation.
3. Run `concept_conflict_validate` when ownership or boundary conflicts appear.
4. Record accepted proposed concepts with `concept_proposal_record`.
5. Record review outcomes with `concept_validation_decision_record`.

### Governance activation result

Executed through the real TypeScript tool implementation using `conceptGovernanceActivate`.

```json
{
  "concept_governed": true,
  "workflow_count": 6,
  "actions": [
    "enter_concept_governed_mode",
    "read_concept_files_first",
    "call_concept_task_prepare",
    "call_concept_conflict_validate_if_needed"
  ]
}
```

Effect on planning: the task cannot start by designing packages or APIs. It must first map to registered concepts.

### Task preparation result

Executed through the real TypeScript tool implementation using `DemoConceptRepository` and `conceptTaskPrepare`.

Requested concept ids:

```json
[
  "concept-recording",
  "concept-repository",
  "concept-validation-decision",
  "host-adapter"
]
```

Observed result summary:

```json
{
  "task_id_prefix": "concept-skill:task:design:<timestamp>",
  "summary": {
    "project_id": "concept-skill",
    "mode": "design",
    "concept_count": 3,
    "relation_count": 15
  },
  "concepts": [
    "concept-repository",
    "concept-recording",
    "host-adapter"
  ],
  "actions": [
    "map_task_to_concepts",
    "propose_missing_concepts",
    "validate_conflicts_if_needed",
    "implement_after_concept_alignment"
  ]
}
```

Concept mapping produced by the governed pass:

| Task concern | Owning registered concept | Boundary consequence |
| --- | --- | --- |
| Persisting review decisions | `concept-recording` | Recording is the workflow/action. Do not model it as the storage layer itself. |
| Storage of concepts, relations, proposals, decisions | `concept-repository` | File/sqlite backends own persistence shape and mutability. |
| Rendering host-specific prompts or launch request shapes | `host-adapter` | Host adapter should not own MCP runtime tool behavior or persistence. |
| New review-status dashboard | No accepted concept | Must be proposed or rejected as UI-only terminology before design relies on it. |
| Validation decision as a first-class concept | No accepted concept with id `concept-validation-decision` | Current type exists in code, but the concept registry does not register it as canonical. |

### Conflict validation result

Executed through the real TypeScript tool implementation using `DemoConceptRepository` and `conceptConflictValidate`.

```json
{
  "validation_id_prefix": "concept-skill:validation:<timestamp>",
  "summary": {
    "project_id": "concept-skill",
    "validated_concept_count": 10,
    "candidate_count": 3,
    "highest_severity": "high"
  },
  "need_agent_review": true,
  "actions": ["launch_independent_agent", "record_validation"]
}
```

Conflict candidates returned:

| Candidate | Type | Severity | Interpretation |
| --- | --- | --- | --- |
| `boundary:concept-repository:concept-recording` | `boundary-overlap` | `high` | Expected overlap in write/persistence language. Needs semantic decision, not automatic merge. |
| `boundary:concept-task-preparation:concept-governance-policy` | `boundary-overlap` | `medium` | Preparation and policy share workflow language. Likely acceptable but should be acknowledged. |
| `boundary:concept-task-preparation:agent-review-request` | `boundary-overlap` | `high` | Preparation and review request both package host actions. Needs boundary clarity. |

The important after-state is not that the detector is always right. The tool describes these as conflict candidates. The host should launch independent review if policy requires it, then persist the resulting decision.

## Concept inventory example

Inventory candidate: `Validation Decision Record`

```json
{
  "id": "validation-decision-record",
  "name": "Validation Decision Record",
  "kind": "value-object",
  "definition": "Persisted decision about a conflict validation candidate, including judgment, rationale, reviewer identity, and timestamp.",
  "boundary": "Decision payload and persisted audit record for concept conflict validation outcomes; not the conflict detector and not the repository backend.",
  "layer": "data",
  "aliases": ["review decision", "conflict decision"],
  "abstraction_level": "foundational",
  "status": "candidate",
  "source_refs": [
    "source://packages/core/src/types.ts#ConceptValidationDecisionRecord",
    "source://packages/server/src/tool.ts#conceptValidationDecisionRecord",
    "source://packages/storage-file/src/index.ts#recordValidationDecision"
  ],
  "supported_by": ["concept-recording", "concept-repository"]
}
```

Inventory classification:

| Term | Classification | Reason |
| --- | --- | --- |
| `Validation Decision Record` | Candidate concept | It has a stable TypeScript interface and persisted JSON collection, but is not in the canonical concept registry. |
| `Review Status Dashboard` | Review-required or rejected term | No source evidence of a dashboard boundary in this repo; currently a feature/UI label, not a registered concept. |
| `Writable Decision API` | Rejected as canonical concept name | It describes an implementation surface. It should map to `concept-recording` plus repository backend behavior. |

## Concept authenticity check example

Proposed term: `Review Status Dashboard`

| Check | Result |
| --- | --- |
| Stable owner or boundary in code/data/workflow/user domain | Fails. No dashboard package, UI boundary, or accepted concept exists in the repo. |
| Explains behavior, lifecycle, state, identity, or responsibility | Weak. It names a UI view, not the underlying responsibility. |
| Has source evidence | Fails for current repo state. |
| Not just a concrete specialization | Fails. It appears to specialize existing `conflict-candidate-detection`, `agent-review-request`, and `concept-recording` behavior. |
| Does not duplicate existing canonical concept or alias | Partially passes. It is not a direct duplicate, but overlaps existing review/recording concepts. |
| Can name supporting lower-level concepts | Passes if treated as composite: `conflict-candidate-detection`, `agent-review-request`, `concept-recording`, `concept-repository`. |
| Removing the name makes responsibility less clear | Fails for current design. Existing concept names are clearer. |

Decision: do not accept `Review Status Dashboard` as a canonical concept. Record it as rejected or review-required unless the repository gains a real UI/dashboard boundary.

## Record semantics exercised with writable file repository

The recording semantics were exercised through the real `FileConceptRepository`, `conceptProposalRecord`, and `conceptValidationDecisionRecord` code paths. The test copied the self concept registry into a temporary file repository, wrote a candidate concept proposal, then wrote a validation decision.

Observed summaries:

```json
{
  "proposal_summary": {
    "recorded": true,
    "concept_id": "record-semantics-demo",
    "relation_count": 1
  },
  "decision_summary": {
    "recorded": true,
    "validation_id": "concept-skill:validation:demo-before-after",
    "candidate_id": "concept-inflation:record-semantics-demo",
    "recorded_at_present": true
  }
}
```

Expected persisted JSON shape in `<CONCEPT_MCP_FILE_ROOT>/concept-skill.json`:

```json
{
  "project_id": "concept-skill",
  "concepts": [
    {
      "id": "record-semantics-demo",
      "name": "Record Semantics Demo",
      "kind": "action",
      "definition": "Temporary demonstration concept used to verify file-backed proposal persistence semantics.",
      "boundary": "Documentation/demo evidence only; not an accepted product concept.",
      "layer": "application",
      "aliases": ["record demo"],
      "status": "candidate",
      "source_refs": ["source://docs/concept-skill-before-after-demo.md"],
      "abstraction_level": "specialized",
      "supported_by": ["concept-recording", "concept-repository"]
    }
  ],
  "relations": [
    {
      "from": "record-semantics-demo",
      "type": "uses",
      "to": "concept-recording"
    }
  ],
  "concept_proposals": [
    {
      "project_id": "concept-skill",
      "concept": {
        "id": "record-semantics-demo",
        "name": "Record Semantics Demo",
        "kind": "action",
        "definition": "Temporary demonstration concept used to verify file-backed proposal persistence semantics.",
        "boundary": "Documentation/demo evidence only; not an accepted product concept.",
        "layer": "application",
        "aliases": ["record demo"],
        "status": "candidate",
        "source_refs": ["source://docs/concept-skill-before-after-demo.md"],
        "abstraction_level": "specialized",
        "supported_by": ["concept-recording", "concept-repository"]
      },
      "relations": [
        {
          "from": "record-semantics-demo",
          "type": "uses",
          "to": "concept-recording"
        }
      ],
      "rationale": "Exercise concept_proposal_record through the real file repository write path.",
      "proposed_by": "codex-demo"
    }
  ],
  "validation_decisions": [
    {
      "project_id": "concept-skill",
      "validation_id": "concept-skill:validation:demo-before-after",
      "candidate_id": "concept-inflation:record-semantics-demo",
      "judgment": "needs-human-decision",
      "rationale": "The temporary concept is valid as a demo artifact but should not be accepted into the canonical registry without maintainer approval.",
      "decided_by": "codex-demo",
      "recorded_at": "<ISO timestamp>"
    }
  ]
}
```

Equivalent MCP server configuration for the same writable repository mode:

```powershell
$env:CONCEPT_MCP_REPOSITORY = "file"
$env:CONCEPT_MCP_FILE_ROOT = "D:\path\to\concept-repo"
npm run dev:server
```

Then call `concept_proposal_record` with the candidate concept payload and call `concept_validation_decision_record` after independent review. A realistic validation decision for this demo would be:

```json
{
  "project_id": "concept-skill",
  "validation_id": "concept-skill:validation:<timestamp>",
  "candidate_id": "boundary:concept-repository:concept-recording",
  "judgment": "accepted-overlap",
  "rationale": "Recording necessarily calls repository persistence, but the concepts remain distinct: action/workflow versus storage boundary.",
  "decided_by": "independent-agent-or-human"
}
```

## Limitations and gaps found

1. `DemoConceptRepository` is read-only. Calling record tools with default `CONCEPT_MCP_REPOSITORY=demo` will fail through `asMutableRepository`. Writable semantics require `file` or writable `sqlite` mode.
2. `concept_task_prepare` silently drops unknown requested concept ids. In this demo, `concept-validation-decision` disappeared from the returned concept snapshot instead of being reported as missing.
3. `concept_conflict_validate` returns candidates, not final architectural truth. The output correctly requires host-side independent review for higher-severity candidates.
4. The file repository records proposals by upserting the concept into `concepts` and appending the full proposal into `concept_proposals`. This is useful for demos, but it means a candidate proposal is immediately visible in the concept list.
5. The current registry includes `concept-recording`, but not a separate accepted `Validation Decision Record` concept, despite the type and persistence collection existing in code.

## Conclusion

The concept-skill workflow materially changes the result. The before pass would likely plan a combined feature/API/storage change and invent dashboard/review terminology without registration. The after pass forces explicit concept ownership, exposes a missing concept id, detects boundary overlaps, requires independent review for high-severity candidates, and demonstrates how proposal and validation decisions persist in a writable repository.
