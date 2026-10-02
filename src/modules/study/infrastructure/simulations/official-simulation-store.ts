import type { Prisma } from "@/generated/prisma/client";
import { PrismaPublicQuestionReadRepository } from "@/modules/question-bank/infrastructure/repositories/prisma-public-question-read-repository";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import {
  buildSections,
  planBlueprint,
  type BlueprintSection,
  type OfficialBlueprint,
} from "../../domain/official-simulation";

/*
 * Official simulations: one per course (combo), built from the notice
 * ("edital verticalizado") the course was generated from.
 */

/** Used when the notice gives no duration. */
const DEFAULT_EXAM_MINUTES = 240;

export type OfficialExamInfo = Readonly<{
  syllabusId: string;
  courseId: string;
  courseSlug: string;
  title: string;
  /** "PMPE 2026 – Soldado" style name for cards. */
  name: string;
  coverAssetId: string | null;
  durationMinutes: number;
  blueprint: OfficialBlueprint;
}>;

async function subjectsWithAvailability(syllabusId: string) {
  const prisma = getPrismaClient();
  const subjects = await prisma.contestSyllabusSubject.findMany({
    where: { syllabusId, questionCount: { gt: 0 } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, questionCount: true, disciplineId: true, areaId: true, topicId: true },
  });

  return Promise.all(
    subjects.map(async (subject) => ({
      ...subject,
      available: subject.disciplineId
        ? await prisma.question.count({
            where: {
              status: "PUBLISHED",
              disciplineId: subject.disciplineId,
              ...(subject.areaId ? { areaId: subject.areaId } : {}),
              ...(subject.topicId ? { topicId: subject.topicId } : {}),
            },
          })
        : 0,
    })),
  );
}

/** Courses that have an official exam (published, generated from a notice that states question counts). */
export async function listOfficialExams(): Promise<OfficialExamInfo[]> {
  const courses = await getPrismaClient().course.findMany({
    where: { isPublished: true, syllabusId: { not: null }, syllabus: { subjects: { some: { questionCount: { gt: 0 } } } } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      coverAssetId: true,
      syllabus: { select: { id: true, title: true, durationMinutes: true, contest: { select: { name: true } } } },
    },
  });

  return Promise.all(
    courses.map(async (course) => {
      const syllabus = course.syllabus!;
      const subjects = await subjectsWithAvailability(syllabus.id);

      return {
        syllabusId: syllabus.id,
        courseId: course.id,
        courseSlug: course.slug,
        title: course.title,
        name: `${syllabus.contest.name.replace(/^Concurso\s+/i, "")} – ${syllabus.title}`,
        coverAssetId: course.coverAssetId,
        durationMinutes: syllabus.durationMinutes ?? DEFAULT_EXAM_MINUTES,
        blueprint: planBlueprint(subjects.map((subject) => ({ id: subject.id, name: subject.name, questionCount: subject.questionCount ?? 0, available: subject.available }))),
      };
    }),
  );
}

export async function loadOfficialExam(courseSlug: string): Promise<OfficialExamInfo | null> {
  return (await listOfficialExams()).find((exam) => exam.courseSlug === courseSlug) ?? null;
}

export type OfficialAttempt = Readonly<{
  id: string;
  status: string;
  correctCount: number | null;
  questionCount: number;
  startedAt: Date;
  finishedAt: Date | null;
}>;

/** The student's earlier official exams of a notice, newest first. */
export async function listOfficialAttempts(profileId: string, syllabusId: string): Promise<OfficialAttempt[]> {
  return getPrismaClient().studySimulation.findMany({
    where: { profileId, filters: { path: ["syllabusId"], equals: syllabusId } },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: { id: true, status: true, correctCount: true, questionCount: true, startedAt: true, finishedAt: true },
  });
}

/**
 * Draws the exam: for each subject of the notice, as many questions as the real
 * exam has (when the bank has them), in the order of the notice, avoiding
 * questions of the student's earlier official exams of this notice.
 */
export async function createOfficialSimulation(profileId: string, courseSlug: string): Promise<{ id: string; sections: BlueprintSection[] } | null> {
  const prisma = getPrismaClient();
  const exam = await loadOfficialExam(courseSlug);

  if (!exam) {
    return null;
  }

  const subjects = await subjectsWithAvailability(exam.syllabusId);
  const earlier = await prisma.studySimulation.findMany({
    where: { profileId, filters: { path: ["syllabusId"], equals: exam.syllabusId } },
    select: { questions: { select: { questionId: true } } },
  });
  const seen = new Set(earlier.flatMap((simulation) => simulation.questions.map((question) => question.questionId)));
  const used = new Set<string>();
  const repository = new PrismaPublicQuestionReadRepository();
  const drawn: { subjectId: string; name: string; wanted: number; ids: string[] }[] = [];

  for (const subject of subjects) {
    const wanted = subject.questionCount ?? 0;
    const ids: string[] = [];

    if (subject.disciplineId && wanted > 0) {
      const filters = {
        disciplineId: subject.disciplineId,
        ...(subject.areaId ? { areaId: subject.areaId } : {}),
        ...(subject.topicId ? { topicId: subject.topicId } : {}),
      };
      // Questions already used by another subject of this exam are never repeated; ones the student saw
      // in an earlier official exam come last (only when the bank has nothing else).
      const pool = await repository.drawPublishedIds(filters, Math.min(subject.available, wanted + seen.size + used.size + 40));
      const fresh = pool.filter((id) => !used.has(id) && !seen.has(id));
      const reused = pool.filter((id) => !used.has(id) && seen.has(id));

      for (const id of [...fresh, ...reused]) {
        if (ids.length < wanted) {
          ids.push(id);
          used.add(id);
        }
      }
    }

    drawn.push({ subjectId: subject.id, name: subject.name, wanted, ids });
  }

  const sections = buildSections(drawn);
  const questionIds = drawn.flatMap((subject) => subject.ids);

  if (questionIds.length === 0) {
    return null;
  }

  const simulation = await prisma.studySimulation.create({
    data: {
      profileId,
      title: `Simulado oficial — ${exam.name}`,
      filters: { kind: "OFFICIAL", syllabusId: exam.syllabusId, courseSlug: exam.courseSlug, sections } as unknown as Prisma.InputJsonValue,
      questionCount: questionIds.length,
      timeLimitMinutes: exam.durationMinutes,
      questions: { create: questionIds.map((questionId, position) => ({ questionId, position })) },
    },
    select: { id: true },
  });

  return { id: simulation.id, sections };
}

/** Sections stored in an official exam, or null for a custom one. */
export function sectionsFromFilters(filters: unknown): BlueprintSection[] | null {
  const value = filters as { kind?: string; sections?: unknown } | null;

  return value?.kind === "OFFICIAL" && Array.isArray(value.sections) ? (value.sections as BlueprintSection[]) : null;
}
