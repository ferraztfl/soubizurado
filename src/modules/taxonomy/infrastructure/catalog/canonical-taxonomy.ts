import type { CanonicalTaxonomyCatalog } from "../../domain/canonical-taxonomy-catalog";

import {
  CONCURSOS_AREAS_FOR_EXISTING,
  CONCURSOS_DISCIPLINES,
  CONCURSOS_KNOWLEDGE_AREAS,
} from "./concursos-taxonomy-additions";
import { ENEM_CANONICAL_TAXONOMY_V1 } from "./enem-canonical-taxonomy-v1";

/**
 * Current canonical catalog. Version history:
 * - v1: ENEM / Ensino Médio.
 * - v2: + public-service exam disciplines (Ciências Jurídicas,
 *   Tecnologia da Informação, Raciocínio Lógico, Estatística) and
 *   regional history areas, with aliases for board section names.
 *
 * The seed is create-only, so applying v2 over v1 only adds entries.
 */
export const CANONICAL_TAXONOMY: CanonicalTaxonomyCatalog = {
  version: 2,
  summary:
    "Catálogo canônico v2: ENEM/Ensino Médio + disciplinas de concursos públicos (jurídicas, informática, raciocínio lógico, estatística) e história regional.",
  knowledgeAreas: [
    ...ENEM_CANONICAL_TAXONOMY_V1.knowledgeAreas,
    ...CONCURSOS_KNOWLEDGE_AREAS,
  ],
  disciplines: [
    ...ENEM_CANONICAL_TAXONOMY_V1.disciplines.map((discipline) => {
      const extraAreas = CONCURSOS_AREAS_FOR_EXISTING[discipline.name];

      return extraAreas
        ? { ...discipline, areas: [...discipline.areas, ...extraAreas] }
        : discipline;
    }),
    ...CONCURSOS_DISCIPLINES,
  ],
};
