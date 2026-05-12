export const conceptProposalRecordInputSchema = {
  type: "object",
  required: ["project_id", "concept"],
  properties: {
    project_id: { type: "string" },
    concept: {
      type: "object",
      required: ["id", "name", "kind", "definition", "boundary", "layer", "aliases"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        kind: { type: "string", enum: ["entity", "value-object", "state", "action", "event", "boundary"] },
        definition: { type: "string" },
        boundary: { type: "string" },
        layer: { type: "string", enum: ["data", "domain", "application", "interface", "cross-cutting"] },
        aliases: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["accepted", "candidate", "review-required"] },
        source_refs: { type: "array", items: { type: "string" } },
        abstraction_level: { type: "string", enum: ["foundational", "composite", "specialized"] },
        supported_by: { type: "array", items: { type: "string" } }
      }
    },
    relations: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "type", "to"],
        properties: {
          from: { type: "string" },
          type: { type: "string" },
          to: { type: "string" }
        }
      }
    },
    rationale: { type: "string" },
    proposed_by: { type: "string" }
  }
} as const;

export const conceptValidationDecisionRecordInputSchema = {
  type: "object",
  required: ["project_id", "validation_id", "judgment", "rationale"],
  properties: {
    project_id: { type: "string" },
    validation_id: { type: "string" },
    candidate_id: { type: "string" },
    judgment: {
      type: "string",
      enum: ["accepted-conflict", "rejected-conflict", "accepted-overlap", "needs-human-decision"]
    },
    rationale: { type: "string" },
    decided_by: { type: "string" },
    recorded_at: { type: "string" }
  }
} as const;
