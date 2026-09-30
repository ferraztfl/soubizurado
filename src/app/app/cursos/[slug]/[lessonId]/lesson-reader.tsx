"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { ANNOTATION_COLORS, locateQuote } from "@/modules/courses/domain/lesson-annotation";
import {
  deleteAnnotationAction,
  saveAnnotationAction,
  saveReadingPositionAction,
  updateAnnotationNoteAction,
  type SavedAnnotation,
} from "@/modules/courses/presentation/lesson-reader-actions";

import styles from "./lesson-reader.module.css";

type LessonReaderProps = Readonly<{
  courseSlug: string;
  lessonId: string;
  annotations: readonly SavedAnnotation[];
  /** Scroll position to restore ("continuar de onde parei"), or null. */
  resumeAt: number | null;
  children: ReactNode;
}>;

const COLOR_LABELS: Readonly<Record<(typeof ANNOTATION_COLORS)[number], string>> = {
  yellow: "Amarelo",
  green: "Verde",
  blue: "Azul",
  pink: "Rosa",
};

/** Text of the lesson with whitespace collapsed, and where each character comes from. */
function mapText(container: HTMLElement): { text: string; nodes: Text[]; offsets: number[] } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let text = "";
  const nodes: Text[] = [];
  const offsets: number[] = [];
  let lastSpace = true;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const value = node.data;
    for (let i = 0; i < value.length; i += 1) {
      const space = /\s/.test(value[i]!);
      if (space && lastSpace) continue;
      text += space ? " " : value[i];
      nodes.push(node);
      offsets.push(i);
      lastSpace = space;
    }
  }
  return { text, nodes, offsets };
}

