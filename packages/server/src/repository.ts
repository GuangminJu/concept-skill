import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ConceptRecord, ConceptRepository, RelationRecord } from "@concept-mcp/core";

interface DemoProjectFile {
  project_id: string;
  concepts: ConceptRecord[];
  relations: RelationRecord[];
}

export class DemoConceptRepository implements ConceptRepository {
  private readonly dataDir: string;

  public constructor() {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    this.dataDir = join(currentDir, "..", "data");
  }

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

  private async loadProject(projectId: string): Promise<DemoProjectFile> {
    const projects = await loadProjects(this.dataDir);
    const data = projects.get(projectId);
    if (!data) {
      const availableProjects = [...projects.keys()].sort().join(", ");
      throw new Error(
        `Unknown project_id '${projectId}'. Demo repository exposes: ${availableProjects || "(none)"}.`
      );
    }
    return data;
  }
}

async function loadProjects(dataDir: string): Promise<Map<string, DemoProjectFile>> {
  const fileNames = (await readdir(dataDir)).filter((fileName) => fileName.endsWith(".json"));
  const entries = await Promise.all(
    fileNames.map(async (fileName) => {
      const raw = await readFile(join(dataDir, fileName), "utf8");
      const data = JSON.parse(raw) as DemoProjectFile;
      return [data.project_id, data] as const;
    })
  );

  const projects = new Map<string, DemoProjectFile>();
  for (const [projectId, data] of entries) {
    if (projects.has(projectId)) {
      throw new Error(`Duplicate demo project_id '${projectId}' in ${dataDir}.`);
    }
    projects.set(projectId, data);
  }
  return projects;
}
