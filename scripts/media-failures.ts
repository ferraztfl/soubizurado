import "dotenv/config";

import {
  getPrismaClient,
} from "../src/shared/infrastructure/database/prisma";

function argumentValue(
  name: string,
): string | undefined {
  const prefix =
    `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) =>
      argument.startsWith(
        prefix,
      ),
    )
    ?.slice(
      prefix.length,
    )
    .trim();
}

function latestArgument(): number {
  const value =
    Number(
      argumentValue("latest") ??
        "50",
    );

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 500
  ) {
    throw new Error(
      "--latest must be between 1 and 500.",
    );
  }

  return value;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing.",
    );
  }

  const provider =
    argumentValue(
      "provider",
    );

  const year =
    argumentValue(
      "year",
    );

  const prisma =
    getPrismaClient();

  const tasks =
    await prisma
      .importMediaTask
      .findMany({
        where: {
          status: "FAILED",

          importItem: {
            ...(year
              ? {
                  externalId: {
                    startsWith:
                      `enem-${year}-`,
                  },
                }
              : {}),

            ...(provider
              ? {
                  job: {
                    provider,
                  },
                }
              : {}),
          },
        },

        orderBy: {
          updatedAt:
            "desc",
        },

        take:
          latestArgument(),

        select: {
          id: true,
          status: true,
          attempts: true,
          role: true,
          alternativeLabel: true,
          position: true,
          sourceUrl: true,
          errorMessage: true,
          questionId: true,
          mediaAssetId: true,
          createdAt: true,
          updatedAt: true,

          importItem: {
            select: {
              externalId: true,

              job: {
                select: {
                  provider: true,

                  source: {
                    select: {
                      reference:
                        true,
                    },
                  },
                },
              },
            },
          },
        },
      });

  process.stdout.write(
    `${JSON.stringify(
      {
        filter: {
          provider:
            provider ?? null,
          year:
            year ?? null,
        },
        count:
          tasks.length,
        tasks,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch(
  (error: unknown) => {
    process.stderr.write(
      `${
        error instanceof Error
          ? error.message
          : "Unknown media failure query error."
      }\n`,
    );

    process.exitCode = 1;
  },
);