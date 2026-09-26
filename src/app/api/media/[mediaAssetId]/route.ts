import { isCurrentUserAdmin } from "@/modules/identity/application/is-current-user-admin";
import { decideMediaAccess } from "@/modules/question-bank/infrastructure/media/media-access-policy";
import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { readStoredMedia } from "@/shared/infrastructure/media-storage/stored-media";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = Readonly<{
  params: Promise<Readonly<{ mediaAssetId: string }>>;
}>;

function notFound(): Response {
  // Same answer for "missing" and "not allowed": unpublished media ids
  // must not be confirmable by guessing.
  return new Response("Media not found.", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { mediaAssetId } = await context.params;

  if (!mediaAssetId || !UUID_PATTERN.test(mediaAssetId)) {
    return notFound();
  }

  const prisma = getPrismaClient();
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    select: {
      storageProvider: true,
      bucket: true,
      storageKey: true,
      mimeType: true,
      questionLinks: {
        where: { question: { status: "PUBLISHED" } },
        select: { id: true },
        take: 1,
      },
      questionAlternativeLinks: {
        where: { alternative: { question: { status: "PUBLISHED" } } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!asset) {
    return notFound();
  }

  const linkedToPublishedQuestion =
    asset.questionLinks.length > 0 || asset.questionAlternativeLinks.length > 0;

  const decision = decideMediaAccess({
    mimeType: asset.mimeType,
    linkedToPublishedQuestion,
    // Only look up the session when the media is not public.
    isAdmin: linkedToPublishedQuestion ? false : await isCurrentUserAdmin(),
  });

  if (!decision.allowed) {
    return notFound();
  }

  const bytes = await readStoredMedia(asset);

  if (!bytes) {
    return notFound();
  }

  return new Response(Uint8Array.from(bytes).buffer, {
    status: 200,
    headers: {
      ...decision.headers,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
