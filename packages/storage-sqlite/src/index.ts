import Database from "better-sqlite3";

import type {
  ConceptProposalRecord,
  ConceptRecord,
  ConceptValidationDecisionRecord,
  MutableConceptRepository,
  RelationRecord
} from "@concept-mcp/core";

interface SqliteRepositoryOptions {
  databasePath: string;
  readonly?: boolean;
}

interface ConceptRow {
  id: string;
  name: string;
  kind: ConceptRecord["kind"];
  definition: string;
  boundary: string;
  layer: ConceptRecord["layer"];
  aliases_json: string;
  status: ConceptRecord["status"] | null;
  source_refs_json: string;
  abstraction_level: ConceptRecord["abstraction_level"] | null;
  supported_by_json: string;
}

interface RelationRow {
  from_id: string;
  type: string;
  to_id: string;
}

export class SqliteConceptRepository implements MutableConceptRepository {
  private readonly db: Database.Database;
  private readonly readonly: boolean;

  public constructor(options: SqliteRepositoryOptions) {
    this.readonly = options.readonly ?? true;
    this.db = new Database(options.databasePath, {
      readonly: this.readonly
    });
  }

  public async getProjectConcepts(projectId: string): Promise<ConceptRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT id, name, kind, definition, boundary, layer, aliases_json
              , status, source_refs_json, abstraction_level, supported_by_json
         FROM concepts
         WHERE project_id = ?`
      )
      .all(projectId) as ConceptRow[];
    return rows.map((row) => this.mapConceptRow(row));
  }

  public async getProjectRelations(projectId: string): Promise<RelationRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT from_id, type, to_id
         FROM relations
         WHERE project_id = ?`
      )
      .all(projectId) as RelationRow[];
    return rows.map((row) => ({
      from: row.from_id,
      type: row.type,
      to: row.to_id
    }));
  }

  public async getConceptsByIds(projectId: string, conceptIds: string[]): Promise<ConceptRecord[]> {
    if (conceptIds.length === 0) {
      return [];
    }

    const placeholders = conceptIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT id, name, kind, definition, boundary, layer, aliases_json
              , status, source_refs_json, abstraction_level, supported_by_json
         FROM concepts
         WHERE project_id = ?
           AND id IN (${placeholders})`
      )
      .all(projectId, ...conceptIds) as ConceptRow[];
    return rows.map((row) => this.mapConceptRow(row));
  }

  public async recordConceptProposal(record: ConceptProposalRecord): Promise<ConceptProposalRecord> {
    this.assertWritable();
    const concept = {
      ...record.concept,
      status: record.concept.status ?? "candidate"
    };

    const insertConcept = this.db.prepare(
      `INSERT INTO concepts (
         project_id, id, name, kind, definition, boundary, layer, aliases_json,
         status, source_refs_json, abstraction_level, supported_by_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, id) DO UPDATE SET
         name = excluded.name,
         kind = excluded.kind,
         definition = excluded.definition,
         boundary = excluded.boundary,
         layer = excluded.layer,
         aliases_json = excluded.aliases_json,
         status = excluded.status,
         source_refs_json = excluded.source_refs_json,
         abstraction_level = excluded.abstraction_level,
         supported_by_json = excluded.supported_by_json`
    );
    insertConcept.run(
      record.project_id,
      concept.id,
      concept.name,
      concept.kind,
      concept.definition,
      concept.boundary,
      concept.layer,
      JSON.stringify(concept.aliases),
      concept.status ?? null,
      JSON.stringify(concept.source_refs ?? []),
      concept.abstraction_level ?? null,
      JSON.stringify(concept.supported_by ?? [])
    );

    const insertRelation = this.db.prepare(
      `INSERT OR IGNORE INTO relations (project_id, from_id, type, to_id)
       VALUES (?, ?, ?, ?)`
    );
    for (const relation of record.relations ?? []) {
      insertRelation.run(record.project_id, relation.from, relation.type, relation.to);
    }

    return { ...record, concept };
  }

  public async recordValidationDecision(
    record: ConceptValidationDecisionRecord
  ): Promise<ConceptValidationDecisionRecord> {
    this.assertWritable();
    const recorded = {
      ...record,
      recorded_at: record.recorded_at ?? new Date().toISOString()
    };
    this.db
      .prepare(
        `INSERT INTO validation_decisions (
           project_id, validation_id, candidate_id, judgment, rationale, decided_by, recorded_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        recorded.project_id,
        recorded.validation_id,
        recorded.candidate_id ?? null,
        recorded.judgment,
        recorded.rationale,
        recorded.decided_by ?? null,
        recorded.recorded_at
      );
    return recorded;
  }

  private mapConceptRow(row: ConceptRow): ConceptRecord {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      definition: row.definition,
      boundary: row.boundary,
      layer: row.layer,
      aliases: JSON.parse(row.aliases_json) as string[],
      status: row.status ?? undefined,
      source_refs: JSON.parse(row.source_refs_json) as string[],
      abstraction_level: row.abstraction_level ?? undefined,
      supported_by: JSON.parse(row.supported_by_json) as string[]
    };
  }

  private assertWritable(): void {
    if (this.readonly) {
      throw new Error("SQLite repository is readonly. Set CONCEPT_MCP_SQLITE_READONLY=false to record concepts or decisions.");
    }
  }
}
