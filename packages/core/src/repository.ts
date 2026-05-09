import type { ConceptRecord, RelationRecord } from "./types.js";

export interface ConceptRepository {
  getProjectConcepts(projectId: string): Promise<ConceptRecord[]>;
  getProjectRelations(projectId: string): Promise<RelationRecord[]>;
  getConceptsByIds(projectId: string, conceptIds: string[]): Promise<ConceptRecord[]>;
}
