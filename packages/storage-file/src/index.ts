import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ConceptProposalRecord,
  ConceptRecord,
  ConceptValidationDecisionRecord,
  MutableConceptRepository,
  RelationRecord
} from "@concept-mcp/core";

interface FileProjectDocument {
  project_id: string;
  concepts: ConceptRecord[];
  relations: RelationRecord[];
  concept_proposals?: ConceptProposalRecord[];
  validation_decisions?: ConceptValidationDecisionRecord[];
}

export interface FileRepositoryOptions {
  rootDir: string;
}

export class FileConceptRepository implements MutableConceptRepository {
  public constructor(private readonly options: FileRepositoryOptions) {}

  public async getProjectConcepts(projectId: string): Promise<ConceptRecord[]> {
    const data = await this.loadProject(projectId);
    return data.concepts;
  }

  public async getProjectRelations(projectId: string): Promise<RelationRecord[]> {
    const data = await this.loadProject(projectId);
    return data.relations;
  }

  public async getConceptsByIds(projectId: string, conceptIds: string[]): Promise<ConceptRecord[]> {
    const data = await this.loadProject(projectId);
    const wanted = new Set(conceptIds);
    return data.concepts.filter((concept) => wanted.has(concept.id));
  }

  public async recordConceptProposal(record: ConceptProposalRecord): Promise<ConceptProposalRecord> {
    const data = await this.loadOrCreateProject(record.project_id);
    const concept = {
      ...record.concept,
      status: record.concept.status ?? "candidate"
    };
    const existingIndex = data.concepts.findIndex((item) => item.id === concept.id);
    if (existingIndex >= 0) {
      data.concepts[existingIndex] = concept;
    } else {
      data.concepts.push(concept);
    }

    for (const relation of record.relations ?? []) {
      if (!data.relations.some((item) => sameRelation(item, relation))) {
        data.relations.push(relation);
      }
    }

    const recorded = { ...record, concept };
    data.concept_proposals = [...(data.concept_proposals ?? []), recorded];
    await this.saveProject(record.project_id, data);
    return recorded;
  }

  public async recordValidationDecision(
    record: ConceptValidationDecisionRecord
  ): Promise<ConceptValidationDecisionRecord> {
    const data = await this.loadOrCreateProject(record.project_id);
    const recorded = {
      ...record,
      recorded_at: record.recorded_at ?? new Date().toISOString()
    };
    data.validation_decisions = [...(data.validation_decisions ?? []), recorded];
    await this.saveProject(record.project_id, data);
    return recorded;
  }

  private async loadProject(projectId: string): Promise<FileProjectDocument> {
    const filePath = join(this.options.rootDir, `${projectId}.json`);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as FileProjectDocument;
  }

  private async loadOrCreateProject(projectId: string): Promise<FileProjectDocument> {
    try {
      return await this.loadProject(projectId);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return {
          project_id: projectId,
          concepts: [],
          relations: []
        };
      }
      throw error;
    }
  }

  private async saveProject(projectId: string, data: FileProjectDocument): Promise<void> {
    await mkdir(this.options.rootDir, { recursive: true });
    const filePath = join(this.options.rootDir, `${projectId}.json`);
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}

function sameRelation(left: RelationRecord, right: RelationRecord): boolean {
  return left.from === right.from && left.type === right.type && left.to === right.to;
}
