import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  runQuestionImport,
} from "./run-question-import";

describe(
  "runQuestionImport",
  () => {
    it(
      "aggregates multiple pages and advances the cursor",
      async () => {
        const executePage = vi
          .fn()
          .mockResolvedValueOnce({
            jobId: "job-1",
            received: 100,
            imported: 80,
            duplicates: 5,
            reviewRequired: 15,
            failed: 0,
            nextCursor: "cursor-100",
          })
          .mockResolvedValueOnce({
            jobId: "job-2",
            received: 40,
            imported: 30,
            duplicates: 2,
            reviewRequired: 7,
            failed: 1,
            nextCursor: null,
          });

        const result =
          await runQuestionImport({
            executePage,
            pageInput: {
              limit: 100,
              publish: false,
            },
            all: true,
          });

        expect(
          executePage,
        ).toHaveBeenCalledTimes(2);

        expect(
          executePage.mock.calls[1]?.[0],
        ).toMatchObject({
          afterId:
            "cursor-100",
        });

        expect(result).toEqual({
          pages: 2,
          jobs: [
            "job-1",
            "job-2",
          ],
          counts: {
            received: 140,
            imported: 110,
            duplicates: 7,
            reviewRequired: 22,
            failed: 1,
          },
          nextCursor: null,
        });
      },
    );

    it(
      "can stop after the configured maximum number of pages",
      async () => {
        const executePage = vi
          .fn()
          .mockResolvedValueOnce({
            jobId: "job-1",
            received: 100,
            imported: 100,
            duplicates: 0,
            reviewRequired: 0,
            failed: 0,
            nextCursor: "cursor-100",
          })
          .mockResolvedValueOnce({
            jobId: "job-2",
            received: 100,
            imported: 100,
            duplicates: 0,
            reviewRequired: 0,
            failed: 0,
            nextCursor: "cursor-200",
          });

        const result =
          await runQuestionImport({
            executePage,
            pageInput: {
              limit: 100,
              publish: false,
            },
            all: true,
            maxPages: 2,
          });

        expect(result.pages).toBe(2);
        expect(
          result.nextCursor,
        ).toBe("cursor-200");
      },
    );

    it(
      "rejects a cursor that does not advance",
      async () => {
        const executePage = vi
          .fn()
          .mockResolvedValue({
            jobId: "job-1",
            received: 100,
            imported: 100,
            duplicates: 0,
            reviewRequired: 0,
            failed: 0,
            nextCursor: "same-cursor",
          });

        await expect(
          runQuestionImport({
            executePage,
            pageInput: {
              limit: 100,
              publish: false,
              afterId:
                "same-cursor",
            },
            all: true,
          }),
        ).rejects.toThrow(
          "Question import cursor did not advance.",
        );
      },
    );
  },
);