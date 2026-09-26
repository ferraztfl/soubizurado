import {
  lookup,
} from "node:dns/promises";
import {
  BlockList,
  isIP,
} from "node:net";

export type ResolvedMediaAddress =
  Readonly<{
    address: string;
    family: 4 | 6;
  }>;

export type MediaHostResolver =
  (
    hostname: string,
  ) => Promise<
    readonly ResolvedMediaAddress[]
  >;

const BLOCKED_ADDRESSES =
  new BlockList();

BLOCKED_ADDRESSES.addSubnet(
  "0.0.0.0",
  8,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "10.0.0.0",
  8,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "100.64.0.0",
  10,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "127.0.0.0",
  8,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "169.254.0.0",
  16,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "172.16.0.0",
  12,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "192.0.0.0",
  24,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "192.0.2.0",
  24,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "192.168.0.0",
  16,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "198.18.0.0",
  15,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "198.51.100.0",
  24,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "203.0.113.0",
  24,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "224.0.0.0",
  4,
  "ipv4",
);
BLOCKED_ADDRESSES.addSubnet(
  "240.0.0.0",
  4,
  "ipv4",
);

BLOCKED_ADDRESSES.addAddress(
  "::",
  "ipv6",
);
BLOCKED_ADDRESSES.addAddress(
  "::1",
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "64:ff9b::",
  96,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "64:ff9b:1::",
  48,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "100::",
  64,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "fc00::",
  7,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "fe80::",
  10,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "ff00::",
  8,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "2001:2::",
  48,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "2001:db8::",
  32,
  "ipv6",
);
BLOCKED_ADDRESSES.addSubnet(
  "2002::",
  16,
  "ipv6",
);

function normalizeHostname(
  hostname: string,
): string {
  const value =
    hostname.trim();

  if (
    value.startsWith("[") &&
    value.endsWith("]")
  ) {
    return value.slice(
      1,
      -1,
    );
  }

  return value;
}

function assertPublicAddress(
  address: string,
): ResolvedMediaAddress {
  const normalized =
    normalizeHostname(
      address,
    );

  const family =
    isIP(
      normalized,
    );

  if (
    family !== 4 &&
    family !== 6
  ) {
    throw new Error(
      `Invalid media IP address: ${address}`,
    );
  }

  const type =
    family === 4
      ? "ipv4"
      : "ipv6";

  if (
    BLOCKED_ADDRESSES.check(
      normalized,
      type,
    )
  ) {
    throw new Error(
      `Blocked private or reserved media address: ${normalized}`,
    );
  }

  return {
    address:
      normalized,
    family,
  };
}

const defaultResolver:
  MediaHostResolver =
  async (
    hostname,
  ) => {
    const results =
      await lookup(
        hostname,
        {
          all: true,
          verbatim: true,
        },
      );

    return results.map(
      (result) => ({
        address:
          result.address,
        family:
          result.family === 6
            ? 6
            : 4,
      }),
    );
  };

export async function resolvePublicMediaAddress(
  hostname: string,
  resolver:
    MediaHostResolver =
      defaultResolver,
): Promise<ResolvedMediaAddress> {
  const normalized =
    normalizeHostname(
      hostname,
    );

  const literalFamily =
    isIP(
      normalized,
    );

  if (
    literalFamily === 4 ||
    literalFamily === 6
  ) {
    return assertPublicAddress(
      normalized,
    );
  }

  const addresses =
    await resolver(
      normalized,
    );

  if (
    addresses.length === 0
  ) {
    throw new Error(
      `Media hostname did not resolve: ${normalized}`,
    );
  }

  const validated =
    addresses.map(
      (item) =>
        assertPublicAddress(
          item.address,
        ),
    );

  return validated[0]!;
}

