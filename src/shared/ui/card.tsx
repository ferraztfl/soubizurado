import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

import styles from "./card.module.css";

type CardProps = Readonly<
  ComponentPropsWithoutRef<"section"> & {
    children: ReactNode;
    tone?: "default" | "muted";
  }
>;

export function Card({
  children,
  className,
  tone = "default",
  ...props
}: CardProps) {
  const classes = [
    styles.card,
    tone === "muted" ? styles.muted : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} {...props}>
      {children}
    </section>
  );
}
