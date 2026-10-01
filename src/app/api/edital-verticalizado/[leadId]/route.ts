import { formatContestDate } from "@/modules/contests/domain/contest";
import { buildSyllabusPdf } from "@/modules/leads/infrastructure/syllabus-pdf";
import { siteUrl } from "@/modules/question-bank/infrastructure/queries/question-sitemap";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A link is personal: enough downloads for every device, not for sharing as a public file. */
const MAX_DOWNLOADS = 30;

/** Edital verticalizado PDF for the person who asked for it (the id is the unguessable link). */
export async function GET(_request: Request, context: Readonly<{ params: Promise<{ leadId: string }> }>): Promise<Response> {
  const { leadId } = await context.params;
  if (!UUID.test(leadId)) return new Response("Link inválido.", { status: 404 });

  const prisma = getPrismaClient();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      downloads: true,
      syllabus: {
        select: {
          title: true,
          slug: true,
          essayPoints: true,
          durationMinutes: true,
          notes: true,
          isPublished: true,
          contest: { select: { slug: true, name: true, organizationName: true, examDate: true, isPublished: true, board: { select: { name: true } } } },
          subjects: {
            orderBy: { sortOrder: "asc" },
            select: { name: true, block: true, questionCount: true, topics: { orderBy: { sortOrder: "asc" }, select: { code: true, text: true } } },
          },
        },
      },
    },
  });

  const syllabus = lead?.syllabus;
  if (!lead || !syllabus || !syllabus.isPublished || !syllabus.contest.isPublished) {
    return new Response("Este edital não está mais disponível.", { status: 404 });
  }
  if (lead.downloads >= MAX_DOWNLOADS) {
    return new Response("Limite de downloads deste link atingido. Peça o PDF de novo na página do edital.", { status: 429 });
  }

  const base = siteUrl();
  const bytes = await buildSyllabusPdf({
    contestName: syllabus.contest.name,
    organizationName: syllabus.contest.organizationName,
    boardName: syllabus.contest.board?.name ?? null,
    examDate: formatContestDate(syllabus.contest.examDate),
    syllabusTitle: syllabus.title,
    essayPoints: syllabus.essayPoints,
    durationMinutes: syllabus.durationMinutes,
    notes: syllabus.notes,
    subjects: syllabus.subjects,
    siteHost: "soubizurado.com.br",
    pageUrl: `${base.includes("localhost") ? "https://soubizurado.com.br" : base}/concursos/${syllabus.contest.slug}/o-que-estudar/${syllabus.slug}`,
  });

  await prisma.lead.update({ where: { id: lead.id }, data: { downloads: { increment: 1 }, lastDownloadAt: new Date() } });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="edital-verticalizado-${syllabus.contest.slug.replace(/^concurso-/, "")}-${syllabus.slug}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
