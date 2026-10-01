import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { readStoredMedia } from "@/shared/infrastructure/media-storage/stored-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = Readonly<{ params: Promise<Readonly<{ assetId: string }>> }>;

function notFound(): Response {
  return new Response("Not found.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

/** Banners and card images of offers on sale (home carousel, store); anything else stays private. */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { assetId } = await context.params;
  if (!UUID.test(assetId)) return notFound();

  const asset = await getPrismaClient().mediaAsset.findFirst({
    where: {
      id: assetId,
      mimeType: { startsWith: "image/" },
      OR: [
        { offerBanners: { some: { isActive: true } } },
        { offerCardImages: { some: { isActive: true } } },
        { courseCovers: { some: { isPublished: true } } },
      ],
    },
    select: { storageProvider: true, bucket: true, storageKey: true, mimeType: true },
  });

  if (!asset) return notFound();

  const bytes = await readStoredMedia(asset);
  if (!bytes) return notFound();

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      // Content-addressed: the bytes of an asset never change.
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
