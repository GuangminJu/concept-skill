export const conceptConflictValidateInputSchema = {
  type: "object",
  required: ["project_id", "mode", "agent_review_policy"],
  properties: {
    project_id: { type: "string" },
    concept_ids: { type: "array", items: { type: "string" } },
    mode: { type: "string", enum: ["incremental", "full"] },
    sensitivity: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
    max_candidates: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    include_evidence: { type: "boolean", default: true },
    agent_review_policy: {
      type: "object",
      required: ["require_independent_agent", "min_severity", "trigger_on"],
      properties: {
        require_independent_agent: { type: "boolean" },
        min_severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        trigger_on: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "duplicate-identity",
              "alias-collision",
              "boundary-overlap",
              "hierarchy-support-gap",
              "concept-inflation",
              "layer-violation",
              "state-model-mismatch",
              "action-semantics-collision",
              "event-meaning-collision",
              "ownership-ambiguity",
              "cyclic-dependency"
            ]
          }
        }
      }
    }
  }
} as const;

export const agentReviewOutputSchema = {
  type: "object",
  required: ["validation_id", "overall_judgment", "candidate_reviews", "normalization_recommendations"],
  properties: {
    validation_id: { type: "string" },
    overall_judgment: {
      type: "string",
      enum: ["no-material-conflict", "material-conflicts-found", "human-decision-required"]
    },
    candidate_reviews: {
      type: "array",
      items: {
        type: "object",
        required: [
          "candidate_id",
          "judgment",
          "severity",
          "evidence_for",
          "evidence_against",
          "recommended_resolution"
        ],
        properties: {
          candidate_id: { type: "string" },
          judgment: {
            type: "string",
            enum: ["real-conflict", "acceptable-overlap", "false-positive", "needs-human-decision"]
          },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          evidence_for: { type: "array", items: { type: "string" } },
          evidence_against: { type: "array", items: { type: "string" } },
          recommended_resolution: { type: "string" },
          rename_or_boundary_change: { type: "string" }
        }
      }
    },
    normalization_recommendations: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export const analysisPromptTemplate = [
  "You are an independent concept-conflict analysis agent.",
  "Re-evaluate the supplied conflict candidates from first principles.",
  "Do not trust the validator blindly.",
  "",
  "Mission:",
  "1. Judge each candidate as real-conflict, acceptable-overlap, false-positive, or needs-human-decision.",
  "2. Use only the supplied concepts, relations, and evidence.",
  "3. Preserve concept IDs exactly.",
  "4. Prefer one concept, one boundary, one owner, one canonical name.",
  "",
  "Conflict classes:",
  "- duplicate identity",
  "- alias collision",
  "- boundary overlap",
  "- hierarchy support gap",
  "- concept inflation",
  "- layer violation",
  "- state-model mismatch",
  "- action semantics collision",
  "- event meaning collision",
  "- ownership ambiguity",
  "- cyclic dependency",
  "",
  "Output JSON matching expected_output_schema only."
].join("\n");
