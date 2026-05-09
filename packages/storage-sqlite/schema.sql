CREATE TABLE concepts (
    project_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    definition TEXT NOT NULL,
    boundary TEXT NOT NULL,
    layer TEXT NOT NULL,
    aliases_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (project_id, id)
);

CREATE TABLE relations (
    project_id TEXT NOT NULL,
    from_id TEXT NOT NULL,
    type TEXT NOT NULL,
    to_id TEXT NOT NULL,
    PRIMARY KEY (project_id, from_id, type, to_id)
);

CREATE INDEX relations_project_from_idx ON relations (project_id, from_id);
CREATE INDEX relations_project_to_idx ON relations (project_id, to_id);
