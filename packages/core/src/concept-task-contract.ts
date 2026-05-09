import type {
  ConceptRecord,
  ConceptTaskPrepareInput,
  RelationRecord,
} from "./types.js";

type PromptInput = Omit<ConceptTaskPrepareInput, "concept_ids" | "include_relations"> & {
  concepts: ConceptRecord[];
  relations: RelationRecord[];
};

export const conceptTaskPrepareInputSchema = {
  type: "object",
  required: ["project_id", "task", "mode"],
  properties: {
    project_id: { type: "string" },
    task: { type: "string" },
    mode: { type: "string", enum: ["design", "analysis", "implementation"] },
    concept_ids: { type: "array", items: { type: "string" } },
    include_relations: { type: "boolean", default: true },
    constraints: { type: "array", items: { type: "string" } }
  }
} as const;

export const conceptTaskExecutionOutputSchema = {
  type: "object",
  required: [
    "task_summary",
    "reused_concepts",
    "proposed_concepts",
    "boundary_checks",
    "implementation_rules"
  ],
  properties: {
    task_summary: { type: "string" },
    reused_concepts: {
      type: "array",
      items: {
        type: "object",
        required: ["concept_id", "role_in_task", "why_this_concept"],
        properties: {
          concept_id: { type: "string" },
          role_in_task: { type: "string" },
          why_this_concept: { type: "string" }
        }
      }
    },
    proposed_concepts: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "kind", "definition", "boundary", "layer", "abstraction_level", "rationale"],
        properties: {
          name: { type: "string" },
          kind: { type: "string", enum: ["entity", "value-object", "state", "action", "event", "boundary"] },
          definition: { type: "string" },
          boundary: { type: "string" },
          layer: { type: "string", enum: ["data", "domain", "application", "interface", "cross-cutting"] },
          abstraction_level: { type: "string", enum: ["foundational", "composite", "specialized"] },
          rationale: { type: "string" },
          supported_by: {
            type: "array",
            items: { type: "string" }
          },
          conflicts_to_validate: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    },
    boundary_checks: {
      type: "array",
      items: { type: "string" }
    },
    implementation_rules: {
      type: "array",
      items: { type: "string" }
    },
    unresolved_conflicts: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export function buildConceptTaskExecutionPrompt(input: PromptInput): string {
  const constraints = input.constraints?.length
    ? ["", "Task constraints:", ...input.constraints.map((constraint, index) => `${index + 1}. ${constraint}`)]
    : [];

  return [
    "You are a concept-disciplined engine agent.",
    "You must reason, design, and code through the project's registered concept system.",
    "Do not improvise unnamed abstractions or silently overload an existing concept.",
    "",
    "Non-negotiable workflow:",
    "1. Identify which existing concepts already own the task's data, lifecycle, serialization, runtime, and interface responsibilities.",
    "2. Reuse registered concepts whenever they already cover the responsibility.",
    "3. If the task needs a new concept, propose it explicitly with name, kind, definition, boundary, layer, and abstraction_level before using it.",
    "4. If two concepts seem to overlap, record the ambiguity as an unresolved conflict instead of blending them together.",
    "5. Keep one concept, one boundary, one owner, one canonical name.",
    "6. Composite concepts must name the lower-level concepts that support them.",
    "7. If a concept would only name a concrete gameplay specialization over generic mechanisms, treat that as a concept error instead of registering it.",
    "8. In implementation mode, do not write code that crosses concept boundaries without stating the boundary rule first.",
    "",
    `Project: ${input.project_id}`,
    `Mode: ${input.mode}`,
    `Task: ${input.task}`,
    ...constraints,
    "",
    "Concept snapshot:",
    JSON.stringify(input.concepts, null, 2),
    "",
    "Relations:",
    JSON.stringify(input.relations, null, 2),
    "",
    "Expected output schema:",
    JSON.stringify(conceptTaskExecutionOutputSchema, null, 2),
    "",
    "Output JSON matching expected_output_schema only."
  ].join("\n");
}
