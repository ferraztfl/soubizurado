import type { CatalogArea, CatalogDiscipline, CatalogKnowledgeArea } from "../../domain/canonical-taxonomy-catalog";

import { ADMINISTRACAO, area, JURIDICAS, TECNOLOGIA, topic } from "./concursos-taxonomy-additions";

/*
 * v7: the disciplines most public-service exams charge beyond the v2–v6
 * core, so large imports (Quest API, official booklets) land on a
 * canonical discipline instead of review. Same editing rules: names are
 * stable, only additions; board section names go in aliases.
 */

export const CONTABILIDADE_ECONOMIA = "contabilidade-e-economia";
export const SAUDE = "saude";
export const EDUCACAO = "educacao";
const HUMANAS = "ciencias-humanas-e-suas-tecnologias";

export const V7_KNOWLEDGE_AREAS: readonly CatalogKnowledgeArea[] = [
  { slug: CONTABILIDADE_ECONOMIA, name: "Contabilidade e Economia" },
  { slug: SAUDE, name: "Saúde" },
  { slug: EDUCACAO, name: "Educação" },
];

/** v7 areas added to existing disciplines, keyed by discipline name. */
export const V7_AREAS_FOR_EXISTING: Readonly<Record<string, readonly CatalogArea[]>> = {
  Geografia: [
    area("Geografia Regional", [
      topic("Geografia de Goiás"),
      topic("Geografia do Paraná"),
      topic("Geografia de Pernambuco"),
      topic("Geografia de Minas Gerais"),
      topic("Geografia do Distrito Federal"),
      topic("Geografia do Rio Grande do Sul"),
    ], ["Realidade Regional", "Conhecimentos Regionais"]),
  ],
  História: [
    area("História Regional Complementar", [
      topic("História de Goiás"),
      topic("História do Paraná"),
      topic("História do Distrito Federal"),
    ]),
  ],
};

