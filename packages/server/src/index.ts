#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";

import {
  conceptConflictValidateInputSchema,
  conceptGovernanceActivateInputSchema,
  conceptProposalRecordInputSchema,
  conceptTaskPrepareInputSchema,
  conceptValidationDecisionRecordInputSchema
} from "@concept-mcp/core";
import type {
  AgentReviewPolicy,
  ConceptAbstractionLevel,
  ConceptConflictValidateInput,
  ConceptGovernanceActivateInput,
  ConceptKind,
  ConceptLayer,
  ConceptProposalRecord,
  ConceptRecord,
  ConceptRepository,
  ConceptStatus,
  ConceptTaskPrepareInput,
  ConceptValidationDecisionRecord,
  ConflictType,
  RelationRecord
} from "@concept-mcp/core";
import { FileConceptRepository } from "@concept-mcp/storage-file";
import { SqliteConceptRepository } from "@concept-mcp/storage-sqlite";

import { DemoConceptRepository } from "./repository.js";
import {
  conceptConflictValidate,
  conceptGovernanceActivate,
  conceptProposalRecord,
  conceptTaskPrepare,
  conceptValidationDecisionRecord
} from "./tool.js";

const server = new Server(
  {
    name: "concept-mcp-server",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const repository = createRepository();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "concept_governance_activate",
        description:
          "Activate concept-governed mode when a project exposes concept files, so the host AI must use concept-first reasoning.",
        inputSchema: conceptGovernanceActivateInputSchema
      },
      {
        name: "concept_task_prepare",
        description:
          "Prepare a concept-aware design or coding task package so the host AI must reason through registered concepts before implementation.",
        inputSchema: conceptTaskPrepareInputSchema
      },
      {
        name: "concept_conflict_validate",
        description:
          "Detect structural concept conflict candidates and, when needed, return a host-AI package for independent semantic review.",
        inputSchema: conceptConflictValidateInputSchema
      },
      {
        name: "concept_proposal_record",
        description:
          "Persist a proposed or accepted concept and optional supporting relations to a writable concept repository.",
        inputSchema: conceptProposalRecordInputSchema
      },
      {
        name: "concept_validation_decision_record",
        description:
          "Persist a human or independent-agent decision about a concept conflict candidate.",
        inputSchema: conceptValidationDecisionRecordInputSchema
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArguments } = request.params;

  if (name === "concept_governance_activate") {
    const input = normalizeGovernanceActivateInput(rawArguments);
    const result = conceptGovernanceActivate(input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      structuredContent: result
    };
  }

  if (name === "concept_proposal_record") {
    const input = normalizeConceptProposalRecordInput(rawArguments);
    const result = await conceptProposalRecord(repository, input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      structuredContent: result
    };
  }

  if (name === "concept_validation_decision_record") {
    const input = normalizeValidationDecisionRecordInput(rawArguments);
    const result = await conceptValidationDecisionRecord(repository, input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      structuredContent: result
    };
  }

  if (name === "concept_task_prepare") {
    const input = normalizeTaskPrepareInput(rawArguments);
    const result = await conceptTaskPrepare(repository, input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      structuredContent: result
    };
  }

  if (name === "concept_conflict_validate") {
    const input = normalizeValidateInput(rawArguments);
    const result = await conceptConflictValidate(repository, input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ],
      structuredContent: result
    };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool '${name}'.`);
});

function normalizeValidateInput(rawArguments: unknown): ConceptConflictValidateInput {
  if (!rawArguments || typeof rawArguments !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Tool arguments must be an object.");
  }

  const input = rawArguments as Record<string, unknown>;
  if (!input.project_id || !input.mode || !input.agent_review_policy) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required fields: project_id, mode, agent_review_policy."
    );
  }

  return {
    project_id: expectString(input.project_id, "project_id"),
    concept_ids: input.concept_ids === undefined ? undefined : expectStringArray(input.concept_ids, "concept_ids"),
    mode: expectEnum(input.mode, "mode", ["incremental", "full"]),
    sensitivity: input.sensitivity === undefined
      ? "medium"
      : expectEnum<"low" | "medium" | "high">(input.sensitivity, "sensitivity", ["low", "medium", "high"]),
    max_candidates: input.max_candidates === undefined ? 20 : expectInteger(input.max_candidates, "max_candidates", 1, 100),
    include_evidence: input.include_evidence === undefined ? true : expectBoolean(input.include_evidence, "include_evidence"),
    agent_review_policy: normalizeAgentReviewPolicy(input.agent_review_policy)
  };
}

function normalizeTaskPrepareInput(rawArguments: unknown): ConceptTaskPrepareInput {
  if (!rawArguments || typeof rawArguments !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Tool arguments must be an object.");
  }

  const input = rawArguments as Record<string, unknown>;
  if (!input.project_id || !input.task || !input.mode) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required fields: project_id, task, mode."
    );
  }

  return {
    project_id: expectString(input.project_id, "project_id"),
    task: expectString(input.task, "task"),
    mode: expectEnum(input.mode, "mode", ["design", "analysis", "implementation"]),
    concept_ids: input.concept_ids === undefined ? undefined : expectStringArray(input.concept_ids, "concept_ids"),
    include_relations: input.include_relations === undefined ? true : expectBoolean(input.include_relations, "include_relations"),
    constraints: input.constraints === undefined ? undefined : expectStringArray(input.constraints, "constraints")
  };
}

function normalizeGovernanceActivateInput(rawArguments: unknown): ConceptGovernanceActivateInput {
  if (!rawArguments || typeof rawArguments !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Tool arguments must be an object.");
  }

  const input = rawArguments as Record<string, unknown>;
  if (!input.project_id || !input.concept_files) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required fields: project_id, concept_files."
    );
  }

  return {
    project_id: expectString(input.project_id, "project_id"),
    concept_files: expectStringArray(input.concept_files, "concept_files")
  };
}

function normalizeConceptProposalRecordInput(rawArguments: unknown): ConceptProposalRecord {
  if (!rawArguments || typeof rawArguments !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Tool arguments must be an object.");
  }

  const input = rawArguments as Record<string, unknown>;
  return {
    project_id: expectString(input.project_id, "project_id"),
    concept: normalizeConceptRecord(input.concept),
    relations: input.relations === undefined ? undefined : expectRelationArray(input.relations, "relations"),
    rationale: input.rationale === undefined ? undefined : expectString(input.rationale, "rationale"),
    proposed_by: input.proposed_by === undefined ? undefined : expectString(input.proposed_by, "proposed_by")
  };
}

function normalizeValidationDecisionRecordInput(rawArguments: unknown): ConceptValidationDecisionRecord {
  if (!rawArguments || typeof rawArguments !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Tool arguments must be an object.");
  }

  const input = rawArguments as Record<string, unknown>;
  return {
    project_id: expectString(input.project_id, "project_id"),
    validation_id: expectString(input.validation_id, "validation_id"),
    candidate_id: input.candidate_id === undefined ? undefined : expectString(input.candidate_id, "candidate_id"),
    judgment: expectEnum(input.judgment, "judgment", [
      "accepted-conflict",
      "rejected-conflict",
      "accepted-overlap",
      "needs-human-decision"
    ]),
    rationale: expectString(input.rationale, "rationale"),
    decided_by: input.decided_by === undefined ? undefined : expectString(input.decided_by, "decided_by"),
    recorded_at: input.recorded_at === undefined ? undefined : expectString(input.recorded_at, "recorded_at")
  };
}

function normalizeAgentReviewPolicy(rawValue: unknown): AgentReviewPolicy {
  if (!rawValue || typeof rawValue !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "agent_review_policy must be an object.");
  }

  const value = rawValue as Record<string, unknown>;
  return {
    require_independent_agent: expectBoolean(value.require_independent_agent, "agent_review_policy.require_independent_agent"),
    min_severity: expectEnum(value.min_severity, "agent_review_policy.min_severity", ["low", "medium", "high", "critical"]),
    trigger_on: expectEnumArray(value.trigger_on, "agent_review_policy.trigger_on", [
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
    ])
  };
}

function normalizeConceptRecord(rawValue: unknown): ConceptRecord {
  if (!rawValue || typeof rawValue !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "concept must be an object.");
  }

  const value = rawValue as Record<string, unknown>;
  return {
    id: expectString(value.id, "concept.id"),
    name: expectString(value.name, "concept.name"),
    kind: expectEnum<ConceptKind>(value.kind, "concept.kind", ["entity", "value-object", "state", "action", "event", "boundary"]),
    definition: expectString(value.definition, "concept.definition"),
    boundary: expectString(value.boundary, "concept.boundary"),
    layer: expectEnum<ConceptLayer>(value.layer, "concept.layer", ["data", "domain", "application", "interface", "cross-cutting"]),
    aliases: expectStringArray(value.aliases, "concept.aliases"),
    status: value.status === undefined ? undefined : expectEnum<ConceptStatus>(value.status, "concept.status", ["accepted", "candidate", "review-required"]),
    source_refs: value.source_refs === undefined ? undefined : expectStringArray(value.source_refs, "concept.source_refs"),
    abstraction_level: value.abstraction_level === undefined
      ? undefined
      : expectEnum<ConceptAbstractionLevel>(value.abstraction_level, "concept.abstraction_level", ["foundational", "composite", "specialized"]),
    supported_by: value.supported_by === undefined ? undefined : expectStringArray(value.supported_by, "concept.supported_by")
  };
}

function expectRelationArray(rawValue: unknown, fieldName: string): RelationRecord[] {
  if (!Array.isArray(rawValue)) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be an array.`);
  }

  return rawValue.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new McpError(ErrorCode.InvalidParams, `${fieldName}[${index}] must be an object.`);
    }
    const relation = item as Record<string, unknown>;
    return {
      from: expectString(relation.from, `${fieldName}[${index}].from`),
      type: expectString(relation.type, `${fieldName}[${index}].type`),
      to: expectString(relation.to, `${fieldName}[${index}].to`)
    };
  });
}

