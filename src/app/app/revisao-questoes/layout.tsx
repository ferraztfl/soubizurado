import type {
  ReactNode,
} from "react";

import {
  requireAdminUser,
} from "@/modules/identity/application/require-admin-user";

type ReviewQuestionsLayoutProps =
  Readonly<{
    children: ReactNode;
  }>;

export default async function ReviewQuestionsLayout({
  children,
}: ReviewQuestionsLayoutProps) {
  await requireAdminUser();

  return children;
}