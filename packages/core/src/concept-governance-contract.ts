import type { ConceptGovernanceActivateInput } from "./types.js";

export const conceptGovernanceActivateInputSchema = {
  type: "object",
  required: ["project_id", "concept_files"],
  properties: {
    project_id: { type: "string" },
    concept_files: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export function buildConceptGovernanceActivationPrompt(input: ConceptGovernanceActivateInput): string {
  if (input.concept_files.length === 0) {
    return [
      "No concept files were supplied for this project.",
      "Stay in standard mode unless concept files appear later.",
      "If concept files are added, switch to concept-governed mode immediately."
    ].join("\n");
  }

  return [
    "This project contains concept files.",
    "Those files are authoritative for design, reasoning, and implementation boundaries.",
    "You are now in concept-governed mode.",
    "",
    "Required workflow:",
    "1. Read the supplied concept files first.",
    "2. Before design, analysis, or implementation, call concept_task_prepare for the concrete task.",
    "3. Reuse existing concepts whenever they already own the responsibility.",
    "4. If a needed abstraction is missing, propose it explicitly before using it.",
    "5. If concept ownership is ambiguous, call concept_conflict_validate before proceeding.",
    "6. Do not silently invent, merge, or overload concepts while writing code.",
    "",
    `Project: ${input.project_id}`,
    "Concept files:",
    ...input.concept_files.map((filePath) => `- ${filePath}`)
  ].join("\n");
}
