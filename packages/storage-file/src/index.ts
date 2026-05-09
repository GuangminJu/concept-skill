import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ConceptRecord, ConceptRepository, RelationRecord } from "@concept-mcp/core";

interface FileProjectDocument {
  project_id: string;
  concepts: ConceptRecord[];
  relations: RelationRecord[];
}

export interface FileRepositoryOptions {
  rootDir: string;
}

export class FileConceptRepository implements ConceptRepository {
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

  private async loadProject(projectId: string): Promise<FileProjectDocument> {
    const filePath = join(this.options.rootDir, `${projectId}.json`);
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as FileProjectDocument;
  }
}
