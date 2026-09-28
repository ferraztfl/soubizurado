import "dotenv/config";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { resolveExamSection } from "../src/modules/imports/application/official-exams/resolve-exam-section";
import type {
  ProviderQuestionCandidate,
  QuestionProvider,
} from "../src/modules/imports/application/ports/question-provider";
import { ImportProviderQuestionsUseCase } from "../src/modules/imports/application/use-cases/import-provider-questions";
import { loadSectionTaxonomyEntries } from "../src/modules/imports/infrastructure/official-exams/run-official-exam-import";
import { QuestApiProvider } from "../src/modules/imports/infrastructure/providers/quest-api-provider";
import { PrismaQuestionImportRepository } from "../src/modules/imports/infrastructure/repositories/prisma-question-import-repository";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Imports whole exams from the Quest API into our bank, spending credits
 * only once: every paid response is cached in data-private and never
 * requested again. Questions then follow our pipeline (catalog board,
 * canonical taxonomy only, our classification, public code, publication
 * policy) — students never hit the Quest API.
 *
 *   npm run quest:plan   -- --banca="Instituto AOCP" --anos=2025,2024 [--list-budget=150] [--reserve=60]
 *   npm run quest:import                 # dry-run: shows what the plan would fetch and cost
 *   npm run quest:import -- --apply      # fetches (cache first), imports to review, enqueues classification
 *
 * Keys: QUEST_API_KEYS (comma-separated, one per account) or QUEST_API_KEY in .env.
 * Cost (credits): exam listing 1/exam · exam 3/question · answer key 3/question.
 */

const DIR = resolve("data-private", "imports", "quest-api");
const CACHE = join(DIR, "cache");
const PLAN = join(DIR, "plan.json");
const MAX_QUESTIONS = 100; // the provider imports at most 100 items per exam

type Exam = {
  id: string;
  board: string | null;
  year: number | null;
  organization: string | null;
  careerPosition: string | null;
  alternativeType: string | null;
  totalQuestions: number;
  cost: number;
  status: "planned" | "already-imported" | "already-in-bank" | "too-large" | "over-budget";
  match?: string;
};

// ---------------------------------------------------------------- keys + cache

function readKeys(): string[] {
  const keys = (process.env.QUEST_API_KEYS ?? process.env.QUEST_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    throw new Error("Set QUEST_API_KEYS (or QUEST_API_KEY) in .env.");
  }

  return keys;
}

const spent = { credits: 0, requests: 0, cacheHits: 0 };

/** Credits a response cost, from what it delivered (docs: "Consumo e créditos"). */
function creditsOf(url: URL, body: unknown): number {
  const data = (body as { data?: Record<string, unknown> })?.data ?? {};
  const items = Array.isArray(data.items) ? data.items.length : 0;
  const answerKeys = Array.isArray(data.gabaritos) ? data.gabaritos.length : 0;

  if (/^\/v2\/provas\/[^/]+\/gabarito$/.test(url.pathname)) return 3 * answerKeys;
  if (/^\/v2\/provas\/[^/]+$/.test(url.pathname)) return 3 * items;
  if (url.pathname === "/v2/provas") return items;
  if (url.pathname.startsWith("/v2/questoes")) return (url.searchParams.get("include_gabarito") === "true" ? 6 : 3) * Math.max(items, 1);
  return url.pathname.startsWith("/v2/filtros") || url.pathname === "/v2/stats" ? 1 : 0;
}

/**
 * fetch() for the provider: paid GET responses are cached on disk by URL
 * (the key is never part of it) and replayed for free; on 402 (credits
 * over) the next key/account is tried.
 */
