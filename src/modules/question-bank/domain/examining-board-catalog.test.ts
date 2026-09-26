import { describe, expect, it } from "vitest";

import {
  EXAMINING_BOARD_CATALOG,
  examiningBoardSlug,
  suggestExaminingBoard,
} from "./examining-board-catalog";

describe("examining board catalog", () => {
  it("has unique names and slugs", () => {
    const slugs = EXAMINING_BOARD_CATALOG.map((entry) => examiningBoardSlug(entry.name));

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("instituto-aocp");
    expect(slugs).toContain("aocp");
    expect(slugs).toContain("vunesp");
  });

  it("tells Instituto AOCP and AOCP apart", () => {
    expect(suggestExaminingBoard("Realização: Instituto AOCP\nwww.institutoaocp.org.br")?.name).toBe(
      "Instituto AOCP",
    );
    expect(suggestExaminingBoard("www.institutoaocp.org.br")?.name).toBe("Instituto AOCP");
    expect(suggestExaminingBoard("Organização: AOCP Concursos Públicos")?.name).toBe("AOCP");
  });

  it("suggests other boards and returns null when unknown", () => {
    expect(suggestExaminingBoard("CEBRASPE – Centro Brasileiro")?.name).toBe("Cebraspe");
    expect(suggestExaminingBoard("FUNDATEC - Fundação Universidade Empresa")?.name).toBe("Fundatec");
    expect(suggestExaminingBoard("Exame Nacional do Ensino Médio 2024")?.name).toBe("INEP");
    expect(suggestExaminingBoard("Prefeitura Municipal de Exemplo")).toBeNull();
    expect(suggestExaminingBoard("Instituto Consulplan")?.name).toBe("Instituto Consulplan");
    expect(suggestExaminingBoard("Realização: CONSULPLAN")?.name).toBe("Consulplan");
  });
});
