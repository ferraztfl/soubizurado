import { z } from "zod";

import { parseStateCode } from "@/modules/blog/domain/blog";

import {
  EDUCATION_LEVELS,
  formatPositionLines,
  isContestStatus,
  parsePositionLines,
  type ContestPositionPlan,
  type EducationLevel,
} from "./contest";

/*
 * What the AI may return after reading an official notice (edital), and how
 * it becomes suggestions for the contest form. Everything is optional and
 * re-validated: the admin reviews and saves through the normal form rules.
 */

const text = (max: number) => z.string().trim().max(max * 4).nullish();

export const noticeExtractionSchema = z.object({
  name: text(200),
  organizationName: text(200),
  stateCode: text(2),
  boardName: text(120),
  status: text(40),
  vacancies: z.number().int().min(0).max(1_000_000).nullish(),
  hasReserveList: z.boolean().nullish(),
  salaryMin: text(20),
  salaryMax: text(20),
  educationLevels: z.array(z.string()).max(3).nullish(),
  positions: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(400),
        vacancies: z.number().int().min(0).max(1_000_000).nullish(),
        reserve: z.boolean().nullish(),
        salary: text(20),
        education: text(20),
        requirements: text(500),
      }),
    )
    .max(80)
    .nullish(),
  registrationStart: text(10),
  registrationEnd: text(10),
  examDate: text(10),
  feeText: text(120),
  stages: z.array(z.string().trim().max(300)).max(20).nullish(),
  examLocations: text(300),
  summary: text(4000),
  news: z
    .object({
      title: z.string().trim().max(400),
      excerpt: z.string().trim().max(1200),
      body: z.string().trim().max(40_000),
    })
    .nullish(),
});

export type NoticeExtraction = z.infer<typeof noticeExtractionSchema>;

export type NoticeSuggestion = Readonly<{
  name: string;
  organizationName: string;
  stateCode: string | null;
  boardName: string | null;
  status: string;
  vacancies: string;
  hasReserveList: boolean;
  salaryMin: string;
  salaryMax: string;
  educationLevels: EducationLevel[];
  positionLines: string;
  registrationStart: string;
  registrationEnd: string;
  examDate: string;
  feeText: string;
  stages: string;
  examLocations: string;
  summary: string;
  news: Readonly<{ title: string; excerpt: string; body: string }> | null;
  warnings: string[];
}>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONEY = /^\d{1,3}(\.\d{3})*(,\d{2})?$|^\d+(,\d{2})?$/;

function day(value: string | null | undefined): string {
  return value && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : "";
}

function money(value: string | null | undefined): string {
  const cleaned = (value ?? "").replace(/R\$\s*/i, "").trim();
  return MONEY.test(cleaned) ? cleaned : "";
}

function education(value: string | null | undefined): EducationLevel | null {
  const key = (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  if (key.startsWith("FUNDAMENTAL")) return "FUNDAMENTAL";
  if (key.startsWith("MEDIO") || key.startsWith("TECNICO")) return "MEDIO";
  if (key.startsWith("SUPERIOR")) return "SUPERIOR";
  return null;
}

function clip(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

/** Turns the AI answer into form suggestions (invalid pieces are dropped with a warning). */
export function toNoticeSuggestion(extraction: NoticeExtraction): NoticeSuggestion {
  const warnings: string[] = [];

  const status = extraction.status && isContestStatus(extraction.status) ? extraction.status : "NOTICE_PUBLISHED";
  const stateCode = extraction.stateCode ? parseStateCode(extraction.stateCode) : null;
  if (extraction.stateCode && !stateCode) warnings.push(`UF "${extraction.stateCode}" ignorada.`);

  const positions: ContestPositionPlan[] = (extraction.positions ?? []).map((position) => ({
    name: clip(position.name, 200),
    vacancies: position.vacancies ?? null,
    hasReserveList: Boolean(position.reserve),
    salaryCents: null,
    educationLevel: education(position.education),
    requirements: clip(position.requirements, 500),
  }));
  // Salaries go through the same parser as the form (Brazilian format).
  let positionLines = formatPositionLines(positions);
  const withSalary = (extraction.positions ?? []).map((position, index) => {
    const salary = money(position.salary);
    const line = positionLines.split("\n")[index] ?? "";
    if (!salary) return line;
    const cells = line.split(" | ");
    while (cells.length < 3) cells.push("");
    cells[2] = salary;
    return cells.join(" | ");
  });
  positionLines = withSalary.join("\n");
  if (positionLines && !parsePositionLines(positionLines).ok) {
    warnings.push("Alguns cargos vieram fora do formato; confira a lista de cargos.");
  }

  const levels = [
    ...new Set([
      ...(extraction.educationLevels ?? []).map(education),
      ...positions.map((position) => position.educationLevel),
    ]),
  ].filter((level): level is EducationLevel => level !== null && Object.hasOwn(EDUCATION_LEVELS, level));

  const totalFromPositions = positions.reduce((sum, position) => sum + (position.vacancies ?? 0), 0);
  const vacancies = extraction.vacancies ?? (totalFromPositions > 0 ? totalFromPositions : null);

  const news = extraction.news?.title && extraction.news.body
    ? { title: clip(extraction.news.title, 200), excerpt: clip(extraction.news.excerpt, 320), body: clip(extraction.news.body, 20_000) }
    : null;
  if (!news) warnings.push("A IA não montou o rascunho da notícia.");

  return {
    name: clip(extraction.name, 200),
    organizationName: clip(extraction.organizationName, 200),
    stateCode,
    boardName: extraction.boardName ? clip(extraction.boardName, 120) : null,
    status,
    vacancies: vacancies === null ? "" : String(vacancies),
    hasReserveList: Boolean(extraction.hasReserveList) || positions.some((position) => position.hasReserveList),
    salaryMin: money(extraction.salaryMin),
    salaryMax: money(extraction.salaryMax),
    educationLevels: levels,
    positionLines,
    registrationStart: day(extraction.registrationStart),
    registrationEnd: day(extraction.registrationEnd),
    examDate: day(extraction.examDate),
    feeText: clip(extraction.feeText, 120),
    stages: (extraction.stages ?? []).map((stage) => stage.trim()).filter(Boolean).join("\n").slice(0, 2000),
    examLocations: clip(extraction.examLocations, 300),
    summary: clip(extraction.summary, 20_000),
    news,
    warnings,
  };
}

/** Exact (case-insensitive) match in the board catalog — "Instituto AOCP" is not "AOCP". */
export function matchBoard<T extends Readonly<{ id: string; name: string }>>(boards: readonly T[], name: string | null): T | null {
  if (!name) return null;
  const wanted = name.trim().toLowerCase();
  return boards.find((board) => board.name.trim().toLowerCase() === wanted) ?? null;
}
