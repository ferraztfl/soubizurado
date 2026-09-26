import { readFile } from "node:fs/promises";

import { requireAdminUser } from "@/modules/identity/application/require-admin-user";
import {
  isValidUploadId,
  workspaceFile,
} from "@/modules/imports/infrastructure/official-exams/official-exam-upload-store";

export const runtime = "nodejs";

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

type RouteContext = Readonly<{
  params: Promise<Readonly<{ uploadId: string; file: string }>>;
}>;

function notFound(): Response {
  return new Response("Not found.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}

/** Admin-only preview of images extracted from an uploaded booklet. */
export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  await requireAdminUser();

  const { uploadId, file } = await context.params;

  if (!isValidUploadId(uploadId)) {
    return notFound();
  }

  const path = workspaceFile(uploadId, file);
  const extension = file.split(".").pop()?.toLowerCase() ?? "";

  if (!path || !CONTENT_TYPES[extension]) {
    return notFound();
  }

  try {
    const bytes = await readFile(path);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension]!,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
