import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./taxonomia.module.css";

export const dynamic = "force-dynamic";

type Counts = Readonly<{ published: number; total: number }>;

const EMPTY: Counts = { published: 0, total: 0 };

/** Question counts per id (discipline, area or topic), published and total. */
function countBy<K extends string>(
  rows: readonly (Readonly<Record<K, string | null>> & Readonly<{ status: string; _count: { _all: number } }>)[],
  key: K,
): Map<string, Counts> {
  const counts = new Map<string, Counts>();

  for (const row of rows) {
    const id = row[key];
    if (!id) continue;
    const current = counts.get(id) ?? EMPTY;
    counts.set(id, {
      published: current.published + (row.status === "PUBLISHED" ? row._count._all : 0),
      total: current.total + row._count._all,
    });
  }

  return counts;
}

export default async function TaxonomyPage() {
  await requireAdminUser();

  const prisma = getPrismaClient();
  const [knowledgeAreas, disciplines, byDiscipline, byArea, byTopic, revision] = await Promise.all([
    prisma.knowledgeArea.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.discipline.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        knowledgeAreaId: true,
        aliases: { select: { name: true }, orderBy: { name: "asc" } },
        areas: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            topics: {
              where: { isActive: true },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              select: {
                id: true,
                name: true,
                subtopics: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.question.groupBy({ by: ["disciplineId", "status"], _count: { _all: true } }),
    prisma.question.groupBy({ by: ["areaId", "status"], _count: { _all: true } }),
    prisma.question.groupBy({ by: ["topicId", "status"], _count: { _all: true } }),
    prisma.taxonomyRevision.findFirst({ orderBy: { version: "desc" }, select: { version: true, summary: true, createdAt: true } }),
  ]);

  const disciplineCounts = countBy(byDiscipline, "disciplineId");
  const areaCounts = countBy(byArea, "areaId");
  const topicCounts = countBy(byTopic, "topicId");
  const number = new Intl.NumberFormat("pt-BR");
  const format = (counts: Counts) => `${number.format(counts.published)} publ. · ${number.format(counts.total)} total`;

  const sections = [
    ...knowledgeAreas.map((area) => ({
      id: area.id,
      name: area.name,
      disciplines: disciplines.filter((discipline) => discipline.knowledgeAreaId === area.id),
    })),
    {
      id: "legacy",
      name: "Sem área do conhecimento (legado)",
      disciplines: disciplines.filter((discipline) => discipline.knowledgeAreaId === null),
    },
  ].filter((section) => section.disciplines.length > 0);

  const totals = {
    disciplines: disciplines.filter((discipline) => discipline.knowledgeAreaId !== null).length,
    areas: disciplines.reduce((sum, discipline) => sum + discipline.areas.length, 0),
    topics: disciplines.reduce(
      (sum, discipline) => sum + discipline.areas.reduce((inner, area) => inner + area.topics.length, 0),
      0,
    ),
  };

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Operação</p>
        <h1 className={styles.title}>Taxonomia</h1>
        <p className={styles.description}>
          Catálogo controlado de Matérias, Tópicos, Subtópicos e Detalhes. Nem a IA nem os importadores criam itens:
          mudanças entram por uma nova versão do catálogo (código versionado + <code>npm run taxonomy:seed</code>).
        </p>
      </header>

      <section className={styles.summary} aria-label="Resumo">
        <div>
          <strong>v{revision?.version ?? "—"}</strong>
          <span>versão aplicada</span>
        </div>
        <div>
          <strong>{number.format(knowledgeAreas.length)}</strong>
          <span>áreas do conhecimento</span>
        </div>
        <div>
          <strong>{number.format(totals.disciplines)}</strong>
          <span>matérias</span>
        </div>
        <div>
          <strong>{number.format(totals.areas)}</strong>
          <span>tópicos</span>
        </div>
        <div>
          <strong>{number.format(totals.topics)}</strong>
          <span>subtópicos</span>
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.id} className={styles.section}>
          <h2>{section.name}</h2>
          <div className={styles.disciplines}>
            {section.disciplines.map((discipline) => (
              <details key={discipline.id} className={styles.discipline}>
                <summary>
                  <span className={styles.disciplineName}>{discipline.name}</span>
                  <span className={styles.count}>{format(disciplineCounts.get(discipline.id) ?? EMPTY)}</span>
                </summary>

                <div className={styles.body}>
                  {discipline.aliases.length > 0 ? (
                    <p className={styles.aliases}>
                      <span>Também reconhecida como:</span> {discipline.aliases.map((alias) => alias.name).join(" · ")}
                    </p>
                  ) : null}

                  <Link href={`/admin/questoes?materia=${discipline.id}`} className={styles.link}>
                    Ver questões desta matéria
                  </Link>

                  {discipline.areas.length === 0 ? (
                    <p className={styles.muted}>Sem tópicos cadastrados.</p>
                  ) : (
                    <ul className={styles.areas}>
                      {discipline.areas.map((area) => (
                        <li key={area.id}>
                          <div className={styles.areaHead}>
                            <strong>{area.name}</strong>
                            <span className={styles.count}>{format(areaCounts.get(area.id) ?? EMPTY)}</span>
                          </div>
                          <ul className={styles.topics}>
                            {area.topics.map((topic) => {
                              const counts = topicCounts.get(topic.id) ?? EMPTY;

                              return (
                                <li key={topic.id}>
                                  <span>
                                    {topic.name}
                                    {topic.subtopics.length > 0 ? (
                                      <small> — {topic.subtopics.map((subtopic) => subtopic.name).join(", ")}</small>
                                    ) : null}
                                  </span>
                                  <span className={counts.total === 0 ? styles.countZero : styles.count}>
                                    {number.format(counts.total)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
