import { describe, expect, it } from "vitest";

import type {
  OfficialExamAnalysis,
  OfficialExamQuestion,
} from "../../application/official-exams/official-exam";

import {
  detectBoard,
  detectMetadata,
  stripWatermarks,
} from "./analyze-official-exam";
import {
  importableQuestions,
  OfficialExamProvider,
} from "./official-exam-provider";

function question(overrides: Partial<OfficialExamQuestion>): OfficialExamQuestion {
  return {
    key: "1",
    number: 1,
    variant: 0,
    block: null,
    section: "Língua Portuguesa",
    type: "MULTIPLE_CHOICE",
    statement: "Assinale a <correta>.",
    images: [],
    supportText: "**Título**\n\nParágrafo & mais.",
    supportImages: [],
    alternatives: [
      { label: "A", content: "Um.", images: [] },
      { label: "B", content: "", images: ["alt-b.png"] },
    ],
    answer: "A",
    annulled: false,
    refersToHighlight: false,
    ...overrides,
  };
}

const analysis: OfficialExamAnalysis = {
  version: 1,
  uploadId: "00000000-0000-4000-8000-000000000000",
  createdAt: "2026-09-26T00:00:00.000Z",
  board: "AOCP",
  bookletChecksum: "a".repeat(64),
  answerKeyChecksum: "b".repeat(64),
  bookletFileName: "prova.pdf",
  answerKeyFileName: "gabarito.pdf",
  detected: { organization: null, careerPosition: null, year: 2025, level: null, notice: null },
  sections: ["Língua Portuguesa", "Noções de Direito"],
  questions: [
    question({}),
    question({ key: "2", number: 2, answer: null, annulled: true }),
    question({
      key: "3",
      number: 3,
      section: "Noções de Direito",
      supportText: null,
      images: ["grafico.png"],
    }),
  ],
  blockingIssues: [],
};

function provider() {
  return new OfficialExamProvider({
    analysis,
    metadata: {
      board: "AOCP",
      organization: "SEJUSP-MG",
      careerPosition: "Policial Penal",
      year: 2025,
      level: "Médio",
      notice: "Edital 01/2025",
      title: "SEJUSP-MG 2025 – Policial Penal",
    },
    examinationSlug: "aocp-sejusp-2025",
    sections: {
      "Língua Portuguesa": {
        kind: "DISCIPLINE",
        disciplineName: "Língua Portuguesa",
        knowledgeAreaSlug: "linguagens-codigos-e-suas-tecnologias",
      },
      "Noções de Direito": { kind: "KNOWLEDGE_AREA", knowledgeAreaSlug: "ciencias-juridicas" },
    },
    stagedMedia: {
      "alt-b.png": "staging://local/official-exams/x/alt.png",
      "grafico.png": "staging://local/official-exams/x/grafico.png",
    },
  });
}

describe("OfficialExamProvider", () => {
  it("skips annulled questions", () => {
    expect(importableQuestions(analysis).map((item) => item.key)).toEqual(["1", "3"]);
  });

  it("maps questions to escaped candidates with staged media and taxonomy", async () => {
    const result = await provider().listQuestions({ limit: 10 });

    expect(result.total).toBe(2);
    expect(result.nextCursor).toBeNull();

    const [first, second] = result.items;

    expect(first).toMatchObject({
      externalId: "aocp-sejusp-2025-q1",
      statementHtml: "Assinale a &lt;correta&gt;.",
      answerKey: "A",
      discipline: "Língua Portuguesa",
      knowledgeAreaSlug: "linguagens-codigos-e-suas-tecnologias",
      supportTextsHtml: ["<p>**Título**</p><p>Parágrafo &amp; mais.</p>"],
      examinationExternalIds: ["aocp-sejusp-2025"],
    });
    expect(first?.alternatives[1]?.imageUrls).toEqual(["staging://local/official-exams/x/alt.png"]);
    expect(second).toMatchObject({
      discipline: null,
      knowledgeAreaSlug: "ciencias-juridicas",
      attachmentUrls: ["staging://local/official-exams/x/grafico.png"],
      hasImages: true,
    });
  });

  it("paginates with the external id cursor", async () => {
    const page = await provider().listQuestions({ limit: 1 });

    expect(page.nextCursor).toBe("aocp-sejusp-2025-q1");

    const next = await provider().listQuestions({ limit: 1, afterId: page.nextCursor! });

    expect(next.items.map((item) => item.externalId)).toEqual(["aocp-sejusp-2025-q3"]);
    expect(next.nextCursor).toBeNull();
  });

  it("describes the examination with the board name", async () => {
    await expect(provider().getExamination("aocp-sejusp-2025")).resolves.toMatchObject({
      board: "Instituto AOCP",
      organization: "SEJUSP-MG",
      careerPosition: "Policial Penal",
      year: 2025,
    });
    await expect(provider().getExamination("other")).resolves.toBeNull();
  });
});

describe("board and metadata detection", () => {
  it("detects the board from the cover", () => {
    expect(detectBoard("SEJUSP (MG) INSTITUTO AOCP")).toBe("AOCP");
    expect(detectBoard(".: Fundatec Concursos :.")).toBe("FUNDATEC");
    expect(detectBoard("CEBRASPE – PF – Edital: 2025")).toBe("CEBRASPE");
    expect(detectBoard("Banca desconhecida")).toBeNull();
  });

  it("reads year, level and organization hints", () => {
    expect(
      detectMetadata(
        "EDITAL DE CONCURSO PÚBLICO\nPORTARIA CONJUNTA SAD/SDS n° 83/2023\nPMPE – POLÍCIA MILITAR DE PERNAMBUCO\nSOLDADO DA POLÍCIA MILITAR\nNível\nMÉDIO",
      ),
    ).toMatchObject({
      year: 2023,
      level: "Médio",
      organization: "PMPE – POLÍCIA MILITAR DE PERNAMBUCO",
    });
  });

  it("removes aggregator watermarks", () => {
    expect(stripWatermarks("pcimarkpci MDAw:U2F0\nTexto\nwww.pciconcursos.com.br")).toBe("Texto");
  });
});
