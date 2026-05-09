import Database from "better-sqlite3";

import type { ConceptRecord, ConceptRepository, RelationRecord } from "@concept-mcp/core";

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
}

interface RelationRow {
  from_id: string;
  type: string;
  to_id: string;
}

export class SqliteConceptRepository implements ConceptRepository {
  private readonly db: Database.Database;

  public constructor(options: SqliteRepositoryOptions) {
    this.db = new Database(options.databasePath, {
      readonly: options.readonly ?? true
    });
  }

  public async getProjectConcepts(projectId: string): Promise<ConceptRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT id, name, kind, definition, boundary, layer, aliases_json
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
         FROM concepts
         WHERE project_id = ?
           AND id IN (${placeholders})`
      )
      .all(projectId, ...conceptIds) as ConceptRow[];
    return rows.map((row) => this.mapConceptRow(row));
  }

  private mapConceptRow(row: ConceptRow): ConceptRecord {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      definition: row.definition,
      boundary: row.boundary,
      layer: row.layer,
      aliases: JSON.parse(row.aliases_json) as string[]
    };
  }
}
