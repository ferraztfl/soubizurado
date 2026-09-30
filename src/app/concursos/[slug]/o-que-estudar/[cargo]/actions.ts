"use server";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { loadSiteViewer } from "../../../../_components/site-viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ToggleTopicResult = Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "SIGN_IN" | "INVALID" }>;

/** Marks (or unmarks) a topic of a published "edital verticalizado" as studied by the signed-in student. */
export async function toggleSyllabusTopicAction(topicId: string, studied: boolean): Promise<ToggleTopicResult> {
  if (typeof topicId !== "string" || !UUID.test(topicId) || typeof studied !== "boolean") return { ok: false, reason: "INVALID" };

  const viewer = await loadSiteViewer();
  if (!viewer.profileId) return { ok: false, reason: "SIGN_IN" };

  const prisma = getPrismaClient();
  const topic = await prisma.contestSyllabusTopic.findFirst({
    where: { id: topicId, subject: { syllabus: { isPublished: true, contest: { isPublished: true } } } },
    select: { id: true },
  });
  if (!topic) return { ok: false, reason: "INVALID" };

  if (studied) {
    await prisma.studySyllabusProgress.upsert({
      where: { profileId_topicId: { profileId: viewer.profileId, topicId } },
      create: { profileId: viewer.profileId, topicId },
      update: {},
    });
  } else {
    await prisma.studySyllabusProgress.deleteMany({ where: { profileId: viewer.profileId, topicId } });
  }

  return { ok: true };
}
