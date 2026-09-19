import { z } from "zod";

const questionIdSchema = z
  .string()
  .trim()
  .uuid();

const answerSchema = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("MULTIPLE_CHOICE"),
      alternativeId: z
        .string()
        .trim()
        .uuid(),
    }),
    z.object({
      type: z.literal("TRUE_FALSE"),
      value: z.boolean(),
    }),
  ],
);

const inputSchema = z.object({
  questionId: questionIdSchema,
  answer: answerSchema,
  responseTimeMs: z
    .number()
    .int()
    .nonnegative()
    .max(86_400_000)
    .optional(),
});

export type StudyAnswerActionInput =
  z.infer<typeof inputSchema>;

export function parseStudyAnswerActionInput(
  input: unknown,
): StudyAnswerActionInput | null {
  const parsed = inputSchema.safeParse(input);

  return parsed.success
    ? parsed.data
    : null;
}
