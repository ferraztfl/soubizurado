"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./rich-text.module.css";

/** Taller than this (in image pixels) is a figure, not a symbol. */
const MAX_SYMBOL_HEIGHT = 64;

type TextImageProps = Readonly<{
  src: string;
  alt: string;
  /** From the text: glued to words on its line. Confirmed by the image size. */
  inline: boolean;
}>;

/**
 * An image written inside an imported text. Legacy imports flattened line
 * breaks, so a figure can sit mid-sentence: an "inline" image that turns
 * out to be large is shown as a block.
 */
export function TextImage({ src, alt, inline }: TextImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [isFigure, setIsFigure] = useState(!inline);

  function measure(image: HTMLImageElement) {
    if (image.naturalHeight > MAX_SYMBOL_HEIGHT) {
      setIsFigure(true);
    }
  }

  // The image may finish loading before hydration (cache): check once mounted.
  useEffect(() => {
    if (ref.current?.complete) {
      measure(ref.current);
    }
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- private media route, sizes unknown
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={(event) => measure(event.currentTarget)}
      className={isFigure ? styles.blockImage : styles.inlineImage}
    />
  );
}
