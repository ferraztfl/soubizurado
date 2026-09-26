import type {
  CatalogArea,
  CatalogDiscipline,
  CatalogKnowledgeArea,
  CatalogSubtopic,
  CatalogTopic,
} from "../../domain/canonical-taxonomy-catalog";

/*
 * Public-service exam ("concursos") additions to the canonical
 * taxonomy. Merged with the ENEM catalog in canonical-taxonomy.ts.
 *
 * Discipline aliases cover the section names printed by exam boards
 * (e.g. "Legislação Extravagante", "Informática Básica"), so imported
 * booklets resolve to canonical disciplines instead of creating new
 * ones. Same editing rules as the ENEM catalog apply.
 */

type SubtopicInput = string | CatalogSubtopic;

function topic(
  name: string,
  subtopics: readonly SubtopicInput[] = [],
  aliases: readonly string[] = [],
): CatalogTopic {
  return {
    name,
    aliases,
    subtopics: subtopics.map((subtopic) =>
      typeof subtopic === "string" ? { name: subtopic } : subtopic,
    ),
  };
}

function area(
  name: string,
  topics: readonly CatalogTopic[],
  aliases: readonly string[] = [],
): CatalogArea {
  return { name, aliases, topics };
}

export const JURIDICAS = "ciencias-juridicas";
export const TECNOLOGIA = "tecnologia-da-informacao";
const MATEMATICA = "matematica-e-suas-tecnologias";

export const CONCURSOS_KNOWLEDGE_AREAS: readonly CatalogKnowledgeArea[] = [
  { slug: JURIDICAS, name: "Ciências Jurídicas" },
  { slug: TECNOLOGIA, name: "Tecnologia da Informação" },
];

/** Areas added to existing ENEM disciplines, keyed by discipline name. */
export const CONCURSOS_AREAS_FOR_EXISTING: Readonly<Record<string, readonly CatalogArea[]>> = {
  História: [
    area("História Regional", [
      topic("História de Pernambuco", [
        "Capitania de Pernambuco",
        "Invasões holandesas",
        "Revoluções pernambucanas",
      ]),
      topic("História de Minas Gerais"),
      topic("História do Rio Grande do Sul"),
    ]),
  ],
};

