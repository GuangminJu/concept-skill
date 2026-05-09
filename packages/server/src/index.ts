#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";

import {
  conceptConflictValidateInputSchema,
  conceptGovernanceActivateInputSchema,
  conceptTaskPrepareInputSchema
} from "@concept-mcp/core";
import type {
  ConceptConflictValidateInput,
  ConceptGovernanceActivateInput,
  ConceptRepository,
  ConceptTaskPrepareInput
} from "@concept-mcp/core";
import { FileConceptRepository } from "@concept-mcp/storage-file";
import { SqliteConceptRepository } from "@concept-mcp/storage-sqlite";

import { DemoConceptRepository } from "./repository.js";
import { conceptConflictValidate, conceptGovernanceActivate, conceptTaskPrepare } from "./tool.js";

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
          "Run structural concept validation and, when needed, return a host-AI package for an independent semantic conflict review agent.",
        inputSchema: conceptConflictValidateInputSchema
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

  const input = rawArguments as Partial<ConceptConflictValidateInput>;
  if (!input.project_id || !input.mode || !input.agent_review_policy) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required fields: project_id, mode, agent_review_policy."
    );
  }

  return {
    project_id: input.project_id,
    concept_ids: input.concept_ids,
    mode: input.mode,
    sensitivity: input.sensitivity ?? "medium",
    max_candidates: input.max_candidates ?? 20,
    include_evidence: input.include_evidence ?? true,
    agent_review_policy: input.agent_review_policy
  };
}

function normalizeTaskPrepareInput(rawArguments: unknown): ConceptTaskPrepareInput {
  if (!rawArguments || typeof rawArguments !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Tool arguments must be an object.");
  }

  const input = rawArguments as Partial<ConceptTaskPrepareInput>;
  if (!input.project_id || !input.task || !input.mode) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required fields: project_id, task, mode."
    );
  }

  return {
    project_id: input.project_id,
    task: input.task,
    mode: input.mode,
    concept_ids: input.concept_ids,
    include_relations: input.include_relations ?? true,
    constraints: input.constraints
  };
}

function normalizeGovernanceActivateInput(rawArguments: unknown): ConceptGovernanceActivateInput {
  if (!rawArguments || typeof rawArguments !== "object") {
    throw new McpError(ErrorCode.InvalidParams, "Tool arguments must be an object.");
  }

  const input = rawArguments as Partial<ConceptGovernanceActivateInput>;
  if (!input.project_id || !input.concept_files) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Missing required fields: project_id, concept_files."
    );
  }

  return {
    project_id: input.project_id,
    concept_files: input.concept_files
  };
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
      return new SqliteConceptRepository({ databasePath, readonly: true });
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
