import { parseStateCode, type StateCode } from "@/modules/blog/domain/blog";
import { formatBRL, parseBRL } from "@/modules/store/domain/store";

/*
 * Contests ("concursos") followed by the editorial team. Facts come from the
 * official notice; the summary is ours. Nothing here is scraped.
 */

export const CONTEST_STATUSES = {
  EXPECTED: "Previsto",
  AUTHORIZED: "Autorizado",
  NOTICE_PUBLISHED: "Edital publicado",
  REGISTRATION_OPEN: "Inscrições abertas",
  REGISTRATION_CLOSED: "Inscrições encerradas",
  EXAM_DONE: "Prova realizada",
  FINISHED: "Encerrado",
} as const;

export type ContestStatus = keyof typeof CONTEST_STATUSES;

export function isContestStatus(value: string): value is ContestStatus {
  return Object.hasOwn(CONTEST_STATUSES, value);
}

/** Public tabs (URL value → label and the statuses it lists). "destaques" = featured, any open status. */
export const CONTEST_TABS = {
  destaques: { label: "Mais procurados", statuses: null },
  "edital-publicado": {
    label: "Edital publicado",
    statuses: ["NOTICE_PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"],
  },
  "em-breve": { label: "Edital em breve", statuses: ["AUTHORIZED"] },
  previstos: { label: "Previstos", statuses: ["EXPECTED"] },
  encerrados: { label: "Encerrados", statuses: ["EXAM_DONE", "FINISHED"] },
} as const satisfies Record<string, { label: string; statuses: readonly ContestStatus[] | null }>;

export type ContestTab = keyof typeof CONTEST_TABS;

export function parseContestTab(value: string | null | undefined): ContestTab {
  return value && Object.hasOwn(CONTEST_TABS, value) ? (value as ContestTab) : "destaques";
}

/** Statuses of contests that are still ahead (shown in "Mais procurados"). */
export const ACTIVE_CONTEST_STATUSES: readonly ContestStatus[] = [
  "EXPECTED",
  "AUTHORIZED",
  "NOTICE_PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
];

export const EDUCATION_LEVELS = {
  FUNDAMENTAL: "Fundamental",
  MEDIO: "Médio",
  SUPERIOR: "Superior",
} as const;

export type EducationLevel = keyof typeof EDUCATION_LEVELS;

export function slugifyContest(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
    .replace(/-+$/g, "");
}

export type ContestInput = Readonly<{
  name: string;
  slug: string;
  organizationName: string;
  stateCode: string;
  status: string;
  vacancies: string;
  hasReserveList: boolean;
  salaryMin: string;
  salaryMax: string;
  educationLevels: readonly string[];
  positions: string;
  summary: string;
  registrationStart: string;
  registrationEnd: string;
  examDate: string;
  noticeUrl: string;
  isFeatured: boolean;
  isPublished: boolean;
}>;

export type ContestError =
  | "NAME_REQUIRED"
  | "SLUG_INVALID"
  | "ORGANIZATION_REQUIRED"
  | "STATUS_INVALID"
  | "STATE_INVALID"
  | "VACANCIES_INVALID"
  | "SALARY_INVALID"
  | "DATE_INVALID"
  | "REGISTRATION_ORDER"
  | "NOTICE_URL_INVALID"
  | "TEXT_TOO_LONG";

export type ContestPlan = Readonly<{
  name: string;
  slug: string;
  organizationName: string;
  stateCode: StateCode | null;
  status: ContestStatus;
  vacancies: number | null;
  hasReserveList: boolean;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  educationLevels: EducationLevel[];
  positions: string;
  summary: string;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  examDate: Date | null;
  noticeUrl: string | null;
  isFeatured: boolean;
  isPublished: boolean;
}>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** "YYYY-MM-DD" → UTC midnight (DATE column); "" → null; anything else → undefined (invalid). */
function parseDay(value: string): Date | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return undefined;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCDate() === Number(match[3]) && date.getUTCMonth() === Number(match[2]) - 1 ? date : undefined;
}

/** "1.000" / "1000" → 1000; "" → null; anything else → undefined. */
function parseVacancies(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(trimmed)) return undefined;
  const number = Number(trimmed.replace(/\./g, ""));
  return Number.isSafeInteger(number) && number <= 1_000_000 ? number : undefined;
}

function parseSalary(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseBRL(trimmed) ?? undefined;
}