export const CONCURSOS_DISCIPLINES: readonly CatalogDiscipline[] = [
  // --------------------------------------------------------------
  {
    name: "Direito Constitucional",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Direito Constitucional", "Direitos e Garantias Fundamentais"],
    areas: [
      area("Teoria da Constituição", [
        topic("Conceito e Classificação das Constituições"),
        topic("Poder Constituinte"),
        topic("Aplicabilidade das Normas Constitucionais"),
        topic("Princípios Fundamentais", [], ["Fundamentos da República"]),
      ]),
      area("Direitos e Garantias Fundamentais na Constituição", [
        topic("Direitos e Deveres Individuais e Coletivos", [
          "Direito à vida e à liberdade",
          "Inviolabilidade do domicílio e sigilos",
          "Garantias penais e processuais",
        ], ["Artigo 5º"]),
        topic("Remédios Constitucionais", [
          "Habeas corpus",
          "Mandado de segurança",
          "Mandado de injunção",
          "Habeas data",
          "Ação popular",
        ]),
        topic("Direitos Sociais"),
        topic("Nacionalidade"),
        topic("Direitos Políticos"),
      ]),
      area("Organização do Estado", [
        topic("Organização Político-Administrativa"),
        topic("Competências da União, Estados e Municípios", [], ["Repartição de competências"]),
        topic("Intervenção Federal e Estadual"),
      ]),
      area("Organização dos Poderes", [
        topic("Poder Legislativo", ["Processo legislativo", "Fiscalização contábil e orçamentária"]),
        topic("Poder Executivo"),
        topic("Poder Judiciário"),
        topic("Funções Essenciais à Justiça"),
      ]),
      area("Administração Pública na Constituição", [
        topic("Disposições Gerais da Administração Pública", [], ["Artigo 37"]),
        topic("Servidores Públicos na Constituição"),
      ]),
      area("Defesa do Estado e das Instituições", [
        topic("Estado de Defesa e Estado de Sítio"),
        topic("Forças Armadas"),
        topic("Segurança Pública", ["Polícias e suas atribuições", "Polícia penal"]),
      ]),
      area("Ordem Social na Constituição", [
        topic("Meio Ambiente na Constituição"),
        topic("Povos Indígenas na Constituição"),
        topic("Família, Criança, Adolescente e Idoso"),
      ]),
      area("Controle de Constitucionalidade", [
        topic("Controle Difuso"),
        topic("Controle Concentrado"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Direito Administrativo",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Direito Administrativo"],
    areas: [
      area("Fundamentos do Direito Administrativo", [
        topic("Princípios da Administração Pública", ["Legalidade, impessoalidade, moralidade, publicidade e eficiência"]),
        topic("Regime Jurídico-Administrativo"),
      ]),
      area("Organização Administrativa", [
        topic("Administração Direta e Indireta", ["Autarquias", "Fundações públicas", "Empresas públicas e sociedades de economia mista"]),
        topic("Descentralização e Desconcentração"),
        topic("Terceiro Setor"),
      ]),
      area("Agentes Públicos", [
        topic("Regime Jurídico dos Servidores", ["Provimento e vacância", "Direitos e vantagens", "Regime disciplinar"]),
        topic("Responsabilidade dos Agentes Públicos"),
      ]),
      area("Atos e Poderes Administrativos", [
        topic("Atos Administrativos", ["Requisitos e atributos", "Classificação", "Extinção, anulação e revogação"]),
        topic("Poderes Administrativos", ["Poder de polícia", "Poder hierárquico", "Poder disciplinar", "Poder regulamentar"]),
      ]),
      area("Licitações e Contratos", [
        topic("Licitações", ["Modalidades", "Contratação direta"], ["Lei 14.133/2021"]),
        topic("Contratos Administrativos"),
      ]),
      area("Controle e Responsabilidade", [
        topic("Improbidade Administrativa", [], ["Lei 8.429/1992"]),
        topic("Responsabilidade Civil do Estado"),
        topic("Controle da Administração Pública"),
        topic("Processo Administrativo", [], ["Lei 9.784/1999"]),
      ]),
      area("Serviços e Bens Públicos", [
        topic("Serviços Públicos"),
        topic("Bens Públicos"),
        topic("Intervenção do Estado na Propriedade"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Direito Penal",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Direito Penal"],
    areas: [
      area("Parte Geral do Direito Penal", [
        topic("Aplicação da Lei Penal", ["Lei penal no tempo", "Lei penal no espaço"]),
        topic("Teoria do Crime", ["Fato típico", "Ilicitude e excludentes", "Culpabilidade", "Tentativa e consumação"]),
        topic("Concurso de Pessoas"),
        topic("Penas", ["Espécies de pena", "Aplicação da pena", "Concurso de crimes"]),
        topic("Extinção da Punibilidade", ["Prescrição"]),
      ]),
      area("Parte Especial do Direito Penal", [
        topic("Crimes contra a Pessoa", ["Homicídio", "Lesão corporal", "Crimes contra a honra", "Crimes contra a liberdade individual"]),
        topic("Crimes contra o Patrimônio", ["Furto", "Roubo", "Extorsão", "Estelionato", "Receptação"]),
        topic("Crimes contra a Dignidade Sexual"),
        topic("Crimes contra a Administração Pública", ["Peculato", "Concussão e corrupção", "Prevaricação", "Crimes praticados por particular"]),
        topic("Crimes contra a Fé Pública"),
        topic("Crimes contra a Paz Pública"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Direito Processual Penal",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Direito Processual Penal", "Processo Penal"],
    areas: [
      area("Investigação e Ação Penal", [
        topic("Inquérito Policial"),
        topic("Ação Penal"),
        topic("Competência Criminal"),
      ]),
      area("Prisões e Medidas Cautelares", [
        topic("Prisão em Flagrante"),
        topic("Prisão Preventiva e Temporária"),
        topic("Medidas Cautelares Diversas da Prisão"),
        topic("Audiência de Custódia"),
      ]),
      area("Provas no Processo Penal", [
        topic("Teoria Geral da Prova"),
        topic("Meios de Prova", ["Busca e apreensão", "Interrogatório", "Prova testemunhal", "Exame de corpo de delito"]),
      ]),
      area("Procedimentos e Recursos", [
        topic("Procedimentos Penais"),
        topic("Recursos no Processo Penal"),
        topic("Habeas Corpus no Processo Penal"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Direito Penal Militar",
    knowledgeAreaSlug: JURIDICAS,
    areas: [
      area("Parte Geral do Direito Penal Militar", [
        topic("Aplicação da Lei Penal Militar"),
        topic("Crime Militar", ["Crime propriamente militar", "Crime impropriamente militar"]),
        topic("Penas no Direito Penal Militar"),
      ]),
      area("Crimes Militares em Tempo de Paz", [
        topic("Crimes contra a Autoridade ou Disciplina Militar", ["Motim e revolta", "Insubordinação", "Desrespeito a superior"]),
        topic("Crimes contra o Serviço e o Dever Militar", ["Deserção", "Abandono de posto"]),
        topic("Crimes contra a Administração Militar"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Direito Processual Penal Militar",
    knowledgeAreaSlug: JURIDICAS,
    areas: [
      area("Polícia Judiciária e Inquérito Militar", [
        topic("Polícia Judiciária Militar"),
        topic("Inquérito Policial Militar"),
      ]),
      area("Processo Penal Militar", [
        topic("Ação Penal Militar"),
        topic("Prisão e Medidas no Processo Penal Militar"),
        topic("Justiça Militar", ["Competência da Justiça Militar"]),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Legislação Penal Especial",
    knowledgeAreaSlug: JURIDICAS,
    aliases: [
      "Legislação Especial",
      "Legislação Extravagante",
      "Extravagante",
      "Legislação Penal Extravagante",
      "Leis Penais Especiais",
    ],
    areas: [
      area("Leis Penais Especiais", [
        topic("Lei de Drogas", [], ["Lei 11.343/2006"]),
        topic("Crimes Hediondos", [], ["Lei 8.072/1990"]),
        topic("Estatuto do Desarmamento", [], ["Lei 10.826/2003"]),
        topic("Abuso de Autoridade", [], ["Lei 13.869/2019"]),
        topic("Lei de Tortura", [], ["Lei 9.455/1997"]),
        topic("Organizações Criminosas", [], ["Lei 12.850/2013"]),
        topic("Lavagem de Dinheiro", [], ["Lei 9.613/1998"]),
        topic("Crimes de Trânsito", [], ["Código de Trânsito Brasileiro"]),
        topic("Crimes Ambientais", [], ["Lei 9.605/1998"]),
        topic("Interceptação Telefônica", [], ["Lei 9.296/1996"]),
        topic("Juizados Especiais Criminais", [], ["Lei 9.099/1995"]),
        topic("Crimes de Racismo", [], ["Lei 7.716/1989"]),
      ]),
      area("Execução Penal", [
        topic("Lei de Execução Penal", ["Direitos e deveres do preso", "Faltas disciplinares", "Regime Disciplinar Diferenciado", "Regimes de cumprimento e progressão"], ["LEP", "Lei 7.210/1984"]),
      ]),
      area("Proteção de Grupos Vulneráveis", [
        topic("Lei Maria da Penha", [], ["Lei 11.340/2006"]),
        topic("Estatuto da Criança e do Adolescente", [], ["ECA"]),
        topic("Estatuto da Pessoa Idosa"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Legislação Institucional",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Legislação Específica", "Legislação Institucional e Regimentos"],
    areas: [
      area("Normas da Instituição", [
        topic("Estatutos e Leis Orgânicas"),
        topic("Regimentos e Regulamentos Internos"),
        topic("Normas de Procedimentos do Sistema Prisional"),
        topic("Ética no Serviço Público"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Direitos Humanos",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Direitos Humanos"],
    areas: [
      area("Teoria dos Direitos Humanos", [
        topic("Conceito, Características e Gerações dos Direitos Humanos"),
        topic("Incorporação de Tratados de Direitos Humanos", [], ["Emenda Constitucional 45"]),
      ]),
      area("Sistemas de Proteção", [
        topic("Sistema Global de Proteção", ["Declaração Universal dos Direitos Humanos", "Pactos internacionais"]),
        topic("Sistema Interamericano de Proteção", ["Convenção Americana de Direitos Humanos", "Corte Interamericana"]),
      ]),
      area("Temas de Direitos Humanos", [
        topic("Prevenção e Combate à Tortura"),
        topic("Tratamento de Pessoas Presas", [], ["Regras de Mandela"]),
        topic("Direitos Humanos e Segurança Pública"),
        topic("Igualdade e Não Discriminação"),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Informática",
    knowledgeAreaSlug: TECNOLOGIA,
    aliases: ["Informática Básica", "Noções de Informática"],
    areas: [
      area("Fundamentos de Informática", [
        topic("Hardware e Software"),
        topic("Sistemas Operacionais", ["Windows", "Linux"]),
        topic("Organização de Arquivos e Pastas"),
      ]),
      area("Aplicativos de Escritório", [
        topic("Editores de Texto", ["Microsoft Word", "LibreOffice Writer"]),
        topic("Planilhas Eletrônicas", ["Microsoft Excel", "LibreOffice Calc"]),
        topic("Apresentações"),
      ]),
      area("Internet e Comunicação", [
        topic("Navegadores e Internet", ["Atalhos e favoritos", "Busca na internet"]),
        topic("Correio Eletrônico"),
        topic("Redes de Computadores"),
        topic("Computação em Nuvem"),
      ]),
      area("Segurança da Informação", [
        topic("Códigos Maliciosos", [], ["Malware"]),
        topic("Backup e Recuperação"),
        topic("Proteção e Boas Práticas", ["Senhas e autenticação", "Criptografia", "Golpes e engenharia social"]),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Raciocínio Lógico",
    knowledgeAreaSlug: MATEMATICA,
    aliases: ["Raciocínio Lógico-Matemático", "Raciocínio Lógico Quantitativo"],
    areas: [
      area("Lógica Proposicional", [
        topic("Proposições e Conectivos"),
        topic("Tabelas-Verdade"),
        topic("Equivalências e Negações Lógicas"),
      ]),
      area("Lógica de Argumentação", [
        topic("Argumentos Válidos"),
        topic("Diagramas Lógicos", [], ["Quantificadores"]),
      ]),
      area("Raciocínio Quantitativo", [
        topic("Problemas Aritméticos e Porcentagem"),
        topic("Sequências e Padrões Lógicos"),
        topic("Contagem e Probabilidade"),
        topic("Problemas de Lógica", [], ["Associação lógica"]),
      ]),
    ],
  },

  // --------------------------------------------------------------
  {
    name: "Estatística",
    knowledgeAreaSlug: MATEMATICA,
    aliases: ["Noções de Estatística"],
    areas: [
      area("Estatística Descritiva", [
        topic("Tabelas e Gráficos Estatísticos"),
        topic("Medidas de Posição", ["Média", "Mediana", "Moda", "Quartis"]),
        topic("Medidas de Dispersão", ["Variância", "Desvio padrão", "Coeficiente de variação"]),
      ]),
      area("Probabilidade e Distribuições", [
        topic("Probabilidade Estatística"),
        topic("Variáveis Aleatórias e Distribuições", ["Distribuição binomial", "Distribuição normal"]),
      ]),
      area("Inferência Estatística", [
        topic("Amostragem"),
        topic("Estimação e Intervalos de Confiança"),
        topic("Testes de Hipóteses"),
        topic("Correlação e Regressão"),
      ]),
    ],
  },
];
