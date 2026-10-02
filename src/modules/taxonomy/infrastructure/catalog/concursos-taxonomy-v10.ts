import type { CatalogArea, CatalogDiscipline, CatalogKnowledgeArea, CatalogSubtopic, CatalogTopic } from "../../domain/canonical-taxonomy-catalog";

import { area, topic } from "./concursos-taxonomy-additions";
import { SAUDE } from "./concursos-taxonomy-v7";

/*
 * v10: gaps found when publishing the exams imported in bulk (2018-2019
 * municipal, university and police boards, 2023-2025 MP exams): specific
 * knowledge of positions that had no discipline (cartography and surveying,
 * public works and maintenance, work safety, veterinary medicine, nutrition),
 * plus areas and topics inside existing disciplines. Same editing rules: names
 * are stable, only additions; board section names go in aliases.
 */

export const ENGENHARIA = "engenharia-obras-e-operacoes";
export const AGRARIAS = "ciencias-agrarias-e-veterinarias";

export const V10_KNOWLEDGE_AREAS: readonly CatalogKnowledgeArea[] = [
  { slug: ENGENHARIA, name: "Engenharia, Obras e Operações" },
  { slug: AGRARIAS, name: "Ciências Agrárias e Veterinárias" },
];

/** v10 areas added to existing disciplines, keyed by discipline name. */
export const V10_AREAS_FOR_EXISTING: Readonly<Record<string, readonly CatalogArea[]>> = {
  "Língua Portuguesa": [
    area(
      "Redação Oficial",
      [
        topic("Manual de Redação da Presidência da República", [], ["Padrão ofício"]),
        topic("Correspondência Oficial", ["Ofício", "Aviso", "Memorando", "Requerimento"], ["Expedientes oficiais"]),
        topic("Finalidade e Características da Redação Oficial", [], ["Impessoalidade e formalidade"]),
      ],
      ["Redação Oficial e Correspondência"],
    ),
  ],
  "Educação Física": [
    area(
      "Fisiologia do Exercício e Treinamento",
      [
        topic("Bioenergética e Sistemas Energéticos", ["ATP-CP", "Glicólise", "Sistema oxidativo"]),
        topic("Princípios do Treinamento Desportivo", ["Sobrecarga", "Adaptação ao esforço", "Carga de treino"]),
        topic("Prescrição de Exercícios", ["Exercício aeróbico", "Exercício de resistência", "Frequência cardíaca"]),
        topic("Atividade Física em Grupos Especiais", ["Envelhecimento", "Saúde mental"]),
      ],
      ["Fisiologia do Esforço"],
    ),
    area("Biomecânica e Avaliação Física", [
      topic("Biomecânica", ["Cinemática", "Cinética"]),
      topic("Cineantropometria e Avaliação Física", ["Ergometria", "Medidas e avaliação"]),
    ]),
    area("Saúde Coletiva e Práticas Corporais", [
      topic("Programa Academia da Saúde"),
      topic("Promoção da Saúde e Intersetorialidade"),
      topic("Epidemiologia da Atividade Física"),
    ]),
  ],
  "Clínica Médica": [
    area(
      "Otorrinolaringologia",
      [
        topic("Ouvido e Audição", ["Otites", "Surdez", "Triagem auditiva neonatal"]),
        topic("Nariz e Seios Paranasais", ["Rinossinusites", "Polipose nasossinusal", "Respirador oral"]),
        topic("Laringe, Faringe e Vias Aéreas", ["Paralisia laríngea", "Estridor", "Apneia obstrutiva do sono"]),
        topic("Glândulas Salivares e Cabeça e Pescoço"),
      ],
      ["Otorrino"],
    ),
    area("Atenção Primária e Saúde da Mulher", [
      topic("Atenção Primária e Saúde da Família", ["Visita domiciliar"]),
      topic("Saúde da Mulher e Câncer Ginecológico"),
    ]),
  ],
  Economia: [
    area("Elaboração e Avaliação de Projetos", [
      topic("Análise de Investimentos", ["Valor presente líquido", "Taxa interna de retorno", "Payback"]),
      topic("Análise Custo-Benefício"),
    ]),
  ],
  Atualidades: [
    area(
      "Conhecimentos sobre o Município e a Região",
      [
        topic("História do Município", [], ["Colonização do município"]),
        topic("Geografia do Município e da Região", [], ["Aspectos geográficos locais"]),
        topic("Lei Orgânica Municipal"),
      ],
      ["Conhecimentos Gerais do Município"],
    ),
  ],
};

/** v10 topics added to existing areas: discipline → area → topics. */
export const V10_TOPICS_FOR_EXISTING: Readonly<Record<string, Readonly<Record<string, readonly CatalogTopic[]>>>> = {
  "Legislação Institucional": {
    "Legislação Estadual": [
      topic("Códigos de Ética e Disciplina Militar", ["Transgressões e sanções disciplinares", "Recompensas"], ["Código Disciplinar dos Militares"]),
      topic("Organização Básica das Corporações Estaduais", [], ["Lei de Organização Básica"]),
      topic("Organização do Ministério Público Estadual", [], ["Lei Orgânica do Ministério Público"]),
      topic("Organização Judiciária Estadual", [], ["Lei de Organização Judiciária"]),
      topic("Leis Estaduais Específicas do Órgão", [], ["Taxas, quadro de pessoal e carreiras do órgão"]),
    ],
  },
};

/** v10 subtopics added to existing topics: discipline → topic → subtopics. */
export const V10_SUBTOPICS_FOR_EXISTING: Readonly<Record<string, Readonly<Record<string, readonly CatalogSubtopic[]>>>> = {};

