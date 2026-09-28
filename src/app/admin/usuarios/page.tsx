import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { loadAuthUsers } from "@/modules/identity/infrastructure/auth-user-directory";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "./usuarios.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ROLES = [
  { value: "ADMIN", label: "Administrador" },
  { value: "EDITOR", label: "Editor" },
  { value: "MODERATOR", label: "Moderador" },
  { value: "STUDENT", label: "Aluno" },
] as const;

type Role = (typeof ROLES)[number]["value"];

type UsersPageProps = Readonly<{
  searchParams: Promise<Readonly<{ busca?: string; papel?: string; antes?: string }>>;
}>;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function UsersPage(props: UsersPageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const search = params.busca?.trim().slice(0, 120) ?? "";
  const role = ROLES.find((item) => item.value === params.papel)?.value ?? null;
  const before = params.antes && !Number.isNaN(Date.parse(params.antes)) ? new Date(params.antes) : null;
  const prisma = getPrismaClient();
  const weekAgo = daysAgo(7);

  const [profiles, total, admins, activeThisWeek] = await Promise.all([
    prisma.profile.findMany({
      where: {
        ...(search ? { displayName: { contains: search, mode: "insensitive" } } : {}),
        ...(role ? { roles: { some: { role } } } : {}),
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      select: {
        id: true,
        authUserId: true,
        displayName: true,
        createdAt: true,
        roles: { select: { role: true } },
      },
    }),
    prisma.profile.count(),
    prisma.userRole.count({ where: { role: "ADMIN" } }),
    prisma.studyAnswerAttempt.groupBy({ by: ["profileId"], where: { answeredAt: { gte: weekAgo } } }),
  ]);

  const page = profiles.slice(0, PAGE_SIZE);
  const next = profiles.length > PAGE_SIZE ? page[page.length - 1]?.createdAt : undefined;
  const profileIds = page.map((profile) => profile.id);

  const [accounts, answers, correct, lastAnswers] = await Promise.all([
    loadAuthUsers(page.map((profile) => profile.authUserId)),
    prisma.studyAnswerAttempt.groupBy({ by: ["profileId"], where: { profileId: { in: profileIds } }, _count: { _all: true } }),
    prisma.studyAnswerAttempt.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds }, isCorrect: true },
      _count: { _all: true },
    }),
    prisma.studyAnswerAttempt.groupBy({ by: ["profileId"], where: { profileId: { in: profileIds } }, _max: { answeredAt: true } }),
  ]);

  const countFor = (rows: readonly { profileId: string; _count: { _all: number } }[], id: string) =>
    rows.find((row) => row.profileId === id)?._count._all ?? 0;
  const number = new Intl.NumberFormat("pt-BR");
  const roleLabel = (value: Role) => ROLES.find((item) => item.value === value)?.label ?? value;

  const hrefWith = (changes: Record<string, string | null>) => {
    const query = new URLSearchParams();
    const values = { busca: search || null, papel: role, ...changes };
    for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
    const text = query.toString();
    return text ? `/admin/usuarios?${text}` : "/admin/usuarios";
  };

  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>Sistema</p>
        <h1 className={styles.title}>Usuários</h1>
        <p className={styles.description}>
          Contas da plataforma, papéis e atividade de estudo. Os papéis são somente leitura aqui: a concessão de
          acesso administrativo continua controlada no servidor.
        </p>
      </header>

      <section className={styles.cards} aria-label="Resumo">
        <div className={styles.card}>
          <strong>{number.format(total)}</strong>
          <span>contas</span>
        </div>
        <div className={styles.card}>
          <strong>{number.format(activeThisWeek.length)}</strong>
          <span>estudaram nos últimos 7 dias</span>
        </div>
        <div className={styles.card}>
          <strong>{number.format(admins)}</strong>
          <span>administradores</span>
        </div>
      </section>

      <form className={styles.filters} action="/admin/usuarios" role="search">
        <label>
          <span>Nome</span>
          <input name="busca" defaultValue={search} maxLength={120} placeholder="Nome de exibição" autoComplete="off" />
        </label>
        <label>
          <span>Papel</span>
          <select name="papel" defaultValue={role ?? ""}>
            <option value="">Todos</option>
            {ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.filterActions}>
          <button type="submit">Filtrar</button>
          <Link href="/admin/usuarios">Limpar</Link>
        </div>
      </form>

      {page.length === 0 ? (
        <p className={styles.empty}>Nenhuma conta encontrada.</p>
      ) : (
        <ul className={styles.list}>
          {page.map((profile) => {
            const account = accounts.get(profile.authUserId);
            const answered = countFor(answers, profile.id);
            const right = countFor(correct, profile.id);
            const last = lastAnswers.find((row) => row.profileId === profile.id)?._max.answeredAt ?? null;

            return (
              <li key={profile.id} className={styles.item}>
                <div className={styles.identity}>
                  <strong>{profile.displayName ?? "Sem nome"}</strong>
                  <span className={styles.meta}>
                    {account?.email ?? "e-mail indisponível"}
                    {account && !account.emailConfirmed ? " · e-mail não confirmado" : ""}
                  </span>
                  <span className={styles.roles}>
                    {profile.roles.length === 0 ? (
                      <span className={styles.role}>Aluno</span>
                    ) : (
                      profile.roles.map((item) => (
                        <span key={item.role} className={item.role === "ADMIN" ? styles.roleAdmin : styles.role}>
                          {roleLabel(item.role)}
                        </span>
                      ))
                    )}
                  </span>
                </div>
                <dl className={styles.stats}>
                  <div>
                    <dt>Conta criada</dt>
                    <dd>{dateFormatter.format(profile.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Último acesso</dt>
                    <dd>{account?.lastSignInAt ? dateTimeFormatter.format(account.lastSignInAt) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Respostas</dt>
                    <dd>
                      {number.format(answered)}
                      {answered > 0 ? ` · ${Math.round((right / answered) * 100)}% de acerto` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Última resposta</dt>
                    <dd>{last ? dateTimeFormatter.format(last) : "—"}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      <nav className={styles.pager} aria-label="Paginação">
        {before ? <Link href={hrefWith({})}>« Mais recentes</Link> : <span />}
        {next ? <Link href={hrefWith({ antes: next.toISOString() })}>Próximas »</Link> : null}
      </nav>
    </main>
  );
}
