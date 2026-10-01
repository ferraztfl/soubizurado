/*
 * Pairs booklet and answer-key PDFs found in the batch inbox. Pure: the
 * caller lists the files (relative paths with "/" separators).
 *
 * Supported layouts:
 *  - one subfolder per exam, with the booklet and a file whose name
 *    contains "gabarito";
 *  - a subfolder without answer key uses the inbox root answer key when
 *    there is exactly one (e.g. a key PDF that lists every role);
 *  - loose files in the root: "<nome>.pdf" + "<nome>-gabarito.pdf"
 *    (also "_gabarito", " gabarito", "gabarito-<nome>"), and the
 *    "<nome>-prova.pdf" + "<nome>-gabarito.pdf" naming ("-prova" is ignored
 *    when comparing names).
 */

export type ExamFilePair = Readonly<{
  /** Folder or base name shown in the panel. */
  label: string;
  booklet: string;
  answerKey: string;
}>;

export type PairingResult = Readonly<{
  pairs: readonly ExamFilePair[];
  /** Files that could not be paired, with the reason. */
  unpaired: readonly Readonly<{ file: string; reason: string }>[];
}>;

const ANSWER_KEY = /gabarito/i;

function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function stem(path: string): string {
  return baseName(path).replace(/\.pdf$/i, "");
}

/** "prova-gabarito", "gabarito_prova", "prova gabarito" → "prova". */
function keyStem(path: string): string {
  return stem(path)
    .replace(/[\s_-]*gabaritos?(?:[\s_-]*(?:definitivo|preliminar|oficial|pos[\s_-]*recursos?))?[\s_-]*/gi, " ")
    .trim()
    .toLowerCase();
}

/** Name used to match a booklet with its key: no "(1)" copy marker and no "prova" label. */
function pairingName(name: string): string {
  return name
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/(?:^|[\s_-]+)prova(?=[\s_-]*$)/i, "")
    .trim()
    .toLowerCase();
}

export function pairExamFiles(files: readonly string[]): PairingResult {
  const pdfs = files.filter((file) => /\.pdf$/i.test(file)).sort();
  const pairs: ExamFilePair[] = [];
  const unpaired: { file: string; reason: string }[] = [];

  const rootFiles = pdfs.filter((file) => !file.includes("/"));
  const rootKeys = rootFiles.filter((file) => ANSWER_KEY.test(baseName(file)));
  const rootBooklets = rootFiles.filter((file) => !ANSWER_KEY.test(baseName(file)));

  // Subfolders (first path segment).
  const folders = new Map<string, string[]>();

  for (const file of pdfs.filter((candidate) => candidate.includes("/"))) {
    const folder = file.slice(0, file.indexOf("/"));
    folders.set(folder, [...(folders.get(folder) ?? []), file]);
  }

  const usedRootKeys = new Set<string>();

  for (const [folder, entries] of folders) {
    const keys = entries.filter((file) => ANSWER_KEY.test(baseName(file)));
    const booklets = entries.filter((file) => !ANSWER_KEY.test(baseName(file)));
    const sharedKey = rootKeys.length === 1 && rootBooklets.length === 0 ? rootKeys[0]! : null;
    const answerKey = keys.length === 1 ? keys[0]! : keys.length === 0 ? sharedKey : null;

    if (!answerKey) {
      entries.forEach((file) =>
        unpaired.push({
          file,
          reason: keys.length > 1 ? "Mais de um gabarito na pasta." : "Pasta sem gabarito.",
        }),
      );
      continue;
    }

    if (keys.length === 0 && sharedKey) {
      usedRootKeys.add(sharedKey);
    }

    if (booklets.length === 0) {
      unpaired.push({ file: answerKey, reason: "Pasta sem caderno de questões." });
      continue;
    }

    // Several booklets may share one key (e.g. several roles, one key).
    for (const booklet of booklets) {
      pairs.push({ label: booklets.length === 1 ? folder : `${folder}/${stem(booklet)}`, booklet, answerKey });
    }
  }

  // Loose root files paired by name.
  const keysByStem = new Map<string, string[]>();

  for (const key of rootKeys) {
    const name = pairingName(keyStem(key));

    keysByStem.set(name, [...(keysByStem.get(name) ?? []), key]);
  }

  for (const booklet of rootBooklets) {
    const matches = keysByStem.get(pairingName(stem(booklet))) ?? [];

    if (matches.length === 1) {
      pairs.push({ label: stem(booklet), booklet, answerKey: matches[0]! });
      usedRootKeys.add(matches[0]!);
    } else {
      unpaired.push({
        file: booklet,
        reason: matches.length > 1 ? "Mais de um gabarito com o mesmo nome." : "Gabarito correspondente não encontrado.",
      });
    }
  }

  for (const key of rootKeys) {
    if (!usedRootKeys.has(key)) {
      unpaired.push({ file: key, reason: "Gabarito sem caderno correspondente." });
    }
  }

  return { pairs, unpaired };
}
