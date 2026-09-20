import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import {
  tmpdir,
} from "node:os";
import {
  join,
} from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  StagedMediaSourceReader,
} from "./staged-media-source-reader";

const workspaces:
  string[] = [];

async function workspace():
  Promise<string> {
  const value =
    await mkdtemp(
      join(
        tmpdir(),
        "soubizurado-stage-test-",
      ),
    );

  workspaces.push(value);

  return value;
}

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0)
      .map(
        (path) =>
          rm(
            path,
            {
              recursive: true,
              force: true,
            },
          ),
      ),
  );
});

describe(
  "StagedMediaSourceReader",
  () => {
    it(
      "reads a staged image inside the configured root",
      async () => {
        const root =
          await workspace();

        const directory =
          join(
            root,
            "enem-pdf",
            "2024",
            "abc",
          );

        await mkdir(
          directory,
          {
            recursive: true,
          },
        );

        await writeFile(
          join(
            directory,
            "asset.png",
          ),
          new Uint8Array([
            1,
            2,
            3,
          ]),
        );

        const reader =
          new StagedMediaSourceReader({
            rootDirectory:
              root,
          });

        await expect(
          reader.read(
            "staging://local/enem-pdf/2024/abc/asset.png",
          ),
        ).resolves.toMatchObject({
          mimeType:
            "image/png",
          sourceUrl:
            "staging://local/enem-pdf/2024/abc/asset.png",
        });
      },
    );

    it(
      "rejects unsupported staged extensions",
      async () => {
        const root =
          await workspace();

        await mkdir(
          join(
            root,
            "assets",
          ),
          {
            recursive: true,
          },
        );

        await writeFile(
          join(
            root,
            "assets",
            "formula.latex",
          ),
          "x^2",
        );

        const reader =
          new StagedMediaSourceReader({
            rootDirectory:
              root,
          });

        await expect(
          reader.read(
            "staging://local/assets/formula.latex",
          ),
        ).rejects.toThrow(
          "Unsupported staged media extension",
        );
      },
    );
  },
);