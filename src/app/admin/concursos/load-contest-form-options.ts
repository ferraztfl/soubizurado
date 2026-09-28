import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/** Organizations, boards, career editorials and offers for the contest editor (server-only). */
export async function loadContestFormOptions() {
  const prisma = getPrismaClient();
  const [organizations, boards, careers, offers] = await Promise.all([
    prisma.publicOrganization.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, take: 2000, select: { name: true } }),
    prisma.examiningBoard.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.blogCategory.findMany({
      where: { groupKey: { in: ["CARREIRA", "EXAME"] } },
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.offer.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  return { organizations: organizations.map((row) => row.name), boards, careers, offers };
}
