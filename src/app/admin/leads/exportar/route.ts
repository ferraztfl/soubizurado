import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import { csvCell, formatWhatsapp } from "@/modules/leads/domain/lead";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

export const dynamic = "force-dynamic";

const MAX_ROWS = 50_000;
/** Byte order mark: makes Excel read the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** Leads as CSV (semicolon, UTF-8 with BOM for Excel). Admins only. */
export async function GET(request: Request): Promise<Response> {
  await requireAdminUser();

  const url = new URL(request.url);
  const origin = url.searchParams.get("origem")?.slice(0, 240) ?? "";
  const onlyMarketing = url.searchParams.get("marketing") === "1";

  const leads = await getPrismaClient().lead.findMany({
    where: {
      ...(origin ? { sourceLabel: origin } : {}),
      ...(onlyMarketing ? { marketingConsent: true, unsubscribedAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: { name: true, email: true, whatsapp: true, sourceLabel: true, marketingConsent: true, marketingConsentAt: true, unsubscribedAt: true, downloads: true, createdAt: true },
  });

  const header = ["nome", "email", "whatsapp", "origem", "aceita_novidades", "consentimento_em", "saiu_da_lista_em", "downloads", "cadastro_em"];
  const lines = leads.map((lead) =>
    [
      lead.name,
      lead.email,
      formatWhatsapp(lead.whatsapp),
      lead.sourceLabel,
      lead.marketingConsent && !lead.unsubscribedAt ? "sim" : "não",
      lead.marketingConsentAt?.toISOString() ?? "",
      lead.unsubscribedAt?.toISOString() ?? "",
      lead.downloads,
      lead.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(";"),
  );

  return new Response(`${BOM}${[header.join(";"), ...lines].join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
