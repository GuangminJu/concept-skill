import type { AgentReviewPolicy, ConceptRecord, ConflictCandidate, RelationRecord, Severity } from "./types.js";

export function detectConflictCandidates(
  concepts: ConceptRecord[],
  relations: RelationRecord[]
): ConflictCandidate[] {
  const candidates: ConflictCandidate[] = [];
  const byCanonicalName = new Map<string, ConceptRecord[]>();
  const byAlias = new Map<string, ConceptRecord[]>();

  for (const concept of concepts) {
    const canonical = concept.name.trim().toLowerCase();
    byCanonicalName.set(canonical, [...(byCanonicalName.get(canonical) ?? []), concept]);

    for (const alias of concept.aliases) {
      const normalizedAlias = alias.trim().toLowerCase();
      byAlias.set(normalizedAlias, [...(byAlias.get(normalizedAlias) ?? []), concept]);
    }
  }

  for (const [canonical, matches] of byCanonicalName) {
    if (matches.length > 1) {
      candidates.push({
        candidate_id: `duplicate:${canonical}`,
        conflict_type: "duplicate-identity",
        severity: "high",
        concept_ids: matches.map((item) => item.id),
        title: `Duplicate identity for '${canonical}'`,
        description: "Multiple concepts claim the same canonical name.",
        machine_reason: ["same canonical concept name"],
        evidence_refs: matches.map((item) => `concept://${item.id}`),
        needs_agent_review: true
      });
    }
  }

  for (const [alias, matches] of byAlias) {
    const uniqueIds = [...new Set(matches.map((item) => item.id))];
    if (uniqueIds.length > 1) {
      candidates.push({
        candidate_id: `alias:${alias}`,
        conflict_type: "alias-collision",
        severity: "medium",
        concept_ids: uniqueIds,
        title: `Alias collision for '${alias}'`,
        description: "One alias points to multiple concepts.",
        machine_reason: ["shared alias across multiple concepts"],
        evidence_refs: uniqueIds.map((id) => `concept://${id}`),
        needs_agent_review: true
      });
    }
  }

  for (let index = 0; index < concepts.length; index += 1) {
    for (let offset = index + 1; offset < concepts.length; offset += 1) {
      const left = concepts[index];
      const right = concepts[offset];
      if (overlaps(left.boundary, right.boundary)) {
        candidates.push({
          candidate_id: `boundary:${left.id}:${right.id}`,
          conflict_type: "boundary-overlap",
          severity: left.layer === right.layer ? "medium" : "high",
          concept_ids: [left.id, right.id],
          title: `Boundary overlap between ${left.name} and ${right.name}`,
          description: "Boundary text suggests overlapping ownership across concepts.",
          machine_reason: ["boundary token overlap", `layers: ${left.layer} vs ${right.layer}`],
          evidence_refs: [`concept://${left.id}`, `concept://${right.id}`],
          needs_agent_review: true
        });
      }
    }
  }

  const relationPairs = new Set(relations.map((relation) => `${relation.from}:${relation.to}`));
  for (const relation of relations) {
    if (relation.from !== relation.to && relationPairs.has(`${relation.to}:${relation.from}`)) {
      candidates.push({
        candidate_id: `cycle:${relation.from}:${relation.to}`,
        conflict_type: "cyclic-dependency",
        severity: "high",
        concept_ids: [relation.from, relation.to],
        title: `Possible cyclic dependency between ${relation.from} and ${relation.to}`,
        description: "Two concepts appear to depend on each other.",
        machine_reason: ["bidirectional relation pair found"],
        evidence_refs: [`relation://${relation.from}/${relation.type}/${relation.to}`],
        needs_agent_review: true
      });
    }
  }

  return dedupeCandidates(candidates);
}

export function computeHighestSeverity(candidates: ConflictCandidate[]): Severity {
  if (candidates.length === 0) {
    return "none";
  }

  return candidates.reduce<Exclude<Severity, "none">>((highest, current) => {
    return compareSeverity(current.severity, highest) > 0 ? current.severity : highest;
  }, "low");
}

export function shouldEscalate(candidate: ConflictCandidate, policy: AgentReviewPolicy): boolean {
  return (
    policy.require_independent_agent &&
    compareSeverity(candidate.severity, policy.min_severity) >= 0 &&
    policy.trigger_on.includes(candidate.conflict_type)
  );
}

function compareSeverity(left: Exclude<Severity, "none">, right: Exclude<Severity, "none">): number {
  const order: Exclude<Severity, "none">[] = ["low", "medium", "high", "critical"];
  return order.indexOf(left) - order.indexOf(right);
}

function dedupeCandidates(candidates: ConflictCandidate[]): ConflictCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.candidate_id)) {
      return false;
    }
    seen.add(candidate.candidate_id);
    return true;
  });
}

function overlaps(leftBoundary: string, rightBoundary: string): boolean {
  const leftTokens = tokenize(leftBoundary);
  const rightTokens = tokenize(rightBoundary);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return false;
  }

  let overlapCount = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlapCount += 1;
    }
  }
  return overlapCount >= 2;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_]+/i)
      .filter((token) => token.length >= 4)
  );
}
