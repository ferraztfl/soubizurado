"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import styles from "./combo-carousel.module.css";

export type ComboSlide = Readonly<{
  slug: string;
  name: string;
  headline: string | null;
  price: string;
  compareAt: string | null;
  bannerUrl: string | null;
}>;

const INTERVAL_MS = 7000;

/** Home page carousel of the store's combos (banner image, or a slide built from the offer). */
export function ComboCarousel({ slides }: Readonly<{ slides: readonly ComboSlide[] }>) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || hovered) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, hovered]);

  if (count === 0) return null;
  const slide = slides[index]!;

  return (
    <section
      className={styles.carousel}
      aria-roledescription="carrossel"
      aria-label="Combos por concurso"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className={styles.head}>
        <span className={styles.eyebrow}>Sua próxima conquista começa aqui</span>
        <Link href="/loja">Todos os combos →</Link>
      </div>

      <Link
        href={`/loja/${slide.slug}`}
        className={styles.slide}
        aria-roledescription="slide"
        aria-label={`${index + 1} de ${count}: ${slide.name}`}
      >
        {/* The offer banner is the background; the offer text always stays on top (readable, indexable). */}
        <div className={slide.bannerUrl ? styles.generatedWithBanner : styles.generated}>
          {slide.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- media route (private bucket)
            <img src={slide.bannerUrl} alt="" aria-hidden="true" className={styles.background} />
          ) : null}
          <span className={styles.generatedKicker}>Combo</span>
          <strong>{slide.name}</strong>
          {slide.headline ? <p>{slide.headline}</p> : null}
          <span className={styles.generatedPrice}>
            {slide.compareAt ? <s>{slide.compareAt}</s> : null} {slide.price}
          </span>
          <span className={styles.generatedCta}>Conheça o combo</span>
        </div>
      </Link>

      <div className={styles.controls}>
        <div className={styles.tabs} role="tablist" aria-label="Escolher combo">
          {slides.map((item, itemIndex) => (
            <button
              key={item.slug}
              type="button"
              role="tab"
              aria-selected={itemIndex === index}
              className={itemIndex === index ? styles.tabActive : styles.tab}
              onClick={() => go(itemIndex)}
            >
              <small>{String(itemIndex + 1).padStart(2, "0")}</small> {item.name}
            </button>
          ))}
        </div>
        {count > 1 ? (
          <div className={styles.arrows}>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Retomar" : "Pausar"}>
              {paused ? "▶" : "❚❚"}
            </button>
            <button type="button" onClick={() => go(index - 1)} aria-label="Anterior">
              ‹
            </button>
            <button type="button" onClick={() => go(index + 1)} aria-label="Próximo">
              ›
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
