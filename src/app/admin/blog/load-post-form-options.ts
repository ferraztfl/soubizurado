import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/** Categories, offers, boards and contests for the post editor (server-only). */
export async function loadPostFormOptions() {
  const prisma = getPrismaClient();
  const [categories, offers, boards, contests] = await Promise.all([
    prisma.blogCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.offer.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.examiningBoard.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contest.findMany({ orderBy: [{ isPublished: "desc" }, { name: "asc" }], take: 500, select: { id: true, name: true } }),
  ]);

  return { categories: categories.map((row) => row.name), offers, boards, contests };
}