function expectString(rawValue: unknown, fieldName: string): string {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be a non-empty string.`);
  }
  return rawValue;
}

function expectBoolean(rawValue: unknown, fieldName: string): boolean {
  if (typeof rawValue !== "boolean") {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be a boolean.`);
  }
  return rawValue;
}

function expectInteger(rawValue: unknown, fieldName: string, min: number, max: number): number {
  if (typeof rawValue !== "number" || !Number.isInteger(rawValue) || rawValue < min || rawValue > max) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be an integer between ${min} and ${max}.`);
  }
  return rawValue;
}

function expectStringArray(rawValue: unknown, fieldName: string): string[] {
  if (!Array.isArray(rawValue) || rawValue.some((item) => typeof item !== "string")) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be an array of strings.`);
  }
  return rawValue;
}

function expectEnum<T extends string>(rawValue: unknown, fieldName: string, allowed: readonly T[]): T {
  if (typeof rawValue !== "string" || !allowed.includes(rawValue as T)) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be one of: ${allowed.join(", ")}.`);
  }
  return rawValue as T;
}

function expectEnumArray<T extends string>(rawValue: unknown, fieldName: string, allowed: readonly T[]): T[] {
  if (!Array.isArray(rawValue)) {
    throw new McpError(ErrorCode.InvalidParams, `${fieldName} must be an array.`);
  }
  return rawValue.map((item, index) => expectEnum(item, `${fieldName}[${index}]`, allowed));
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function createRepository(): ConceptRepository {
  const repositoryMode = process.env.CONCEPT_MCP_REPOSITORY ?? "demo";
  switch (repositoryMode) {
    case "demo":
      return new DemoConceptRepository();
    case "file": {
      const rootDir = process.env.CONCEPT_MCP_FILE_ROOT;
      if (!rootDir) {
        throw new Error("CONCEPT_MCP_FILE_ROOT is required when CONCEPT_MCP_REPOSITORY=file.");
      }
      return new FileConceptRepository({ rootDir });
    }
    case "sqlite": {
      const databasePath = process.env.CONCEPT_MCP_SQLITE_PATH;
      if (!databasePath) {
        throw new Error("CONCEPT_MCP_SQLITE_PATH is required when CONCEPT_MCP_REPOSITORY=sqlite.");
      }
      return new SqliteConceptRepository({
        databasePath,
        readonly: process.env.CONCEPT_MCP_SQLITE_READONLY !== "false"
      });
    }
    default:
      throw new Error(`Unsupported CONCEPT_MCP_REPOSITORY '${repositoryMode}'. Use demo, file, or sqlite.`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
