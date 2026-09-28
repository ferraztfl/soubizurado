import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

import styles from "../loja.module.css";
import { OfferForm } from "../offer-form";

export const dynamic = "force-dynamic";

type EditOfferPageProps = Readonly<{
  params: Promise<{ offerId: string }>;
  searchParams: Promise<Readonly<{ ok?: string; error?: string }>>;
}>;

export default async function EditOfferPage(props: EditOfferPageProps) {
  await requireAdminUser();

  const { offerId } = await props.params;
  const params = await props.searchParams;
  const prisma = getPrismaClient();
  const [offer, courses] = await Promise.all([
    /^[0-9a-f-]{36}$/i.test(offerId) ? prisma.offer.findUnique({ where: { id: offerId }, include: { grants: true } }) : null,
    prisma.course.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true } }),
  ]);

  if (!offer) {
    notFound();
  }

  const premium = offer.grants.find((grant) => grant.kind === "QUESTION_BANK");
  const courseGrants = offer.grants.filter((grant) => grant.kind === "COURSE" && grant.courseId);

  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb}>
        <Link href="/admin/loja">Loja</Link> / <span>{offer.name}</span>
      </nav>
      <h1 className={styles.title}>Editar oferta</h1>
      {params.ok ? <p className={styles.info}>Oferta salva.</p> : null}
      {params.error ? <p className={styles.error}>{params.error.slice(0, 300)}</p> : null}
      <p className={styles.hint}>
        Página pública: <Link href={`/loja/${offer.slug}`}>/loja/{offer.slug}</Link>
        {offer.isActive ? "" : " (pausada — só administradores veem)"}
      </p>

      <section className={styles.card}>
        <OfferForm
          values={{
            id: offer.id,
            name: offer.name,
            slug: offer.slug,
            headline: offer.headline ?? "",
            description: offer.description,
            priceCents: offer.priceCents,
            compareAtCents: offer.compareAtCents,
            premiumDays: premium ? premium.durationDays : "none",
            isActive: offer.isActive,
            isFeatured: offer.isFeatured,
            sortOrder: offer.sortOrder,
            courseIds: courseGrants.map((grant) => grant.courseId!),
            courseDays: courseGrants[0]?.durationDays ?? null,
          }}
          courses={courses}
        />
      </section>
    </main>
  );
}
