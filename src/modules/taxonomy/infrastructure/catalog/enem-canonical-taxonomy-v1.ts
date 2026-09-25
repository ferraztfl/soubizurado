import type {
  CanonicalTaxonomyCatalog,
  CatalogArea,
  CatalogSubtopic,
  CatalogTopic,
} from "../../domain/canonical-taxonomy-catalog";

/*
 * Canonical taxonomy v1 for ENEM / Ensino Médio.
 *
 * Structure: Discipline -> Area ("Assunto") -> Topic -> Subtopic.
 * Based on the ENEM Matriz de Referência and BNCC (Ensino Médio).
 *
 * Rules for editing:
 * - Never rename or remove an entry that may already be linked to
 *   questions; deactivate it in the backoffice instead.
 * - Add alternative wordings as aliases, not as new entries.
 * - Bump `version` whenever the catalog changes.
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
      typeof subtopic === "string"
        ? { name: subtopic }
        : subtopic,
    ),
  };
}

function sub(
  name: string,
  ...aliases: string[]
): CatalogSubtopic {
  return { name, aliases };
}

function area(
  name: string,
  topics: readonly CatalogTopic[],
  aliases: readonly string[] = [],
): CatalogArea {
  return { name, aliases, topics };
}

const LINGUAGENS = "linguagens-codigos-e-suas-tecnologias";
const HUMANAS = "ciencias-humanas-e-suas-tecnologias";
const NATUREZA = "ciencias-da-natureza-e-suas-tecnologias";
const MATEMATICA = "matematica-e-suas-tecnologias";

export const ENEM_CANONICAL_TAXONOMY_V1: CanonicalTaxonomyCatalog = {
  version: 1,
  summary:
    "Catálogo canônico ENEM/Ensino Médio v1: áreas do conhecimento, disciplinas, assuntos, tópicos e subtópicos.",

  knowledgeAreas: [
    {
      slug: LINGUAGENS,
      name: "Linguagens, Códigos e suas Tecnologias",
    },
    {
      slug: HUMANAS,
      name: "Ciências Humanas e suas Tecnologias",
    },
    {
      slug: NATUREZA,
      name: "Ciências da Natureza e suas Tecnologias",
    },
    {
      slug: MATEMATICA,
      name: "Matemática e suas Tecnologias",
    },
  ],

  disciplines: [
    // ------------------------------------------------------------------
    // MATEMÁTICA
    // ------------------------------------------------------------------
    {
      name: "Matemática",
      knowledgeAreaSlug: MATEMATICA,
      aliases: ["Mat"],
      areas: [
        area("Aritmética e Números", [
          topic("Conjuntos Numéricos", [
            "Números naturais e inteiros",
            "Números racionais",
            "Números irracionais e reais",
            "Intervalos reais",
          ]),
          topic("Operações e Propriedades", [
            "Frações e decimais",
            "Potenciação e radiciação",
            "Notação científica",
            "Expressões numéricas",
          ]),
          topic("Divisibilidade", [
            "Múltiplos e divisores",
            sub("MMC e MDC", "Mínimo múltiplo comum", "Máximo divisor comum"),
            "Números primos",
          ]),
          topic("Razão e Proporção", [
            "Razão",
            "Proporção",
            "Grandezas diretamente proporcionais",
            "Grandezas inversamente proporcionais",
            "Regra de três simples",
            "Regra de três composta",
            "Escalas",
          ]),
          topic("Porcentagem", [
            "Cálculo percentual",
            "Aumentos e descontos",
            "Variação percentual",
          ]),
          topic("Sistemas de Medidas", [
            "Unidades de comprimento",
            "Unidades de área",
            "Unidades de volume e capacidade",
            "Unidades de massa",
            "Unidades de tempo",
            "Conversão de unidades",
          ], ["Unidades de medida"]),
        ]),

        area("Matemática Financeira", [
          topic("Juros", [
            "Juros simples",
            "Juros compostos",
          ]),
          topic("Operações Comerciais", [
            "Lucro e prejuízo",
            "Financiamentos e parcelamentos",
          ]),
        ]),

        area("Álgebra", [
          topic("Expressões Algébricas", [
            "Produtos notáveis",
            "Fatoração",
            "Frações algébricas",
          ]),
          topic("Equações", [
            sub("Equação do 1º grau", "Equação do primeiro grau", "Equação linear"),
            sub("Equação do 2º grau", "Equação do segundo grau", "Equação quadrática"),
            "Equações exponenciais",
            "Equações logarítmicas",
            "Problemas com equações",
          ]),
          topic("Inequações", [
            "Inequação do 1º grau",
            "Inequação do 2º grau",
          ]),
          topic("Sistemas Lineares", [
            "Sistemas de equações do 1º grau",
            "Escalonamento",
          ]),
          topic("Funções", [
            "Conceito de função",
            "Domínio, contradomínio e imagem",
            "Gráficos de funções",
            sub(
              "Função Afim",
              "Função do 1º grau",
              "Função do primeiro grau",
              "Função linear",
              "Funções afins",
            ),
            sub(
              "Função Quadrática",
              "Função do 2º grau",
              "Função do segundo grau",
              "Parábola",
            ),
            sub("Função Exponencial", "Funções exponenciais"),
            sub("Função Logarítmica", "Funções logarítmicas"),
            "Função modular",
            "Função composta e inversa",
          ]),
          topic("Logaritmos", [
            "Definição e propriedades",
            "Mudança de base",
          ]),
          topic("Sequências", [
            sub("Progressão Aritmética", "PA"),
            sub("Progressão Geométrica", "PG"),
            "Padrões e regularidades",
          ]),
          topic("Matrizes e Determinantes", [
            "Matrizes",
            "Determinantes",
          ]),
          topic("Polinômios", [
            "Operações com polinômios",
            "Equações polinomiais",
          ]),
          topic("Números Complexos"),
        ]),

        area("Geometria Plana", [
          topic("Fundamentos da Geometria Plana", [
            "Ângulos",
            "Retas paralelas e transversais",
            "Polígonos",
          ]),
          topic("Triângulos", [
            "Classificação e propriedades",
            "Semelhança de triângulos",
            "Congruência de triângulos",
            "Teorema de Pitágoras",
            "Relações métricas no triângulo retângulo",
          ]),
          topic("Quadriláteros"),
          topic("Circunferência e Círculo", [
            "Elementos da circunferência",
            "Comprimento da circunferência",
            "Ângulos na circunferência",
          ]),
          topic("Áreas e Perímetros", [
            "Perímetro",
            "Área de polígonos",
            "Área do círculo e setores",
          ]),
          topic("Teorema de Tales"),
          topic("Transformações Geométricas", [
            "Simetria",
            "Rotação, translação e reflexão",
            "Ampliação e redução",
          ]),
        ]),

        area("Geometria Espacial", [
          topic("Poliedros", [
            "Relação de Euler",
            "Planificação de sólidos",
          ]),
          topic("Prismas"),
          topic("Pirâmides"),
          topic("Cilindros"),
          topic("Cones"),
          topic("Esferas"),
          topic("Volume e Capacidade"),
          topic("Troncos e Sólidos Compostos"),
          topic("Vistas e Projeções Ortogonais", [], ["Vistas ortogonais"]),
        ]),

        area("Geometria Analítica", [
          topic("Ponto e Plano Cartesiano", [
            "Distância entre dois pontos",
            "Ponto médio",
          ]),
          topic("Estudo da Reta", [
            "Equação da reta",
            "Coeficiente angular",
            "Posições relativas entre retas",
          ]),
          topic("Estudo da Circunferência"),
          topic("Cônicas"),
        ]),

        area("Trigonometria", [
          topic("Trigonometria no Triângulo Retângulo", [
            "Seno, cosseno e tangente",
            "Ângulos notáveis",
          ]),
          topic("Trigonometria em Triângulos Quaisquer", [
            "Lei dos senos",
            "Lei dos cossenos",
          ]),
          topic("Ciclo Trigonométrico"),
          topic("Funções Trigonométricas"),
        ]),

        area("Estatística", [
          topic("Leitura e Interpretação de Dados", [
            "Tabelas",
            "Gráficos de barras e colunas",
            "Gráficos de setores",
            "Gráficos de linhas",
            "Histogramas",
            "Infográficos",
          ], ["Interpretação de gráficos e tabelas"]),
          topic("Medidas de Tendência Central", [
            "Média aritmética",
            "Média ponderada",
            "Mediana",
            "Moda",
          ]),
          topic("Medidas de Dispersão", [
            "Amplitude",
            "Variância",
            "Desvio padrão",
          ]),
        ]),

        area("Combinatória e Probabilidade", [
          topic("Análise Combinatória", [
            "Princípio fundamental da contagem",
            "Permutações",
            "Arranjos",
            "Combinações",
          ]),
          topic("Probabilidade", [
            "Probabilidade simples",
            "Probabilidade condicional",
            "Eventos independentes",
            "União de eventos",
          ]),
        ]),

        area("Lógica e Raciocínio Matemático", [
          topic("Raciocínio Lógico"),
          topic("Problemas de Otimização"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // FÍSICA
    // ------------------------------------------------------------------
    {
      name: "Física",
      knowledgeAreaSlug: NATUREZA,
      areas: [
        area("Mecânica", [
          topic("Cinemática", [
            "Movimento uniforme",
            "Movimento uniformemente variado",
            "Queda livre e lançamentos",
            "Movimento circular",
            "Gráficos do movimento",
          ]),
          topic("Dinâmica", [
            "Leis de Newton",
            "Força de atrito",
            "Força peso e normal",
            "Plano inclinado",
            "Força centrípeta",
          ]),
          topic("Trabalho, Energia e Potência", [
            "Trabalho de uma força",
            "Energia cinética",
            "Energia potencial",
            "Conservação da energia mecânica",
            "Potência e rendimento",
          ]),
          topic("Impulso e Quantidade de Movimento", [
            "Conservação da quantidade de movimento",
            "Colisões",
          ]),
          topic("Gravitação Universal", [
            "Leis de Kepler",
            "Lei da gravitação universal",
          ]),
          topic("Estática", [
            "Equilíbrio de corpos",
            "Momento de uma força",
            "Máquinas simples",
          ]),
          topic("Hidrostática", [
            "Pressão",
            "Teorema de Stevin",
            "Princípio de Pascal",
            "Empuxo e princípio de Arquimedes",
          ]),
        ]),

        area("Termologia", [
          topic("Termometria", ["Escalas termométricas"]),
          topic("Dilatação Térmica"),
          topic("Calorimetria", [
            "Calor sensível",
            "Calor latente",
            "Trocas de calor",
          ]),
          topic("Mudanças de Estado Físico"),
          topic("Propagação de Calor", [
            "Condução",
            "Convecção",
            "Irradiação",
          ]),
          topic("Estudo dos Gases"),
          topic("Termodinâmica", [
            "Primeira lei da termodinâmica",
            "Segunda lei da termodinâmica",
            "Máquinas térmicas",
          ]),
        ]),

        area("Ondulatória", [
          topic("Ondas", [
            "Características das ondas",
            "Fenômenos ondulatórios",
            "Espectro eletromagnético",
          ]),
          topic("Acústica", [
            "Qualidades do som",
            "Efeito Doppler",
            "Ressonância",
          ]),
        ]),

        area("Óptica", [
          topic("Óptica Geométrica", [
            "Princípios da óptica geométrica",
            "Reflexão da luz",
            "Espelhos planos",
            "Espelhos esféricos",
          ]),
          topic("Refração da Luz", [
            "Lei de Snell",
            "Lentes esféricas",
            "Instrumentos ópticos",
          ]),
          topic("Óptica da Visão", ["Defeitos da visão"]),
        ]),

        area("Eletricidade e Magnetismo", [
          topic("Eletrostática", [
            "Carga elétrica e eletrização",
            "Lei de Coulomb",
            "Campo elétrico",
            "Potencial elétrico",
          ]),
          topic("Eletrodinâmica", [
            "Corrente elétrica",
            "Resistores e leis de Ohm",
            "Associação de resistores",
            "Potência elétrica e consumo de energia",
            "Circuitos elétricos",
            "Geradores e receptores",
          ]),
          topic("Magnetismo", [
            "Campo magnético",
            "Força magnética",
          ]),
          topic("Eletromagnetismo", [
            "Indução eletromagnética",
            "Transformadores",
            "Geração de energia elétrica",
          ]),
        ]),

        area("Física Moderna", [
          topic("Relatividade"),
          topic("Física Quântica", ["Efeito fotoelétrico"]),
          topic("Física Nuclear", [
            "Radioatividade",
            "Fissão e fusão nuclear",
          ]),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // QUÍMICA
    // ------------------------------------------------------------------
    {
      name: "Química",
      knowledgeAreaSlug: NATUREZA,
      areas: [
        area("Química Geral", [
          topic("Matéria e Energia", [
            "Estados físicos da matéria",
            "Propriedades da matéria",
          ]),
          topic("Substâncias e Misturas", [
            "Substâncias puras",
            "Misturas homogêneas e heterogêneas",
            "Separação de misturas",
          ]),
          topic("Atomística", [
            "Modelos atômicos",
            "Estrutura atômica",
            "Distribuição eletrônica",
          ]),
          topic("Tabela Periódica", [
            "Organização da tabela periódica",
            "Propriedades periódicas",
          ]),
          topic("Ligações Químicas", [
            "Ligação iônica",
            "Ligação covalente",
            "Ligação metálica",
            "Geometria molecular e polaridade",
            "Forças intermoleculares",
          ]),
          topic("Funções Inorgânicas", [
            "Ácidos",
            "Bases",
            "Sais",
            "Óxidos",
          ]),
          topic("Reações Químicas", [
            "Tipos de reações",
            "Balanceamento de equações",
          ]),
        ]),

        area("Físico-Química", [
          topic("Cálculos Químicos", [
            "Mol e massa molar",
            "Estequiometria",
          ], ["Estequiometria geral"]),
          topic("Soluções", [
            "Concentração de soluções",
            "Diluição e mistura de soluções",
          ]),
          topic("Propriedades Coligativas"),
          topic("Termoquímica", [
            "Entalpia",
            "Lei de Hess",
          ]),
          topic("Cinética Química", [
            "Velocidade das reações",
            "Fatores que alteram a velocidade",
            "Catalisadores",
          ]),
          topic("Equilíbrio Químico", [
            "Constante de equilíbrio",
            "Princípio de Le Chatelier",
            "pH e pOH",
            "Hidrólise salina",
            "Solução tampão",
          ]),
          topic("Eletroquímica", [
            "Números de oxidação",
            "Oxirredução",
            "Pilhas",
            "Eletrólise",
          ]),
          topic("Radioatividade na Química", ["Meia-vida"]),
        ]),

        area("Química Orgânica", [
          topic("Introdução à Química Orgânica", [
            "Cadeias carbônicas",
            "Hibridização do carbono",
          ]),
          topic("Funções Orgânicas", [
            "Hidrocarbonetos",
            "Funções oxigenadas",
            "Funções nitrogenadas",
          ]),
          topic("Isomeria", [
            "Isomeria plana",
            "Isomeria espacial",
          ]),
          topic("Reações Orgânicas", [
            "Reações de substituição",
            "Reações de adição",
            "Reações de eliminação",
            "Reações de oxidação",
            "Esterificação e saponificação",
          ]),
          topic("Polímeros"),
          topic("Bioquímica", [
            "Carboidratos",
            "Lipídios",
            "Proteínas",
          ], ["Química dos alimentos"]),
        ]),

        area("Química Ambiental", [
          topic("Poluição e Impactos Ambientais", [
            "Chuva ácida",
            "Efeito estufa",
            "Camada de ozônio",
            "Tratamento de água e esgoto",
          ]),
          topic("Energia e Combustíveis", [
            "Combustíveis fósseis",
            "Biocombustíveis",
          ]),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // BIOLOGIA
    // ------------------------------------------------------------------
    {
      name: "Biologia",
      knowledgeAreaSlug: NATUREZA,
      areas: [
        area("Citologia", [
          topic("Composição Química da Célula", [
            "Água e sais minerais",
            "Carboidratos e lipídios",
            "Proteínas e enzimas",
            "Ácidos nucleicos",
          ]),
          topic("Estrutura Celular", [
            "Membrana plasmática",
            "Organelas citoplasmáticas",
            "Núcleo celular",
          ]),
          topic("Metabolismo Energético", [
            "Respiração celular",
            "Fermentação",
            "Fotossíntese",
          ]),
          topic("Divisão Celular", [
            "Mitose",
            "Meiose",
          ]),
          topic("Síntese Proteica", [], ["Código genético"]),
        ]),

        area("Genética", [
          topic("Leis de Mendel", [
            "Primeira lei de Mendel",
            "Segunda lei de Mendel",
          ]),
          topic("Herança e Heredogramas", [
            "Heredogramas",
            "Herança ligada ao sexo",
            "Grupos sanguíneos",
            "Interação gênica",
          ]),
          topic("Mutações e Alterações Cromossômicas"),
          topic("Biotecnologia", [
            "DNA recombinante e transgênicos",
            "Clonagem",
            "Células-tronco",
            "Testes de DNA",
          ]),
        ]),

        area("Evolução", [
          topic("Teorias Evolutivas", [
            "Lamarckismo",
            "Darwinismo",
            "Teoria sintética da evolução",
          ]),
          topic("Especiação e Evidências Evolutivas"),
          topic("Origem da Vida"),
        ]),

        area("Ecologia", [
          topic("Conceitos Básicos de Ecologia"),
          topic("Cadeias e Teias Alimentares", [
            "Níveis tróficos",
            "Pirâmides ecológicas",
          ]),
          topic("Relações Ecológicas", [
            "Relações harmônicas",
            "Relações desarmônicas",
          ]),
          topic("Ciclos Biogeoquímicos", [
            "Ciclo do carbono",
            "Ciclo do nitrogênio",
            "Ciclo da água",
          ]),
          topic("Dinâmica de Populações e Sucessão Ecológica"),
          topic("Biomas", [
            "Biomas brasileiros",
            "Biomas mundiais",
          ]),
          topic("Impactos Ambientais e Sustentabilidade", [
            "Poluição",
            "Desmatamento e perda de biodiversidade",
            "Unidades de conservação",
          ]),
        ]),

        area("Fisiologia Humana", [
          topic("Sistema Digestório"),
          topic("Sistema Respiratório"),
          topic("Sistema Circulatório"),
          topic("Sistema Excretor"),
          topic("Sistema Nervoso"),
          topic("Sistema Endócrino", [], ["Hormônios"]),
          topic("Sistema Imunológico", ["Vacinas e soros"]),
          topic("Sistema Reprodutor", ["Métodos contraceptivos"]),
          topic("Nutrição Humana"),
        ]),

        area("Seres Vivos", [
          topic("Classificação dos Seres Vivos"),
          topic("Vírus"),
          topic("Bactérias e Arqueias"),
          topic("Protistas"),
          topic("Fungos"),
          topic("Botânica", [
            "Grupos vegetais",
            "Fisiologia vegetal",
            "Morfologia vegetal",
          ]),
          topic("Zoologia", [
            "Invertebrados",
            "Vertebrados",
          ]),
        ]),

        area("Saúde e Doenças", [
          topic("Doenças Infecciosas e Parasitárias", [
            "Viroses",
            "Bacterioses",
            "Protozooses",
            "Verminoses",
          ]),
          topic("Saúde Pública e Saneamento"),
        ]),

        area("Histologia e Embriologia", [
          topic("Tecidos"),
          topic("Embriologia"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // HISTÓRIA
    // ------------------------------------------------------------------
    {
      name: "História",
      knowledgeAreaSlug: HUMANAS,
      areas: [
        area("História Antiga e Medieval", [
          topic("Pré-História"),
          topic("Antiguidade Oriental"),
          topic("Grécia Antiga"),
          topic("Roma Antiga"),
          topic("Idade Média", [
            "Feudalismo",
            "Igreja medieval",
            "Império Bizantino e Islã",
            "Crise da Baixa Idade Média",
          ]),
        ]),

        area("História Moderna", [
          topic("Renascimento"),
          topic("Reformas Religiosas"),
          topic("Grandes Navegações"),
          topic("Absolutismo e Mercantilismo"),
          topic("Iluminismo"),
          topic("Revoluções Inglesas"),
        ]),

        area("História Contemporânea", [
          topic("Revolução Francesa e Era Napoleônica"),
          topic("Revolução Industrial"),
          topic("Independências na América"),
          topic("Imperialismo e Neocolonialismo"),
          topic("Primeira Guerra Mundial", [], ["1ª Guerra Mundial"]),
          topic("Revolução Russa"),
          topic("Período Entreguerras", [
            "Crise de 1929",
            "Totalitarismos",
          ]),
          topic("Segunda Guerra Mundial", [], ["2ª Guerra Mundial"]),
          topic("Guerra Fria"),
          topic("Descolonização da África e da Ásia"),
          topic("Mundo Contemporâneo e Globalização"),
        ]),

        area("História do Brasil", [
          topic("Brasil Colônia", [
            "Povos indígenas",
            "Economia colonial",
            "Escravidão e resistência",
            "Mineração",
            "Revoltas coloniais",
          ]),
          topic("Brasil Império", [
            "Independência do Brasil",
            "Primeiro Reinado",
            "Período Regencial",
            "Segundo Reinado",
            "Abolição da escravidão",
          ]),
          topic("Primeira República", [
            "República da Espada",
            "República Oligárquica",
            "Movimentos sociais na Primeira República",
          ], ["República Velha"]),
          topic("Era Vargas"),
          topic("República Populista", [], ["República de 1946"]),
          topic("Ditadura Militar", [], ["Regime Militar"]),
          topic("Nova República", [
            "Redemocratização",
            "Constituição de 1988",
          ]),
        ]),

        area("História da América", [
          topic("Povos Pré-Colombianos"),
          topic("Colonização da América"),
          topic("América Latina Contemporânea"),
        ]),

        area("Patrimônio, Cultura e Memória", [
          topic("Patrimônio Histórico e Cultural"),
          topic("Cultura Afro-Brasileira e Indígena"),
          topic("Cidadania e Direitos Humanos na História"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // GEOGRAFIA
    // ------------------------------------------------------------------
    {
      name: "Geografia",
      knowledgeAreaSlug: HUMANAS,
      areas: [
        area("Cartografia", [
          topic("Orientação e Coordenadas Geográficas"),
          topic("Escalas Cartográficas"),
          topic("Projeções Cartográficas"),
          topic("Fusos Horários"),
          topic("Leitura de Mapas e Geotecnologias"),
        ]),

        area("Geografia Física", [
          topic("Estrutura Geológica e Relevo", [
            "Estrutura interna da Terra",
            "Tectônica de placas",
            "Agentes do relevo",
            "Relevo brasileiro",
          ]),
          topic("Solos"),
          topic("Clima", [
            "Elementos e fatores climáticos",
            "Tipos de clima",
            "Climas do Brasil",
            "Fenômenos climáticos",
          ]),
          topic("Hidrografia", [
            "Bacias hidrográficas",
            "Hidrografia brasileira",
          ]),
          topic("Vegetação e Domínios Morfoclimáticos"),
        ]),

        area("Geografia Humana", [
          topic("População", [
            "Crescimento populacional",
            "Estrutura etária",
            "Migrações",
            "População brasileira",
          ]),
          topic("Urbanização", [
            "Urbanização mundial",
            "Urbanização brasileira",
            "Problemas urbanos",
            "Rede urbana",
          ]),
          topic("Espaço Agrário", [
            "Agropecuária",
            "Estrutura fundiária",
            "Questão agrária no Brasil",
          ]),
          topic("Industrialização", [
            "Revoluções industriais e modelos produtivos",
            "Industrialização brasileira",
          ]),
          topic("Energia", [
            "Fontes de energia",
            "Matriz energética brasileira",
          ]),
          topic("Transportes e Circulação"),
        ]),

        area("Geografia Econômica e Geopolítica", [
          topic("Globalização"),
          topic("Blocos Econômicos"),
          topic("Conflitos Mundiais"),
          topic("Ordem Mundial"),
          topic("Comércio Internacional"),
        ]),

        area("Geografia Regional", [
          topic("Regionalização do Brasil"),
          topic("Geografia da América"),
          topic("Geografia da Europa"),
          topic("Geografia da Ásia"),
          topic("Geografia da África"),
        ]),

        area("Questões Ambientais", [
          topic("Problemas Ambientais Globais", [
            "Mudanças climáticas",
            "Aquecimento global",
          ]),
          topic("Desenvolvimento Sustentável"),
          topic("Recursos Naturais"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // FILOSOFIA
    // ------------------------------------------------------------------
    {
      name: "Filosofia",
      knowledgeAreaSlug: HUMANAS,
      areas: [
        area("Filosofia Antiga", [
          topic("Pré-Socráticos"),
          topic("Sofistas e Sócrates"),
          topic("Platão"),
          topic("Aristóteles"),
          topic("Filosofia Helenística"),
        ]),
        area("Filosofia Medieval", [
          topic("Patrística", [], ["Santo Agostinho"]),
          topic("Escolástica", [], ["São Tomás de Aquino"]),
        ]),
        area("Filosofia Moderna", [
          topic("Racionalismo", [], ["Descartes"]),
          topic("Empirismo"),
          topic("Contratualismo", [
            "Hobbes",
            "Locke",
            "Rousseau",
          ]),
          topic("Maquiavel"),
          topic("Kant"),
        ]),
        area("Filosofia Contemporânea", [
          topic("Hegel e Marx"),
          topic("Nietzsche"),
          topic("Existencialismo"),
          topic("Escola de Frankfurt"),
          topic("Filosofia da Linguagem"),
        ]),
        area("Temas Filosóficos", [
          topic("Ética e Moral"),
          topic("Filosofia Política"),
          topic("Teoria do Conhecimento", [], ["Epistemologia"]),
          topic("Estética"),
          topic("Lógica"),
          topic("Filosofia da Ciência"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // SOCIOLOGIA
    // ------------------------------------------------------------------
    {
      name: "Sociologia",
      knowledgeAreaSlug: HUMANAS,
      areas: [
        area("Teoria Sociológica", [
          topic("Surgimento da Sociologia"),
          topic("Émile Durkheim"),
          topic("Max Weber"),
          topic("Karl Marx na Sociologia"),
          topic("Sociologia Contemporânea"),
        ]),
        area("Sociedade e Cultura", [
          topic("Cultura e Identidade"),
          topic("Indústria Cultural e Meios de Comunicação"),
          topic("Movimentos Sociais"),
          topic("Religião e Sociedade"),
        ]),
        area("Trabalho e Desigualdade", [
          topic("Trabalho e Sociedade", [
            "Fordismo e toyotismo",
            "Precarização do trabalho",
          ]),
          topic("Estratificação e Desigualdade Social"),
          topic("Relações Étnico-Raciais"),
          topic("Relações de Gênero"),
        ]),
        area("Política e Cidadania", [
          topic("Poder e Estado"),
          topic("Democracia e Participação Política"),
          topic("Cidadania e Direitos Humanos"),
          topic("Violência e Segurança Pública"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // LÍNGUA PORTUGUESA
    // ------------------------------------------------------------------
    {
      name: "Língua Portuguesa",
      knowledgeAreaSlug: LINGUAGENS,
      aliases: ["Português"],
      areas: [
        area("Leitura e Interpretação de Textos", [
          topic("Compreensão e Interpretação Textual", [
            "Ideia central",
            "Inferência",
            "Intertextualidade",
          ], ["Interpretação de texto"]),
          topic("Gêneros Textuais", [
            "Gêneros jornalísticos",
            "Gêneros publicitários",
            "Gêneros digitais",
            "Gêneros instrucionais",
          ]),
          topic("Tipologia Textual", [
            "Narração",
            "Descrição",
            "Dissertação e argumentação",
          ]),
          topic("Linguagem Verbal e Não Verbal", [
            "Charges e tirinhas",
            "Textos multimodais",
          ]),
        ]),

        area("Linguística e Variação", [
          topic("Funções da Linguagem"),
          topic("Variação Linguística", [
            "Variação regional",
            "Variação social",
            "Norma-padrão e registros",
          ]),
          topic("Semântica", [
            "Sinonímia e antonímia",
            "Polissemia e ambiguidade",
            "Denotação e conotação",
          ]),
          topic("Figuras de Linguagem"),
        ]),

        area("Gramática", [
          topic("Fonologia e Ortografia", [
            "Acentuação gráfica",
            "Ortografia",
          ]),
          topic("Morfologia", [
            "Classes de palavras",
            "Formação de palavras",
          ]),
          topic("Sintaxe", [
            "Termos da oração",
            "Período composto",
            "Concordância",
            "Regência e crase",
            "Colocação pronominal",
          ]),
          topic("Pontuação"),
          topic("Coesão e Coerência", [
            "Conectivos",
            "Referenciação",
          ]),
        ]),

        area("Tecnologias da Informação e Comunicação", [
          topic("Linguagem nas Mídias Digitais"),
          topic("Impacto das Tecnologias na Comunicação"),
        ], ["TIC"]),
      ],
    },

    // ------------------------------------------------------------------
    // LITERATURA
    // ------------------------------------------------------------------
    {
      name: "Literatura",
      knowledgeAreaSlug: LINGUAGENS,
      areas: [
        area("Teoria Literária", [
          topic("Gêneros Literários"),
          topic("Versificação"),
          topic("Texto Literário e Não Literário"),
        ]),
        area("Literatura Brasileira", [
          topic("Quinhentismo"),
          topic("Barroco"),
          topic("Arcadismo"),
          topic("Romantismo"),
          topic("Realismo e Naturalismo"),
          topic("Parnasianismo"),
          topic("Simbolismo"),
          topic("Pré-Modernismo"),
          topic("Modernismo", [
            "Semana de Arte Moderna",
            "Primeira fase do Modernismo",
            "Segunda fase do Modernismo",
            "Terceira fase do Modernismo",
          ]),
          topic("Literatura Contemporânea"),
        ]),
        area("Literatura Portuguesa", [
          topic("Trovadorismo e Humanismo"),
          topic("Classicismo"),
        ]),
        area("Literaturas Africanas e Indígenas", [
          topic("Literaturas Africanas de Língua Portuguesa"),
          topic("Literatura Indígena"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // LÍNGUA INGLESA
    // ------------------------------------------------------------------
    {
      name: "Língua Inglesa",
      knowledgeAreaSlug: LINGUAGENS,
      aliases: ["Inglês"],
      areas: [
        area("Compreensão de Textos em Inglês", [
          topic("Interpretação de Textos em Inglês", [
            "Ideia principal",
            "Informações específicas",
            "Inferência",
          ]),
          topic("Gêneros Textuais em Inglês"),
          topic("Vocabulário e Estratégias de Leitura", [
            "Cognatos e falsos cognatos",
            "Expressões idiomáticas",
          ]),
        ]),
        area("Gramática da Língua Inglesa", [
          topic("Tempos Verbais em Inglês"),
          topic("Classes Gramaticais em Inglês"),
        ]),
        area("Aspectos Culturais em Inglês", [
          topic("Diversidade Cultural em Países de Língua Inglesa"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // LÍNGUA ESPANHOLA
    // ------------------------------------------------------------------
    {
      name: "Língua Espanhola",
      knowledgeAreaSlug: LINGUAGENS,
      aliases: ["Espanhol"],
      areas: [
        area("Compreensão de Textos em Espanhol", [
          topic("Interpretação de Textos em Espanhol", [
            "Ideia principal",
            "Informações específicas",
            "Inferência",
          ]),
          topic("Gêneros Textuais em Espanhol"),
          topic("Vocabulário e Heterossemânticos", [], ["Falsos amigos"]),
        ]),
        area("Gramática da Língua Espanhola", [
          topic("Tempos Verbais em Espanhol"),
          topic("Classes Gramaticais em Espanhol"),
        ]),
        area("Aspectos Culturais em Espanhol", [
          topic("Diversidade Cultural Hispânica"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // ARTES
    // ------------------------------------------------------------------
    {
      name: "Artes",
      knowledgeAreaSlug: LINGUAGENS,
      aliases: ["Arte"],
      areas: [
        area("História da Arte", [
          topic("Arte Pré-Histórica e Antiga"),
          topic("Arte Medieval e Renascentista"),
          topic("Arte Barroca"),
          topic("Vanguardas Europeias"),
          topic("Arte Moderna Brasileira"),
          topic("Arte Contemporânea"),
        ]),
        area("Linguagens Artísticas", [
          topic("Artes Visuais"),
          topic("Música"),
          topic("Teatro"),
          topic("Dança"),
          topic("Cinema e Fotografia"),
        ]),
        area("Arte e Sociedade", [
          topic("Arte Popular e Patrimônio Cultural"),
          topic("Arte Afro-Brasileira e Indígena"),
        ]),
      ],
    },

    // ------------------------------------------------------------------
    // EDUCAÇÃO FÍSICA
    // ------------------------------------------------------------------
    {
      name: "Educação Física",
      knowledgeAreaSlug: LINGUAGENS,
      areas: [
        area("Práticas Corporais", [
          topic("Esportes"),
          topic("Jogos e Brincadeiras"),
          topic("Lutas"),
          topic("Danças e Expressões Corporais"),
          topic("Ginásticas"),
        ]),
        area("Corpo, Saúde e Sociedade", [
          topic("Atividade Física e Saúde"),
          topic("Corpo e Padrões de Beleza"),
          topic("Esporte, Mídia e Sociedade"),
        ]),
      ],
    },
  ],
};
