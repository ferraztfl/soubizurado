import {
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

function escapesRoot(
  relativePath: string,
): boolean {
  return (
    relativePath === ".." ||
    relativePath.startsWith(
      `..${sep}`,
    ) ||
    isAbsolute(relativePath)
  );
}

export function resolveLocalPublicMediaPath(
  input: Readonly<{
    rootDirectory: string;
    storageKey: string;
  }>,
): string {
  if (!input.storageKey.trim()) {
    throw new Error(
      "Invalid local media storage key.",
    );
  }

  const rootDirectory =
    resolve(
      input.rootDirectory,
    );

  const filePath =
    resolve(
      rootDirectory,
      input.storageKey,
    );

  const relativePath =
    relative(
      rootDirectory,
      filePath,
    );

  if (
    !relativePath ||
    escapesRoot(
      relativePath,
    )
  ) {
    throw new Error(
      "Media storage key escapes storage root.",
    );
  }

  return filePath;
}