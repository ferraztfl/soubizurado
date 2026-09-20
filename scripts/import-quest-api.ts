import "dotenv/config";

import {
  ImportProviderQuestionsUseCase,
} from "../src/modules/imports/application/use-cases/import-provider-questions";
import {
  QuestApiProvider,
} from "../src/modules/imports/infrastructure/providers/quest-api-provider";
import {
  PrismaQuestionImportRepository,
} from "../src/modules/imports/infrastructure/repositories/prisma-question-import-repository";

type Arguments = Readonly<{
  limit: number;
  externalId?: string;
  afterId?: string;
  publish: boolean;
  board?: string;
  year?: string;
  discipline?: string;
  topic?: string;
  alternativeType?:
    | "MULTIPLA_ESCOLHA"
    | "CERTO_ERRADO";
  hasAttachments: boolean;
}>;

function argumentValue(
  name: string,
): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .slice(2)
    .find((argument) =>
      argument.startsWith(prefix),
    )
    ?.slice(prefix.length)
    .trim();
}

function hasFlag(
  name: string,
): boolean {
  return process.argv
    .slice(2)
    .includes(`--${name}`);
}

function parseArguments(): Arguments {
  const limitRaw =
    argumentValue("limit") ?? "5";
  const limit = Number(limitRaw);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new Error(
      "--limit must be an integer between 1 and 100.",
    );
  }

  const alternativeType =
    argumentValue("tipo");

  if (
    alternativeType !== undefined &&
    alternativeType !==
      "MULTIPLA_ESCOLHA" &&
    alternativeType !==
      "CERTO_ERRADO"
  ) {
    throw new Error(
      "--tipo must be MULTIPLA_ESCOLHA or CERTO_ERRADO.",
    );
  }

  if (alternativeType) {
    throw new Error(
      "--tipo is temporarily disabled for /v2/questoes because the live Quest API currently rejects alternative_type with 422 despite its documentation.",
    );
  }

  const externalId =
    argumentValue("id");

  return {
    limit: externalId ? 1 : limit,
    externalId,
    afterId:
      argumentValue("after-id"),
    publish: hasFlag("publish"),
    board: argumentValue("banca"),
    year: argumentValue("ano"),
    discipline:
      argumentValue("materia"),
    topic: argumentValue("assunto"),
    alternativeType,
    hasAttachments:
      hasFlag("com-imagens"),
  };
}

async function main(): Promise<void> {
  const apiKey =
    process.env.QUEST_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "QUEST_API_KEY is missing from the environment.",
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from the environment.",
    );
  }

  const args = parseArguments();

  const provider = new QuestApiProvider({
    apiKey,
  });
  const repository =
    new PrismaQuestionImportRepository();
  const useCase =
    new ImportProviderQuestionsUseCase(
      provider,
      repository,
    );

  const result = await useCase.execute({
    limit: args.limit,
    externalId: args.externalId,
    afterId: args.afterId,
    publish: args.publish,
    filters: {
      board: args.board,
      year: args.year,
      discipline:
        args.discipline,
      topic: args.topic,
      alternativeType:
        args.alternativeType,
      hasAttachments:
        args.hasAttachments,
    },
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        ...result,
        publicationMode:
          args.publish
            ? "PUBLISHED"
            : "IN_REVIEW",
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown import error.";

  process.stderr.write(
    `Quest API import failed: ${message}\n`,
  );
  process.exitCode = 1;
});
