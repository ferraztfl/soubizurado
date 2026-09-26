"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = Readonly<{
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
}>;

/** Submit button that shows progress while its form action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  disabled,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
