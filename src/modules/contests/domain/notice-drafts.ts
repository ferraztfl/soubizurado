import { BRAZIL_STATES, parseStateCode } from "@/modules/blog/domain/blog";
import { formatBRL, parseBRL } from "@/modules/store/domain/store";

import { EDUCATION_LEVELS, parsePositionLines, vacanciesLabel, type EducationLevel } from "./contest";
import type { NoticeSuggestion } from "./notice-extraction";

/*
 * Helpers for the local (small, CPU) AI: pick the parts of a notice that
 * carry the facts, and write the summary and the news draft from the
 * extracted facts with a fixed template (no free text from the model).
 */

const KEYWORDS: readonly (readonly [RegExp, number])[] = [
  [/cronograma/i, 6],
  [/\bvagas?\b/i, 4],
  [/remunera[çc][ãa]o|vencimento|subs[íi]dio|sal[áa]rio/i, 4],
  [/inscri[çc][õo]es|inscri[çc][ãa]o/i, 4],
  [/taxa\b/i, 3],
  [/prova objetiva|provas? discursiva|teste de aptid[ãa]o|avalia[çc][ãa]o (psicol|m[ée]dica)|investiga[çc][ãa]o social|curso de forma[çc][ãa]o|t[íi]tulos/i, 3],
  [/escolaridade|requisitos?|n[íi]vel (m[ée]dio|superior|fundamental)/i, 3],
  [/cadastro de reserva/i, 2],
  [/\bcargos?\b/i, 2],
  [/\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2} de [a-zç]+ de \d{4}/i, 2],
  [/R\$\s*\d/i, 3],
];

/**
 * The most informative parts of a long notice, in their original order: the
 * opening (organization, board, title) plus the paragraphs that mention
 * vacancies, pay, registration, fee, schedule and stages.
 */
export function selectNoticeExcerpts(text: string, maxChars = 20_000): string {
  if (text.length <= maxChars) return text;

  const head = text.slice(0, 4_000);
  const blocks = text
    .slice(4_000)
    .split(/\n\s*\n/)
    .map((block, index) => ({ block: block.trim(), index }))
    .filter((item) => item.block.length > 20);

  const scored = blocks
    .map((item) => ({
      ...item,
      score: KEYWORDS.reduce((sum, [pattern, weight]) => sum + (pattern.test(item.block) ? weight : 0), 0),
    }))
    .filter((item) => item.score >= 4);

  const chosen = new Set<number>();
  let used = head.length;
  for (const item of [...scored].sort((a, b) => b.score - a.score || a.index - b.index)) {
    const piece = item.block.slice(0, 2_500);
    if (used + piece.length + 2 > maxChars) continue;
    chosen.add(item.index);
    used += piece.length + 2;
  }

  return [head, ...blocks.filter((item) => chosen.has(item.index)).map((item) => item.block.slice(0, 2_500))].join("\n\n");
}

/** "no Rio Grande do Sul", "na Bahia", "em Pernambuco". */
const STATE_PREPOSITION: Readonly<Record<string, "no" | "na" | "em">> = {
  AC: "no", AP: "no", AM: "no", CE: "no", DF: "no", ES: "no", MA: "no", PA: "no", PR: "no", PI: "no",
  RJ: "no", RN: "no", RS: "no", TO: "no", BA: "na", PB: "na",
};

export function inState(code: string | null | undefined): string | null {
  const state = parseStateCode(code ?? null);
  return state ? `${STATE_PREPOSITION[state] ?? "em"} ${BRAZIL_STATES[state]}` : null;
}