function unwrapMarks(container: HTMLElement) {
  for (const mark of container.querySelectorAll("mark[data-annotation]")) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

/** Wraps [start, end) of the collapsed text in <mark>, one mark per text node piece. */
function markRange(container: HTMLElement, start: number, end: number, annotation: SavedAnnotation) {
  const { nodes, offsets } = mapText(container);
  const pieces = new Map<Text, { from: number; to: number }>();
  for (let i = start; i < end && i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const piece = pieces.get(node);
    if (piece) piece.to = offsets[i]! + 1;
    else pieces.set(node, { from: offsets[i]!, to: offsets[i]! + 1 });
  }
  for (const [node, { from, to }] of pieces) {
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    const mark = document.createElement("mark");
    mark.dataset.annotation = annotation.id;
    mark.className = styles[`mark_${annotation.color}`] ?? styles.mark_yellow ?? "";
    if (annotation.note) mark.title = annotation.note;
    try {
      range.surroundContents(mark);
    } catch {
      // A piece crossing element borders is skipped (the rest still shows).
    }
  }
}

export function LessonReader({ courseSlug, lessonId, annotations: initial, resumeAt, children }: LessonReaderProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const [annotations, setAnnotations] = useState<readonly SavedAnnotation[]>(initial);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selection = useRef<{ quote: string; prefix: string; suffix: string } | null>(null);

  // Highlights on the text.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    unwrapMarks(element);
    for (const annotation of annotations) {
      const { text } = mapText(element);
      const start = locateQuote(text, annotation);
      if (start >= 0) markRange(element, start, start + annotation.quote.length, annotation);
    }
  }, [annotations]);

  // Selection → floating toolbar.
  const onSelect = useCallback(() => {
    const element = container.current;
    const current = window.getSelection();
    if (!element || !current || current.isCollapsed || current.rangeCount === 0) {
      setToolbar(null);
      return;
    }
    const range = current.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) {
      setToolbar(null);
      return;
    }
    const quote = current.toString().replace(/\s+/g, " ").trim();
    if (!quote || quote.length > 1000) {
      setToolbar(null);
      return;
    }
    const { text, nodes, offsets } = mapText(element);
    let startIndex = -1;
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i] === range.startContainer && offsets[i]! >= range.startOffset) {
        startIndex = i;
        break;
      }
    }
    const at = startIndex >= 0 ? text.indexOf(quote, Math.max(0, startIndex - 2)) : text.indexOf(quote);
    const found = at >= 0 ? at : text.indexOf(quote);
    selection.current = {
      quote,
      prefix: found > 0 ? text.slice(Math.max(0, found - 64), found) : "",
      suffix: found >= 0 ? text.slice(found + quote.length, found + quote.length + 64) : "",
    };
    const box = range.getBoundingClientRect();
    const host = element.getBoundingClientRect();
    setToolbar({ top: box.top - host.top - 48, left: Math.max(0, Math.min(box.left - host.left + box.width / 2 - 110, host.width - 230)) });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", onSelect);
    return () => document.removeEventListener("selectionchange", onSelect);
  }, [onSelect]);

  async function highlight(color: string, withNote: boolean) {
    const picked = selection.current;
    if (!picked) return;
    const note = withNote ? window.prompt("Sua anotação sobre o trecho:") ?? "" : "";
    const result = await saveAnnotationAction(courseSlug, lessonId, { ...picked, note, color });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
    if (result.ok) setAnnotations((current) => [...current, result.value]);
    else setMessage(result.message);
  }

  async function remove(id: string) {
    const result = await deleteAnnotationAction(courseSlug, lessonId, id);
    if (result.ok) setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
    else setMessage(result.message);
  }

  async function saveNote(id: string, note: string) {
    const result = await updateAnnotationNoteAction(courseSlug, lessonId, id, note);
    if (result.ok) setAnnotations((current) => current.map((annotation) => (annotation.id === id ? { ...annotation, note: note.trim() || null } : annotation)));
    else setMessage(result.message);
  }

  // Reading position: remembered while reading, restored on "continuar".
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    if (resumeAt !== null && resumeAt > 0) {
      const box = element.getBoundingClientRect();
      window.scrollTo({ top: window.scrollY + box.top + (box.height * resumeAt) / 100 - 120, behavior: "smooth" });
    }
    let timer: number | undefined;
    const save = () => {
      const box = element.getBoundingClientRect();
      const read = box.height > 0 ? ((window.innerHeight * 0.4 - box.top) / box.height) * 100 : 0;
      void saveReadingPositionAction(courseSlug, lessonId, read);
    };
    save();
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(save, 2500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [courseSlug, lessonId, resumeAt]);

  return (
    <div className={styles.reader}>
      <ListenBar container={container} />
      {message ? (
        <p className={styles.message} role="status">
          {message}
        </p>
      ) : null}
      <div className={styles.textHost}>
        {toolbar ? (
          <div className={styles.toolbar} style={{ top: toolbar.top, left: toolbar.left }} onMouseDown={(event) => event.preventDefault()}>
            {ANNOTATION_COLORS.map((color) => (
              <button key={color} type="button" className={styles[`swatch_${color}`]} aria-label={`Grifar em ${COLOR_LABELS[color]}`} onClick={() => void highlight(color, false)} />
            ))}
            <button type="button" className={styles.noteButton} onClick={() => void highlight("yellow", true)}>
              Anotar
            </button>
          </div>
        ) : null}
        <div ref={container} className={styles.text}>
          {children}
        </div>
      </div>

      {annotations.length > 0 ? (
        <section className={styles.notes} aria-label="Seus grifos e anotações">
          <h2>Seus grifos e anotações ({annotations.length})</h2>
          <ul>
            {annotations.map((annotation) => (
              <li key={annotation.id} className={styles[`note_${annotation.color}`]}>
                <blockquote>{annotation.quote.length > 220 ? `${annotation.quote.slice(0, 220)}…` : annotation.quote}</blockquote>
                <textarea
                  defaultValue={annotation.note ?? ""}
                  placeholder="Escreva uma anotação (salva ao sair do campo)"
                  maxLength={2000}
                  rows={2}
                  onBlur={(event) => {
                    if ((event.currentTarget.value.trim() || null) !== annotation.note) void saveNote(annotation.id, event.currentTarget.value);
                  }}
                />
                <button type="button" onClick={() => void remove(annotation.id)}>
                  Apagar
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className={styles.tip}>Dica: selecione um trecho do texto para grifar ou anotar.</p>
      )}
    </div>
  );
}

/** "Ouvir a aula" with the browser's own Portuguese voice (no cost, works offline once loaded). */
function ListenBar({ container }: Readonly<{ container: React.RefObject<HTMLDivElement | null> }>) {
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const [rate, setRate] = useState(1);
  // Known only in the browser (false while rendering on the server).
  const supported = useSyncExternalStore(
    subscribeNothing,
    () => "speechSynthesis" in window,
    () => false,
  );

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  function play() {
    const synth = window.speechSynthesis;
    if (state === "paused") {
      synth.resume();
      setState("playing");
      return;
    }
    const text = container.current?.innerText.replace(/\s+/g, " ").trim() ?? "";
    if (!text) return;
    synth.cancel();
    const voice = synth.getVoices().find((item) => item.lang.toLowerCase().startsWith("pt-br")) ?? synth.getVoices().find((item) => item.lang.toLowerCase().startsWith("pt"));
    // Short pieces: some browsers stop long utterances midway.
    const pieces = text.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [text];
    pieces.forEach((piece, index) => {
      const utterance = new SpeechSynthesisUtterance(piece);
      utterance.lang = "pt-BR";
      utterance.rate = rate;
      if (voice) utterance.voice = voice;
      if (index === pieces.length - 1) utterance.onend = () => setState("idle");
      synth.speak(utterance);
    });
    setState("playing");
  }

  if (!supported) return null;

  return (
    <div className={styles.listen}>
      <strong>Ouvir a aula</strong>
      {state === "playing" ? (
        <button
          type="button"
          onClick={() => {
            window.speechSynthesis.pause();
            setState("paused");
          }}
        >
          ❚❚ Pausar
        </button>
      ) : (
        <button type="button" onClick={play}>
          ▶ {state === "paused" ? "Continuar" : "Ouvir"}
        </button>
      )}
      {state !== "idle" ? (
        <button
          type="button"
          onClick={() => {
            window.speechSynthesis.cancel();
            setState("idle");
          }}
        >
          ■ Parar
        </button>
      ) : null}
      <label>
        Velocidade
        <select value={rate} onChange={(event) => setRate(Number(event.currentTarget.value))} disabled={state !== "idle"}>
          <option value={0.9}>0,9×</option>
          <option value={1}>1×</option>
          <option value={1.25}>1,25×</option>
          <option value={1.5}>1,5×</option>
        </select>
      </label>
    </div>
  );
}

function subscribeNothing(): () => void {
  return () => {};
}
