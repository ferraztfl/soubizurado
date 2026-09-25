import { redirect } from "next/navigation";

type LegacyReviewQuestionPageProps = Readonly<{
  params: Promise<
    Readonly<{
      questionId: string;
    }>
  >;
}>;

export default async function LegacyReviewQuestionPage({
  params,
}: LegacyReviewQuestionPageProps): Promise<never> {
  const { questionId } = await params;

  redirect(
    `/admin/questoes/revisao/${encodeURIComponent(questionId)}`,
  );
}
