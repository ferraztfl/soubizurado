"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "../portal.module.css";

type TickerItem = Readonly<{ slug: string; title: string }>;

/** "Em destaque" strip: one featured title at a time, arrows and auto-advance (paused on hover/focus). */
export function FeaturedTicker({ items }: Readonly<{ items: readonly TickerItem[] }>) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 6000);
    return () => window.clearInterval(timer);
  }, [paused, items.length]);

  if (items.length === 0) return null;

  const current = items[index % items.length]!;
  const move = (step: number) => setIndex((value) => (value + step + items.length) % items.length);

  return (
    <div
      className={styles.ticker}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className={styles.tickerLabel}>Em destaque</span>
      <Link href={`/blog/${current.slug}`} className={styles.tickerTitle} aria-live="polite">
        {current.title}
      </Link>
      {items.length > 1 ? (
        <span className={styles.tickerArrows}>
          <button type="button" onClick={() => move(-1)} aria-label="Destaque anterior">
            ‹
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Próximo destaque">
            ›
          </button>
        </span>
      ) : null}
    </div>
  );
}