function createFetcher(keys: readonly string[]) {
  mkdirSync(CACHE, { recursive: true });
  let current = 0;

  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const cacheable = url.pathname.startsWith("/v2/provas") || url.pathname.startsWith("/v2/questoes");
    const file = join(CACHE, `${createHash("sha1").update(url.pathname + url.search).digest("hex")}.json`);

    if (cacheable && existsSync(file)) {
      spent.cacheHits += 1;
      return new Response(JSON.stringify(JSON.parse(readFileSync(file, "utf8")).body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    for (; current < keys.length; current += 1) {
      const headers = new Headers(init?.headers);
      headers.set("X-API-Key", keys[current]!);
      const response = await fetch(url, { ...init, headers });
      spent.requests += 1;

      if (response.status === 402) {
        console.log(`  chave ${current + 1}: créditos esgotados, tentando a próxima…`);
        continue;
      }

      if (response.ok && cacheable) {
        const body = await response.json();
        spent.credits += creditsOf(url, body);
        writeFileSync(file, JSON.stringify({ url: url.pathname + url.search, fetchedAt: new Date().toISOString(), body }));
        return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      }

      return response;
    }

    return new Response(JSON.stringify({ statusCode: 402, message: "Todas as chaves sem créditos." }), { status: 402 });
  };
}

async function remainingCredits(keys: readonly string[]): Promise<number> {
  // Keys of the same account share one pool: count each pool once.
  const pools = new Map<string, number>();

  for (const key of keys) {
    const quota = await new QuestApiProvider({ apiKey: key }).getQuota();
    pools.set(`${quota.periodStart}|${quota.periodEnd}|${quota.used}|${quota.planCode}`, quota.remaining);
  }

  return [...pools.values()].reduce((sum, value) => sum + value, 0);
}

// ---------------------------------------------------------------- plan

const argument = (name: string) =>
  process.argv.slice(2).find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3).trim();

const simplify = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function plan(): Promise<void> {
  const keys = readKeys();
  const board = argument("banca") ?? "Instituto AOCP";
  const years = (argument("anos") ?? String(new Date().getFullYear())).split(",").map((year) => year.trim());
  const listBudget = Number(argument("list-budget") ?? 150);
  const reserve = Number(argument("reserve") ?? 60);
  const provider = new QuestApiProvider({ apiKey: keys[0]!, fetcher: createFetcher(keys) });
  const prisma = getPrismaClient();

  const before = await remainingCredits(keys);
  console.log(`Créditos disponíveis: ${before}. Listagem até ${listBudget} créditos; reserva ${reserve}.`);

  const exams: Exam[] = [];
  // --orgaos="Polícia Militar,Bombeiro" lists only matching exams (partial
  // match, all years unless --anos is given) — listing is paid per exam.
  const organizations = argument("orgaos")?.split(",").map((term) => term.trim()).filter(Boolean);
  const searches: { year?: string; organization?: string }[] = organizations
    ? organizations.flatMap((organization) => (argument("anos") ? years.map((year) => ({ year, organization })) : [{ organization }]))
    : years.map((year) => ({ year }));

  for (const search of searches) {
    for (let page = 1; spent.credits < listBudget; page += 1) {
      const perPage = Math.min(100, listBudget - spent.credits);
      if (perPage < 1) break;
      const result = await provider.listExaminations({ limit: perPage, page, board, ...search });

      for (const item of result.items) {
        if (exams.some((exam) => exam.id === item.externalId)) continue;
        const total = item.totalQuestions;
        exams.push({
          id: item.externalId,
          board: item.board,
          year: item.year,
          organization: item.organization,
          careerPosition: item.careerPosition,
          alternativeType: item.alternativeType,
          totalQuestions: total,
          cost: 6 * total,
          status: "planned",
        });
      }

      if (result.items.length < perPage) break;
    }
  }

  // What we already have: an earlier Quest import of the same exam, or the
  // same board/year/organization/position imported from the official PDF.
  const ours = await prisma.examination.findMany({
    select: { slug: true, title: true, year: true, board: { select: { name: true } }, organization: { select: { name: true } }, careerPosition: { select: { name: true } } },
  });

  // --excluir=id,id: exams a reviewer identified as already in the bank
  // (same contest recorded with another year or organization spelling).
  const excluded = new Set(argument("excluir")?.split(",").map((id) => id.trim()) ?? []);

  for (const exam of exams) {
    const imported = ours.find((item) => item.slug === `quest-api-${exam.id}`);

    if (excluded.has(exam.id)) {
      exam.status = "already-in-bank";
      exam.match = "excluída na revisão do plano";
      continue;
    }

    const sameExam = ours.find(
      (item) =>
        item.year === exam.year &&
        simplify(item.board?.name) === simplify(exam.board) &&
        simplify(item.organization?.name).includes(simplify(exam.organization).split(" ")[0] ?? "") &&
        simplify(item.careerPosition?.name) !== "" &&
        (simplify(item.careerPosition?.name).includes(simplify(exam.careerPosition)) ||
          simplify(exam.careerPosition).includes(simplify(item.careerPosition?.name))),
    );

    if (imported) {
      exam.status = "already-imported";
      exam.match = imported.title;
    } else if (sameExam) {
      exam.status = "already-in-bank";
      exam.match = sameExam.title;
    } else if (exam.totalQuestions > MAX_QUESTIONS || exam.totalQuestions === 0) {
      exam.status = "too-large";
    }
  }

  // One exam per contest (organization + year) first — exams of the same
  // contest repeat the common part, paid again and then dropped as
  // duplicates — newest first; extra exams of a contest only if credits remain.
  let budget = before - spent.credits - reserve;
  const contest = (exam: Exam) => `${simplify(exam.organization)}|${exam.year}`;
  const firstOfContest = new Set<string>();
  const candidates = exams
    .filter((exam) => exam.status === "planned")
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.totalQuestions - a.totalQuestions)
    .map((exam) => {
      const first = !firstOfContest.has(contest(exam));
      firstOfContest.add(contest(exam));
      return { exam, first };
    })
    .sort((a, b) => Number(b.first) - Number(a.first));

  // --somente=id,id: a reviewed selection replaces the automatic order.
  const only = argument("somente")?.split(",").map((id) => id.trim());

  for (const { exam } of candidates) {
    if (only && !only.includes(exam.id)) {
      exam.status = "over-budget";
      continue;
    }

    // + 1 credit: the importer looks the exam metadata up once.
    if (exam.cost + 1 <= budget) budget -= exam.cost + 1;
    else exam.status = "over-budget";
  }

  mkdirSync(DIR, { recursive: true });
  writeFileSync(PLAN, JSON.stringify({ createdAt: new Date().toISOString(), board, years, creditsBefore: before, listingCredits: spent.credits, exams }, null, 2));

  const planned = exams.filter((exam) => exam.status === "planned");
  const count = (status: Exam["status"]) => exams.filter((exam) => exam.status === status).length;
  console.log(`\nProvas listadas: ${exams.length} (custo da listagem: ${spent.credits} créditos)`);
  console.log(`  já importadas da Quest: ${count("already-imported")} · já no banco (PDF oficial): ${count("already-in-bank")} · acima de ${MAX_QUESTIONS} questões ou vazias: ${count("too-large")} · fora do orçamento: ${count("over-budget")}`);
  console.log(`  planejadas: ${planned.length} provas, ${planned.reduce((sum, exam) => sum + exam.totalQuestions, 0)} questões, ${planned.reduce((sum, exam) => sum + exam.cost + 1, 0)} créditos`);

  for (const exam of planned) {
    console.log(`   · ${exam.id}  ${exam.year}  ${exam.organization} — ${exam.careerPosition} (${exam.totalQuestions} q, ${exam.cost + 1} cr)`);
  }

  console.log(`\nPlano salvo em ${PLAN}. Revise e rode: npm run quest:import -- --apply`);
  await prisma.$disconnect();
}

