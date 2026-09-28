import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../[questionId]/editar/editar.module.css";
import { NewQuestionForm, type TaxonomyOption } from "./new-question-form";

export const dynamic = "force-dynamic";

/** Suggestions only (datalist): a new name is still accepted. */
const MAX_SUGGESTIONS = 2_000;

export default async function NewQuestionPage() {
  await requireAdminUser();

  const prisma = getPrismaClient();
  const [disciplines, boards, organizations, careerPositions] = await Promise.all([
    prisma.discipline.findMany({
      where: { isActive: true, knowledgeAreaId: { not: null } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        areas: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            topics: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.examiningBoard.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.publicOrganization.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: MAX_SUGGESTIONS,
      select: { name: true },
    }),
    prisma.careerPosition.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: MAX_SUGGESTIONS,
      select: { name: true },
    }),
  ]);

  const taxonomy: TaxonomyOption[] = disciplines.map((discipline) => ({
    id: discipline.id,
    name: discipline.name,
    areas: discipline.areas.map((area) => ({ id: area.id, name: area.name, topics: area.topics })),
  }));

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/admin/questoes">Todas as questões</Link>
        <span aria-hidden="true">/</span>
        <span>Nova questão</span>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Banco de questões</p>
          <h1>Nova questão</h1>
          <p className={styles.subtitle}>
            Questão de uma prova de concurso (com banca, ano, órgão e cargo) ou questão inédita, elaborada por nós. Ela entra em revisão
            e só vai para os alunos depois de publicada pela política de publicação.
          </p>
        </div>
      </header>

      <NewQuestionForm
        taxonomy={taxonomy}
        boards={boards}
        organizations={organizations.map((item) => item.name)}
        careerPositions={careerPositions.map((item) => item.name)}
        currentYear={new Date().getFullYear()}
      />
    </main>
  );
}