export const V7_DISCIPLINES: readonly CatalogDiscipline[] = [
  // ============================================================ Jurídicas
  {
    name: "Direito Civil",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Direito Civil"],
    areas: [
      area("Lei de Introdução e Parte Geral", [
        topic("Lei de Introdução às Normas do Direito Brasileiro", [], ["LINDB"]),
        topic("Pessoas Naturais", ["Personalidade e capacidade", "Direitos da personalidade", "Ausência"]),
        topic("Pessoas Jurídicas", ["Desconsideração da personalidade jurídica"]),
        topic("Domicílio"),
        topic("Bens"),
        topic("Fatos e Negócios Jurídicos", ["Defeitos do negócio jurídico", "Invalidade do negócio jurídico"]),
        topic("Prescrição e Decadência"),
      ]),
      area("Obrigações e Contratos", [
        topic("Teoria Geral das Obrigações", ["Modalidades", "Adimplemento e inadimplemento"]),
        topic("Teoria Geral dos Contratos"),
        topic("Contratos em Espécie"),
      ]),
      area("Responsabilidade Civil", [
        topic("Responsabilidade Subjetiva e Objetiva"),
        topic("Dano Moral e Material"),
      ]),
      area("Direito das Coisas", [
        topic("Posse"),
        topic("Propriedade", ["Usucapião"]),
        topic("Direitos Reais sobre Coisa Alheia"),
      ]),
      area("Família e Sucessões", [
        topic("Casamento e União Estável"),
        topic("Parentesco, Filiação e Alimentos"),
        topic("Sucessões", ["Sucessão legítima", "Sucessão testamentária"]),
      ]),
    ],
  },
  {
    name: "Direito Processual Civil",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Processo Civil", "Noções de Direito Processual Civil"],
    areas: [
      area("Parte Geral do Processo Civil", [
        topic("Normas Fundamentais do Processo Civil"),
        topic("Jurisdição e Competência"),
        topic("Partes, Procuradores e Intervenção de Terceiros"),
        topic("Atos, Prazos e Comunicação Processual"),
        topic("Tutela Provisória"),
      ]),
      area("Processo de Conhecimento", [
        topic("Petição Inicial e Resposta do Réu"),
        topic("Provas no Processo Civil"),
        topic("Sentença e Coisa Julgada"),
      ]),
      area("Cumprimento de Sentença e Execução", [
        topic("Cumprimento de Sentença"),
        topic("Processo de Execução"),
      ]),
      area("Recursos e Procedimentos Especiais", [
        topic("Recursos Cíveis"),
        topic("Procedimentos Especiais"),
        topic("Juizados Especiais Cíveis"),
      ]),
    ],
  },
  {
    name: "Direito Tributário",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Legislação Tributária", "Noções de Direito Tributário"],
    areas: [
      area("Sistema Tributário Nacional", [
        topic("Competência Tributária"),
        topic("Limitações ao Poder de Tributar", ["Princípios tributários", "Imunidades"]),
        topic("Espécies Tributárias", ["Impostos", "Taxas", "Contribuições de melhoria", "Empréstimos compulsórios", "Contribuições especiais"]),
      ]),
      area("Código Tributário Nacional", [
        topic("Obrigação Tributária", ["Fato gerador", "Sujeição ativa e passiva", "Responsabilidade tributária"]),
        topic("Crédito Tributário", ["Lançamento", "Suspensão, extinção e exclusão"]),
        topic("Administração Tributária"),
      ]),
      area("Tributos em Espécie", [
        topic("Impostos Federais"),
        topic("Impostos Estaduais", ["ICMS", "IPVA", "ITCMD"]),
        topic("Impostos Municipais", ["ISS", "IPTU", "ITBI"]),
        topic("Reforma Tributária"),
      ]),
    ],
  },
  {
    name: "Direito Financeiro",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Direito Financeiro e Orçamentário"],
    areas: [
      area("Normas Gerais de Direito Financeiro", [
        topic("Lei nº 4.320/1964", ["Receita pública", "Despesa pública"], ["Lei 4.320"]),
        topic("Lei de Responsabilidade Fiscal", [], ["LRF", "Lei Complementar nº 101/2000"]),
        topic("Finanças Públicas na Constituição"),
      ]),
      area("Orçamento no Direito Financeiro", [
        topic("Leis Orçamentárias", ["PPA", "LDO", "LOA"]),
        topic("Créditos Adicionais"),
        topic("Fiscalização Financeira e Tribunais de Contas"),
      ]),
    ],
  },
  {
    name: "Direito do Trabalho",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Legislação Trabalhista", "Noções de Direito do Trabalho"],
    areas: [
      area("Relação de Emprego", [
        topic("Princípios e Fontes do Direito do Trabalho"),
        topic("Empregado e Empregador"),
        topic("Contrato de Trabalho", ["Alteração, suspensão e interrupção", "Extinção do contrato"]),
      ]),
      area("Direitos Trabalhistas", [
        topic("Jornada de Trabalho"),
        topic("Remuneração e Salário"),
        topic("Férias"),
        topic("FGTS"),
        topic("Segurança e Medicina do Trabalho"),
      ]),
      area("Direito Coletivo do Trabalho", [
        topic("Organização Sindical"),
        topic("Negociação Coletiva e Greve"),
      ]),
    ],
  },
  {
    name: "Direito Processual do Trabalho",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Processo do Trabalho"],
    areas: [
      area("Justiça do Trabalho", [
        topic("Organização e Competência da Justiça do Trabalho"),
        topic("Reclamação Trabalhista e Audiência"),
        topic("Provas no Processo do Trabalho"),
      ]),
      area("Recursos e Execução Trabalhista", [
        topic("Recursos Trabalhistas"),
        topic("Execução Trabalhista"),
      ]),
    ],
  },
  {
    name: "Direito Previdenciário",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Legislação Previdenciária", "Noções de Direito Previdenciário"],
    areas: [
      area("Seguridade Social", [
        topic("Seguridade Social na Constituição"),
        topic("Custeio da Seguridade Social"),
      ]),
      area("Regime Geral de Previdência Social", [
        topic("Segurados e Dependentes"),
        topic("Benefícios Previdenciários", ["Aposentadorias", "Pensão por morte", "Auxílios"]),
        topic("Assistência Social", ["BPC/LOAS"]),
      ]),
      area("Regimes Próprios de Previdência", [
        topic("Previdência do Servidor Público"),
        topic("Previdência dos Militares Estaduais"),
      ]),
    ],
  },
  {
    name: "Direito Empresarial",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Direito Comercial"],
    areas: [
      area("Teoria da Empresa", [
        topic("Empresário e Estabelecimento"),
        topic("Sociedades Empresárias"),
      ]),
      area("Títulos, Falência e Recuperação", [
        topic("Títulos de Crédito"),
        topic("Falência e Recuperação Judicial"),
      ]),
    ],
  },
  {
    name: "Direito Ambiental",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Legislação Ambiental"],
    areas: [
      area("Fundamentos do Direito Ambiental", [
        topic("Princípios do Direito Ambiental"),
        topic("Política Nacional do Meio Ambiente"),
        topic("Licenciamento Ambiental"),
      ]),
      area("Proteção Ambiental", [
        topic("Código Florestal"),
        topic("Unidades de Conservação"),
        topic("Crimes e Infrações Ambientais", [], ["Lei nº 9.605/1998"]),
      ]),
    ],
  },
  {
    name: "Direito Eleitoral",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Legislação Eleitoral"],
    areas: [
      area("Justiça Eleitoral e Eleições", [
        topic("Organização da Justiça Eleitoral"),
        topic("Alistamento e Direitos Políticos"),
        topic("Partidos Políticos"),
        topic("Processo Eleitoral e Propaganda"),
        topic("Crimes Eleitorais"),
      ]),
    ],
  },
  {
    name: "Direito do Consumidor",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Código de Defesa do Consumidor"],
    areas: [
      area("Relação de Consumo", [
        topic("Conceitos e Princípios do CDC"),
        topic("Direitos Básicos do Consumidor"),
        topic("Responsabilidade pelo Fato e pelo Vício"),
        topic("Práticas Comerciais e Proteção Contratual"),
      ]),
    ],
  },
  {
    name: "Direito Internacional",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Direito Internacional Público"],
    areas: [
      area("Direito Internacional Público", [
        topic("Fontes e Tratados Internacionais"),
        topic("Nacionalidade e Condição Jurídica do Estrangeiro"),
        topic("Organizações Internacionais"),
      ]),
    ],
  },
  {
    name: "Ética no Serviço Público",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Ética na Administração Pública", "Ética e Conduta no Serviço Público"],
    areas: [
      area("Ética e Conduta", [
        topic("Ética, Moral e Serviço Público"),
        topic("Código de Ética Profissional do Servidor", [], ["Decreto nº 1.171/1994"]),
        topic("Improbidade e Conflito de Interesses"),
      ]),
    ],
  },
  // ============================================================ Perícia e segurança pública
  {
    name: "Medicina Legal",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Medicina Legal"],
    areas: [
      area("Perícia Médico-Legal", [
        topic("Perícias e Peritos", ["Documentos médico-legais", "Resoluções do CFM"]),
        topic("Antropologia Forense", ["Identidade e identificação"]),
      ]),
      area("Traumatologia Forense", [
        topic("Lesões Corporais", ["Classificação das lesões", "Instrumentos e agentes lesivos"]),
        topic("Asfixiologia"),
        topic("Balística Forense"),
      ]),
      area("Tanatologia Forense", [
        topic("Morte e Fenômenos Cadavéricos", ["Cronotanatognose", "Sobrevivência e comoriência"]),
        topic("Necropsia"),
      ]),
      area("Sexologia e Toxicologia Forense", [
        topic("Sexologia Forense"),
        topic("Toxicologia Forense"),
        topic("Psicopatologia Forense"),
      ]),
    ],
  },
  {
    name: "Criminologia",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Criminologia"],
    areas: [
      area("Fundamentos da Criminologia", [
        topic("Conceito, Objeto e Métodos da Criminologia"),
        topic("Escolas Criminológicas"),
        topic("Teorias Sociológicas do Crime"),
      ]),
      area("Vitimologia e Prevenção", [
        topic("Vitimologia"),
        topic("Prevenção Criminal"),
        topic("Controle Social e Sistema Penal"),
      ]),
    ],
  },
  {
    name: "Criminalística",
    knowledgeAreaSlug: JURIDICAS,
    aliases: ["Noções de Criminalística"],
    areas: [
      area("Fundamentos da Criminalística", [
        topic("Princípios e Postulados da Criminalística"),
        topic("Local de Crime", ["Isolamento e preservação", "Cadeia de custódia"]),
        topic("Vestígios e Evidências"),
      ]),
      area("Áreas da Perícia Criminal", [
        topic("Papiloscopia"),
        topic("Documentoscopia"),
        topic("Balística"),
        topic("Perícia em Informática"),
        topic("Genética Forense"),
      ]),
    ],
  },
  // ============================================================ Administração e gestão
  {
    name: "Administração Financeira e Orçamentária",
    knowledgeAreaSlug: ADMINISTRACAO,
    aliases: ["AFO", "Orçamento Público", "Administração Orçamentária e Financeira"],
    areas: [
      area("Orçamento Público", [
        topic("Princípios Orçamentários"),
        topic("Ciclo Orçamentário", ["PPA", "LDO", "LOA"]),
        topic("Receita Pública", ["Classificação e estágios da receita"]),
        topic("Despesa Pública", ["Classificação e estágios da despesa", "Restos a pagar"]),
        topic("Créditos Orçamentários e Adicionais"),
      ]),
      area("Gestão Financeira Pública", [
        topic("Programação Financeira"),
        topic("Suprimento de Fundos"),
        topic("Responsabilidade Fiscal na Gestão"),
      ]),
    ],
  },
  {
    name: "Arquivologia",
    knowledgeAreaSlug: ADMINISTRACAO,
    aliases: ["Noções de Arquivologia", "Gestão de Documentos"],
    areas: [
      area("Fundamentos da Arquivologia", [
        topic("Conceitos e Princípios Arquivísticos"),
        topic("Ciclo de Vida dos Documentos", ["Teoria das três idades"]),
        topic("Classificação e Avaliação de Documentos", ["Tabela de temporalidade"]),
      ]),
      area("Práticas Arquivísticas", [
        topic("Protocolo"),
        topic("Métodos de Arquivamento"),
        topic("Preservação e Documentos Digitais"),
      ]),
    ],
  },
  {
    name: "Gestão Pública",
    knowledgeAreaSlug: ADMINISTRACAO,
    aliases: ["Gestão Governamental", "Administração Pública Gerencial"],
    areas: [
      area("Modelos de Gestão Pública", [
        topic("Patrimonialismo, Burocracia e Gerencialismo"),
        topic("Governança e Governo Digital"),
        topic("Planejamento Estratégico no Setor Público"),
      ]),
      area("Políticas e Controle", [
        topic("Políticas Públicas"),
        topic("Controle, Transparência e Accountability", ["Lei de Acesso à Informação"]),
        topic("Gestão por Resultados e Indicadores"),
      ]),
      area("Atendimento e Qualidade", [
        topic("Atendimento ao Público"),
        topic("Gestão da Qualidade"),
        topic("Gestão de Projetos e Processos"),
      ]),
    ],
  },
  // ============================================================ Contabilidade e economia
  {
    name: "Contabilidade Geral",
    knowledgeAreaSlug: CONTABILIDADE_ECONOMIA,
    aliases: ["Contabilidade", "Noções de Contabilidade"],
    areas: [
      area("Fundamentos Contábeis", [
        topic("Patrimônio e Equação Patrimonial"),
        topic("Contas e Plano de Contas"),
        topic("Escrituração e Lançamentos"),
        topic("Pronunciamentos e Estrutura Conceitual"),
      ]),
      area("Demonstrações Contábeis", [
        topic("Balanço Patrimonial"),
        topic("Demonstração do Resultado"),
        topic("Fluxo de Caixa e Demais Demonstrações"),
        topic("Análise das Demonstrações"),
      ]),
      area("Operações Contábeis", [
        topic("Estoques"),
        topic("Depreciação, Amortização e Exaustão"),
        topic("Provisões e Tributos sobre Vendas"),
      ]),
    ],
  },
  {
    name: "Contabilidade Pública",
    knowledgeAreaSlug: CONTABILIDADE_ECONOMIA,
    aliases: ["Contabilidade Aplicada ao Setor Público", "CASP"],
    areas: [
      area("Contabilidade Aplicada ao Setor Público", [
        topic("MCASP e Normas Brasileiras do Setor Público"),
        topic("Plano de Contas Aplicado ao Setor Público"),
        topic("Demonstrações Contábeis do Setor Público"),
        topic("Patrimônio Público"),
      ]),
    ],
  },
  {
    name: "Auditoria",
    knowledgeAreaSlug: CONTABILIDADE_ECONOMIA,
    aliases: ["Auditoria Governamental", "Controle Externo"],
    areas: [
      area("Auditoria e Controle", [
        topic("Normas e Tipos de Auditoria"),
        topic("Planejamento, Riscos e Evidências de Auditoria"),
        topic("Controle Interno"),
        topic("Relatórios e Pareceres de Auditoria"),
      ]),
    ],
  },
  {
    name: "Economia",
    knowledgeAreaSlug: CONTABILIDADE_ECONOMIA,
    aliases: ["Noções de Economia", "Economia do Setor Público"],
    areas: [
      area("Microeconomia", [
        topic("Oferta, Demanda e Elasticidade"),
        topic("Teoria do Consumidor e da Firma"),
        topic("Estruturas de Mercado"),
      ]),
      area("Macroeconomia", [
        topic("Contas Nacionais"),
        topic("Moeda, Inflação e Juros"),
        topic("Política Econômica", ["Política fiscal", "Política monetária", "Política cambial"]),
        topic("Economia Internacional"),
      ]),
      area("Finanças Públicas", [
        topic("Funções do Governo"),
        topic("Tributação e Gasto Público"),
      ]),
    ],
  },
  {
    name: "Matemática Financeira",
    knowledgeAreaSlug: "matematica-e-suas-tecnologias",
    aliases: ["Noções de Matemática Financeira"],
    areas: [
      area("Capitalização", [
        topic("Juros Simples"),
        topic("Juros Compostos"),
        topic("Taxas Equivalentes, Nominais e Efetivas"),
        topic("Descontos"),
      ]),
      area("Séries e Amortização", [
        topic("Séries de Pagamentos"),
        topic("Sistemas de Amortização", ["SAC", "Tabela Price"]),
      ]),
    ],
  },
  // ============================================================ Tecnologia da informação
  {
    name: "Banco de Dados",
    knowledgeAreaSlug: TECNOLOGIA,
    aliases: ["Bancos de Dados"],
    areas: [
      area("Modelagem e SQL", [
        topic("Modelo Entidade-Relacionamento"),
        topic("Modelo Relacional e Normalização"),
        topic("SQL"),
        topic("Transações e Controle de Concorrência"),
      ]),
      area("Dados e Análise", [
        topic("Data Warehouse e BI"),
        topic("NoSQL e Big Data"),
      ]),
    ],
  },
  {
    name: "Desenvolvimento de Software",
    knowledgeAreaSlug: TECNOLOGIA,
    aliases: ["Programação", "Linguagens de Programação", "Algoritmos e Programação"],
    areas: [
      area("Programação", [
        topic("Algoritmos e Estruturas de Dados"),
        topic("Programação Orientada a Objetos"),
        topic("Linguagens de Programação", ["Java", "Python", "JavaScript", "C#"]),
        topic("Desenvolvimento Web e APIs"),
      ]),
    ],
  },
  {
    name: "Engenharia de Software",
    knowledgeAreaSlug: TECNOLOGIA,
    areas: [
      area("Processos e Qualidade de Software", [
        topic("Processos e Metodologias Ágeis"),
        topic("Requisitos e Modelagem", ["UML"]),
        topic("Testes e Qualidade de Software"),
        topic("DevOps e Integração Contínua"),
      ]),
    ],
  },
  {
    name: "Redes de Computadores",
    knowledgeAreaSlug: TECNOLOGIA,
    aliases: ["Redes", "Redes e Telecomunicações"],
    areas: [
      area("Arquitetura de Redes", [
        topic("Modelos OSI e TCP/IP"),
        topic("Protocolos de Rede"),
        topic("Equipamentos e Cabeamento"),
        topic("Redes sem Fio"),
      ]),
      area("Segurança de Redes", [
        topic("Firewall, VPN e IDS/IPS"),
        topic("Criptografia e Certificação Digital"),
        topic("Ataques e Defesa Cibernética"),
      ]),
    ],
  },
  {
    name: "Governança de TI",
    knowledgeAreaSlug: TECNOLOGIA,
    aliases: ["Gestão de TI", "Governança e Gestão de TI"],
    areas: [
      area("Governança e Gestão de Serviços", [
        topic("COBIT"),
        topic("ITIL"),
        topic("Gestão de Projetos de TI"),
        topic("Contratações de TI"),
        topic("Proteção de Dados Pessoais", [], ["LGPD"]),
      ]),
    ],
  },
  // ============================================================ Saúde
  {
    name: "Saúde Pública",
    knowledgeAreaSlug: SAUDE,
    aliases: ["Legislação do SUS", "SUS", "Políticas de Saúde", "Saúde Coletiva"],
    areas: [
      area("Sistema Único de Saúde", [
        topic("Princípios e Diretrizes do SUS"),
        topic("Leis Orgânicas da Saúde", [], ["Lei nº 8.080/1990", "Lei nº 8.142/1990"]),
        topic("Financiamento e Controle Social"),
        topic("Atenção Primária e Redes de Atenção"),
      ]),
      area("Epidemiologia e Vigilância", [
        topic("Epidemiologia"),
        topic("Vigilância em Saúde"),
        topic("Imunização"),
      ]),
    ],
  },
  {
    name: "Enfermagem",
    knowledgeAreaSlug: SAUDE,
    aliases: ["Conhecimentos de Enfermagem"],
    areas: [
      area("Fundamentos de Enfermagem", [
        topic("Ética e Legislação em Enfermagem"),
        topic("Sistematização da Assistência de Enfermagem"),
        topic("Procedimentos e Técnicas de Enfermagem"),
        topic("Biossegurança e Controle de Infecção"),
      ]),
      area("Assistência de Enfermagem", [
        topic("Saúde da Mulher e da Criança"),
        topic("Saúde do Adulto e do Idoso"),
        topic("Urgência e Emergência"),
        topic("Saúde Mental"),
      ]),
    ],
  },
  {
    name: "Primeiros Socorros",
    knowledgeAreaSlug: SAUDE,
    aliases: ["Atendimento Pré-Hospitalar", "APH", "Noções de Primeiros Socorros"],
    areas: [
      area("Atendimento a Emergências", [
        topic("Avaliação da Vítima"),
        topic("Suporte Básico de Vida"),
        topic("Hemorragias, Fraturas e Queimaduras"),
      ]),
    ],
  },
  // ============================================================ Educação
  {
    name: "Conhecimentos Pedagógicos",
    knowledgeAreaSlug: EDUCACAO,
    aliases: ["Pedagogia", "Didática", "Fundamentos da Educação"],
    areas: [
      area("Teorias e Práticas Pedagógicas", [
        topic("Tendências Pedagógicas"),
        topic("Teorias da Aprendizagem"),
        topic("Planejamento e Didática"),
        topic("Avaliação da Aprendizagem"),
        topic("Educação Inclusiva"),
      ]),
    ],
  },
  {
    name: "Legislação Educacional",
    knowledgeAreaSlug: EDUCACAO,
    aliases: ["Legislação da Educação"],
    areas: [
      area("Normas da Educação", [
        topic("Educação na Constituição"),
        topic("Lei de Diretrizes e Bases", [], ["LDB", "Lei nº 9.394/1996"]),
        topic("Base Nacional Comum Curricular", [], ["BNCC"]),
        topic("Plano Nacional de Educação"),
        topic("Estatuto da Criança e do Adolescente na Educação"),
      ]),
    ],
  },
  // ============================================================ Conhecimentos gerais
  {
    name: "Atualidades",
    knowledgeAreaSlug: HUMANAS,
    aliases: ["Conhecimentos Gerais", "Atualidades e Conhecimentos Gerais"],
    areas: [
      area("Temas da Atualidade", [
        topic("Política e Economia Nacional"),
        topic("Relações Internacionais"),
        topic("Meio Ambiente e Sustentabilidade"),
        topic("Ciência, Tecnologia e Sociedade"),
        topic("Saúde e Sociedade"),
      ]),
    ],
  },
];
