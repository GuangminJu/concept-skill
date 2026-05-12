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
  ConceptProposalRecord,
  ConceptProposalRecordOutput,
  ConceptRecord,
  ConceptTaskPrepareInput,
  ConceptTaskPrepareOutput,
  ConceptValidationDecisionRecord,
  ConceptValidationDecisionRecordOutput,
  MutableConceptRepository,
  ConceptRepository,
  RelationRecord
} from "@concept-mcp/core";

export async function conceptConflictValidate(
  repository: ConceptRepository,
  input: ConceptConflictValidateInput
): Promise<ConceptConflictValidateOutput> {
  const allConcepts = await repository.getProjectConcepts(input.project_id);
  const requestedConceptIds = input.concept_ids?.length ? input.concept_ids : undefined;
  const selectedConcepts = requestedConceptIds
    ? allConcepts.filter((concept) => requestedConceptIds.includes(concept.id))
    : allConcepts;
  const validationConcepts = input.mode === "incremental" && requestedConceptIds ? allConcepts : selectedConcepts;
  const allRelations = await repository.getProjectRelations(input.project_id);
  const candidates = detectConflictCandidates(validationConcepts, allRelations, {
    sensitivity: input.sensitivity,
    includeEvidence: input.include_evidence,
    scopeConceptIds: input.mode === "incremental" ? requestedConceptIds : undefined
  }).slice(0, input.max_candidates ?? 20);
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
            description: "Launch a separate agent/context to review conflict candidates without rewriting concept IDs.",
            payload: { validation_id: validationId, candidate_ids: escalatedCandidates.map((item) => item.candidate_id) }
          },
          {
            action: "record_validation",
            description: "Persist the independent review decision with concept_validation_decision_record."
          }
        ]
      : [
          {
            action: "present_summary",
            description: "Present the structural validation summary; no independent agent is required."
          }
        ],
    agent_review_request: needAgentReview
      ? buildAgentReviewRequest(input.project_id, validationId, validationConcepts, allRelations, escalatedCandidates)
      : undefined
  };
}

export async function conceptProposalRecord(
  repository: ConceptRepository,
  input: ConceptProposalRecord
): Promise<ConceptProposalRecordOutput> {
  const mutableRepository = asMutableRepository(repository);
  const record = await mutableRepository.recordConceptProposal(input);
  return {
    recorded: true,
    project_id: record.project_id,
    concept_id: record.concept.id,
    relation_count: record.relations?.length ?? 0,
    record
  };
}

export async function conceptValidationDecisionRecord(
  repository: ConceptRepository,
  input: ConceptValidationDecisionRecord
): Promise<ConceptValidationDecisionRecordOutput> {
  const mutableRepository = asMutableRepository(repository);
  const record = await mutableRepository.recordValidationDecision(input);
  return {
    recorded: true,
    project_id: record.project_id,
    validation_id: record.validation_id,
    candidate_id: record.candidate_id,
    record
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
      "Review structural conflict candidates and decide which are real conceptual conflicts, acceptable overlaps, false positives, or human decisions.",
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

function asMutableRepository(repository: ConceptRepository): MutableConceptRepository {
  const candidate = repository as Partial<MutableConceptRepository>;
  if (
    typeof candidate.recordConceptProposal === "function" &&
    typeof candidate.recordValidationDecision === "function"
  ) {
    return candidate as MutableConceptRepository;
  }

  throw new Error("Current concept repository is read-only. Use file or writable sqlite repository mode to record concepts or decisions.");
}