export const V10_DISCIPLINES: readonly CatalogDiscipline[] = [
  {
    name: "Topografia e Cartografia",
    knowledgeAreaSlug: ENGENHARIA,
    aliases: ["Conhecimentos Específicos - Engenharia Cartográfica", "Cartografia", "Topografia", "Geoprocessamento"],
    areas: [
      area("Cartografia", [
        topic("Escala e Representação do Relevo", ["Escala numérica e gráfica", "Curvas de nível"]),
        topic("Projeções Cartográficas", ["UTM", "Classificação das projeções"]),
        topic("Sistemas de Referência e Geodésia", ["Sistemas geocêntricos", "Datum e elipsoide"]),
        topic("Geoprocessamento e SIG", ["Dados geográficos", "Imagens de satélite", "Sensoriamento remoto"]),
      ]),
      area("Topografia", [
        topic("Levantamentos Topográficos", ["Planimetria", "Altimetria"]),
        topic("Cálculo de Distâncias, Áreas e Coordenadas"),
      ]),
      area("Cadastro e Avaliação de Imóveis", [
        topic("Cadastro Técnico Municipal", [], ["Cadastro imobiliário"]),
        topic("Avaliação de Imóveis Urbanos", [], ["NBR 14653"]),
      ]),
    ],
  },
  {
    name: "Obras e Manutenção",
    knowledgeAreaSlug: ENGENHARIA,
    aliases: ["Conhecimentos Específicos - Auxiliar de Operações", "Conhecimentos de Operações", "Serviços Gerais"],
    areas: [
      area("Materiais e Serviços de Construção", [
        topic("Aglomerantes, Argamassas e Concreto"),
        topic("Alvenaria, Reboco e Pintura", ["Preparo de superfícies"]),
        topic("Instalações Hidrossanitárias", ["Redes de esgoto", "Tubulações"]),
      ]),
      area("Ferramentas e Equipamentos", [topic("Ferramentas Elétricas e Manuais", ["Furadeira e brocas"])]),
      area("Jardinagem e Conservação", [topic("Plantio, Capina e Jardinagem")]),
    ],
  },
  {
    name: "Segurança do Trabalho",
    knowledgeAreaSlug: ENGENHARIA,
    aliases: ["Saúde e Segurança do Trabalho", "Segurança e Medicina do Trabalho"],
    areas: [
      area("Prevenção de Acidentes", [
        topic("Acidente de Trabalho", ["Conceitos e NBR 14280"], ["CAT"]),
        topic("Sinalização e Identificação de Segurança", ["NR-26"]),
      ]),
      area("Normas Regulamentadoras", [
        topic("Equipamentos de Proteção Individual", ["NR-06"], ["EPI"]),
        topic("Demais Normas Regulamentadoras"),
      ]),
    ],
  },
  {
    name: "Medicina Veterinária",
    knowledgeAreaSlug: AGRARIAS,
    aliases: ["Conhecimentos Específicos - Veterinária", "Auxiliar de Veterinária", "Zootecnia"],
    areas: [
      area("Manejo e Contenção de Animais", [topic("Contenção de Cães e Gatos"), topic("Contenção de Equinos e Grandes Animais")]),
      area("Clínica e Procedimentos Veterinários", [
        topic("Coleta e Acondicionamento de Material", ["Hemograma"]),
        topic("Vias de Administração de Medicamentos", ["Via intramuscular"]),
        topic("Estrutura e Rotina de Ambulatório Veterinário"),
      ]),
      area("Sanidade Animal", [topic("Vacinação e Doenças de Cães e Gatos"), topic("Classificação dos Seres Vivos")]),
      area("Defesa Agropecuária", [topic("Defesa Sanitária Animal e Vegetal"), topic("Fiscalização e Taxas de Serviços Agropecuários")]),
    ],
  },
  {
    name: "Nutrição",
    knowledgeAreaSlug: SAUDE,
    aliases: ["Conhecimentos Específicos - Nutrição", "Nutrição e Dietética"],
    areas: [
      area("Nutrição Básica e Clínica", [
        topic("Nutrientes e Carências Nutricionais", ["Deficiência de ferro", "Anemias"]),
        topic("Avaliação do Estado Nutricional"),
        topic("Dietoterapia"),
      ]),
      area("Alimentos e Técnica Dietética", [topic("Composição e Valor Nutritivo dos Alimentos"), topic("Higiene e Segurança dos Alimentos")]),
      area("Nutrição em Saúde Pública", [topic("Programas de Alimentação e Nutrição"), topic("Educação Alimentar e Nutricional")]),
    ],
  },
];

/** Appends the v10 topics and subtopics to a discipline; fails on a parent name that does not exist. */
export function withV10Additions(discipline: CatalogDiscipline): CatalogDiscipline {
  const topics = V10_TOPICS_FOR_EXISTING[discipline.name] ?? {};
  const subtopics = V10_SUBTOPICS_FOR_EXISTING[discipline.name] ?? {};
  const pendingAreas = new Set(Object.keys(topics));
  const pendingTopics = new Set(Object.keys(subtopics));

  if (pendingAreas.size === 0 && pendingTopics.size === 0) return discipline;

  const areas = discipline.areas.map((current) => {
    pendingAreas.delete(current.name);

    return {
      ...current,
      topics: [...current.topics, ...(topics[current.name] ?? [])].map((item) => {
        const extra = subtopics[item.name];

        if (!extra) return item;
        pendingTopics.delete(item.name);

        return { ...item, subtopics: [...(item.subtopics ?? []), ...extra] };
      }),
    };
  });
  const missing = [...pendingAreas, ...pendingTopics];

  if (missing.length > 0) {
    throw new Error(`Catalog v10: parent not found in ${discipline.name}: ${missing.join(", ")}`);
  }

  return { ...discipline, areas };
}
