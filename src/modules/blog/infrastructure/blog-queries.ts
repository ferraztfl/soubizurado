import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export const BLOG_PAGE_SIZE = 12;

export function blogImageUrl(assetId: string): string {
  return `/api/blog/imagens/${assetId}`;
}

/** Posts that are live now (published and past their publication time). */
export function livePostsWhere(now: Date): Prisma.BlogPostWhereInput {
  return { status: "PUBLISHED", publishedAt: { lte: now } };
}

export const postCardSelect = {
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  format: true,
  stateCode: true,
  isFeatured: true,
  publishedAt: true,
  coverAssetId: true,
  category: { select: { name: true, slug: true } },
  author: { select: { displayName: true } },
} satisfies Prisma.BlogPostSelect;

export type PostCard = Prisma.BlogPostGetPayload<{ select: typeof postCardSelect }>;

export type PostListFilters = Readonly<{
  categorySlug?: string | null;
  stateCode?: string | null;
  format?: "NEWS" | "ARTICLE" | null;
  /** Title / excerpt search (case-insensitive). */
  query?: string | null;
}>;

function listWhere(filters: PostListFilters, now: Date): Prisma.BlogPostWhereInput {
  return {
    ...livePostsWhere(now),
    ...(filters.categorySlug ? { category: { slug: filters.categorySlug } } : {}),
    ...(filters.stateCode ? { stateCode: filters.stateCode } : {}),
    ...(filters.format ? { format: filters.format } : {}),
    ...(filters.query
      ? {
          OR: [
            { title: { contains: filters.query, mode: "insensitive" } },
            { excerpt: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listPosts(filters: PostListFilters, page: number, now: Date) {
  const prisma = getPrismaClient();
  const where = listWhere(filters, now);
  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * BLOG_PAGE_SIZE,
      take: BLOG_PAGE_SIZE,
      select: postCardSelect,
    }),
    prisma.blogPost.count({ where }),
  ]);

  return { posts, total, totalPages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)) };
}

/** Everything the portal home shows, in one round of queries. */
export async function loadPortalHome(now: Date) {
  const prisma = getPrismaClient();
  const live = livePostsWhere(now);

  const [featured, latest, articles] = await Promise.all([
    prisma.blogPost.findMany({ where: { ...live, isFeatured: true }, orderBy: { publishedAt: "desc" }, take: 6, select: postCardSelect }),
    prisma.blogPost.findMany({ where: live, orderBy: { publishedAt: "desc" }, take: 14, select: postCardSelect }),
    prisma.blogPost.findMany({ where: { ...live, format: "ARTICLE" }, orderBy: { publishedAt: "desc" }, take: 4, select: postCardSelect }),
  ]);

  // Hero = latest featured (or latest); the grid and the list skip what is already shown.
  const hero = featured[0] ?? latest[0] ?? null;
  const shown = new Set(hero ? [hero.slug] : []);
  const grid = latest.filter((post) => !shown.has(post.slug)).slice(0, 4);
  grid.forEach((post) => shown.add(post.slug));
  const list = latest.filter((post) => !shown.has(post.slug)).slice(0, 8);

  return { hero, grid, list, featured, articles };
}

/** Editorials for menus and the sidebar, grouped. */
export async function loadEditorials() {
  const categories = await getPrismaClient().blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, groupKey: true, icon: true },
  });

  return {
    careers: categories.filter((category) => category.groupKey === "CARREIRA"),
    exams: categories.filter((category) => category.groupKey === "EXAME"),
    general: categories.filter((category) => category.groupKey === "GERAL"),
  };
}

/** The store offer promoted in the blog banner (featured first, then the cheapest). */
export async function loadBannerOffer() {
  return getPrismaClient().offer.findFirst({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { priceCents: "asc" }],
    select: { slug: true, name: true, headline: true, priceCents: true, compareAtCents: true },
  });
}

/** Boards with published questions (footer links to the question bank). */
export async function loadFooterBoards() {
  return getPrismaClient().examiningBoard.findMany({
    where: { isActive: true, examinations: { some: { questions: { some: { status: "PUBLISHED" } } } } },
    orderBy: { name: "asc" },
    take: 12,
    select: { id: true, name: true },
  });
}

export async function loadLivePost(slug: string, now: Date) {
  const prisma = getPrismaClient();
  const post = await prisma.blogPost.findFirst({
    where: { slug, ...livePostsWhere(now) },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      format: true,
      stateCode: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,
      coverAssetId: true,
      categoryId: true,
      category: { select: { name: true, slug: true } },
      author: { select: { displayName: true } },
      images: { orderBy: { position: "asc" }, select: { position: true, mediaAssetId: true } },
      relatedOffer: { select: { slug: true, name: true, headline: true, priceCents: true, isActive: true } },
      relatedBoard: { select: { id: true, name: true } },
      contest: { select: { slug: true, name: true, isPublished: true } },
    },
  });

  if (!post) return null;

  const [related, latest] = await Promise.all([
    prisma.blogPost.findMany({
      where: { ...livePostsWhere(now), id: { not: post.id }, ...(post.categoryId ? { categoryId: post.categoryId } : {}) },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: postCardSelect,
    }),
    prisma.blogPost.findMany({
      where: { ...livePostsWhere(now), id: { not: post.id } },
      orderBy: { publishedAt: "desc" },
      take: 5,
      select: postCardSelect,
    }),
  ]);

  return { ...post, related, latest };
}
