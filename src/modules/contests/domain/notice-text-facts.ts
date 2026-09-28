import { BRAZIL_STATES, type StateCode } from "@/modules/blog/domain/blog";
import { parseBRL } from "@/modules/store/domain/store";

import type { NoticeExtraction } from "./notice-extraction";

/*
 * Facts read straight from the notice text with fixed rules — no AI. They
 * are more reliable than a small local model for the header data (board,
 * organization, state, fee, exam places, stages) and are used to check
 * ("ground") what the AI answers: a value the notice does not contain is
 * dropped instead of shown.
 */

const PRINT_HEADER = /^\s*\d{2}\/\d{2}\/\d{4},?\s+\d{1,2}:\d{2}(\s.*)?$/;
const PRINT_FOOTER = /^\s*https?:\/\/\S+\s+\d+\/\d+\s*$/;

/** Drops browser print headers/footers ("28/09/2026, 17:43  title", "https://… 12/84"). */
export function cleanNoticeText(text: string): string {
  // pdftotext on Windows writes CRLF and a form feed at each page start.
  return text
    .replace(/\f/g, "")
    .split(/\r?\n/)
    .filter((line) => !PRINT_HEADER.test(line) && !PRINT_FOOTER.test(line) && !/^\s*https?:\/\/\S+…\s+\d+\/\d+\s*$/.test(line))
    .join("\n");
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWord(haystack: string, needle: string): number {
  const matches = haystack.match(new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalize(needle))}(?=$|[^a-z0-9])`, "g"));
  return matches?.length ?? 0;
}

/** Other ways notices name some boards. */
const BOARD_ALIASES: Readonly<Record<string, readonly string[]>> = {
  Cebraspe: ["Centro Brasileiro de Pesquisa em Avaliação e Seleção"],
  FGV: ["Fundação Getulio Vargas", "Fundação Getúlio Vargas"],
  VUNESP: ["Fundação para o Vestibular da Universidade Estadual Paulista"],
  FCC: ["Fundação Carlos Chagas"],
  Cesgranrio: ["Fundação Cesgranrio"],
};

/**
 * The catalog board the notice mentions the most. A name inside a longer one
 * ("AOCP" in "Instituto AOCP") only counts where it stands alone — they are
 * different boards.
 */
export function detectBoard(text: string, boardNames: readonly string[]): string | null {
  const haystack = normalize(text);
  let best: { name: string; count: number } | null = null;

  for (const name of boardNames) {
    let count = countWord(haystack, name);
    for (const longer of boardNames) {
      if (longer !== name && normalize(longer).includes(normalize(name))) count -= countWord(haystack, longer);
    }
    for (const alias of BOARD_ALIASES[name] ?? []) count += countWord(haystack, alias);
    if (count > 0 && (!best || count > best.count)) best = { name, count };
  }

  return best?.name ?? null;
}

const SMALL_WORDS = new Set(["de", "do", "da", "dos", "das", "e", "em"]);

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word)
        ? word
        : word
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join("-"),
    )
    .join("");
}

/** Headers without an acronym: "TRIBUNAL DE JUSTIÇA DO ESTADO DO RIO GRANDE DO SUL". */
const INSTITUTION = /^\s*((?:TRIBUNAL|POL[ÍI]CIA|PREFEITURA|SECRETARIA|MINIST[ÉE]RIO|C[ÂA]MARA|ASSEMBLEIA|UNIVERSIDADE|INSTITUTO FEDERAL|DEFENSORIA|PROCURADORIA|CORPO DE BOMBEIROS|AG[ÊE]NCIA|BANCO|CONTROLADORIA|DEPARTAMENTO|CONSELHO|FUNDA[ÇC][ÃA]O|EMPRESA|COMPANHIA|GUARDA MUNICIPAL)[A-ZÀ-Ú\s,.-]{4,150}?)\s*$/;

/** Usual acronyms built from the institution + UF ("Tribunal de Justiça" in RS → TJRS). */
function acronymFor(name: string, state: StateCode | null): string | null {
  const text = normalize(name);
  const uf = state ?? "";
  const rules: [RegExp, string][] = [
    [/^tribunal de justica/, `TJ${uf}`],
    [/^tribunal regional eleitoral/, `TRE${uf ? `-${uf}` : ""}`],
    [/^policia militar/, `PM${uf}`],
    [/^policia civil/, `PC${uf}`],
    [/^policia penal/, `PP${uf}`],
    [/^corpo de bombeiros/, `CBM${uf}`],
    [/^defensoria publica/, `DPE${uf}`],
    [/^ministerio publico/, `MP${uf}`],
    [/^assembleia legislativa/, `ALE${uf}`],
  ];
  for (const [pattern, acronym] of rules) if (pattern.test(text) && uf) return acronym;
  return null;
}

/**
 * The organization in the header ("POLÍCIA MILITAR DO ESTADO DE ALAGOAS (PMAL)"):
 * among the first lines with an acronym in parentheses, the one the notice
 * repeats the most.
 */
export function detectOrganization(text: string): { name: string; acronym: string } | null {
  const lines = text.split("\n").slice(0, 60);
  const candidates: { name: string; acronym: string; count: number }[] = [];

  for (const line of lines) {
    const match = /^\s*([A-ZÀ-Ú][A-ZÀ-Ú\s,.-]{6,160}?)\s*\(([A-Z][A-Za-z]{1,12}(?:\/[A-Z]{2})?)\)\s*$/.exec(line);
    if (!match) continue;
    const acronym = match[2]!;
    const bare = acronym.replace(/\/[A-Z]{2}$/, "");
    const count = (text.match(new RegExp(`\\b${escapeRegExp(bare)}\\b`, "g")) ?? []).length;
    candidates.push({ name: `${titleCase(match[1]!.trim())} (${acronym})`, acronym: bare, count });
  }

  candidates.sort((a, b) => b.count - a.count);
  if (candidates[0]) return { name: candidates[0].name, acronym: candidates[0].acronym };

  // No acronym in parentheses: the first institution line of the header.
  for (const line of lines.slice(0, 15)) {
    const match = INSTITUTION.exec(line);
    if (!match) continue;
    const name = titleCase(match[1]!.trim());
    const acronym = acronymFor(name, detectState(text));
    return { name: acronym ? `${name} (${acronym})` : name, acronym: acronym ?? "" };
  }
  return null;
}

/** "ESTADO DE ALAGOAS" / "Governo do Estado do Rio Grande do Sul" in the opening → UF. */
export function detectState(text: string): StateCode | null {
  const opening = normalize(text.slice(0, 4_000));
  const entries = (Object.entries(BRAZIL_STATES) as [StateCode, string][]).sort((a, b) => b[1].length - a[1].length);
  for (const [code, name] of entries) {
    if (new RegExp(`estado (de|do|da) ${escapeRegExp(normalize(name))}\\b`).test(opening)) return code;
  }
  return null;
}

/** Year of the notice ("EDITAL Nº 1 – PMAL, DE 19 DE MARÇO DE 2026"). */
export function detectNoticeYear(text: string): number | null {
  const match = /EDITAL\s+N[º°o.]*\s*\d+[^\n]{0,80}?(20\d{2})/i.exec(text);
  return match ? Number(match[1]) : null;
}

/** Registration fee(s): "TAXA: R$ 150,00" → "R$ 150,00"; several → "R$ 90,00 a R$ 200,00". */
export function detectFee(text: string): string | null {
  const values = new Set<number>();
  for (const match of text.matchAll(/taxa(?:\s+de\s+inscri[çc][ãa]o)?[^\n]{0,60}?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi)) {
    const cents = parseBRL(match[1]!);
    if (cents !== null && cents > 0 && cents < 100_000) values.add(cents);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  if (sorted.length === 0) return null;
  return sorted.length === 1 ? money(sorted[0]!) : `${money(sorted[0]!)} a ${money(sorted[sorted.length - 1]!)}`;
}

/** "serão realizadas nas cidades de Arapiraca/AL e Maceió/AL." */
export function detectExamLocations(text: string): string | null {
  const flat = text.replace(/\s+/g, " ");
  const match = /(?:provas?[^.]{0,120}?)?ser[ãa]o\s+(?:realizadas|aplicadas)\s+(?:nas\s+cidades\s+de|na\s+cidade\s+de|em)\s+([^.;]{3,160})[.;]/i.exec(flat);
  return match ? match[1]!.trim() : null;
}

/** Stages listed as "a) provas objetivas, de caráter eliminatório…". */
export function detectStages(text: string): string[] {
  const stages: string[] = [];
  for (const match of text.matchAll(/^\s*[a-j]\)\s*([^,;\n]{4,80}?),\s*de\s+car[áa]ter/gim)) {
    const stage = match[1]!.trim();
    const label = stage.charAt(0).toUpperCase() + stage.slice(1);
    if (!stages.some((item) => normalize(item) === normalize(label))) stages.push(label);
    if (stages.length >= 12) break;
  }
  if (stages.length > 0) return stages;

  // "A Primeira Etapa compreenderá 1 (uma) Prova Objetiva Seletiva, …"
  const flat = text.replace(/\s+/g, " ");
  for (const match of flat.matchAll(/(Primeira|Segunda|Terceira|Quarta|Quinta|Sexta)\s+Etapa\s+compreender[áa]\s+(?:\d+\s*\([^)]*\)\s*)?([^,.;]{4,90})/gi)) {
    const label = `${match[1]!.charAt(0).toUpperCase()}${match[1]!.slice(1).toLowerCase()} etapa: ${match[2]!.trim()}`;
    if (!stages.some((item) => normalize(item) === normalize(label))) stages.push(label);
    if (stages.length >= 8) break;
  }
  return stages;
}

/** Whether a money value (e.g. "11.563,77") is written in the notice. */
function hasMoney(normalizedText: string, value: string | null | undefined): boolean {
  if (!value) return false;
  const cents = parseBRL(value.replace(/R\$\s*/i, ""));
  if (cents === null) return false;
  const formatted = (cents / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return normalizedText.includes(formatted) || normalizedText.includes(formatted.replace(/\./g, ""));
}

function hasNumber(normalizedText: string, value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  const plain = String(value);
  const dotted = plain.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return new RegExp(`(^|[^\\d.])(${escapeRegExp(plain)}|${escapeRegExp(dotted)})(?=$|[^\\d])`).test(normalizedText);
}

function hasText(normalizedText: string, value: string | null | undefined, prefix = 14): boolean {
  if (!value) return false;
  const needle = normalize(value).replace(/\s+/g, " ").trim().slice(0, prefix);
  return needle.length >= 3 && normalizedText.replace(/\s+/g, " ").includes(needle);
}

/**
 * Keeps only what the notice actually says: names, numbers and money the AI
 * returned but that do not appear in the text are removed.
 */
export function groundExtraction(extraction: NoticeExtraction, text: string): { extraction: NoticeExtraction; dropped: string[] } {
  const normalizedText = normalize(text);
  const dropped: string[] = [];
  const keep = <T>(label: string, value: T | null | undefined, ok: boolean): T | null => {
    if (value === null || value === undefined || value === "") return null;
    if (!ok) dropped.push(label);
    return ok ? value : null;
  };

  const positions = (extraction.positions ?? []).filter((position) => {
    const ok = hasText(normalizedText, position.name, 12);
    if (!ok) dropped.push(`cargo "${position.name}"`);
    return ok;
  });

  return {
    extraction: {
      ...extraction,
      name: null, // rebuilt from organization + year (small models copy examples here)
      organizationName: keep("órgão", extraction.organizationName, hasText(normalizedText, extraction.organizationName, 18)),
      boardName: keep("banca", extraction.boardName, hasText(normalizedText, extraction.boardName, 20)),
      vacancies: keep("total de vagas", extraction.vacancies, hasNumber(normalizedText, extraction.vacancies)),
      salaryMin: keep("salário mínimo", extraction.salaryMin, hasMoney(normalizedText, extraction.salaryMin)),
      salaryMax: keep("salário máximo", extraction.salaryMax, hasMoney(normalizedText, extraction.salaryMax)),
      feeText: keep("taxa", extraction.feeText, hasMoney(normalizedText, extraction.feeText)),
      positions: positions.map((position) => ({
        ...position,
        vacancies: hasNumber(normalizedText, position.vacancies) ? position.vacancies : null,
        salary: hasMoney(normalizedText, position.salary) ? position.salary : null,
        // Small models invent requirements: keep only what the rules read.
        requirements: null,
      })),
      examLocations: keep("locais de prova", extraction.examLocations, hasText(normalizedText, extraction.examLocations, 8)),
      registrationStart: keep("início das inscrições", extraction.registrationStart, hasDate(text, extraction.registrationStart)),
      registrationEnd: keep("fim das inscrições", extraction.registrationEnd, hasDate(text, extraction.registrationEnd)),
      examDate: keep("data da prova", extraction.examDate, hasDate(text, extraction.examDate)),
    },
    dropped,
  };
}

/* ------------------------------------------------------------ positions */

export type DetectedPosition = Readonly<{
  name: string;
  vacancies: number | null;
  hasReserveList: boolean;
  /** Highest pay quoted in the position section (after training, when there are several). */
  salary: string | null;
  education: "FUNDAMENTAL" | "MEDIO" | "SUPERIOR" | null;
}>;

function educationFrom(requirement: string): DetectedPosition["education"] {
  const text = normalize(requirement);
  if (/superior|graduac|bacharel|licenciatura|diploma de curso de nivel superior/.test(text)) return "SUPERIOR";
  if (/ensino medio|nivel medio|tecnico/.test(text)) return "MEDIO";
  if (/ensino fundamental|nivel fundamental/.test(text)) return "FUNDAMENTAL";
  return null;
}

const MONEY = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g;

/**
 * Vacancy row of a position in an AC / PcD / PPIQ / TOTAL table: the first
 * group of 2–3 numbers whose sum is also written in the row (or the line
 * above, where printed tables often push the total) is the immediate total;
 * the next group with a matching sum is the reserve list.
 */
function vacanciesFromTable(lines: readonly string[], name: string): { immediate: number | null; reserve: number | null } {
  const wanted = normalize(name).slice(0, 18);
  for (const [index, line] of lines.entries()) {
    const normalized = normalize(line);
    const at = normalized.indexOf(wanted);
    if (at < 0 || !/\d/.test(normalized.slice(at + wanted.length))) continue;

    const afterName = line.slice(at + wanted.length).replace(/\d{1,3}(\.\d{3})+/g, (value) => value.replace(/\./g, ""));
    const numbers = [...afterName.matchAll(/\b\d{1,6}\b/g)].map((match) => Number(match[0]));
    const nearby = new Set([
      ...numbers,
      ...[...(lines[index - 1] ?? "").matchAll(/\b\d{1,6}\b/g)].map((match) => Number(match[0])),
    ]);

    const groups: number[] = [];
    for (let start = 0; start < numbers.length && groups.length < 2; start += 1) {
      for (const size of [3, 2]) {
        const slice = numbers.slice(start, start + size);
        if (slice.length < size) continue;
        const sum = slice.reduce((total, value) => total + value, 0);
        if (sum > 0 && nearby.has(sum) && !slice.includes(sum)) {
          groups.push(sum);
          start += size - 1;
          break;
        }
      }
    }
    if (groups.length > 0) return { immediate: groups[0] ?? null, reserve: groups[1] ?? null };
  }
  return { immediate: null, reserve: null };
}

/** Positions from "CARGO 1: NOME" headings, with requirement → education, pay and table vacancies. */
export function detectPositions(text: string): DetectedPosition[] {
  const lines = text.split("\n");
  const headings: { index: number; name: string }[] = [];
  for (const [index, line] of lines.entries()) {
    const match = /^\s*(?:\d+(?:\.\d+)*\s+)?CARGO\s+\d{1,3}\s*[:–-]\s*(.{3,120}?)\s*$/.exec(line);
    if (match && match[1] === match[1]!.toUpperCase()) headings.push({ index, name: titleCase(match[1]!.trim()) });
  }

  // "provimento de 30 (trinta) vagas no cargo de JUIZ DE DIREITO SUBSTITUTO"
  if (headings.length === 0) {
    const flat = text.replace(/\s+/g, " ");
    const found: DetectedPosition[] = [];
    for (const match of flat.matchAll(/provimento\s+de\s+(\d{1,5})\s*(?:\([^)]{1,40}\)\s*)?vagas?\s+(?:no|para\s+o)\s+cargo\s+de\s+([A-ZÀ-Ú][A-ZÀ-Ú\s-]{3,80}?)(?=[,.;]|\s+[a-zà-ú(])/g)) {
      const pays = [...flat.matchAll(/(?:subs[íi]dio|remunera[çc][ãa]o|vencimento)[^.]{0,80}?R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi)]
        .map((pay) => parseBRL(pay[1]!))
        .filter((cents): cents is number => cents !== null && cents >= 100_000);
      const requirements = /requisitos?[\s\S]{0,1500}/i.exec(text)?.[0] ?? "";
      found.push({
        name: titleCase(match[2]!.trim()),
        vacancies: Number(match[1]),
        hasReserveList: false,
        salary: pays.length > 0 ? (Math.max(...pays) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") : null,
        education: educationFrom(requirements),
      });
    }
    return found.slice(0, 20);
  }

  const detected = headings.slice(0, 40).map((heading, position) => {
    const end = headings[position + 1]?.index ?? Math.min(heading.index + 80, lines.length);
    const section = lines.slice(heading.index + 1, end).join("\n");
    const requirement = /REQUISITOS?:\s*([\s\S]{0,400}?)(?:\n\s*\n|DESCRI|REMUNERA|$)/i.exec(section)?.[1] ?? "";
    const pays = [...section.matchAll(MONEY)]
      .map((match) => parseBRL(match[1]!))
      .filter((cents): cents is number => cents !== null && cents >= 100_000);
    const table = vacanciesFromTable(lines, heading.name);

    return {
      name: heading.name,
      vacancies: table.immediate,
      hasReserveList: table.reserve !== null,
      salary: pays.length > 0 ? (Math.max(...pays) / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") : null,
      education: educationFrom(requirement),
    };
  });

  // The same headings come back later (syllabus, annexes): keep one per name, the richest.
  const unique = new Map<string, DetectedPosition>();
  for (const position of detected) {
    const key = normalize(position.name);
    const previous = unique.get(key);
    if (!previous || (!previous.salary && position.salary)) unique.set(key, position);
  }
  return [...unique.values()];
}

/* ---------------------------------------------------------------- dates */

const MONTH_NUMBERS: Readonly<Record<string, string>> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

const DATE = /(\d{1,2})\/(\d{1,2})\/(20\d{2})|(\d{1,2})º?\s+de\s+([a-zç]+)\s+de\s+(20\d{2})/gi;

function isoDates(fragment: string): string[] {
  const dates: string[] = [];
  for (const match of fragment.matchAll(DATE)) {
    if (match[1]) {
      dates.push(`${match[3]}-${match[2]!.padStart(2, "0")}-${match[1].padStart(2, "0")}`);
    } else {
      const month = MONTH_NUMBERS[normalize(match[5]!)];
      if (month) dates.push(`${match[6]}-${month}-${match[4]!.padStart(2, "0")}`);
    }
  }
  return dates;
}

/** "inscrições … de 14 de setembro de 2026 … até 16 de outubro de 2026" → both dates. */
export function detectRegistrationPeriod(text: string): { start: string | null; end: string | null } {
  const flat = text.replace(/\s+/g, " ");
  for (const match of flat.matchAll(/(?:per[íi]odo\s+de\s+(?:solicita[çc][ãa]o\s+de\s+)?inscri[çc][ãa]o|inscri[çc][õo]es[^.]{0,60}?(?:ser[ãa]o|estar[ãa]o|poder[ãa]o|ficar[ãa]o|abertas)|reabertura\s+das\s+inscri[çc][õo]es)[^.]{0,260}/gi)) {
    const dates = isoDates(match[0]);
    if (dates.length >= 2 && dates[0]! <= dates[1]!) return { start: dates[0]!, end: dates[1]! };
  }
  return { start: null, end: null };
}

/** Whether a date (YYYY-MM-DD) is written in the notice, numeric or in words. */
function hasDate(text: string, iso: string | null | undefined): boolean {
  if (!iso) return false;
  return isoDates(text.replace(/\s+/g, " ")).includes(iso);
}

/** Everything the rules can tell, to fill or replace what the AI missed. */
export type NoticeTextFacts = Readonly<{
  organization: { name: string; acronym: string } | null;
  stateCode: StateCode | null;
  year: number | null;
  boardName: string | null;
  feeText: string | null;
  examLocations: string | null;
  stages: string[];
  positions: DetectedPosition[];
  registration: { start: string | null; end: string | null };
}>;

export function readNoticeTextFacts(text: string, boardNames: readonly string[]): NoticeTextFacts {
  return {
    organization: detectOrganization(text),
    stateCode: detectState(text),
    year: detectNoticeYear(text),
    boardName: detectBoard(text, boardNames),
    feeText: detectFee(text),
    examLocations: detectExamLocations(text),
    stages: detectStages(text),
    positions: detectPositions(text),
    registration: detectRegistrationPeriod(text),
  };
}

/** The AI answer (already grounded) completed with the rule facts; rules win for header data. */
export function mergeNoticeFacts(extraction: NoticeExtraction, facts: NoticeTextFacts): NoticeExtraction {
  const acronym = facts.organization?.acronym;
  const rulePositions = facts.positions;
  const salaries = rulePositions
    .map((position) => (position.salary ? parseBRL(position.salary) : null))
    .filter((cents): cents is number => cents !== null);
  const money = (cents: number) => (cents / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const totalVacancies = rulePositions.reduce((sum, position) => sum + (position.vacancies ?? 0), 0);

  return {
    ...extraction,
    ...(rulePositions.length > 0
      ? {
          positions: rulePositions.map((position) => ({
            name: position.name,
            vacancies: position.vacancies,
            reserve: position.hasReserveList,
            salary: position.salary,
            education: position.education === "MEDIO" ? "médio" : position.education?.toLowerCase() ?? null,
            requirements: null,
          })),
          vacancies: totalVacancies > 0 ? totalVacancies : extraction.vacancies ?? null,
          hasReserveList: rulePositions.some((position) => position.hasReserveList),
          salaryMin: salaries.length > 0 ? money(Math.min(...salaries)) : extraction.salaryMin ?? null,
          salaryMax: salaries.length > 0 ? money(Math.max(...salaries)) : extraction.salaryMax ?? null,
          educationLevels: [],
        }
      : {}),
    registrationStart: facts.registration.start ?? extraction.registrationStart ?? null,
    registrationEnd: facts.registration.end ?? extraction.registrationEnd ?? null,
    name: acronym && facts.year ? `Concurso ${acronym} ${facts.year}` : extraction.name ?? null,
    organizationName: facts.organization?.name ?? extraction.organizationName ?? null,
    stateCode: facts.stateCode ?? extraction.stateCode ?? null,
    boardName: facts.boardName ?? extraction.boardName ?? null,
    feeText: facts.feeText ?? extraction.feeText ?? null,
    examLocations: facts.examLocations ?? extraction.examLocations ?? null,
    stages: facts.stages.length > 0 ? facts.stages : extraction.stages ?? [],
  };
}

/**
 * Lines around the anchors that carry the facts (money, vacancies, positions,
 * fee, schedule, exam places), plus the opening — for the local AI.
 */
export function anchoredExcerpt(text: string, maxChars = 12_000): string {
  const lines = text.split("\n");
  const anchors = [
    /R\$\s*\d/,
    /vagas\s+imediatas|cadastro\s+de\s+reserva\s*\(CR\)|total\s+de\s+vagas/i,
    /^\s*(\d+(\.\d+)*\s+)?cargo\s*\d*\s*:/i,
    /\btaxa\b/i,
    /per[íi]odo\s+de\s+(solicita[çc][ãa]o\s+de\s+)?inscri/i,
    /\d{1,2}\/\d{1,2}\/20\d{2}/,
    /\d{1,2}\s+de\s+[a-zç]+\s+de\s+20\d{2}/i,
    /realizadas?\s+nas?\s+cidades?/i,
    /escolaridade|requisito/i,
  ];

  const keep = new Set<number>();
  for (let index = 0; index < Math.min(lines.length, 40); index += 1) keep.add(index);
  for (const [index, line] of lines.entries()) {
    if (anchors.some((anchor) => anchor.test(line))) {
      for (let offset = -2; offset <= 4; offset += 1) {
        if (index + offset >= 0 && index + offset < lines.length) keep.add(index + offset);
      }
    }
  }

  const out: string[] = [];
  let used = 0;
  let previous = -2;
  for (const index of [...keep].sort((a, b) => a - b)) {
    const line = lines[index]!.replace(/\s{3,}/g, "  ").trimEnd();
    if (!line.trim()) continue;
    const piece = (index !== previous + 1 ? "…\n" : "") + line;
    if (used + piece.length + 1 > maxChars) break;
    out.push(piece);
    used += piece.length + 1;
    previous = index;
  }
  return out.join("\n");
}
