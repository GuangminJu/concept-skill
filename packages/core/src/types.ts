export type Severity = "none" | "low" | "medium" | "high" | "critical";
export type ValidationMode = "incremental" | "full";
export type ConceptTaskMode = "design" | "analysis" | "implementation";
export type ConflictType =
  | "duplicate-identity"
  | "alias-collision"
  | "boundary-overlap"
  | "hierarchy-support-gap"
  | "concept-inflation"
  | "layer-violation"
  | "state-model-mismatch"
  | "action-semantics-collision"
  | "event-meaning-collision"
  | "ownership-ambiguity"
  | "cyclic-dependency";

export type ConceptKind = "entity" | "value-object" | "state" | "action" | "event" | "boundary";
export type ConceptLayer = "data" | "domain" | "application" | "interface" | "cross-cutting";
export type ConceptStatus = "accepted" | "candidate" | "review-required";
export type ConceptAbstractionLevel = "foundational" | "composite" | "specialized";

export interface ConceptRecord {
  id: string;
  name: string;
  kind: ConceptKind;
  definition: string;
  boundary: string;
  layer: ConceptLayer;
  aliases: string[];
  status?: ConceptStatus;
  source_refs?: string[];
  abstraction_level?: ConceptAbstractionLevel;
  supported_by?: string[];
}

export interface RelationRecord {
  from: string;
  type: string;
  to: string;
}

export interface ConflictCandidate {
  candidate_id: string;
  conflict_type: ConflictType;
  severity: Exclude<Severity, "none">;
  concept_ids: string[];
  title: string;
  description: string;
  machine_reason: string[];
  evidence_refs: string[];
  needs_agent_review: boolean;
}

export interface AgentReviewPolicy {
  require_independent_agent: boolean;
  min_severity: Exclude<Severity, "none">;
  trigger_on: ConflictType[];
}

export interface ConceptConflictValidateInput {
  project_id: string;
  concept_ids?: string[];
  mode: ValidationMode;
  sensitivity?: "low" | "medium" | "high";
  max_candidates?: number;
  include_evidence?: boolean;
  agent_review_policy: AgentReviewPolicy;
}

export interface AgentReviewRequest {
  protocol_version: "concept-conflict-review/v1";
  objective: string;
  independence_requirement: "must_run_in_separate_context";
  recommended_agent_role: "concept-conflict-analyst";
  input_bundle: {
    project_id: string;
    validation_id: string;
    candidate_ids: string[];
    concepts: ConceptRecord[];
    relations: RelationRecord[];
    conflict_candidates: ConflictCandidate[];
  };
  analysis_prompt: string;
  expected_output_schema: object;
}

export interface ConceptConflictValidateOutput {
  validation_id: string;
  summary: {
    project_id: string;
    validated_concept_count: number;
    candidate_count: number;
    highest_severity: Severity;
  };
  conflict_candidates: ConflictCandidate[];
  need_agent_review: boolean;
  host_ai_actions: Array<{
    action: "launch_independent_agent" | "record_validation" | "present_summary";
    description: string;
    payload?: Record<string, unknown>;
  }>;
  agent_review_request?: AgentReviewRequest;
}

export interface ConceptTaskPrepareInput {
  project_id: string;
  task: string;
  mode: ConceptTaskMode;
  concept_ids?: string[];
  include_relations?: boolean;
  constraints?: string[];
}

export interface ConceptTaskPrepareOutput {
  task_id: string;
  summary: {
    project_id: string;
    mode: ConceptTaskMode;
    concept_count: number;
    relation_count: number;
  };
  required_workflow: string[];
  concept_snapshot: {
    concepts: ConceptRecord[];
    relations: RelationRecord[];
  };
  host_ai_actions: Array<{
    action:
      | "map_task_to_concepts"
      | "propose_missing_concepts"
      | "validate_conflicts_if_needed"
      | "implement_after_concept_alignment";
    description: string;
  }>;
  execution_prompt: string;
  expected_output_schema: object;
}

export interface ConceptGovernanceActivateInput {
  project_id: string;
  concept_files: string[];
}

export interface ConceptGovernanceActivateOutput {
  project_id: string;
  concept_governed: boolean;
  reason: string;
  concept_files: string[];
  required_workflow: string[];
  host_ai_actions: Array<{
    action:
      | "enter_concept_governed_mode"
      | "read_concept_files_first"
      | "call_concept_task_prepare"
      | "call_concept_conflict_validate_if_needed"
      | "stay_in_standard_mode";
    description: string;
    payload?: Record<string, unknown>;
  }>;
  activation_prompt: string;
}
