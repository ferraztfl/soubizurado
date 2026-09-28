import { describe, expect, it } from "vitest";

import { parseArticleBlocks } from "@/modules/blog/domain/blog";

import { buildContestSummary, buildNewsDraft } from "./notice-drafts";

const facts = {
  name: "Concurso TJRS Juiz 2026",
  organizationName: "Tribunal de Justiça do Rio Grande do Sul",
  stateCode: "RS",
  boardName: "FGV",
  vacancies: "30",
  hasReserveList: false,
  salaryMin: "",
  salaryMax: "30.505,36",
  educationLevels: ["SUPERIOR" as const],
  positionLines: "Juiz de Direito Substituto | 30 | 30505,36 | superior",
  registrationStart: "2026-09-15",
  registrationEnd: "2026-10-14",
  examDate: "2026-12-13",
  feeText: "R$ 305,00",
  stages: "Prova objetiva seletiva\nProvas escritas",
  examLocations: "Porto Alegre",
};

describe("notice drafts", () => {
  it("writes the summary only from facts", () => {
    const summary = buildContestSummary(facts);
    expect(summary).toContain("Saiu o edital do Concurso TJRS Juiz 2026 – Tribunal de Justiça do Rio Grande do Sul, organizado pela banca FGV, no Rio Grande do Sul.");
    expect(summary).toContain("30 vagas");
    expect(summary).toContain("15/09/2026 a 14/10/2026");
    expect(buildContestSummary({ ...facts, salaryMax: "", vacancies: "", examDate: "" })).not.toMatch(/remuneração|prova/i);
  });

  it("builds a news draft in the blog format", () => {
    const draft = buildNewsDraft(facts);
    expect(draft.title.replace(/ /g, " ")).toBe("Concurso TJRS Juiz 2026: edital publicado com 30 vagas e salário de R$ 30.505,36");
    const kinds = parseArticleBlocks(draft.body).map((block) => block.type);
    expect(kinds).toContain("callout");
    expect(kinds).toContain("table");
    expect(draft.excerpt).toContain("Inscrições até 14/10/2026");
  });
});
