# Conversor de provas em PDF → JSON (Google AI Studio)

Este guia cria, no Google AI Studio, um app que lê o **caderno de questões** e o **gabarito** em
PDF e gera o arquivo no **padrão SouBizurado (`soubizurado.exam.v1`)**, que a Central de
Importações (`/admin/importacoes/nova` → "Importar arquivo JSON") valida, mostra em prévia e
importa.

> O JSON **não** carrega imagens. Cada imagem é uma **região do PDF** (página + caixa). Na hora de
> importar, envie também o PDF do caderno: o sistema recorta as imagens dele.

---

## 1. Prompt para construir o app (modo *Build* do AI Studio)

Cole no campo de criação do app:

```text
Crie um app web em português chamado "Conversor de Provas SouBizurado".

Objetivo: converter o PDF de um caderno de questões de concurso público e o PDF do gabarito
oficial em um único arquivo JSON no formato "soubizurado.exam.v1".

Tela:
1. Dois campos de upload: "Caderno de questões (PDF)" e "Gabarito (PDF)". Um campo opcional
   "Cargo" (texto) para quando o gabarito tiver vários cargos.
2. Botão "Converter".
3. Barra de progresso por etapa e, ao final, uma prévia em tabela: número, matéria, tipo,
   início do enunciado, gabarito, quantidade de imagens e alertas.
4. Para cada imagem detectada, mostrar a miniatura recortada da página do PDF (renderize a
   página com pdf.js e recorte a caixa [ymin, xmin, ymax, xmax] em escala 0–1000), para
   conferência visual.
5. Botão "Baixar JSON" (nome: <orgao>-<ano>-<cargo>.json).

Processamento (use o modelo Gemini com saída estruturada, temperatura 0):
- Etapa A — Gabarito: envie o PDF do gabarito com o PROMPT DO GABARITO (abaixo) e obtenha
  {"role": ..., "answers": {"1": "A", "2": "X", ...}}. "X" ou "*" = anulada.
- Etapa B — Questões: o caderno pode ser grande; processe em lotes de até 8 páginas,
  enviando o PDF inteiro e pedindo apenas as questões que COMEÇAM nas páginas do lote
  (ex.: "páginas 1 a 8"). Use o PROMPT DE EXTRAÇÃO (abaixo) como instrução de sistema e o
  ESQUEMA DE RESPOSTA como responseSchema.
- Etapa C — Montagem: junte os lotes, remova questões duplicadas (mesmo número e variant),
  junte os textos de apoio pelo id, preencha "answer" e "annulled" de cada questão a partir
  do gabarito da Etapa A (o gabarito oficial prevalece sobre qualquer resposta inferida).
- Etapa D — Validação local antes de liberar o download:
  * números de 1 até o maior, sem lacunas e sem repetição (considerando variant);
  * múltipla escolha: pelo menos 2 alternativas, letras únicas, gabarito entre as letras;
  * Certo/Errado ou V/F: sem alternativas, gabarito V/F/C/E;
  * todo supportTextId deve existir; toda caixa com ymax>ymin e xmax>xmin;
  * quantidade de respostas do gabarito igual à quantidade de questões.
  Mostre cada problema na prévia; permita baixar mesmo com alertas, mas destaque-os.

Nunca invente conteúdo: se um trecho estiver ilegível, escreva "[ilegível]" e gere um alerta.
```

---

## 2. Prompt de extração (instrução de sistema da Etapa B)

