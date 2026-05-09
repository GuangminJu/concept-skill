import type {
  AgentReviewRequest,
  ConceptConflictValidateOutput,
  ConceptGovernanceActivateOutput,
  ConceptTaskPrepareOutput
} from "@concept-mcp/core";

export interface HostAgentLaunchRequest {
  host: "claude" | "codex" | "copilot";
  description: string;
  agent_role: string;
  prompt: string;
  expected_output_schema: object;
}

function assertAgentReviewRequest(validation: ConceptConflictValidateOutput): AgentReviewRequest {
  if (!validation.need_agent_review || !validation.agent_review_request) {
    throw new Error("Independent agent review is not required for this validation result.");
  }
  return validation.agent_review_request;
}

function renderHostPrompt(review: AgentReviewRequest): string {
  return [
    review.analysis_prompt,
    "",
    "Input bundle:",
    JSON.stringify(review.input_bundle, null, 2),
    "",
    "Expected output schema:",
    JSON.stringify(review.expected_output_schema, null, 2)
  ].join("\n");
}

function renderPreparedTaskPrompt(prepared: ConceptTaskPrepareOutput): string {
  return [
    prepared.execution_prompt,
    "",
    "Concept-aware workflow summary:",
    JSON.stringify(prepared.summary, null, 2),
    "",
    "Required workflow:",
    JSON.stringify(prepared.required_workflow, null, 2),
    "",
    "Host actions:",
    JSON.stringify(prepared.host_ai_actions, null, 2)
  ].join("\n");
}

function renderGovernanceActivationPrompt(activation: ConceptGovernanceActivateOutput): string {
  return [
    activation.activation_prompt,
    "",
    "Required workflow:",
    JSON.stringify(activation.required_workflow, null, 2),
    "",
    "Host actions:",
    JSON.stringify(activation.host_ai_actions, null, 2)
  ].join("\n");
}

export function buildClaudeLaunchRequest(validation: ConceptConflictValidateOutput): HostAgentLaunchRequest {
  const review = assertAgentReviewRequest(validation);
  return {
    host: "claude",
    description: "Launch a separate Claude sub-agent or context window for concept conflict analysis.",
    agent_role: "concept-conflict-analyst",
    prompt: renderHostPrompt(review),
    expected_output_schema: review.expected_output_schema
  };
}

export function buildCodexLaunchRequest(validation: ConceptConflictValidateOutput): HostAgentLaunchRequest {
  const review = assertAgentReviewRequest(validation);
  return {
    host: "codex",
    description: "Launch a separate Codex task or agent using the exact prompt and schema below.",
    agent_role: "concept-conflict-analyst",
    prompt: renderHostPrompt(review),
    expected_output_schema: review.expected_output_schema
  };
}

export function buildCopilotLaunchRequest(validation: ConceptConflictValidateOutput): HostAgentLaunchRequest {
  const review = assertAgentReviewRequest(validation);
  return {
    host: "copilot",
    description: "Launch a separate Copilot agent context using the exact prompt and schema below.",
    agent_role: "concept-conflict-analyst",
    prompt: renderHostPrompt(review),
    expected_output_schema: review.expected_output_schema
  };
}

export function buildClaudeConceptTaskRequest(prepared: ConceptTaskPrepareOutput): HostAgentLaunchRequest {
  return {
    host: "claude",
    description: "Launch a separate Claude design/coding context that must follow the registered concept system.",
    agent_role: "concept-disciplined-engine-agent",
    prompt: renderPreparedTaskPrompt(prepared),
    expected_output_schema: prepared.expected_output_schema
  };
}

export function buildCodexConceptTaskRequest(prepared: ConceptTaskPrepareOutput): HostAgentLaunchRequest {
  return {
    host: "codex",
    description: "Launch a separate Codex task that must map work to registered concepts before coding.",
    agent_role: "concept-disciplined-engine-agent",
    prompt: renderPreparedTaskPrompt(prepared),
    expected_output_schema: prepared.expected_output_schema
  };
}

export function buildCopilotConceptTaskRequest(prepared: ConceptTaskPrepareOutput): HostAgentLaunchRequest {
  return {
    host: "copilot",
    description: "Launch a Copilot agent context that must reuse or propose concepts explicitly before implementation.",
    agent_role: "concept-disciplined-engine-agent",
    prompt: renderPreparedTaskPrompt(prepared),
    expected_output_schema: prepared.expected_output_schema
  };
}

export function buildClaudeConceptGovernanceRequest(
  activation: ConceptGovernanceActivateOutput
): HostAgentLaunchRequest {
  return {
    host: "claude",
    description: "Activate concept-governed mode for a project that exposes concept files.",
    agent_role: "concept-governed-project-agent",
    prompt: renderGovernanceActivationPrompt(activation),
    expected_output_schema: {
      type: "object",
      properties: {
        acknowledged: { type: "boolean" },
        next_action: { type: "string" }
      }
    }
  };
}

export function buildCodexConceptGovernanceRequest(
  activation: ConceptGovernanceActivateOutput
): HostAgentLaunchRequest {
  return {
    host: "codex",
    description: "Activate concept-governed mode for a project that exposes concept files.",
    agent_role: "concept-governed-project-agent",
    prompt: renderGovernanceActivationPrompt(activation),
    expected_output_schema: {
      type: "object",
      properties: {
        acknowledged: { type: "boolean" },
        next_action: { type: "string" }
      }
    }
  };
}

export function buildCopilotConceptGovernanceRequest(
  activation: ConceptGovernanceActivateOutput
): HostAgentLaunchRequest {
  return {
    host: "copilot",
    description: "Activate concept-governed mode for a project that exposes concept files.",
    agent_role: "concept-governed-project-agent",
    prompt: renderGovernanceActivationPrompt(activation),
    expected_output_schema: {
      type: "object",
      properties: {
        acknowledged: { type: "boolean" },
        next_action: { type: "string" }
      }
    }
  };
}
