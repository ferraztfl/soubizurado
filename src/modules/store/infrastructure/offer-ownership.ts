import { getPrismaClient } from "@/shared/infrastructure/database/prisma";

/*
 * Which offers a signed-in student already has, so the store can show
 * "você já tem" instead of the buy button. An offer is owned while EVERY
 * thing it grants is active: Premium (question bank), each course (own
 * entitlement, or Premium "all courses") and "all courses". The end is the
 * earliest end among the grants (null = no end).
 */

export type OfferOwnership = Readonly<{ endsAt: Date | null }>;

type GrantInput = Readonly<{ kind: string; courseId: string | null }>;
export type OwnershipOffer = Readonly<{ slug: string; grants: readonly GrantInput[] }>;

type Window = Readonly<{ endsAt: Date | null }>;

/** Latest end of a set of windows (null if any has no end); undefined = none active. */
function latestEnd(windows: readonly Window[]): Date | null | undefined {
  if (windows.length === 0) return undefined;
  if (windows.some((window) => window.endsAt === null)) return null;

  return windows.reduce<Date>((latest, window) => (window.endsAt! > latest ? window.endsAt! : latest), windows[0]!.endsAt!);
}

export function planOfferOwnership(
  offers: readonly OwnershipOffer[],
  entitlements: readonly Readonly<{ kind: string; courseId: string | null; endsAt: Date | null }>[],
): ReadonlyMap<string, OfferOwnership> {
  const result = new Map<string, OfferOwnership>();
  const ofKind = (kind: string) => entitlements.filter((entitlement) => entitlement.kind === kind);

  for (const offer of offers) {
    if (offer.grants.length === 0) continue;

    const ends: (Date | null)[] = [];
    let owned = true;

    for (const grant of offer.grants) {
      const own =
        grant.kind === "COURSE"
          ? [...ofKind("COURSE").filter((entitlement) => entitlement.courseId === grant.courseId), ...ofKind("ALL_COURSES")]
          : ofKind(grant.kind);
      const end = latestEnd(own);

      if (end === undefined) {
        owned = false;
        break;
      }

      ends.push(end);
    }

    if (!owned) continue;

    const finite = ends.filter((end): end is Date => end !== null);

    result.set(offer.slug, {
      endsAt: finite.length === 0 ? null : finite.reduce((earliest, end) => (end < earliest ? end : earliest)),
    });
  }

  return result;
}

export async function loadOfferOwnership(
  profileId: string,
  offers: readonly OwnershipOffer[],
  now = new Date(),
): Promise<ReadonlyMap<string, OfferOwnership>> {
  const entitlements = await getPrismaClient().entitlement.findMany({
    where: {
      profileId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { kind: true, courseId: true, endsAt: true },
  });

  return planOfferOwnership(offers, entitlements);
}
