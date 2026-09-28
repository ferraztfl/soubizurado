import type { Prisma } from "@/generated/prisma/client";
import { asEducationLevel, formatPositionLines, toDayInput } from "@/modules/contests/domain/contest";

import type { ContestFormValues } from "./contest-form";

export type ContestWithPositions = Prisma.ContestGetPayload<{ include: { contestPositions: true } }>;

function centsInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

/** Values of the contest form for an existing contest (edit page and notice import). */
export function contestFormValues(contest: ContestWithPositions): ContestFormValues {
  return {
    id: contest.id,
    name: contest.name,
    slug: contest.slug,
    organizationName: contest.organizationName,
    stateCode: contest.stateCode,
    status: contest.status,
    vacancies: contest.vacancies === null ? "" : String(contest.vacancies),
    hasReserveList: contest.hasReserveList,
    salaryMin: centsInput(contest.salaryMinCents),
    salaryMax: centsInput(contest.salaryMaxCents),
    educationLevels: contest.educationLevels,
    positions: contest.positions,
    summary: contest.summary,
    registrationStart: toDayInput(contest.registrationStart),
    registrationEnd: toDayInput(contest.registrationEnd),
    examDate: toDayInput(contest.examDate),
    noticeUrl: contest.noticeUrl ?? "",
    boardId: contest.boardId,
    careerCategoryId: contest.careerCategoryId,
    relatedOfferId: contest.relatedOfferId,
    isFeatured: contest.isFeatured,
    isPublished: contest.isPublished,
    hasLogo: contest.logoAssetId !== null,
    positionLines: formatPositionLines(
      [...contest.contestPositions]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((position) => ({ ...position, educationLevel: asEducationLevel(position.educationLevel) })),
    ),
    feeText: contest.feeText ?? "",
    stages: contest.stages,
    examLocations: contest.examLocations ?? "",
    authorization: contest.authorization ?? "",
  };
}

export const EMPTY_CONTEST_FORM_VALUES: ContestFormValues = {
  id: null,
  name: "",
  slug: "",
  organizationName: "",
  stateCode: null,
  status: "EXPECTED",
  vacancies: "",
  hasReserveList: false,
  salaryMin: "",
  salaryMax: "",
  educationLevels: [],
  positions: "",
  summary: "",
  registrationStart: "",
  registrationEnd: "",
  examDate: "",
  noticeUrl: "",
  boardId: null,
  careerCategoryId: null,
  relatedOfferId: null,
  isFeatured: false,
  isPublished: false,
  hasLogo: false,
  positionLines: "",
  feeText: "",
  stages: "",
  examLocations: "",
  authorization: "",
};
