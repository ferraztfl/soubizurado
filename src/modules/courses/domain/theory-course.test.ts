import { describe, expect, it } from "vitest";

import {
  lessonContentKey,
  lessonTitleFromTopic,
  planTheoryCourse,
  theoryCourseSlug,
  theoryCourseTitle,
} from "./theory-course";

describe("theory course", () => {
  it("names the course after the contest and the position", () => {
    expect(theoryCourseSlug("concurso-pmpe-2026", "soldado")).toBe("teoria-completa-pmpe-2026-soldado");
    expect(theoryCourseTitle("Concurso CBMPE 2026", "2º Tenente – Oficial Combatente (QOC)")).toBe(
      "Teoria Completa – CBMPE 2026 – 2º Tenente – Oficial Combatente (QOC)",
    );
  });

  it("titles lessons from the syllabus topic", () => {
    expect(lessonTitleFromTopic("Doenças cardiovasculares: hipertensão arterial; cardiopatia isquêmica.")).toBe("Doenças cardiovasculares");
    expect(lessonTitleFromTopic("Formação de Olinda e Recife.")).toBe("Formação de Olinda e Recife");
    const long = lessonTitleFromTopic(`Movimentos de resistência ${"e emancipacionistas ".repeat(12)}`);
    expect(long.length).toBeLessThanOrEqual(151);
    expect(long.endsWith("…")).toBe(true);
  });

  it("reuses content by subject and topic text, ignoring accents and case", () => {
    expect(lessonContentKey("Língua Portuguesa", "Crase.")).toBe(lessonContentKey("LINGUA PORTUGUESA", "crase"));
    expect(lessonContentKey("Língua Portuguesa", "Crase")).not.toBe(lessonContentKey("Informática", "Crase"));
  });

  it("plans one module per subject with topics, in order", () => {
    const plan = planTheoryCourse({
      subjects: [
        { name: "Língua Portuguesa", topics: [] },
        { name: "História de Pernambuco", topics: [{ id: "t1", code: "1", text: "Ocupação e colonização." }] },
      ],
    });
    expect(plan).toEqual([
      {
        title: "História de Pernambuco",
        lessons: [{ title: "1. Ocupação e colonização", syllabusTopicId: "t1", contentKey: lessonContentKey("História de Pernambuco", "Ocupação e colonização.") }],
      },
    ]);
  });
});
