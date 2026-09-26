import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { SubmitButton } from "../_components/submit-button";
import { createExaminingBoardAction, updateExaminingBoardAction } from "./actions";
import styles from "./bancas.module.css";

export const dynamic = "force-dynamic";

type BoardsPageProps = Readonly<{
  searchParams: Promise<Readonly<{ saved?: string; error?: string; q?: string }>>;
}>;

export default async function ExaminingBoardsPage(props: BoardsPageProps) {
  await requireAdminUser();

  const searchParams = await props.searchParams;
  const query = (searchParams.q ?? "").trim().slice(0, 80);

  const boards = await getPrismaClient().examiningBoard.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { acronym: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      acronym: true,
      websiteUrl: true,
      isActive: true,
      _count: { select: { examinations: true } },
    },
  });

  const activeCount = boards.filter((board) => board.isActive).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Operação</p>
          <h1>Bancas</h1>
          <p className={styles.description}>
            Cadastro controlado das bancas examinadoras. Só bancas ativas aparecem na importação de provas e nos
            filtros dos alunos. Bancas com nomes parecidos são entidades diferentes (ex.: Instituto AOCP e AOCP).
          </p>
        </div>
        <dl className={styles.summary}>
          <div>
            <dt>Ativas</dt>
            <dd>{activeCount}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{boards.length}</dd>
          </div>
        </dl>
      </header>

      {searchParams.saved ? (
        <div className={styles.noticeSuccess} role="status">
          Banca &ldquo;{searchParams.saved.slice(0, 120)}&rdquo; salva.
        </div>
      ) : null}

      {searchParams.error ? (
        <div className={styles.noticeError} role="alert">
          {searchParams.error.slice(0, 300)}
        </div>
      ) : null}

      <section className={styles.card}>
        <div>
          <h2 className={styles.cardTitle}>Cadastrar banca</h2>
          <p className={styles.cardMeta}>
            Use o nome como a banca aparece nas provas. O nome não pode ser alterado depois; se errar, desative e
            cadastre de novo.
          </p>
        </div>

        <form action={createExaminingBoardAction} className={styles.createForm}>
          <label className={styles.field}>
            <span>Nome</span>
            <input name="name" required minLength={2} maxLength={120} placeholder="Ex.: Instituto AOCP" />
          </label>
          <label className={styles.field}>
            <span>Sigla exibida</span>
            <input name="acronym" maxLength={40} placeholder="Ex.: Instituto AOCP" />
          </label>
          <label className={styles.field}>
            <span>Site (opcional)</span>
            <input name="websiteUrl" type="url" maxLength={300} placeholder="https://" />
          </label>
          <SubmitButton pendingLabel="Salvando..." className={styles.primaryButton}>
            Cadastrar
          </SubmitButton>
        </form>
      </section>

      <section className={styles.card}>
        <div className={styles.listHeader}>
          <h2 className={styles.cardTitle}>Bancas cadastradas</h2>
          <form className={styles.search} role="search">
            <label className={styles.srOnly} htmlFor="board-search">
              Buscar banca
            </label>
            <input id="board-search" name="q" defaultValue={query} placeholder="Buscar por nome ou sigla" />
            <button type="submit" className={styles.secondaryButton}>
              Buscar
            </button>
          </form>
        </div>

        {boards.length === 0 ? (
          <p className={styles.cardMeta}>Nenhuma banca encontrada.</p>
        ) : (
          <ul className={styles.list}>
            {boards.map((board) => (
              <li key={board.id} className={`${styles.row} ${board.isActive ? "" : styles.rowInactive}`}>
                <div className={styles.rowName}>
                  <strong>{board.name}</strong>
                  <span>
                    {board._count.examinations} {board._count.examinations === 1 ? "prova" : "provas"}
                    {board.isActive ? "" : " · inativa"}
                  </span>
                </div>

                <form action={updateExaminingBoardAction} className={styles.rowForm}>
                  <input type="hidden" name="id" value={board.id} />
                  <label className={styles.field}>
                    <span>Sigla</span>
                    <input name="acronym" defaultValue={board.acronym ?? ""} maxLength={40} />
                  </label>
                  <label className={styles.field}>
                    <span>Site</span>
                    <input name="websiteUrl" type="url" defaultValue={board.websiteUrl ?? ""} maxLength={300} />
                  </label>
                  <label className={styles.field}>
                    <span>Situação</span>
                    <select name="isActive" defaultValue={String(board.isActive)}>
                      <option value="true">Ativa</option>
                      <option value="false">Inativa</option>
                    </select>
                  </label>
                  <SubmitButton pendingLabel="..." className={styles.secondaryButton}>
                    Salvar
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
