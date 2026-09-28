import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";

import styles from "../../loja/loja.module.css";
import { ContestForm } from "../contest-form";
import { loadContestFormOptions } from "../load-contest-form-options";

export const dynamic = "force-dynamic";

type NewContestPageProps = Readonly<{ searchParams: Promise<Readonly<{ error?: string }>> }>;

export default async function NewContestPage(props: NewContestPageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const options = await loadContestFormOptions();

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/concursos">Concursos</Link> / <span>Novo concurso</span>
      </nav>
      <h1 className={styles.title}>Novo concurso</h1>
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}
      <section className={styles.card}>
        <ContestForm
          values={{
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
          }}
          {...options}
        />
      </section>
    </main>
  );
}
