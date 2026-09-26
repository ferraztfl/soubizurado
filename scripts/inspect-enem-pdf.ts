import "dotenv/config";

import {
  resolve,
} from "node:path";

import {
  EnemPdfProvider,
} from "../src/modules/imports/infrastructure/providers/enem-pdf-provider";

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

async function main(): Promise<void> {
  const pdfRaw =
    argumentValue("pdf");
  const yearRaw =
    argumentValue("ano");

  if (!pdfRaw) {
    throw new Error(
      "Use --pdf=<path-to-pdf>.",
    );
  }

  const year =
    Number(yearRaw ?? "2024");

  const provider =
    new EnemPdfProvider({
      pdfPath:
        resolve(pdfRaw),
      year,
    });

  const inspection =
    await provider.inspect();

  const expectedOrdinals =
    Array.from(
      {
        length:
          inspection.total,
      },
      (_, index) =>
        index + 1,
    );

  const missingOrdinals =
    expectedOrdinals.filter(
      (ordinal) =>
        !inspection.ordinals
          .includes(ordinal),
    );

  const missingAnswerKeyOrdinals =
    expectedOrdinals.filter(
      (ordinal) =>
        !inspection
          .answerKeyOrdinals
          .includes(ordinal),
    );

  process.stdout.write(
    `${JSON.stringify(
      {
        year,
        pdf:
          resolve(pdfRaw),
        ...inspection,
        missingOrdinals,
        missingAnswerKeyOrdinals,
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
      : "Unknown ENEM PDF inspection error.";

  process.stderr.write(
    `ENEM PDF inspection failed: ${message}\n`,
  );
  process.exitCode = 1;
});
