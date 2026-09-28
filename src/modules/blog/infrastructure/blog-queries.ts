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

const cardSelect = {
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  publishedAt: true,
  coverAssetId: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.BlogPostSelect;

export async function listLivePosts(input: Readonly<{ page: number; categorySlug: string | null; now: Date }>) {
  const prisma = getPrismaClient();
  const where: Prisma.BlogPostWhereInput = {
    ...livePostsWhere(input.now),
    ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
  };

  const [posts, total, categories] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (input.page - 1) * BLOG_PAGE_SIZE,
      take: BLOG_PAGE_SIZE,
      select: cardSelect,
    }),
    prisma.blogPost.count({ where }),
    prisma.blogCategory.findMany({
      where: { posts: { some: livePostsWhere(input.now) } },
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    }),
  ]);

  return { posts, total, totalPages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)), categories };
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
      publishedAt: true,
      updatedAt: true,
      coverAssetId: true,
      categoryId: true,
      category: { select: { name: true, slug: true } },
      author: { select: { displayName: true } },
      images: { orderBy: { position: "asc" }, select: { position: true, mediaAssetId: true } },
      relatedOffer: { select: { slug: true, name: true, headline: true, priceCents: true, isActive: true } },
      relatedBoard: { select: { id: true, name: true } },
    },
  });

  if (!post) return null;

  const related = await prisma.blogPost.findMany({
    where: { ...livePostsWhere(now), id: { not: post.id }, ...(post.categoryId ? { categoryId: post.categoryId } : {}) },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: cardSelect,
  });

  return { ...post, related };
}