// ---------------------------------------------------------------- import

/**
 * Quest "matéria" is often a fine-grained subject ("Crime omissivo",
 * "Lei de Drogas"). When it is not a canonical discipline, only the
 * knowledge area is guessed from keywords; our classifier picks the
 * discipline and topic inside it.
 */
const AREA_KEYWORDS: readonly [RegExp, string][] = [
  [/\b(lei|leis|decreto|direito|direitos|penal|crime|crimes|criminal|criminologia|inqu[eé]rito|habeas|pris[aã]o|cautelar|execu[cç][aã]o penal|estatuto|legisla[cç][aã]o|constitu|tratado|medidas provis|administra[cç][aã]o p[uú]blica|procedimento administrativo|processo|confiss[aã]o|viol[eê]ncia|disciplina|permiss[aã]o de sa[ií]da|preso|intercepta|seguran[cç]a vi[aá]ria|tr[aâ]nsito|reorganiza[cç][aã]o territorial|corte interamericana)/i, "ciencias-juridicas"],
  [/\b(palavra|palavras|verbal|verbais|conjun[cç][aã]o|locu[cç]|express[oõ]es|morfossint|sintax|sem[aâ]ntic|pontua[cç][aã]o|crase|concord[aâ]ncia|reg[eê]ncia|texto|interpreta[cç][aã]o)/i, "linguagens-codigos-e-suas-tecnologias"],
  [/\b(num[eé]ric|n[uú]meros|dist[aâ]ncia|cilindro|geometri|propos[ií][cç]|l[oó]gic[ao]|porcentagem|probabilidade|equa[cç]|fun[cç][aã]o|raz[aã]o|propor[cç]|matem[aá]tica)/i, "matematica-e-suas-tecnologias"],
  [/\b(office|libreoffice|broffice|navegador|browsers?|bombas l[oó]gicas|v[ií]rus|malware|planilha|windows|linux|internet|e-?mail|inform[aá]tica)/i, "tecnologia-da-informacao"],
  [/\b(contab|auditoria|economia|microecon|macroecon|infla[cç][aã]o)/i, "contabilidade-e-economia"],
  [/\b(sus\b|sa[uú]de|enfermagem|epidemiolog|vacina|primeiros socorros)/i, "saude"],
  [/\b(pedag|did[aá]tica|aprendizagem|ldb\b|bncc|educa[cç][aã]o)/i, "educacao"],
];

