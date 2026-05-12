import type { ConceptProposalRecord, ConceptRecord, ConceptValidationDecisionRecord, RelationRecord } from "./types.js";

export interface ConceptRepository {
  getProjectConcepts(projectId: string): Promise<ConceptRecord[]>;
  getProjectRelations(projectId: string): Promise<RelationRecord[]>;
  getConceptsByIds(projectId: string, conceptIds: string[]): Promise<ConceptRecord[]>;
}

export interface MutableConceptRepository extends ConceptRepository {
  recordConceptProposal(record: ConceptProposalRecord): Promise<ConceptProposalRecord>;
  recordValidationDecision(record: ConceptValidationDecisionRecord): Promise<ConceptValidationDecisionRecord>;
}
