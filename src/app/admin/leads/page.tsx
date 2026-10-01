import Link from "next/link";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { formatWhatsapp } from "@/modules/leads/domain/lead";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../loja/loja.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

type LeadsPageProps = Readonly<{ searchParams: Promise<Readonly<{ origem?: string; marketing?: string }>> }>;

/** People who asked for a free material (edital verticalizado PDF). Personal data: admins only. */
export default async function LeadsPage(props: LeadsPageProps) {
  await requireAdminUser();

  const params = await props.searchParams;
  const origin = params.origem?.slice(0, 240) ?? "";
  const onlyMarketing = params.marketing === "1";
  const prisma = getPrismaClient();
  const where = {
    ...(origin ? { sourceLabel: origin } : {}),
    ...(onlyMarketing ? { marketingConsent: true, unsubscribedAt: null } : {}),
  };

  const [leads, total, withConsent, origins] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, whatsapp: true, sourceLabel: true, marketingConsent: true, unsubscribedAt: true, downloads: true, createdAt: true },
    }),
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, marketingConsent: true, unsubscribedAt: null } }),
    prisma.lead.groupBy({ by: ["sourceLabel"], _count: true, orderBy: { _count: { sourceLabel: "desc" } }, take: 50 }),
  ]);

  const query = new URLSearchParams({ ...(origin ? { origem: origin } : {}), ...(onlyMarketing ? { marketing: "1" } : {}) }).toString();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Leads</h1>
      <p className={styles.hint}>
        Pessoas que pediram o edital verticalizado em PDF. Mensagens de divulgação só para quem marcou “quero receber novidades”
        (LGPD). {total} cadastro(s){origin || onlyMarketing ? " neste filtro" : ""}; {withConsent} aceitam receber novidades.
      </p>

      <section className={styles.card}>
        <form className={styles.form} method="get">
          <label className={styles.field}>
            <span>Origem</span>
            <select name="origem" defaultValue={origin}>
              <option value="">Todas</option>
              {origins.map((row) => (
                <option key={row.sourceLabel} value={row.sourceLabel}>
                  {row.sourceLabel} ({row._count})
                </option>
              ))}
            </select>
          </label>
          <div className={styles.checks}>
            <label>
              <input type="checkbox" name="marketing" value="1" defaultChecked={onlyMarketing} /> Só quem aceita receber novidades
            </label>
          </div>
          <div className={styles.full}>
            <button type="submit" className={styles.primary}>
              Filtrar
            </button>{" "}
            <Link href={`/admin/leads/exportar${query ? `?${query}` : ""}`} className={styles.secondary} prefetch={false}>
              Exportar CSV
            </Link>
          </div>
        </form>
      </section>

      <section className={styles.card}>
        {leads.length === 0 ? (
          <p className={styles.hint}>Nenhum cadastro ainda.</p>
        ) : (
          <ul className={styles.list}>
            {leads.map((lead) => (
              <li key={lead.id}>
                <div>
                  <strong>{lead.name}</strong>
                  <span>
                    {lead.email} · <a href={`https://wa.me/55${lead.whatsapp}`} target="_blank" rel="noopener noreferrer">{formatWhatsapp(lead.whatsapp)}</a>
                  </span>
                  <span>
                    {lead.sourceLabel} · {dateTime.format(lead.createdAt)} · {lead.downloads} download(s) ·{" "}
                    {lead.unsubscribedAt ? "saiu da lista" : lead.marketingConsent ? "aceita novidades" : "sem consentimento de divulgação"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {total > leads.length ? <p className={styles.hint}>Mostrando os {leads.length} mais recentes de {total}. Use o CSV para a lista completa.</p> : null}
      </section>
    </main>
  );
}