function guessArea(subject: string | null): string | null {
  return AREA_KEYWORDS.find(([pattern]) => pattern.test(subject ?? ""))?.[1] ?? null;
}

/** Maps the Quest subject to our taxonomy (canonical discipline or area only). */
function withOurTaxonomy(
  provider: QuestionProvider,
  entries: Awaited<ReturnType<typeof loadSectionTaxonomyEntries>>,
  fallbackArea: string | null,
): QuestionProvider {
  const adapt = (candidate: ProviderQuestionCandidate): ProviderQuestionCandidate => {
    const resolution = resolveExamSection(candidate.discipline, entries);
    const area =
      resolution.kind === "UNRESOLVED"
        ? guessArea(candidate.discipline) ?? guessArea(candidate.topic) ?? fallbackArea
        : resolution.knowledgeAreaSlug;

    return {
      ...candidate,
      discipline: resolution.kind === "DISCIPLINE" ? resolution.disciplineName : null,
      knowledgeAreaSlug: area,
      topic: null, // subjects are ours: the classifier picks the topic
    };
  };

  return {
    listQuestions: async (input) => {
      const result = await provider.listQuestions(input);
      return { ...result, items: result.items.map(adapt) };
    },
    getExamination: (externalId) => provider.getExamination(externalId),
  };
}

async function importPlan(): Promise<void> {
  const apply = process.argv.includes("--apply");

  if (!existsSync(PLAN)) {
    throw new Error("Rode primeiro: npm run quest:plan");
  }

  const planned: Exam[] = JSON.parse(readFileSync(PLAN, "utf8")).exams.filter((exam: Exam) => exam.status === "planned");
  const cost = planned.reduce((sum, exam) => sum + exam.cost + 1, 0);
  console.log(`${planned.length} provas planejadas, até ${cost} créditos (respostas já em cache não são cobradas de novo).`);

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply.");
    return;
  }

  const keys = readKeys();
  // Security exams are mostly law: an unrecognizable subject lands there and the classifier widens if needed.
  const fallbackArea = argument("area-padrao") ?? "ciencias-juridicas";
  const provider = withOurTaxonomy(
    new QuestApiProvider({ apiKey: keys[0]!, fetcher: createFetcher(keys) }),
    await loadSectionTaxonomyEntries(),
    fallbackArea === "nenhuma" ? null : fallbackArea,
  );
  const useCase = new ImportProviderQuestionsUseCase(provider, new PrismaQuestionImportRepository());
  const log = [];

  for (const exam of planned) {
    try {
      const result = await useCase.execute({ limit: MAX_QUESTIONS, examinationId: exam.id, publish: false, filters: {} });
      log.push({ exam: exam.id, ...result });
      console.log(`✓ ${exam.id} ${exam.organization} — ${exam.careerPosition} ${exam.year}: ${JSON.stringify((result as { counts?: unknown }).counts ?? result).slice(0, 160)}`);
    } catch (error) {
      console.log(`✗ ${exam.id}: ${error instanceof Error ? error.message : String(error)}`);
      if (String(error).includes("402")) break;
    }
  }

  writeFileSync(join(DIR, `import-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify(log, null, 2));
  console.log(`\nCréditos gastos nesta execução: ${spent.credits} · requisições pagas: ${spent.requests} · respostas do cache: ${spent.cacheHits}`);
  console.log("Próximos passos: npm run classification:enqueue -- --apply && npm run classification:process, depois questions:publish.");
}

const mode = process.argv[2];

(mode === "plan" ? plan() : mode === "import" ? importPlan() : Promise.reject(new Error("Use: plan | import")))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
