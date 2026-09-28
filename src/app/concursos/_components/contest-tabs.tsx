"use client";

import { useState, type ReactNode } from "react";

import styles from "../concursos.module.css";

type Panel = Readonly<{ key: string; label: string; content: ReactNode }>;

/** Tabs for the home page showcase; every panel is rendered on the server, only the switch is client-side. */
export function ContestTabs({ panels }: Readonly<{ panels: readonly Panel[] }>) {
  const [active, setActive] = useState(panels[0]?.key ?? "");

  return (
    <div>
      <div className={styles.tabs} role="tablist" aria-label="Situação dos concursos">
        {panels.map((panel) => (
          <button
            key={panel.key}
            type="button"
            role="tab"
            id={`contest-tab-${panel.key}`}
            aria-selected={panel.key === active}
            aria-controls={`contest-panel-${panel.key}`}
            className={panel.key === active ? styles.tabActive : styles.tab}
            onClick={() => setActive(panel.key)}
          >
            {panel.label}
          </button>
        ))}
      </div>
      {panels.map((panel) => (
        <div
          key={panel.key}
          role="tabpanel"
          id={`contest-panel-${panel.key}`}
          aria-labelledby={`contest-tab-${panel.key}`}
          hidden={panel.key !== active}
        >
          {panel.content}
        </div>
      ))}
    </div>
  );
}