function parseNoticeUrl(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && trimmed.length <= 500 ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function planContest(input: ContestInput): { ok: true; contest: ContestPlan } | { ok: false; error: ContestError } {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 200) return { ok: false, error: "NAME_REQUIRED" };

  const slug = input.slug.trim() ? input.slug.trim().toLowerCase() : slugifyContest(name);
  if (!SLUG.test(slug) || slug.length > 160) return { ok: false, error: "SLUG_INVALID" };

  const organizationName = input.organizationName.trim().replace(/\s+/g, " ");
  if (organizationName.length < 2 || organizationName.length > 200) return { ok: false, error: "ORGANIZATION_REQUIRED" };

  if (!isContestStatus(input.status)) return { ok: false, error: "STATUS_INVALID" };

  const stateCode = input.stateCode.trim() ? parseStateCode(input.stateCode) : null;
  if (input.stateCode.trim() && !stateCode) return { ok: false, error: "STATE_INVALID" };

  const vacancies = parseVacancies(input.vacancies);
  if (vacancies === undefined) return { ok: false, error: "VACANCIES_INVALID" };

  const salaryMinCents = parseSalary(input.salaryMin);
  const salaryMaxCents = parseSalary(input.salaryMax);
  if (
    salaryMinCents === undefined ||
    salaryMaxCents === undefined ||
    (salaryMinCents !== null && salaryMaxCents !== null && salaryMinCents > salaryMaxCents)
  ) {
    return { ok: false, error: "SALARY_INVALID" };
  }

  const registrationStart = parseDay(input.registrationStart);
  const registrationEnd = parseDay(input.registrationEnd);
  const examDate = parseDay(input.examDate);
  if (registrationStart === undefined || registrationEnd === undefined || examDate === undefined) {
    return { ok: false, error: "DATE_INVALID" };
  }
  if (registrationStart && registrationEnd && registrationStart > registrationEnd) {
    return { ok: false, error: "REGISTRATION_ORDER" };
  }

  const noticeUrl = parseNoticeUrl(input.noticeUrl);
  if (noticeUrl === undefined) return { ok: false, error: "NOTICE_URL_INVALID" };

  const positions = input.positions.trim();
  const summary = input.summary.trim();
  if (positions.length > 1000 || summary.length > 20_000) return { ok: false, error: "TEXT_TOO_LONG" };

  const educationLevels = (Object.keys(EDUCATION_LEVELS) as EducationLevel[]).filter((level) =>
    input.educationLevels.includes(level),
  );

  return {
    ok: true,
    contest: {
      name,
      slug,
      organizationName,
      stateCode,
      status: input.status,
      vacancies,
      hasReserveList: input.hasReserveList,
      salaryMinCents,
      salaryMaxCents,
      educationLevels,
      positions,
      summary,
      registrationStart,
      registrationEnd,
      examDate,
      noticeUrl,
      isFeatured: input.isFeatured,
      isPublished: input.isPublished,
    },
  };
}

const numberFormat = new Intl.NumberFormat("pt-BR");

/** "264 vagas", "63 vagas + CR", "Cadastro reserva", "Vagas a definir". */
export function vacanciesLabel(vacancies: number | null, hasReserveList: boolean): string {
  if (vacancies === null || vacancies === 0) return hasReserveList ? "Cadastro reserva" : "Vagas a definir";
  const base = `${numberFormat.format(vacancies)} ${vacancies === 1 ? "vaga" : "vagas"}`;
  return hasReserveList ? `${base} + CR` : base;
}

/** "Até R$ 16.769,79", "R$ 3.000,00 a R$ 8.000,00", "Salários a definir". */
export function salaryLabel(minCents: number | null, maxCents: number | null): string {
  if (minCents !== null && maxCents !== null && minCents !== maxCents) {
    return `${formatBRL(minCents)} a ${formatBRL(maxCents)}`;
  }
  const single = maxCents ?? minCents;
  return single === null ? "Salários a definir" : `Até ${formatBRL(single)}`;
}

/** Short badge text for a contest without a logo: acronym in parentheses or the initials. */
export function organizationBadge(organizationName: string): string {
  const acronym = /\(([A-Za-zÀ-ú0-9-]{2,10})\)/.exec(organizationName)?.[1];
  if (acronym) return acronym.toUpperCase();
  const firstWord = organizationName.trim().split(/\s+/)[0] ?? "";
  if (/^[A-ZÀ-Ú0-9-]{2,8}$/.test(firstWord)) return firstWord;
  return organizationName
    .split(/\s+/)
    .filter((word) => word.length > 2 && /^[A-Za-zÀ-ú]/.test(word))
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** Dates are stored as UTC midnight (DATE columns): format them in UTC. */
export function formatContestDate(date: Date | null): string | null {
  return date
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date)
    : null;
}

