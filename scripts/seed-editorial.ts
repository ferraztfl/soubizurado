import "dotenv/config";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { excerptOf, parseStateCode } from "../src/modules/blog/domain/blog";
import { planContest } from "../src/modules/contests/domain/contest";
import { getPrismaClient } from "../src/shared/infrastructure/database/prisma";

/*
 * Editorial load: contests and news written by the team from official
 * sources (file in data-private/editorial, not in Git). Board, organization
 * and categories are matched to existing catalog rows — nothing is created
 * in the catalogs. Existing slugs are skipped (safe to re-run).
 *
 *   npm run editorial:seed -- data-private/editorial/seed-2026-09-29.json            # dry-run
 *   npm run editorial:seed -- <file> --apply             # writes as drafts (hidden)
 *   npm run editorial:seed -- <file> --apply --publish   # writes published
 *
 * Every --apply writes a reversal log (created ids) to data-private/logs.
 */

type SeedContest = {
  slug: string;
  name: string;
  organizationName: string;
  stateCode: string;
  status: string;
  vacancies: number | null;
  hasReserveList: boolean;
  salaryMin: string;
  salaryMax: string;
  educationLevels: string[];
  positions: string;
  registrationStart: string;
  registrationEnd: string;
  examDate: string;
  noticeUrl: string;
  boardName: string;
  careerSlug: string;
  isFeatured: boolean;
  summary: string;
};

type SeedPost = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  categorySlug: string;
  format: "NEWS" | "ARTICLE";
  stateCode: string;
  isFeatured: boolean;
  boardName: string;
  contestSlug: string;
};

