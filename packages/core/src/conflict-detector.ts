import type {
  AgentReviewPolicy,
  ConceptLayer,
  ConceptRecord,
  ConflictCandidate,
  RelationRecord,
  Severity
} from "./types.js";

export interface ConflictDetectionOptions {
  sensitivity?: "low" | "medium" | "high";
  includeEvidence?: boolean;
  scopeConceptIds?: string[];
}

const FORWARD_SUPPORT_RELATION_TYPES = new Set([
  "depends-on",
  "uses",
  "applies",
  "annotated-by",
  "validated-by",
  "described-by",
  "specializes",
  "materializes-from",
  "loads",
  "delegates",
  "contains",
  "provides",
  "scopes",
  "obeys",
  "targets",
  "samples",
  "hosts",
  "supports-hook"
]);

const REVERSE_SUPPORT_RELATION_TYPES = new Set([
  "instantiates"
]);

export function detectConflictCandidates(
  concepts: ConceptRecord[],
  relations: RelationRecord[],
  options: ConflictDetectionOptions = {}
): ConflictCandidate[] {
  const candidates: ConflictCandidate[] = [];
  const sensitivity = options.sensitivity ?? "medium";
  const byCanonicalName = new Map<string, ConceptRecord[]>();
  const byAlias = new Map<string, ConceptRecord[]>();
  const byId = new Map<string, ConceptRecord>();
  const supportMap = new Map<string, Set<string>>();

  for (const concept of concepts) {
    byId.set(concept.id, concept);
    supportMap.set(concept.id, new Set(concept.supported_by ?? []));

    const canonical = concept.name.trim().toLowerCase();
    byCanonicalName.set(canonical, [...(byCanonicalName.get(canonical) ?? []), concept]);

    for (const alias of concept.aliases) {
      const normalizedAlias = alias.trim().toLowerCase();
      byAlias.set(normalizedAlias, [...(byAlias.get(normalizedAlias) ?? []), concept]);
    }
  }

  for (const relation of relations) {
    if (FORWARD_SUPPORT_RELATION_TYPES.has(relation.type) && byId.has(relation.from) && byId.has(relation.to)) {
      supportMap.get(relation.from)?.add(relation.to);
    }
    if (REVERSE_SUPPORT_RELATION_TYPES.has(relation.type) && byId.has(relation.from) && byId.has(relation.to)) {
      supportMap.get(relation.to)?.add(relation.from);
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
      if (overlaps(left.boundary, right.boundary, sensitivity)) {
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

  for (const concept of concepts) {
    const supportIds = [...(supportMap.get(concept.id) ?? new Set<string>())]
      .filter((id) => id !== concept.id && byId.has(id));
    const supportConcepts = supportIds
      .map((id) => byId.get(id))
      .filter((item): item is ConceptRecord => Boolean(item));
    const alignedSupport = supportConcepts.filter((support) => isSupportingLayer(support.layer, concept.layer));

    if ((concept.abstraction_level === "composite" || concept.abstraction_level === "specialized") && alignedSupport.length === 0) {
      candidates.push({
        candidate_id: `hierarchy:${concept.id}`,
        conflict_type: "hierarchy-support-gap",
        severity: concept.abstraction_level === "specialized" ? "critical" : "high",
        concept_ids: [concept.id],
        title: `Hierarchy support gap for ${concept.name}`,
        description:
          "This higher-level concept is not supported by lower-level concepts. Composite and specialized concepts must be grounded in reusable lower-level concepts.",
        machine_reason: [
          `abstraction_level=${concept.abstraction_level}`,
          "no lower-layer or same-layer support concepts found"
        ],
        evidence_refs: [`concept://${concept.id}`],
        needs_agent_review: true
      });
    }

    if (concept.abstraction_level === "specialized" && alignedSupport.length > 0) {
      candidates.push({
        candidate_id: `inflation:${concept.id}`,
        conflict_type: "concept-inflation",
        severity: "critical",
        concept_ids: [concept.id, ...alignedSupport.map((support) => support.id)],
        title: `Concept inflation detected for ${concept.name}`,
        description:
          "This concept is a specialization layered on top of reusable lower-level concepts. Concrete gameplay specializations should be composed from generic concepts, not registered as first-class concepts.",
        machine_reason: [
          "specialized concept declared",
          `supported_by=${alignedSupport.map((support) => support.id).join(",")}`
        ],
        evidence_refs: [
          `concept://${concept.id}`,
          ...alignedSupport.map((support) => `concept://${support.id}`)
        ],
        needs_agent_review: true
      });
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

  const scopedCandidates = filterByScope(candidates, options.scopeConceptIds);
  const dedupedCandidates = dedupeCandidates(scopedCandidates);
  if (options.includeEvidence === false) {
    return dedupedCandidates.map((candidate) => ({
      ...candidate,
      evidence_refs: []
    }));
  }
  return dedupedCandidates;
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

function filterByScope(candidates: ConflictCandidate[], scopeConceptIds?: string[]): ConflictCandidate[] {
  if (!scopeConceptIds?.length) {
    return candidates;
  }

  const scope = new Set(scopeConceptIds);
  return candidates.filter((candidate) => candidate.concept_ids.some((conceptId) => scope.has(conceptId)));
}

function isSupportingLayer(supportLayer: ConceptLayer, targetLayer: ConceptLayer): boolean {
  if (supportLayer === "cross-cutting" || targetLayer === "cross-cutting") {
    return true;
  }

  const order: Exclude<ConceptLayer, "cross-cutting">[] = ["data", "domain", "application", "interface"];
  return order.indexOf(supportLayer as Exclude<ConceptLayer, "cross-cutting">) <=
    order.indexOf(targetLayer as Exclude<ConceptLayer, "cross-cutting">);
}

function overlaps(leftBoundary: string, rightBoundary: string, sensitivity: "low" | "medium" | "high"): boolean {
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
  const thresholdBySensitivity = {
    low: 4,
    medium: 3,
    high: 2
  } as const;
  return overlapCount >= thresholdBySensitivity[sensitivity];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9_]+/i)
      .filter((token) => token.length >= 4)
  );
}