/** DATE column → "YYYY-MM-DD" for <input type="date">. */
export function toDayInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/** Public address of a contest logo (served only while the contest is published). */
export function contestLogoUrl(assetId: string): string {
  return `/api/concursos/logos/${assetId}`;
}

/* ------------------------------------------------------------ positions */

export type ContestPositionPlan = Readonly<{
  name: string;
  vacancies: number | null;
  hasReserveList: boolean;
  salaryCents: number | null;
  educationLevel: EducationLevel | null;
  requirements: string;
}>;

const EDUCATION_WORDS: Readonly<Record<string, EducationLevel>> = {
  fundamental: "FUNDAMENTAL",
  medio: "MEDIO",
  "médio": "MEDIO",
  tecnico: "MEDIO",
  "técnico": "MEDIO",
  superior: "SUPERIOR",
};

/** Vacancies cell: "1.250", "30 + CR", "CR", "" → count and reserve list. */
function parseVacancyCell(value: string): { vacancies: number | null; hasReserveList: boolean } | null {
  const text = value.trim().toUpperCase();
  if (!text) return { vacancies: null, hasReserveList: false };
  const reserve = /\bCR\b|CADASTRO/.test(text);
  const number = text.replace(/\+?\s*CR\b|CADASTRO( DE)? RESERVA/g, "").trim();
  if (!number) return { vacancies: null, hasReserveList: reserve };
  const parsed = parseVacancies(number);
  return parsed === undefined ? null : { vacancies: parsed, hasReserveList: reserve };
}

/**
 * Positions typed one per line: "Cargo | vagas | salário | escolaridade | requisitos"
 * (only the name is required). Returns the 1-based line of the first invalid row.
 */
