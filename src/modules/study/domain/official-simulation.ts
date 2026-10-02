/*
 * "Simulado oficial": an exam that mirrors the real one of a position — the
 * same number of questions per subject, in the order of the notice, within the
 * time the notice gives. Pure functions; persistence lives in
 * infrastructure/simulations/official-simulation-store.ts.
 */

export type BlueprintSubject = Readonly<{
  id: string;
  name: string;
  /** Questions of this subject in the real exam. */
  questionCount: number;
  /** Published questions that can fill it. */
  available: number;
}>;

export type BlueprintSection = Readonly<{
  subjectId: string;
  name: string;
  /** 0-based positions of the exam, from..to inclusive. */
  from: number;
  to: number;
  wanted: number;
  /** What the bank could provide (may be below `wanted`). */
  drawn: number;
}>;

export type OfficialBlueprint = Readonly<{
  totalWanted: number;
  totalAvailable: number;
  /** True when every subject has all the questions of the real exam. */
  complete: boolean;
  subjects: readonly (BlueprintSubject & Readonly<{ shortage: number }>)[];
}>;

/** How many questions each subject can really give, and whether the exam is complete. */
export function planBlueprint(subjects: readonly BlueprintSubject[]): OfficialBlueprint {
  const planned = subjects
    .filter((subject) => subject.questionCount > 0)
    .map((subject) => ({ ...subject, shortage: Math.max(0, subject.questionCount - subject.available) }));

  return {
    totalWanted: planned.reduce((sum, subject) => sum + subject.questionCount, 0),
    totalAvailable: planned.reduce((sum, subject) => sum + Math.min(subject.questionCount, subject.available), 0),
    complete: planned.every((subject) => subject.shortage === 0),
    subjects: planned,
  };
}

/** Sections (position ranges) of the drawn exam, in the order of the notice; skips subjects that drew nothing. */
export function buildSections(drawn: readonly Readonly<{ subjectId: string; name: string; wanted: number; ids: readonly string[] }>[]): BlueprintSection[] {
  const sections: BlueprintSection[] = [];
  let position = 0;

  for (const subject of drawn) {
    if (subject.ids.length === 0) {
      continue;
    }

    sections.push({
      subjectId: subject.subjectId,
      name: subject.name,
      from: position,
      to: position + subject.ids.length - 1,
      wanted: subject.wanted,
      drawn: subject.ids.length,
    });
    position += subject.ids.length;
  }

  return sections;
}

/** Name of the section a 0-based position belongs to. */
export function sectionOf(sections: readonly BlueprintSection[], position: number): BlueprintSection | null {
  return sections.find((section) => position >= section.from && position <= section.to) ?? null;
}

/** "5h00" for 300 minutes (the notice duration). */
export function formatExamDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return hours > 0 ? `${hours}h${String(rest).padStart(2, "0")}` : `${rest}min`;
}
