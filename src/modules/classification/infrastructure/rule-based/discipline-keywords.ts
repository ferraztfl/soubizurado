/*
 * Curated discipline signals for ENEM questions, keyed by canonical
 * discipline slug. Terms are matched after normalizeTaxonomyTerm and a
 * light plural stemmer, as whole words/phrases. Keep terms specific:
 * generic words ("texto", "massa") create noise across disciplines.
 */
export const DISCIPLINE_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  matematica: [
    "porcentagem", "razao", "proporcao", "equacao", "funcao", "grafico",
    "media aritmetica", "mediana", "probabilidade", "area", "perimetro",
    "volume", "angulo", "triangulo", "circulo", "numero", "juros",
    "escala", "combinacao", "permutacao", "desvio padrao", "percentual",
  ],
  fisica: [
    "velocidade", "aceleracao", "forca", "energia cinetica",
    "energia potencial", "potencia", "corrente eletrica", "tensao eletrica",
    "resistencia eletrica", "resistor", "circuito", "campo magnetico",
    "campo eletrico", "onda", "frequencia", "comprimento de onda", "lente",
    "espelho", "refracao", "reflexao", "calor", "temperatura", "pressao",
    "empuxo", "gravidade", "gravitacional", "atrito", "movimento", "joule",
    "watt", "volt", "ampere", "newton", "luz", "som", "decibel",
    "radiacao", "termodinamica", "dilatacao", "inercia",
  ],
  quimica: [
    "reacao quimica", "reacao", "molecula", "atomo", "ion", "ligacao",
    "solucao", "concentracao", "mol", "ph", "acido", "base", "sal",
    "oxidacao", "reducao", "combustao", "composto", "organico",
    "hidrocarboneto", "polimero", "elemento quimico", "tabela periodica",
    "catalisador", "equilibrio quimico", "eletrolise", "pilha", "isomero",
    "ester", "alcool", "funcao organica", "entalpia", "estequiometria",
    "soluto", "solvente", "precipitado", "radioativo",
  ],
  biologia: [
    "celula", "dna", "rna", "gene", "genetica", "cromossomo", "proteina",
    "enzima", "organismo", "especie", "evolucao", "ecossistema",
    "cadeia alimentar", "bacteria", "virus", "fungo", "planta", "vegetal",
    "animal", "fotossintese", "respiracao celular", "sistema imunologico",
    "vacina", "doenca", "hormonio", "tecido", "mitose", "meiose", "bioma",
    "biodiversidade", "parasita", "mutacao", "seres vivo", "nutriente",
    "sangue", "orgao",
  ],
  historia: [
    "seculo", "imperio", "colonia", "colonial", "colonizacao",
    "escravidao", "escravizado", "revolucao", "guerra", "republica",
    "monarquia", "ditadura", "feudal", "idade media", "rei",
    "independencia", "vargas", "abolicao", "burguesia", "historiador",
    "antiguidade", "medieval", "absolutismo", "iluminismo", "nazismo",
    "fascismo", "guerra fria", "regime militar", "periodo colonial",
    "oligarquia", "coronelismo",
  ],
  geografia: [
    "relevo", "clima", "bacia hidrografica", "urbanizacao", "migracao",
    "populacao", "territorio", "regiao", "agricultura", "agropecuaria",
    "industria", "industrializacao", "globalizacao", "cartografia", "mapa",
    "latitude", "longitude", "vegetacao", "solo", "desmatamento",
    "fronteira", "geopolitica", "recurso natural", "espaco geografico",
    "paisagem", "urbano", "rural", "metropole", "erosao", "hidrografia",
    "matriz energetica", "fuso horario",
  ],
  filosofia: [
    "filosofo", "filosofia", "filosofico", "etica", "moral", "razao",
    "conhecimento", "verdade", "virtude", "platao", "aristoteles",
    "socrates", "kant", "descartes", "nietzsche", "hobbes", "locke",
    "rousseau", "maquiavel", "metafisica", "existencialismo", "sartre",
    "hegel", "empirismo", "racionalismo", "felicidade", "alma",
  ],
  sociologia: [
    "sociedade", "sociologo", "sociologia", "cultura", "desigualdade",
    "classe social", "movimento social", "cidadania", "democracia",
    "durkheim", "weber", "marx", "identidade", "genero", "racismo",
    "violencia", "trabalhador", "direitos humanos", "exclusao social",
    "industria cultural", "etnia", "preconceito", "participacao politica",
  ],
  "lingua-portuguesa": [
    "variacao linguistica", "norma padrao", "genero textual", "linguagem",
    "argumentacao", "argumentativo", "coesao", "interlocutor", "enunciador",
    "funcao da linguagem", "publicidade", "anuncio", "campanha", "charge",
    "tirinha", "leitor", "linguistico", "vocabulo", "expressao",
    "sentido figurado", "internet", "rede social", "digital",
  ],
  literatura: [
    "poema", "poeta", "poesia", "verso", "estrofe", "romance", "narrador",
    "personagem", "conto", "cronica", "modernismo", "romantismo",
    "realismo", "literatura", "literario", "eu lirico", "soneto",
    "parnasianismo", "simbolismo", "barroco", "arcadismo", "machado de assis",
  ],
  artes: [
    "arte", "artista", "obra de arte", "pintura", "pintor", "escultura",
    "museu", "musica", "musical", "teatro", "danca", "cinema", "fotografia",
    "exposicao", "vanguarda", "performance", "instalacao", "artistico",
    "grafite", "arquitetura",
  ],
  "educacao-fisica": [
    "esporte", "esportivo", "atividade fisica", "exercicio fisico",
    "pratica corporal", "atleta", "ginastica", "luta", "sedentarismo",
    "olimpiada", "olimpico", "jogo", "futebol", "capoeira", "corpo",
    "condicionamento",
  ],
  "lingua-inglesa": ["the", "and", "of", "is", "are", "you", "with", "this"],
  "lingua-espanhola": ["el", "los", "las", "una", "es", "para", "con", "pero", "muy"],
};