export function parsePositionLines(
  text: string,
): { ok: true; positions: ContestPositionPlan[] } | { ok: false; line: number } {
  const positions: ContestPositionPlan[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  for (const [index, raw] of lines.entries()) {
    if (!raw.trim()) continue;
    const [name = "", vacancyCell = "", salaryCell = "", educationCell = "", ...rest] = raw.split("|").map((cell) => cell.trim());
    const vacancy = parseVacancyCell(vacancyCell);
    const salaryCents = parseSalary(salaryCell);
    const educationKey = educationCell.toLowerCase();
    const educationLevel = educationKey ? EDUCATION_WORDS[educationKey] : null;
    const requirements = rest.join(" | ").trim();

    if (name.length < 2 || name.length > 200 || !vacancy || salaryCents === undefined || educationLevel === undefined || requirements.length > 500) {
      return { ok: false, line: index + 1 };
    }

    positions.push({ name, ...vacancy, salaryCents, educationLevel, requirements });
  }

  return { ok: true, positions: positions.slice(0, 40) };
}

/** A stored education level (free VARCHAR) back to the typed value. */
export function asEducationLevel(value: string | null): EducationLevel | null {
  return value && Object.hasOwn(EDUCATION_LEVELS, value) ? (value as EducationLevel) : null;
}

/** Back to the editable text of the admin form. */
export function formatPositionLines(positions: readonly ContestPositionPlan[]): string {
  const education: Readonly<Record<EducationLevel, string>> = { FUNDAMENTAL: "fundamental", MEDIO: "médio", SUPERIOR: "superior" };
  return positions
    .map((position) => {
      const vacancies =
        position.vacancies === null ? (position.hasReserveList ? "CR" : "") : `${position.vacancies}${position.hasReserveList ? " + CR" : ""}`;
      const salary = position.salaryCents === null ? "" : (position.salaryCents / 100).toFixed(2).replace(".", ",");
      const cells = [position.name, vacancies, salary, position.educationLevel ? education[position.educationLevel] : "", position.requirements];
      while (cells.length > 1 && cells[cells.length - 1] === "") cells.pop();
      return cells.join(" | ");
    })
    .join("\n");
}

/* ------------------------------------------------------------- timeline */

export type TimelineStep = Readonly<{ label: string; state: "done" | "current" | "next"; detail: string | null }>;

const TIMELINE_ORDER: readonly ContestStatus[] = [
  "EXPECTED",
  "AUTHORIZED",
  "NOTICE_PUBLISHED",
  "REGISTRATION_OPEN",
  "REGISTRATION_CLOSED",
  "EXAM_DONE",
  "FINISHED",
];

/** Where the contest is: previsto → autorizado → edital → inscrições → prova → resultado. */
export function contestTimeline(
  contest: Readonly<{ status: string; registrationStart: Date | null; registrationEnd: Date | null; examDate: Date | null }>,
): TimelineStep[] {
  const position = TIMELINE_ORDER.indexOf(isContestStatus(contest.status) ? contest.status : "EXPECTED");
  const registration =
    contest.registrationStart && contest.registrationEnd
      ? `${formatContestDate(contest.registrationStart)} a ${formatContestDate(contest.registrationEnd)}`
      : formatContestDate(contest.registrationEnd);

  const steps: { label: string; at: number; detail: string | null }[] = [
    { label: "Autorizado", at: 1, detail: null },
    { label: "Edital publicado", at: 2, detail: null },
    { label: "Inscrições", at: 3, detail: registration },
    { label: "Prova", at: 5, detail: formatContestDate(contest.examDate) },
    { label: "Resultado", at: 6, detail: null },
  ];

  return steps.map((step, index) => {
    const nextAt = steps[index + 1]?.at ?? Number.POSITIVE_INFINITY;
    const state = position >= nextAt ? "done" : position >= step.at ? "current" : "next";
    return { label: step.label, state, detail: step.detail };
  });
}

/* ------------------------------------------------------------------ FAQ */

export type ContestFaqInput = Readonly<{
  name: string;
  status: string;
  vacancies: number | null;
  hasReserveList: boolean;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  boardName: string | null;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  examDate: Date | null;
  feeText: string | null;
  educationLevels: readonly string[];
}>;

/** Questions people search for, answered only from what we know (unknowns say so). */
export function contestFaq(contest: ContestFaqInput): { question: string; answer: string }[] {
  const status = isContestStatus(contest.status) ? CONTEST_STATUSES[contest.status].toLowerCase() : "em acompanhamento";
  const levels = contest.educationLevels
    .filter((level): level is EducationLevel => Object.hasOwn(EDUCATION_LEVELS, level))
    .map((level) => EDUCATION_LEVELS[level].toLowerCase());
  const faq = [
    {
      question: `Qual a situação do ${contest.name}?`,
      answer: `O concurso está com situação "${status}". Esta página é atualizada a cada novidade oficial.`,
    },
    {
      question: `Quantas vagas tem o ${contest.name}?`,
      answer:
        contest.vacancies === null
          ? contest.hasReserveList
            ? "O concurso é para formação de cadastro de reserva."
            : "O número de vagas ainda não foi divulgado."
          : `São ${vacanciesLabel(contest.vacancies, contest.hasReserveList).replace("+ CR", "e cadastro de reserva")}.`,
    },
    {
      question: `Qual o salário do ${contest.name}?`,
      answer:
        contest.salaryMinCents === null && contest.salaryMaxCents === null
          ? "A remuneração ainda não foi confirmada em fonte oficial."
          : `${salaryLabel(contest.salaryMinCents, contest.salaryMaxCents)}, conforme as informações oficiais divulgadas.`,
    },
    {
      question: `Qual a banca do ${contest.name}?`,
      answer: contest.boardName ? `A banca organizadora é ${contest.boardName}.` : "A banca organizadora ainda não foi definida.",
    },
    {
      question: `Quando são as inscrições do ${contest.name}?`,
      answer:
        contest.registrationStart && contest.registrationEnd
          ? `De ${formatContestDate(contest.registrationStart)} a ${formatContestDate(contest.registrationEnd)}${contest.feeText ? `, com taxa de ${contest.feeText}` : ""}.`
          : "As datas de inscrição ainda não foram divulgadas.",
    },
    {
      question: `Quando é a prova do ${contest.name}?`,
      answer: contest.examDate ? `A prova está marcada para ${formatContestDate(contest.examDate)}.` : "A data da prova ainda não foi divulgada.",
    },
  ];

  if (levels.length > 0) {
    faq.push({ question: `Qual a escolaridade exigida no ${contest.name}?`, answer: `Há cargos de nível ${levels.join(" e ")}.` });
  }

  return faq;
}
