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
    bucket: string;
    storageKey: string;
  }>,
): string {
  if (
    !input.bucket.trim() ||
    !input.storageKey.trim()
  ) {
    throw new Error(
      "Invalid local media location.",
    );
  }

  const rootDirectory =
    resolve(
      input.rootDirectory,
    );

  const bucketDirectory =
    resolve(
      rootDirectory,
      input.bucket,
    );

  const bucketRelative =
    relative(
      rootDirectory,
      bucketDirectory,
    );

  if (
    escapesRoot(
      bucketRelative,
    )
  ) {
    throw new Error(
      "Media bucket escapes storage root.",
    );
  }

  const filePath =
    resolve(
      bucketDirectory,
      input.storageKey,
    );

  const fileRelative =
    relative(
      bucketDirectory,
      filePath,
    );

  if (
    !fileRelative ||
    escapesRoot(
      fileRelative,
    )
  ) {
    throw new Error(
      "Media storage key escapes bucket.",
    );
  }

  return filePath;
}