import { describe, expect, it } from "vitest";

import {
  organizationBadge,
  parseContestTab,
  planContest,
  salaryLabel,
  slugifyContest,
  vacanciesLabel,
  type ContestInput,
} from "./contest";

const base: ContestInput = {
  name: "Concurso PMPE 2027",
  slug: "",
  organizationName: "Polícia Militar de Pernambuco (PMPE)",
  stateCode: "pe",
  status: "AUTHORIZED",
  vacancies: "2.400",
  hasReserveList: true,
  salaryMin: "",
  salaryMax: "5.197,50",
  educationLevels: ["SUPERIOR", "MEDIO", "OUTRO"],
  positions: "Soldado",
  summary: "Autorização publicada.",
  registrationStart: "2027-01-10",
  registrationEnd: "2027-02-10",
  examDate: "",
  noticeUrl: "https://www.pm.pe.gov.br/edital.pdf",
  isFeatured: true,
  isPublished: false,
};

describe("planContest", () => {
  it("normalizes a valid contest", () => {
    const result = planContest(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contest.slug).toBe("concurso-pmpe-2027");
    expect(result.contest.stateCode).toBe("PE");
    expect(result.contest.vacancies).toBe(2400);
    expect(result.contest.salaryMaxCents).toBe(519750);
    expect(result.contest.salaryMinCents).toBeNull();
    expect(result.contest.educationLevels).toEqual(["MEDIO", "SUPERIOR"]);
    expect(result.contest.registrationStart?.toISOString()).toBe("2027-01-10T00:00:00.000Z");
    expect(result.contest.examDate).toBeNull();
  });

  it("rejects bad values", () => {
    expect(planContest({ ...base, name: "x" })).toEqual({ ok: false, error: "NAME_REQUIRED" });
    expect(planContest({ ...base, slug: "Com Espaço" })).toEqual({ ok: false, error: "SLUG_INVALID" });
    expect(planContest({ ...base, status: "OPEN" })).toEqual({ ok: false, error: "STATUS_INVALID" });
    expect(planContest({ ...base, stateCode: "XX" })).toEqual({ ok: false, error: "STATE_INVALID" });
    expect(planContest({ ...base, vacancies: "muitas" })).toEqual({ ok: false, error: "VACANCIES_INVALID" });
    expect(planContest({ ...base, salaryMin: "9.000,00" })).toEqual({ ok: false, error: "SALARY_INVALID" });
    expect(planContest({ ...base, examDate: "2027-02-30" })).toEqual({ ok: false, error: "DATE_INVALID" });
    expect(planContest({ ...base, registrationEnd: "2027-01-01" })).toEqual({ ok: false, error: "REGISTRATION_ORDER" });
    expect(planContest({ ...base, noticeUrl: "http://site.gov.br" })).toEqual({ ok: false, error: "NOTICE_URL_INVALID" });
    expect(planContest({ ...base, noticeUrl: "javascript:alert(1)" })).toEqual({ ok: false, error: "NOTICE_URL_INVALID" });
  });

  it("keeps an empty state as national", () => {
    const result = planContest({ ...base, stateCode: "" });
    expect(result.ok && result.contest.stateCode).toBeNull();
  });
});

describe("labels", () => {
  it("describes vacancies", () => {
    expect(vacanciesLabel(264, false)).toBe("264 vagas");
    expect(vacanciesLabel(10000, true)).toBe("10.000 vagas + CR");
    expect(vacanciesLabel(1, false)).toBe("1 vaga");
    expect(vacanciesLabel(null, true)).toBe("Cadastro reserva");
    expect(vacanciesLabel(null, false)).toBe("Vagas a definir");
  });

  it("describes salaries", () => {
    expect(salaryLabel(null, null)).toBe("Salários a definir");
    expect(salaryLabel(null, 1676979).replace(/\s/g, " ")).toBe("Até R$ 16.769,79");
    expect(salaryLabel(300000, 800000).replace(/\s/g, " ")).toBe("R$ 3.000,00 a R$ 8.000,00");
  });

  it("builds a badge from the organization", () => {
    expect(organizationBadge("Polícia Militar de Pernambuco (PMPE)")).toBe("PMPE");
    expect(organizationBadge("Banco Central do Brasil (Bacen)")).toBe("BACEN");
    expect(organizationBadge("INSS Instituto Nacional do Seguro Social")).toBe("INSS");
    expect(organizationBadge("Prefeitura de Curitiba")).toBe("PC");
  });

  it("parses tabs and slugs", () => {
    expect(parseContestTab("previstos")).toBe("previstos");
    expect(parseContestTab("qualquer")).toBe("destaques");
    expect(slugifyContest("Concurso TRF 5ª Região — Juiz")).toBe("concurso-trf-5a-regiao-juiz");
  });
});
