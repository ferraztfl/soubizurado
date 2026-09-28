"use client";

import { useEffect, useState } from "react";

import styles from "../portal.module.css";

/** Thin bar at the top of the page showing how much of the article was read. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        setProgress(total > 0 ? Math.min(1, window.scrollY / total) : 0);
      });
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <div className={styles.progress} style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />;
}
