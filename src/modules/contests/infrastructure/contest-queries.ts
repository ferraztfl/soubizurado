import type { Prisma } from "@/generated/prisma/client";
import { livePostsWhere, postCardSelect } from "@/modules/blog/infrastructure/blog-queries";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { ACTIVE_CONTEST_STATUSES, CONTEST_TABS, type ContestTab } from "../domain/contest";

export const CONTEST_PAGE_SIZE = 24;

export const contestCardSelect = {
  slug: true,
  name: true,
  organizationName: true,
  stateCode: true,
  status: true,
  vacancies: true,
  hasReserveList: true,
  salaryMinCents: true,
  salaryMaxCents: true,
  examDate: true,
  registrationEnd: true,
  logoAssetId: true,
  board: { select: { name: true } },
} satisfies Prisma.ContestSelect;

export type ContestCard = Prisma.ContestGetPayload<{ select: typeof contestCardSelect }>;

export type ContestFilters = Readonly<{
  tab: ContestTab;
  stateCode?: string | null;
  careerSlug?: string | null;
}>;

function tabWhere(tab: ContestTab): Prisma.ContestWhereInput {
  const statuses = CONTEST_TABS[tab].statuses;
  return statuses ? { status: { in: [...statuses] } } : { status: { in: [...ACTIVE_CONTEST_STATUSES] } };
}

function contestWhere(filters: ContestFilters): Prisma.ContestWhereInput {
  return {
    isPublished: true,
    ...tabWhere(filters.tab),
    ...(filters.stateCode ? { stateCode: filters.stateCode } : {}),
    ...(filters.careerSlug ? { careerCategory: { slug: filters.careerSlug } } : {}),
  };
}

/** "Mais procurados" puts the featured ones first; the other tabs list the newest updates first. */
function contestOrder(tab: ContestTab): Prisma.ContestOrderByWithRelationInput[] {
  return tab === "destaques" ? [{ isFeatured: "desc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }];
}

export async function listContests(filters: ContestFilters, page: number) {
  const prisma = getPrismaClient();
  const where = contestWhere(filters);
  const [contests, total] = await Promise.all([
    prisma.contest.findMany({
      where,
      orderBy: contestOrder(filters.tab),
      skip: (page - 1) * CONTEST_PAGE_SIZE,
      take: CONTEST_PAGE_SIZE,
      select: contestCardSelect,
    }),
    prisma.contest.count({ where }),
  ]);

  return { contests, total, totalPages: Math.max(1, Math.ceil(total / CONTEST_PAGE_SIZE)) };
}

/** A few contests per tab for the home page (tabs that have none are left out). */
export async function loadContestShowcase(perTab = 8) {
  const prisma = getPrismaClient();
  const tabs = (Object.keys(CONTEST_TABS) as ContestTab[]).filter((tab) => tab !== "encerrados");
  const lists = await Promise.all(
    tabs.map((tab) =>
      prisma.contest.findMany({
        where: contestWhere({ tab }),
        orderBy: contestOrder(tab),
        take: perTab,
        select: contestCardSelect,
      }),
    ),
  );

  return tabs.map((tab, index) => ({ tab, contests: lists[index] ?? [] })).filter((entry) => entry.contests.length > 0);
}

export async function loadPublishedContest(slug: string, now: Date) {
  const prisma = getPrismaClient();
  const contest = await prisma.contest.findFirst({
    where: { slug, isPublished: true },
    include: {
      board: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true } },
      careerCategory: { select: { slug: true, name: true } },
      relatedOffer: { select: { slug: true, name: true, priceCents: true, compareAtCents: true, isActive: true } },
    },
  });

  if (!contest) return null;

  const [posts, related] = await Promise.all([
    prisma.blogPost.findMany({
      where: { ...livePostsWhere(now), contestId: contest.id },
      orderBy: { publishedAt: "desc" },
      take: 6,
      select: postCardSelect,
    }),
    prisma.contest.findMany({
      where: {
        isPublished: true,
        id: { not: contest.id },
        status: { in: [...ACTIVE_CONTEST_STATUSES] },
        OR: [
          ...(contest.careerCategoryId ? [{ careerCategoryId: contest.careerCategoryId }] : []),
          ...(contest.stateCode ? [{ stateCode: contest.stateCode }] : []),
          ...(contest.boardId ? [{ boardId: contest.boardId }] : []),
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      take: 4,
      select: contestCardSelect,
    }),
  ]);

  return { ...contest, posts, related: contest.careerCategoryId || contest.stateCode || contest.boardId ? related : [] };
}

export async function publishedContestSlugs() {
  return getPrismaClient().contest.findMany({
    where: { isPublished: true },
    orderBy: { updatedAt: "desc" },
    take: 45_000,
    select: { slug: true, updatedAt: true },
  });
}
