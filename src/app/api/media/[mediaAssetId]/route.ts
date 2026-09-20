import {
  readFile,
} from "node:fs/promises";
import {
  resolve,
} from "node:path";

import { getPrismaClient } from "@/shared/infrastructure/database/prisma";
import { resolveLocalPublicMediaPath } from "@/modules/question-bank/infrastructure/media/local-public-media";

export const runtime =
  "nodejs";

type RouteContext =
  Readonly<{
    params:
      | Readonly<{
          mediaAssetId: string;
        }>
      | Promise<
          Readonly<{
            mediaAssetId: string;
          }>
        >;
  }>;

function notFound(): Response {
  return new Response(
    "Media not found.",
    {
      status: 404,
      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const {
    mediaAssetId,
  } = await context.params;

  if (!mediaAssetId) {
    return notFound();
  }

  const prisma =
    getPrismaClient();

  const asset =
    await prisma.mediaAsset.findUnique({
      where: {
        id: mediaAssetId,
      },
      select: {
        storageProvider:
          true,
        bucket:
          true,
        storageKey:
          true,
        mimeType:
          true,
      },
    });

  if (
    !asset ||
    asset.storageProvider !==
      "LOCAL_FS"
  ) {
    return notFound();
  }

  let filePath: string;

  try {
    filePath =
      resolveLocalPublicMediaPath({
        rootDirectory:
          resolve(
            process.env
              .MEDIA_STORAGE_LOCAL_ROOT ??
              "data-private/media-store",
          ),
        bucket:
          asset.bucket,
        storageKey:
          asset.storageKey,
      });
  } catch {
    return notFound();
  }

  let bytes: Uint8Array;

  try {
    bytes =
      Uint8Array.from(
        await readFile(
          filePath,
        ),
      );
  } catch (
    error: unknown
  ) {
    if (
      error &&
      typeof error ===
        "object" &&
      "code" in error &&
      error.code ===
        "ENOENT"
    ) {
      return notFound();
    }

    throw error;
  }

  const responseBody =
    Uint8Array.from(
      bytes,
    ).buffer;

  return new Response(
    responseBody,
    {
      status: 200,
      headers: {
        "Content-Type":
          asset.mimeType,
        "Content-Length":
          String(
            bytes.byteLength,
          ),
        "Cache-Control":
          "public, max-age=31536000, immutable",
        "X-Content-Type-Options":
          "nosniff",
      },
    },
  );
}