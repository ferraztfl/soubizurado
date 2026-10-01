import type { CanonicalTaxonomyCatalog, CatalogDiscipline } from "../../domain/canonical-taxonomy-catalog";

import {
  CONCURSOS_AREAS_FOR_EXISTING,
  CONCURSOS_DISCIPLINES,
  CONCURSOS_KNOWLEDGE_AREAS,
} from "./concursos-taxonomy-additions";
import { V7_AREAS_FOR_EXISTING, V7_DISCIPLINES, V7_KNOWLEDGE_AREAS } from "./concursos-taxonomy-v7";
import { V8_AREAS_FOR_EXISTING, V8_DISCIPLINES } from "./concursos-taxonomy-v8";
import { V9_AREAS_FOR_EXISTING, V9_SUBTOPICS_FOR_EXISTING, V9_TOPICS_FOR_EXISTING, withV9Additions } from "./concursos-taxonomy-v9";
import { ENEM_CANONICAL_TAXONOMY_V1 } from "./enem-canonical-taxonomy-v1";

/** Appends extra areas (from later catalog versions) to a discipline, keeping its own areas first. */
function withAreas(discipline: CatalogDiscipline, ...sources: readonly Readonly<Record<string, readonly CatalogDiscipline["areas"][number][]>>[]) {
  const extraAreas = sources.flatMap((source) => source[discipline.name] ?? []);
  return extraAreas.length > 0 ? { ...discipline, areas: [...discipline.areas, ...extraAreas] } : discipline;
}

/** Applies the v9 additions and fails when one of them names a discipline that does not exist. */
function withKnownParents(disciplines: readonly CatalogDiscipline[]): readonly CatalogDiscipline[] {
  const names = new Set(disciplines.map((discipline) => discipline.name));
  const unknown = [...Object.keys(V9_AREAS_FOR_EXISTING), ...Object.keys(V9_TOPICS_FOR_EXISTING), ...Object.keys(V9_SUBTOPICS_FOR_EXISTING)].filter(
    (name) => !names.has(name),
  );

  if (unknown.length > 0) throw new Error(`Catalog v9: discipline not found: ${unknown.join(", ")}`);

  return disciplines.map(withV9Additions);
}

/**
 * Current canonical catalog. Version history:
 * - v1: ENEM / Ensino Médio.
 * - v2: + public-service exam disciplines (Ciências Jurídicas,
 *   Tecnologia da Informação, Raciocínio Lógico, Estatística) and
 *   regional history areas, with aliases for board section names.
 * - v3: + "Legislação Estadual" in Legislação Institucional (state
 *   military/servant statutes, state police organic laws).
 * - v4: + "Estatuto da Pessoa com Deficiência" in Legislação Penal
 *   Especial.
 * - v5: + "Administração Geral" (new area "Administração e Gestão") for
 *   administrative positions.
 * - v6: + "Libras" (Linguagens) for sign-language interpreter exams.
 * - v7: + the remaining common public-service disciplines (civil, labor,
 *   tax, financial and other law branches; Medicina Legal, Criminologia,
 *   Criminalística; AFO, Arquivologia, Gestão Pública; accounting and
 *   economics; technical IT; public health; education; Atualidades) and
 *   regional geography, for large-scale imports.
 * - v8: + Clínica Médica, Cirurgia Geral and Odontologia (health positions
 *   of military exams) and "Gestão em Saúde" in Saúde Pública.
 * - v9: + topics and subtopics inside existing areas/topics, and new areas,
 *   requested during manual classification review (e.g. "Invasões holandesas" in
 *   Brasil Colônia).
 *
 * The seed is create-only, so applying a new version only adds entries.
 */
export const CANONICAL_TAXONOMY: CanonicalTaxonomyCatalog = {
  version: 9,
  summary:
    "Catálogo canônico v9: ENEM/Ensino Médio + disciplinas de concursos públicos (ramos do direito, perícia, administração, contabilidade e economia, TI, saúde pública e gestão em saúde, clínica médica, cirurgia geral, odontologia, educação, atualidades), história e geografia regionais.",
  knowledgeAreas: [
    ...ENEM_CANONICAL_TAXONOMY_V1.knowledgeAreas,
    ...CONCURSOS_KNOWLEDGE_AREAS,
    ...V7_KNOWLEDGE_AREAS,
  ],
  disciplines: withKnownParents([
    ...ENEM_CANONICAL_TAXONOMY_V1.disciplines.map((discipline) =>
      withAreas(discipline, CONCURSOS_AREAS_FOR_EXISTING, V7_AREAS_FOR_EXISTING, V8_AREAS_FOR_EXISTING, V9_AREAS_FOR_EXISTING),
    ),
    ...CONCURSOS_DISCIPLINES.map((discipline) => withAreas(discipline, V8_AREAS_FOR_EXISTING, V9_AREAS_FOR_EXISTING)),
    ...V7_DISCIPLINES.map((discipline) => withAreas(discipline, V8_AREAS_FOR_EXISTING, V9_AREAS_FOR_EXISTING)),
    ...V8_DISCIPLINES.map((discipline) => withAreas(discipline, V9_AREAS_FOR_EXISTING)),
  ]),
};