function dateBR(day: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

function money(value: string): string | null {
  const cents = value ? parseBRL(value) : null;
  return cents === null ? null : formatBRL(cents);
}

type DraftFacts = Pick<
  NoticeSuggestion,
  | "name"
  | "organizationName"
  | "stateCode"
  | "boardName"
  | "vacancies"
  | "hasReserveList"
  | "salaryMin"
  | "salaryMax"
  | "educationLevels"
  | "positionLines"
  | "registrationStart"
  | "registrationEnd"
  | "examDate"
  | "feeText"
  | "stages"
  | "examLocations"
>;

function salaryText(facts: DraftFacts): string | null {
  const min = money(facts.salaryMin);
  const max = money(facts.salaryMax);
  if (min && max && min !== max) return `de ${min} a ${max}`;
  return max ?? min;
}

/** Short summary of the contest from the extracted facts (only what was found). */
export function buildContestSummary(facts: DraftFacts): string {
  const place = inState(facts.stateCode);
  const vacancies = facts.vacancies ? Number(facts.vacancies) : null;
  const salary = salaryText(facts);
  const start = dateBR(facts.registrationStart);
  const end = dateBR(facts.registrationEnd);
  const exam = dateBR(facts.examDate);

  const first = [
    `Saiu o edital do ${facts.name || "concurso"}`,
    facts.organizationName ? ` (${facts.organizationName})` : "",
    facts.boardName ? `, organizado pela banca ${facts.boardName}` : "",
    place ? `, ${place}` : "",
    ".",
  ].join("");

  const second = [
    vacancies || facts.hasReserveList ? `A seleção oferece ${vacanciesLabel(vacancies, facts.hasReserveList).replace("+ CR", "e cadastro de reserva")}` : "",
    salary ? `${vacancies || facts.hasReserveList ? ", com remuneração inicial " : "A remuneração inicial é "}${salary}` : "",
  ].join("");

  const third = [
    start && end ? `As inscrições vão de ${start} a ${end}` : end ? `As inscrições vão até ${end}` : "",
    facts.feeText ? `${start || end ? ", com taxa de " : "A taxa de inscrição é de "}${facts.feeText}` : "",
    exam ? `${start || end || facts.feeText ? ". A prova objetiva está marcada para " : "A prova objetiva está marcada para "}${exam}` : "",
  ].join("");

  return [first, second ? `${second}.` : "", third ? `${third}.` : ""].filter(Boolean).join("\n\n");
}

/** News draft in the blog format (summary box, positions table, notice warning), only from facts. */
export function buildNewsDraft(facts: DraftFacts): { title: string; excerpt: string; body: string } {
  const name = facts.name || "Concurso";
  const vacancies = facts.vacancies ? Number(facts.vacancies) : null;
  const salary = salaryText(facts);
  const end = dateBR(facts.registrationEnd);
  const start = dateBR(facts.registrationStart);
  const exam = dateBR(facts.examDate);
  const positions = parsePositionLines(facts.positionLines);
  const levels = facts.educationLevels.map((level: EducationLevel) => EDUCATION_LEVELS[level].toLowerCase());

  const titleParts = [
    `${name}: edital publicado`,
    vacancies ? `com ${vacancies.toLocaleString("pt-BR")} vagas` : facts.hasReserveList ? "com cadastro de reserva" : "",
    salary ? `e salário ${salary.startsWith("de ") ? salary : `de ${salary}`}` : "",
  ].filter(Boolean);
  const title = titleParts.join(" ").slice(0, 200);

  const excerpt = [
    facts.boardName ? `Banca ${facts.boardName}.` : "",
    end ? `Inscrições até ${end}.` : "",
    exam ? `Prova em ${exam}.` : "",
    "Veja cargos, requisitos e cronograma.",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 320);

  const summaryLines = [
    vacancies || facts.hasReserveList ? `- **Vagas:** ${vacanciesLabel(vacancies, facts.hasReserveList)}` : "",
    salary ? `- **Remuneração inicial:** ${salary}` : "",
    facts.boardName ? `- **Banca:** ${facts.boardName}` : "",
    levels.length > 0 ? `- **Escolaridade:** nível ${levels.join(" e ")}` : "",
    start && end ? `- **Inscrições:** de ${start} a ${end}` : end ? `- **Inscrições:** até ${end}` : "",
    facts.feeText ? `- **Taxa:** ${facts.feeText}` : "",
    exam ? `- **Prova objetiva:** ${exam}` : "",
    facts.examLocations ? `- **Locais de prova:** ${facts.examLocations}` : "",
  ].filter(Boolean);

  const table =
    positions.ok && positions.positions.length > 0
      ? [
          "## Cargos e vagas",
          [
            "| Cargo | Vagas | Remuneração | Escolaridade |",
            "|---|---|---|---|",
            ...positions.positions.map(
              (position) =>
                `| ${position.name} | ${vacanciesLabel(position.vacancies, position.hasReserveList)} | ${position.salaryCents === null ? "—" : formatBRL(position.salaryCents)} | ${position.educationLevel ? EDUCATION_LEVELS[position.educationLevel] : "—"} |`,
            ),
          ].join("\n"),
        ]
      : [];

  const stages = facts.stages
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const body = [
    buildContestSummary(facts),
    summaryLines.length > 0 ? `!!! resumo ${name} em resumo\n${summaryLines.join("\n")}` : "",
    ...table,
    stages.length > 0 ? `## Etapas da seleção\n\n${stages.map((stage, index) => `${index + 1}. ${stage.charAt(0).toUpperCase()}${stage.slice(1)}`).join("\n")}` : "",
    "!!! atencao Confira sempre o edital\nEste texto resume o edital oficial. Prazos, requisitos e regras valem como estão no documento publicado pelo órgão e pela banca.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { title, excerpt, body };
}
