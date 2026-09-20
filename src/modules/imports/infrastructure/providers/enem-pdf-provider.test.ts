import {
  describe,
  expect,
  it,
} from "vitest";

import {
  EnemPdfProvider,
  parseEnemPdfDocument,
  parsePdftohtmlXml,
} from "./enem-pdf-provider";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<pdf2xml>
<page number="1" height="1262" width="892">
  <image top="100" left="40" width="70" height="30" src="header.png"/>
  <image top="300" left="200" width="200" height="100" src="legend.png"/>
  <image top="500" left="90" width="150" height="80" src="a.png"/>
  <image top="600" left="90" width="150" height="80" src="b.png"/>
  <text top="23" left="36" width="83" height="13">20/09/26, 07:16</text>
  <text top="150" left="43" width="90" height="19"><b>1. [Q3518589]</b></text>
  <text top="152" left="149" width="300" height="19"><b>CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS</b></text>
  <text top="190" left="149" width="500" height="19">Considere a legenda e a figura.</text>
  <text top="450" left="149" width="400" height="19">Qual heredograma foi recebido pelo casal?</text>
  <text top="500" left="61" width="16" height="19"><b>a )</b></text>
  <text top="600" left="61" width="16" height="19"><b>b )</b></text>
  <text top="700" left="50" width="400" height="19">Disciplinas/Assuntos vinculados: Biologia &gt; Heredograma</text>
  <text top="730" left="50" width="700" height="19">Fonte: Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira - INEP/ENEM 2024 / Enem / Questão: 112</text>
  <text top="760" left="43" width="90" height="19"><b>2. [Q3518156]</b></text>
  <text top="790" left="149" width="500" height="19">O esquema representa um experimento com células.</text>
  <text top="820" left="61" width="16" height="19"><b>a )</b></text>
  <text top="820" left="85" width="100" height="19">Vacúolos.</text>
  <text top="850" left="61" width="16" height="19"><b>b )</b></text>
  <text top="850" left="85" width="100" height="19">Mitocôndrias.</text>
  <text top="900" left="50" width="400" height="19">Disciplinas/Assuntos vinculados: Biologia &gt; Mitocôndria</text>
  <text top="930" left="50" width="700" height="19">Fonte: INEP/ENEM 2024 / Enem / Questão: 115</text>
  <text top="1228" left="36" width="400" height="13">https://questoes.grancursosonline.com.br/aluno/simulado/29401523/resolver</text>
</page>
<page number="2" height="1262" width="892">
  <text top="50" left="43" width="90" height="19"><b>3. [Q3518612]</b></text>
  <text top="52" left="149" width="300" height="19"><b>CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS</b></text>
  <text top="90" left="149" width="500" height="19">Uma possível consequência da infecção é</text>
  <text top="120" left="61" width="16" height="19"><b>a )</b></text>
  <text top="120" left="85" width="100" height="19">aids.</text>
  <text top="150" left="61" width="16" height="19"><b>b )</b></text>
  <text top="150" left="85" width="100" height="19">câncer.</text>
</page>
<page number="3" height="1262" width="892">
  <text top="50" left="61" width="16" height="19"><b>c )</b></text>
  <text top="50" left="85" width="100" height="19">diabetes.</text>
  <text top="80" left="61" width="16" height="19"><b>d )</b></text>
  <text top="80" left="85" width="100" height="19">hepatite B.</text>
  <text top="110" left="61" width="16" height="19"><b>e )</b></text>
  <text top="110" left="85" width="100" height="19">hemorragia.</text>
  <text top="150" left="50" width="400" height="19">Disciplinas/Assuntos vinculados: Biologia &gt; Imunologia</text>
  <text top="180" left="50" width="700" height="19">Fonte: INEP/ENEM 2024 / Enem / Questão: 120</text>
  <text top="400" left="43" width="80" height="19">Gabarito</text>
  <text top="430" left="43" width="500" height="19">(1 = b) (2 = c) (3 = b)</text>
</page>
</pdf2xml>`;

describe(
  "ENEM PDF provider",
  () => {
    it(
      "parses pdftohtml XML pages and ignores header/footer images by question bounds",
      () => {
        const pages =
          parsePdftohtmlXml(
            XML,
          );

        expect(
          pages,
        ).toHaveLength(3);
        expect(
          pages[0]?.images,
        ).toHaveLength(3);
      },
    );

    it(
      "builds questions across page boundaries and preserves official metadata",
      () => {
        const document =
          parseEnemPdfDocument({
            xml: XML,
            checksum:
              "a".repeat(64),
          });

        expect(
          document.questions,
        ).toHaveLength(3);

        const first =
          document.questions[0]!;
        expect(
          first.providerQuestionId,
        ).toBe("Q3518589");
        expect(
          first.officialQuestionNumber,
        ).toBe(112);
        expect(
          first.area,
        ).toBe(
          "Ciências da Natureza e suas Tecnologias",
        );
        expect(
          first.subjectPath,
        ).toEqual([
          "Biologia",
          "Heredograma",
        ]);
        expect(
          first.alternatives.map(
            (alternative) => ({
              label:
                alternative.label,
              content:
                alternative.content,
            }),
          ),
        ).toEqual([
          {
            label: "A",
            content: "",
          },
          {
            label: "B",
            content: "",
          },
        ]);
        expect(
          first.hasVisualCue,
        ).toBe(true);
        expect(
          first.answerKey,
        ).toBe("B");

        const third =
          document.questions[2]!;
        expect(
          third.startPage,
        ).toBe(2);
        expect(
          third.endPage,
        ).toBe(3);
        expect(
          third.alternatives.map(
            (alternative) =>
              alternative.label,
          ),
        ).toEqual([
          "A",
          "B",
          "C",
          "D",
          "E",
        ]);
        expect(
          third.answerKey,
        ).toBe("B");
        expect(
          third.officialQuestionNumber,
        ).toBe(120);
      },
    );

    it(
      "maps parsed questions into review-first provider candidates",
      async () => {
        const provider =
          new EnemPdfProvider({
            pdfPath:
              "fixture.pdf",
            year: 2024,
            extractDocument:
              async () =>
                parseEnemPdfDocument({
                  xml: XML,
                  checksum:
                    "b".repeat(64),
                }),
          });

        const result =
          await provider.listQuestions({
            limit: 100,
            examinationId:
              "enem-2024",
          });

        expect(
          result.total,
        ).toBe(3);
        expect(
          result.items[0],
        ).toMatchObject({
          externalId:
            "enem-2024-gran-q3518589",
          number: "112",
          answerKey: "B",
          discipline:
            "Ciências da Natureza e suas Tecnologias",
          topic: null,
          hasImages: true,
        });
        expect(
          result.items[2]
            ?.alternatives,
        ).toHaveLength(5);

        await expect(
          provider.getExamination(
            "enem-2024",
          ),
        ).resolves.toEqual({
          externalId:
            "enem-2024",
          title: "ENEM 2024",
          slugPrefix: "enem",
          organization: "INEP",
          careerPosition: null,
          year: 2024,
          board: null,
          alternativeType:
            "MULTIPLA_ESCOLHA",
        });
      },
    );
  },
);
