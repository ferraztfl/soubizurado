import { z } from "zod";

import { questionKey, type OfficialExamQuestion } from "./official-exam";

/*
 * "SouBizurado Exam JSON" v1: a board-agnostic exchange format for one
 * exam booklet with its answer key. It can be produced by any tool (an
 * AI Studio app, a script, a human) and is imported through the same
 * preview → confirm pipeline as the PDF readers.
 *
 * Images are never embedded: each image is a reference to a region of
 * the booklet PDF (page + normalized box), and the importer crops it
 * from the PDF uploaded alongside the JSON. Boxes follow Gemini's
 * convention: [ymin, xmin, ymax, xmax] scaled 0–1000.
 *
 * Pure module: schema, validation and conversion only.
 */

export const EXAM_JSON_SCHEMA_ID = "soubizurado.exam.v1";

const text = (max: number) => z.string().trim().min(1).max(max);

const imageRefSchema = z
  .object({
    page: z.number().int().min(1).max(500),
    box: z
      .tuple([
        z.number().min(0).max(1000),
        z.number().min(0).max(1000),
        z.number().min(0).max(1000),
        z.number().min(0).max(1000),
      ])
      .refine(([ymin, xmin, ymax, xmax]) => ymax > ymin && xmax > xmin, "box: ymax/xmax devem ser maiores que ymin/xmin."),
    description: z.string().trim().max(300).optional(),
  })
  .strict();

const alternativeSchema = z
  .object({
    label: z.string().trim().regex(/^[A-Fa-f]$/, "label deve ser uma letra de A a F."),
    text: z.string().trim().max(5_000).default(""),
    images: z.array(imageRefSchema).max(10).default([]),
  })
  .strict();

const questionSchema = z
  .object({
    number: z.number().int().min(1).max(1_000),
    /** 0 by default; 1, 2... for repeated numbers (e.g. Inglês/Espanhol 11–15). */
    variant: z.number().int().min(0).max(5).default(0),
    type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE"]),
    section: z.string().trim().max(160).nullable().default(null),
    supportTextId: z.string().trim().max(40).nullable().default(null),
    /** Group command for true/false items ("Julgue os itens a seguir..."). */
    command: z.string().trim().max(3_000).nullable().default(null),
    statement: text(20_000),
    images: z.array(imageRefSchema).max(10).default([]),
    alternatives: z.array(alternativeSchema).max(6).default([]),
    /** "A".."F" for multiple choice; "V"/"F" or "C"/"E" for true/false; null only when annulled. */
    answer: z.string().trim().max(10).nullable(),
    annulled: z.boolean().default(false),
    refersToHighlight: z.boolean().default(false),
  })
  .strict();

const supportTextSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    text: z.string().trim().max(30_000).default(""),
    images: z.array(imageRefSchema).max(10).default([]),
  })
  .strict();

export const examJsonSchema = z
  .object({
    schema: z.literal(EXAM_JSON_SCHEMA_ID),
    exam: z
      .object({
        board: text(180),
        organization: text(200),
        role: text(180),
        year: z.number().int().min(1990).max(2100),
        level: z.string().trim().max(40).nullable().default(null),
        notice: z.string().trim().max(160).nullable().default(null),
        title: z.string().trim().max(240).nullable().default(null),
      })
      .strict(),
    supportTexts: z.array(supportTextSchema).max(300).default([]),
    questions: z.array(questionSchema).min(1).max(1_000),
  })
  .strict();

export type ExamJson = z.infer<typeof examJsonSchema>;
export type ExamJsonImageRef = z.infer<typeof imageRefSchema>;