type SeedFile = { contests: SeedContest[]; posts: SeedPost[] };

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing from the environment.");

  const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Informe o arquivo JSON (data-private/editorial/...).");

  const apply = process.argv.includes("--apply");
  const publish = process.argv.includes("--publish");
  const seed = JSON.parse(await readFile(resolve(file), "utf8")) as SeedFile;
  const prisma = getPrismaClient();

  try {
    const [boards, categories, organizations, existingContests, existingPosts] = await Promise.all([
      prisma.examiningBoard.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.blogCategory.findMany({ select: { id: true, slug: true } }),
      prisma.publicOrganization.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.contest.findMany({ where: { slug: { in: seed.contests.map((row) => row.slug) } }, select: { slug: true } }),
      prisma.blogPost.findMany({ where: { slug: { in: seed.posts.map((row) => row.slug) } }, select: { slug: true } }),
    ]);

    const boardId = (name: string) => (name ? boards.find((row) => row.name.toLowerCase() === name.toLowerCase())?.id ?? null : null);
    const categoryId = (slug: string) => categories.find((row) => row.slug === slug)?.id ?? null;
    const organizationId = (name: string) => organizations.find((row) => row.name.toLowerCase() === name.toLowerCase())?.id ?? null;
    const skipContests = new Set(existingContests.map((row) => row.slug));
    const skipPosts = new Set(existingPosts.map((row) => row.slug));
    const problems: string[] = [];

    const contests = seed.contests.map((row) => {
      const plan = planContest({ ...row, slug: row.slug, vacancies: row.vacancies === null ? "" : String(row.vacancies), isPublished: publish });
      if (!plan.ok) problems.push(`Concurso ${row.slug}: ${plan.error}`);
      if (row.boardName && !boardId(row.boardName)) problems.push(`Concurso ${row.slug}: banca "${row.boardName}" não está no catálogo (fica "a definir").`);
      if (row.careerSlug && !categoryId(row.careerSlug)) problems.push(`Concurso ${row.slug}: editoria "${row.careerSlug}" não existe.`);
      return { row, plan };
    });

    const posts = seed.posts.map((row) => {
      if (row.title.length < 5 || row.title.length > 200) problems.push(`Post ${row.slug}: título fora do limite.`);
      if (row.excerpt.length > 320) problems.push(`Post ${row.slug}: resumo acima de 320.`);
      if (!categoryId(row.categorySlug)) problems.push(`Post ${row.slug}: editoria "${row.categorySlug}" não existe.`);
      if (row.contestSlug && !seed.contests.some((contest) => contest.slug === row.contestSlug)) {
        problems.push(`Post ${row.slug}: concurso "${row.contestSlug}" não está no arquivo.`);
      }
      return row;
    });

    console.log(`Concursos: ${contests.length} (${contests.filter(({ row }) => skipContests.has(row.slug)).length} já existem, serão pulados)`);
    for (const { row } of contests) {
      console.log(
        `  ${skipContests.has(row.slug) ? "=" : "+"} ${row.name} · ${row.stateCode || "Nacional"} · ${row.status} · banca: ${boardId(row.boardName) ? row.boardName : "a definir"} · órgão ligado: ${organizationId(row.organizationName) ? "sim" : "não"}`,
      );
    }
    console.log(`Posts: ${posts.length} (${posts.filter((row) => skipPosts.has(row.slug)).length} já existem, serão pulados)`);
    for (const row of posts) console.log(`  ${skipPosts.has(row.slug) ? "=" : "+"} [${row.format}] ${row.title}`);
    console.log(`Modo: ${publish ? "PUBLICADO (aparece no site)" : "RASCUNHO (oculto até publicar no admin)"}`);

    if (problems.length > 0) {
      console.log("\nAvisos:");
      for (const problem of problems) console.log(`  - ${problem}`);
    }
    if (problems.some((problem) => !problem.includes("a definir"))) {
      throw new Error("Corrija os problemas acima antes de gravar.");
    }

    if (!apply) {
      console.log("\nDry-run: nada foi gravado. Use --apply para gravar.");
      return;
    }

    const now = Date.now();
    const created = await prisma.$transaction(
      async (transaction) => {
        const contestIds = new Map<string, string>();
        const createdContests: string[] = [];
        const createdPosts: string[] = [];

        for (const { row, plan } of contests) {
          if (!plan.ok) continue;
          if (skipContests.has(row.slug)) {
            const existing = await transaction.contest.findUnique({ where: { slug: row.slug }, select: { id: true } });
            if (existing) contestIds.set(row.slug, existing.id);
            continue;
          }
          const contest = await transaction.contest.create({
            data: {
              ...plan.contest,
              organizationId: organizationId(row.organizationName),
              boardId: boardId(row.boardName),
              careerCategoryId: categoryId(row.careerSlug),
            },
            select: { id: true },
          });
          contestIds.set(row.slug, contest.id);
          createdContests.push(contest.id);
        }

        for (const [index, row] of posts.entries()) {
          if (skipPosts.has(row.slug)) continue;
          const post = await transaction.blogPost.create({
            data: {
              slug: row.slug,
              title: row.title,
              excerpt: row.excerpt || excerptOf(row.body),
              body: row.body,
              status: publish ? "PUBLISHED" : "DRAFT",
              // Staggered by 20 minutes, in file order (first = newest).
              publishedAt: publish ? new Date(now - index * 20 * 60_000) : null,
              categoryId: categoryId(row.categorySlug),
              format: row.format,
              stateCode: parseStateCode(row.stateCode),
              isFeatured: row.isFeatured,
              relatedBoardId: boardId(row.boardName),
              contestId: row.contestSlug ? contestIds.get(row.contestSlug) ?? null : null,
            },
            select: { id: true },
          });
          createdPosts.push(post.id);
        }

        return { contests: createdContests, posts: createdPosts };
      },
      { timeout: 60_000 },
    );

    const logDir = resolve("data-private/logs");
    await mkdir(logDir, { recursive: true });
    const logFile = resolve(logDir, `editorial-seed-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await writeFile(logFile, JSON.stringify({ source: file, publish, created }, null, 2));

    console.log(`\nGravado: ${created.contests.length} concursos e ${created.posts.length} posts.`);
    console.log(`Log de reversão: ${logFile}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
