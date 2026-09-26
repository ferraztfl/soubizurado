export type MediaAccessDecision =
  | Readonly<{ allowed: false }>
  | Readonly<{ allowed: true; headers: Readonly<Record<string, string>> }>;

/**
 * Who may read a stored media asset and how it can be cached.
 *
 * - Media linked to at least one PUBLISHED question is public and
 *   immutable (content-addressed keys), so browsers/CDNs may cache it.
 * - Media used only by unpublished questions is visible to admins only
 *   and must not be stored by shared caches.
 * - SVG is active content served from our origin: a restrictive CSP
 *   with sandbox prevents scripts inside it from running.
 */
export function decideMediaAccess(
  input: Readonly<{
    mimeType: string;
    linkedToPublishedQuestion: boolean;
    isAdmin: boolean;
  }>,
): MediaAccessDecision {
  if (!input.linkedToPublishedQuestion && !input.isAdmin) {
    return { allowed: false };
  }

  const headers: Record<string, string> = {
    "Content-Type": input.mimeType,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    "Cache-Control": input.linkedToPublishedQuestion
      ? "public, max-age=31536000, immutable"
      : "private, no-store",
  };

  if (input.mimeType.toLowerCase().startsWith("image/svg")) {
    // Never render an SVG inline as a document from our origin.
    headers["Content-Disposition"] = "inline";
  }

  return { allowed: true, headers };
}
