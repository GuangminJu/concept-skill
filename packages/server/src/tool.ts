import {
  buildConceptTaskExecutionPrompt,
  agentReviewOutputSchema,
  analysisPromptTemplate,
  buildConceptGovernanceActivationPrompt,
  computeHighestSeverity,
  conceptTaskExecutionOutputSchema,
  detectConflictCandidates,
  shouldEscalate
} from "@concept-mcp/core";
import type {
  AgentReviewRequest,
  ConceptConflictValidateInput,
  ConceptConflictValidateOutput,
  ConceptGovernanceActivateInput,
  ConceptGovernanceActivateOutput,
  ConceptRecord,
  ConceptTaskPrepareInput,
  ConceptTaskPrepareOutput,
  ConceptRepository,
  RelationRecord
} from "@concept-mcp/core";

export async function conceptConflictValidate(
  repository: ConceptRepository,
  input: ConceptConflictValidateInput
): Promise<ConceptConflictValidateOutput> {
  const selectedConcepts = input.concept_ids?.length
    ? await repository.getConceptsByIds(input.project_id, input.concept_ids)
    : await repository.getProjectConcepts(input.project_id);
  const allRelations = await repository.getProjectRelations(input.project_id);
  const candidates = detectConflictCandidates(selectedConcepts, allRelations).slice(0, input.max_candidates ?? 20);
  const highestSeverity = computeHighestSeverity(candidates);
  const validationId = buildValidationId(input.project_id);
  const escalatedCandidates = candidates.filter((candidate) => shouldEscalate(candidate, input.agent_review_policy));
  const needAgentReview = escalatedCandidates.length > 0;

  return {
    validation_id: validationId,
    summary: {
      project_id: input.project_id,
      validated_concept_count: selectedConcepts.length,
      candidate_count: candidates.length,
      highest_severity: highestSeverity
    },
    conflict_candidates: candidates,
    need_agent_review: needAgentReview,
    host_ai_actions: needAgentReview
      ? [
          {
            action: "launch_independent_agent",
            description: "Launch a separate agent/context using agent_review_request without rewriting concept IDs.",
            payload: { validation_id: validationId, candidate_ids: escalatedCandidates.map((item) => item.candidate_id) }
          },
          {
            action: "record_validation",
            description: "Persist validation_id and candidate_ids before waiting for the independent review result."
          }
        ]
      : [
          {
            action: "present_summary",
            description: "Present the structural validation summary; no independent agent is required."
          }
        ],
    agent_review_request: needAgentReview
      ? buildAgentReviewRequest(input.project_id, validationId, selectedConcepts, allRelations, escalatedCandidates)
      : undefined
  };
}

export async function conceptTaskPrepare(
  repository: ConceptRepository,
  input: ConceptTaskPrepareInput
): Promise<ConceptTaskPrepareOutput> {
  const concepts = input.concept_ids?.length
    ? await repository.getConceptsByIds(input.project_id, input.concept_ids)
    : await repository.getProjectConcepts(input.project_id);
  const relations = input.include_relations === false
    ? []
    : await repository.getProjectRelations(input.project_id);

  return {
    task_id: buildTaskId(input.project_id, input.mode),
    summary: {
      project_id: input.project_id,
      mode: input.mode,
      concept_count: concepts.length,
      relation_count: relations.length
    },
    required_workflow: [
      "Map the task to existing concepts before changing design or code.",
      "Propose missing concepts explicitly before using them.",
      "Record any concept ambiguity instead of silently collapsing boundaries.",
      "Require higher-level concepts to name the lower-level concepts that support them.",
      "Treat concrete gameplay specializations over generic mechanisms as concept errors.",
      "Only implement after concept ownership and boundaries are explicit."
    ],
    concept_snapshot: {
      concepts,
      relations
    },
    host_ai_actions: [
      {
        action: "map_task_to_concepts",
        description: "State which registered concepts own the task responsibilities before planning or coding."
      },
      {
        action: "propose_missing_concepts",
        description: "If the task needs a missing abstraction, propose a new concept with definition and boundary first."
      },
      {
        action: "validate_conflicts_if_needed",
        description: "If any concept ownership, hierarchy support, or specialization looks ambiguous, run concept conflict validation before proceeding."
      },
      {
        action: "implement_after_concept_alignment",
        description: "Only design or write code after concept boundaries and ownership are explicit."
      }
    ],
    execution_prompt: buildConceptTaskExecutionPrompt({
      project_id: input.project_id,
      task: input.task,
      mode: input.mode,
      constraints: input.constraints,
      concepts,
      relations
    }),
    expected_output_schema: conceptTaskExecutionOutputSchema
  };
}