/** Parses and reports schema errors in Portuguese-friendly form. */
export function parseExamJson(raw: unknown): { ok: true; value: ExamJson } | { ok: false; errors: string[] } {
  const result = examJsonSchema.safeParse(raw);

  if (result.success) {
    return { ok: true, value: result.data };
  }

  return {
    ok: false,
    errors: result.error.issues.slice(0, 20).map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`),
  };
}

function normalizeAnswer(type: "MULTIPLE_CHOICE" | "TRUE_FALSE", answer: string | null): string | null {
  if (answer === null) {
    return null;
  }

  const value = answer.trim().toUpperCase();

  if (type === "MULTIPLE_CHOICE") {
    return /^[A-F]$/.test(value) ? value : null;
  }

  if (value === "V" || value === "C" || value === "CERTO" || value === "VERDADEIRO") {
    return "V";
  }

  if (value === "F" || value === "E" || value === "ERRADO" || value === "FALSO") {
    return "F";
  }

  return null;
}

/** Content checks the schema cannot express. Each issue blocks the import. */
export function validateExamJson(exam: ExamJson): string[] {
  const issues: string[] = [];
  const types = new Set(exam.questions.map((question) => question.type));

  if (types.size > 1) {
    issues.push("O arquivo mistura múltipla escolha e Verdadeiro/Falso; envie um arquivo por tipo de prova.");
  }

  const supportIds = new Set<string>();

  for (const support of exam.supportTexts) {
    if (supportIds.has(support.id)) {
      issues.push(`Texto de apoio "${support.id}" repetido.`);
    }

    supportIds.add(support.id);

    if (!support.text && support.images.length === 0) {
      issues.push(`Texto de apoio "${support.id}" sem texto e sem imagem.`);
    }
  }

  const keys = new Set<string>();

  for (const question of exam.questions) {
    const key = questionKey(question.number, question.variant);
    const where = `Questão ${key}`;

    if (keys.has(key)) {
      issues.push(`${where}: número repetido (use "variant" para versões de idioma).`);
    }

    keys.add(key);

    if (question.supportTextId && !supportIds.has(question.supportTextId)) {
      issues.push(`${where}: texto de apoio "${question.supportTextId}" não existe.`);
    }

    if (question.type === "MULTIPLE_CHOICE") {
      const labels = question.alternatives.map((alternative) => alternative.label.toUpperCase());

      if (labels.length < 2) {
        issues.push(`${where}: múltipla escolha precisa de pelo menos 2 alternativas.`);
      }

      if (new Set(labels).size !== labels.length) {
        issues.push(`${where}: letras de alternativa repetidas.`);
      }

      question.alternatives.forEach((alternative) => {
        if (!alternative.text && alternative.images.length === 0) {
          issues.push(`${where}: alternativa ${alternative.label.toUpperCase()} sem texto e sem imagem.`);
        }
      });

      const answer = normalizeAnswer(question.type, question.answer);

      if (!question.annulled && (!answer || !labels.includes(answer))) {
        issues.push(`${where}: gabarito "${question.answer ?? ""}" não corresponde a nenhuma alternativa.`);
      }
    } else {
      if (question.alternatives.length > 0) {
        issues.push(`${where}: item de Verdadeiro/Falso não deve ter alternativas.`);
      }

      if (!question.annulled && !normalizeAnswer(question.type, question.answer)) {
        issues.push(`${where}: gabarito de Verdadeiro/Falso deve ser V/F ou C/E.`);
      }
    }
  }

  // Every number from 1 to the highest must be present (annulled items included).
  const numbers = new Set(exam.questions.map((question) => question.number));
  const highest = Math.max(...numbers);
  const missing = Array.from({ length: highest }, (_, index) => index + 1).filter((number) => !numbers.has(number));

  if (missing.length > 0) {
    issues.push(`Faltam as questões: ${missing.slice(0, 30).join(", ")}${missing.length > 30 ? "…" : ""}.`);
  }

  return issues;
}

/** Every image reference of the file, in a stable order. */
export function examJsonImageRefs(exam: ExamJson): ExamJsonImageRef[] {
  return [
    ...exam.supportTexts.flatMap((support) => support.images),
    ...exam.questions.flatMap((question) => [
      ...question.images,
      ...question.alternatives.flatMap((alternative) => alternative.images),
    ]),
  ];
}

/** Stable workspace file name for a cropped image reference. */
export function imageRefFileName(ref: ExamJsonImageRef): string {
  return `json-p${ref.page}-${ref.box.map((value) => Math.round(value)).join("-")}.png`;
}

/** Converts a validated file into the internal booklet representation. */
export function examJsonToQuestions(exam: ExamJson): OfficialExamQuestion[] {
  const supports = new Map(exam.supportTexts.map((support) => [support.id, support]));

  return exam.questions
    .slice()
    .sort((left, right) => left.number - right.number || left.variant - right.variant)
    .map((question) => {
      const support = question.supportTextId ? supports.get(question.supportTextId) : undefined;
      const answer = normalizeAnswer(question.type, question.answer);

      return {
        key: questionKey(question.number, question.variant),
        number: question.number,
        variant: question.variant,
        block: null,
        section: question.section,
        type: question.type,
        statement: question.command ? `${question.command}\n\n${question.statement}` : question.statement,
        images: question.images.map(imageRefFileName),
        supportText: support?.text || null,
        supportImages: (support?.images ?? []).map(imageRefFileName),
        alternatives: question.alternatives.map((alternative) => ({
          label: alternative.label.toUpperCase(),
          content: alternative.text,
          images: alternative.images.map(imageRefFileName),
        })),
        answer: question.annulled ? null : answer,
        annulled: question.annulled,
        refersToHighlight: question.refersToHighlight,
      };
    });
}
