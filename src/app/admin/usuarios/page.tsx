import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { loadAuthUsers } from "@/modules/identity/infrastructure/auth-user-directory";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import { accountAction, inviteUserAction, premiumAction } from "./actions";
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
  searchParams: Promise<Readonly<{ busca?: string; papel?: string; antes?: string; ok?: string; error?: string }>>;
}>;

const SUCCESS_MESSAGES: Readonly<Record<string, string>> = {
  INVITE: "Convite enviado por e-mail. A pessoa define a própria senha pelo link.",
  GRANT_ADMIN: "Acesso de administrador concedido.",
  REVOKE_ADMIN: "Acesso de administrador removido.",
  BLOCK: "Conta bloqueada: não consegue mais entrar.",
  UNBLOCK: "Conta desbloqueada.",
  PASSWORD_RESET: "Link de redefinição de senha enviado por e-mail.",
  GRANT_PREMIUM: "Premium concedido.",
  REVOKE_PREMIUM: "Premium concedido pelo painel foi retirado.",
};

const AUDIT_LABELS: Readonly<Record<string, string>> = {
  INVITE: "convidou",
  GRANT_ADMIN: "tornou administrador",
  REVOKE_ADMIN: "removeu administrador de",
  BLOCK: "bloqueou",
  UNBLOCK: "desbloqueou",
  PASSWORD_RESET: "enviou redefinição de senha para",
  GRANT_PREMIUM: "concedeu Premium a",
  REVOKE_PREMIUM: "retirou o Premium de",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export default async function UsersPage(props: UsersPageProps) {
  const currentAdmin = await requireAdminUser();

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

  const auditLog = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      createdAt: true,
      actor: { select: { displayName: true } },
      target: { select: { displayName: true } },
    },
  });
  const success = params.ok ? SUCCESS_MESSAGES[params.ok] ?? null : null;

  const page = profiles.slice(0, PAGE_SIZE);
  const next = profiles.length > PAGE_SIZE ? page[page.length - 1]?.createdAt : undefined;
  const profileIds = page.map((profile) => profile.id);

  const now = new Date();
  const [accounts, answers, correct, lastAnswers, premiumRows] = await Promise.all([
    loadAuthUsers(page.map((profile) => profile.authUserId)),
    prisma.studyAnswerAttempt.groupBy({ by: ["profileId"], where: { profileId: { in: profileIds } }, _count: { _all: true } }),
    prisma.studyAnswerAttempt.groupBy({
      by: ["profileId"],
      where: { profileId: { in: profileIds }, isCorrect: true },
      _count: { _all: true },
    }),
    prisma.studyAnswerAttempt.groupBy({ by: ["profileId"], where: { profileId: { in: profileIds } }, _max: { answeredAt: true } }),
    prisma.entitlement.findMany({
      where: {
        profileId: { in: profileIds },
        kind: "QUESTION_BANK",
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { profileId: true, endsAt: true, source: true },
    }),
  ]);

  /** Latest end of active premium per profile (null end = no expiry). */
  const premiumUntil = new Map<string, Date | null>();
  for (const row of premiumRows) {
    const current = premiumUntil.get(row.profileId);
    if (current === undefined || (current !== null && (row.endsAt === null || row.endsAt > current))) {
      premiumUntil.set(row.profileId, row.endsAt);
    }
  }

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
          Contas da plataforma, papéis e atividade de estudo. Convide contas, conceda ou remova acesso de
          administrador, bloqueie acessos e envie redefinição de senha. Toda ação fica registrada abaixo.
        </p>
      </header>

      {success ? (
        <div className={styles.noticeSuccess} role="status">
          {success}
        </div>
      ) : null}
      {params.error ? (
        <div className={styles.noticeError} role="alert">
          {params.error.slice(0, 300)}
        </div>
      ) : null}

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

      <details className={styles.invite}>
        <summary>Convidar nova conta</summary>
        <form action={inviteUserAction} className={styles.inviteForm}>
          <label>
            <span>Nome</span>
            <input name="displayName" required minLength={2} maxLength={120} autoComplete="off" />
          </label>
          <label>
            <span>E-mail</span>
            <input name="email" type="email" required maxLength={254} autoComplete="off" />
          </label>
          <label className={styles.checkbox}>
            <input name="makeAdmin" type="checkbox" />
            <span>Acesso de administrador</span>
          </label>
          <button type="submit">Enviar convite</button>
          <p className={styles.inviteHint}>
            A pessoa recebe um e-mail do Supabase e define a própria senha — ninguém digita senha por ela. O envio
            padrão do Supabase tem limite de poucos e-mails por hora; para volume, configure um SMTP próprio no painel
            do Supabase.
          </p>
        </form>
      </details>

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
                    {account && !account.emailConfirmed ? " · convite pendente" : ""}
                  </span>
                  {account?.blocked ? <span className={styles.blocked}>Bloqueada</span> : null}
                  {premiumUntil.has(profile.id) ? (
                    <span className={styles.premium}>
                      Premium
                      {premiumUntil.get(profile.id) ? ` até ${dateFormatter.format(premiumUntil.get(profile.id)!)}` : " sem prazo"}
                    </span>
                  ) : null}
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
                <PremiumActions profileId={profile.id} isPremium={premiumUntil.has(profile.id)} />
                <UserActions
                  profileId={profile.id}
                  isAdmin={profile.roles.some((item) => item.role === "ADMIN")}
                  isSelf={profile.id === currentAdmin.profileId}
                  blocked={account?.blocked ?? false}
                  hasAccount={Boolean(account)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <section className={styles.audit}>
        <h2>Registro de ações</h2>
        {auditLog.length === 0 ? (
          <p className={styles.meta}>Nenhuma ação registrada ainda.</p>
        ) : (
          <ul>
            {auditLog.map((entry) => (
              <li key={entry.id}>
                <span className={styles.meta}>{dateTimeFormatter.format(entry.createdAt)}</span>{" "}
                <strong>{entry.actor?.displayName ?? "Administrador"}</strong> {AUDIT_LABELS[entry.action] ?? entry.action}{" "}
                <strong>{entry.target?.displayName ?? "conta"}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className={styles.pager} aria-label="Paginação">
        {before ? <Link href={hrefWith({})}>« Mais recentes</Link> : <span />}
        {next ? <Link href={hrefWith({ antes: next.toISOString() })}>Próximas »</Link> : null}
      </nav>
    </main>
  );
}

function ActionButton({ profileId, action, label, danger }: Readonly<{ profileId: string; action: string; label: string; danger?: boolean }>) {
  return (
    <form action={accountAction}>
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="action" value={action} />
      <button type="submit" className={danger ? styles.dangerButton : styles.actionButton}>
        {label}
      </button>
    </form>
  );
}

function UserActions({
  profileId,
  isAdmin,
  isSelf,
  blocked,
  hasAccount,
}: Readonly<{ profileId: string; isAdmin: boolean; isSelf: boolean; blocked: boolean; hasAccount: boolean }>) {
  if (isSelf) {
    return <p className={styles.selfNote}>Sua conta — ações sobre ela ficam bloqueadas aqui.</p>;
  }

  return (
    <div className={styles.actions}>
      {isAdmin ? (
        <ActionButton profileId={profileId} action="REVOKE_ADMIN" label="Remover administrador" danger />
      ) : (
        <ActionButton profileId={profileId} action="GRANT_ADMIN" label="Tornar administrador" />
      )}
      {hasAccount ? (
        <>
          <ActionButton profileId={profileId} action="PASSWORD_RESET" label="Enviar redefinição de senha" />
          {blocked ? (
            <ActionButton profileId={profileId} action="UNBLOCK" label="Desbloquear" />
          ) : (
            <ActionButton profileId={profileId} action="BLOCK" label="Bloquear acesso" danger />
          )}
        </>
      ) : null}
    </div>
  );
}

function PremiumActions({ profileId, isPremium }: Readonly<{ profileId: string; isPremium: boolean }>) {
  return (
    <div className={styles.actions}>
      <form action={premiumAction} className={styles.inlineForm}>
        <input type="hidden" name="profileId" value={profileId} />
        <input type="hidden" name="operation" value="grant" />
        <select name="days" defaultValue="30" aria-label="Duração do Premium">
          <option value="30">30 dias</option>
          <option value="90">90 dias</option>
          <option value="180">6 meses</option>
          <option value="365">1 ano</option>
          <option value="0">Sem prazo</option>
        </select>
        <button type="submit" className={styles.actionButton}>
          {isPremium ? "Estender Premium" : "Conceder Premium"}
        </button>
      </form>
      {isPremium ? (
        <form action={premiumAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="operation" value="revoke" />
          <input type="hidden" name="days" value="0" />
          <button type="submit" className={styles.dangerButton}>
            Retirar Premium do painel
          </button>
        </form>
      ) : null}
    </div>
  );
}