export function conceptGovernanceActivate(
  input: ConceptGovernanceActivateInput
): ConceptGovernanceActivateOutput {
  const conceptGoverned = input.concept_files.length > 0;

  return {
    project_id: input.project_id,
    concept_governed: conceptGoverned,
    reason: conceptGoverned
      ? "Concept files were supplied, so the project must be handled in concept-governed mode."
      : "No concept files were supplied, so the project can remain in standard mode.",
    concept_files: input.concept_files,
    required_workflow: conceptGoverned
        ? [
            "Read concept files before planning or coding.",
            "Call concept_task_prepare before design, analysis, or implementation tasks.",
            "Propose new concepts explicitly instead of inventing them silently.",
            "Require higher-level concepts to be supported by lower-level concepts.",
            "Treat concrete gameplay specializations over generic mechanisms as errors.",
            "Call concept_conflict_validate when ownership, hierarchy, or boundaries look ambiguous."
          ]
      : [
          "Use standard workflow until concept files are supplied."
        ],
    host_ai_actions: conceptGoverned
      ? [
          {
            action: "enter_concept_governed_mode",
            description: "Treat concept files as authoritative project boundaries."
          },
          {
            action: "read_concept_files_first",
            description: "Read the project concept files before planning, design, or coding."
          },
          {
            action: "call_concept_task_prepare",
            description: "For each design, analysis, or implementation task, call concept_task_prepare first.",
            payload: { tool: "concept_task_prepare", project_id: input.project_id }
          },
          {
            action: "call_concept_conflict_validate_if_needed",
            description: "If reused and proposed concepts overlap, lack lower-level support, or look like inflated specializations, run concept_conflict_validate before proceeding.",
            payload: { tool: "concept_conflict_validate", project_id: input.project_id }
          }
        ]
      : [
          {
            action: "stay_in_standard_mode",
            description: "No concept files were supplied, so concept-governed mode is not active."
          }
        ],
    activation_prompt: buildConceptGovernanceActivationPrompt(input)
  };
}

function buildValidationId(projectId: string): string {
  return `${projectId}:validation:${Date.now()}`;
}

function buildTaskId(projectId: string, mode: string): string {
  return `${projectId}:task:${mode}:${Date.now()}`;
}

function buildAgentReviewRequest(
  projectId: string,
  validationId: string,
  concepts: ConceptRecord[],
  relations: RelationRecord[],
  candidates: ConceptConflictValidateOutput["conflict_candidates"]
): AgentReviewRequest {
  return {
    protocol_version: "concept-conflict-review/v1",
    objective:
      "Determine which conflict candidates are real conceptual conflicts, which are acceptable overlaps, and which require a human architecture decision.",
    independence_requirement: "must_run_in_separate_context",
    recommended_agent_role: "concept-conflict-analyst",
    input_bundle: {
      project_id: projectId,
      validation_id: validationId,
      candidate_ids: candidates.map((candidate) => candidate.candidate_id),
      concepts,
      relations,
      conflict_candidates: candidates
    },
    analysis_prompt: analysisPromptTemplate,
    expected_output_schema: agentReviewOutputSchema
  };
}