```text
Você é um transcritor de provas de concursos públicos brasileiros. Converta o caderno em JSON
seguindo EXATAMENTE o esquema fornecido. Regras:

TRANSCRIÇÃO
1. Transcreva enunciados, textos de apoio e alternativas LITERALMENTE, em português, com
   acentuação e pontuação originais. Não resuma, não corrija, não complete.
2. Remova apenas elementos de diagramação: cabeçalhos/rodapés repetidos, números de página,
   marcas d'água (ex.: pciconcursos), instruções da capa.
3. Parágrafos: separe com uma linha em branco. Junte palavras hifenizadas na quebra de linha.
4. Negrito relevante no enunciado (ex.: NÃO, EXCETO, INCORRETA) pode ser mantido em
   **negrito** Markdown. Fórmulas: texto simples (x² , √2, ≤); se complexas, descreva e marque
   refersToHighlight=false.

ESTRUTURA
5. "number" = número impresso da questão. Números repetidos em blocos de idioma (Inglês e
   Espanhol com as mesmas numerações): primeira ocorrência variant=0, segunda variant=1.
6. "section" = título da seção/matéria impresso no caderno (ex.: "Língua Portuguesa",
   "Noções de Direito Penal"). Se não houver, null.
7. Texto de apoio compartilhado ("Texto 1", "Leia o texto para responder às questões 1 a 5"):
   crie UM item em supportTexts (id T1, T2...) e aponte supportTextId em cada questão que o usa.
   Não repita o texto dentro do enunciado.
8. Múltipla escolha: type="MULTIPLE_CHOICE", alternativas com label A–E (ou A–D) sem o
   "(A)"/"a)" no texto.
9. Certo/Errado ou Verdadeiro/Falso: type="TRUE_FALSE", alternatives=[], cada item numerado é
   uma questão; o comando do grupo ("Julgue os itens a seguir...") vai em "command".
10. refersToHighlight=true quando o enunciado mencionar termo destacado, sublinhado, grifado,
    em negrito ou entre destaques que não são reproduzíveis em texto.

IMAGENS
11. Para cada figura, gráfico, tabela-imagem, tirinha, mapa ou fórmula desenhada que faça parte
    do conteúdo, gere um objeto em "images" (do enunciado, da alternativa ou do texto de apoio
    onde ela aparece) com:
    - page: página do PDF (1 = primeira página do arquivo);
    - box: [ymin, xmin, ymax, xmax] da região da figura, normalizados de 0 a 1000;
    - description: descrição curta e objetiva.
    Inclua título/legenda da figura dentro da caixa quando fizerem parte dela.
12. Alternativa que é só imagem: text="" e a imagem em images.
13. Ignore logotipos, brasões e ícones de cabeçalho/rodapé.

GABARITO
14. Nesta etapa preencha answer=null e annulled=false; o gabarito oficial é aplicado depois.

Responda somente com o JSON.
```

**Prompt do usuário em cada lote (Etapa B):**

```text
Extraia somente as questões que começam nas páginas {inicio} a {fim} deste caderno.
Se o texto de apoio de uma dessas questões começar em página anterior, inclua-o completo.
Metadados da prova (preencha "exam" a partir da capa, página 1):
banca, órgão, cargo, ano, nível e edital como impressos.
```

---

## 3. Prompt do gabarito (Etapa A)

```text
Leia o gabarito oficial deste PDF e responda em JSON:
{"role": "<cargo encontrado>", "answers": {"<número>": "<resposta>"}}

- Se o PDF tiver vários cargos, use SOMENTE o bloco do cargo: "{cargo}". Se o cargo não estiver
  claro, retorne "role": null e "answers": {}.
- Respostas: letra A–E, ou C/E (Certo/Errado), ou V/F (Verdadeiro/Falso), exatamente como no
  gabarito. Questão anulada ("X", "*", "ANULADA", "NULA") → "X".
- Se houver tipos/versões de prova (Tipo 1, Tipo 2...), use a versão indicada: "{versao}".
- Não deduza respostas: transcreva apenas o que está impresso.
```

Esquema de resposta da Etapa A:

```json
{
  "type": "object",
  "properties": {
    "role": { "type": "string", "nullable": true },
    "answers": { "type": "object", "additionalProperties": { "type": "string" } }
  },
  "required": ["role", "answers"]
}
```

> Se o AI Studio não aceitar `additionalProperties`, use
> `"answers": {"type": "array", "items": {"type": "object", "properties": {"number": {"type": "integer"}, "answer": {"type": "string"}}, "required": ["number", "answer"]}}`
> e converta no código do app.

---

## 4. Esquema de resposta da Etapa B

Use o arquivo [`schema-resposta-gemini.json`](schema-resposta-gemini.json) como
`responseSchema`. Se o AI Studio não aceitar `$defs/$ref`, substitua cada
`{"$ref": "#/$defs/image"}` pelo objeto de `$defs.image`.

Exemplo de arquivo válido: [`exemplo-ufba-2016-libras.json`](exemplo-ufba-2016-libras.json).

---

## 5. Boas práticas e custos

- **Temperatura 0** e saída estruturada sempre.
- **Lotes de 6–8 páginas**: a resposta de uma prova inteira pode ultrapassar o limite de saída
  do modelo; lotes menores erram menos.
- **Confira as caixas das imagens** na prévia do app: a detecção de região é aproximada. O
  importador acrescenta uma pequena margem.
- **Custo:** cada página de PDF conta como algumas centenas de tokens de entrada; a saída
  (texto das questões) é a parte mais cara. Uma prova de 10–15 páginas costuma custar poucos
  centavos de dólar em modelos "flash". Meça no seu painel de gastos antes de processar em
  massa.
- **Fonte:** use somente PDFs oficiais das bancas (ou reproduções fiéis, como o PCI Concursos).
  Não use simulados exportados de plataformas de terceiros (Gran, QConcursos etc.).
