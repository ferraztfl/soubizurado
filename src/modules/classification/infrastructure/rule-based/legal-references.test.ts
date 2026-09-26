import { describe, expect, it } from "vitest";

import { matchLegalReferences } from "./legal-references";

function topics(text: string): string[] {
  return matchLegalReferences(text).map((hit) => hit.topic);
}

describe("matchLegalReferences", () => {
  it("reads law numbers in the forms found in PDFs", () => {
    expect(topics("à luz da Lei no 11.340/2006, é correto afirmar")).toEqual(["Lei Maria da Penha"]);
    expect(topics("Nos termos da Lei nº 8.072/1990")).toEqual(["Crimes Hediondos"]);
    expect(topics("conforme a Lei n.º 7.210, de 1984")).toEqual(["Lei de Execução Penal"]);
    expect(topics("Lei 11343/06")).toEqual(["Lei de Drogas"]);
    expect(topics("Lei Federal nº 14.133/2021")).toEqual(["Licitações"]);
  });

  it("recognizes statutes cited by name", () => {
    expect(topics("Sobre a Lei dos Crimes Hediondos, assinale")).toEqual(["Crimes Hediondos"]);
    expect(topics("De acordo com o Estatuto do Desarmamento")).toEqual(["Estatuto do Desarmamento"]);
    expect(topics("Nos termos da Lei de Execução Penal (Lei no 7.210/1984)")).toEqual([
      "Lei de Execução Penal",
      "Lei de Execução Penal",
    ]);
  });

  it("maps Constitution articles only when the text is about the Constitution", () => {
    expect(topics("Segundo o art. 5º da Constituição Federal, é garantido")).toEqual([
      "Direitos e Deveres Individuais e Coletivos",
    ]);
    expect(topics("Conforme o artigo 144 da CF/88, a segurança pública")).toEqual(["Segurança Pública"]);
    expect(topics("O art. 5º do regulamento interno prevê")).toEqual([]);
  });

  it("ignores Constitution articles when a specific law is cited", () => {
    expect(topics("O art. 5º da Lei 11.340, à luz da Constituição Federal")).toEqual(["Lei Maria da Penha"]);
  });

  it("maps Código Penal articles and skips ambiguous code mentions", () => {
    expect(topics("Nos termos do art. 121 do Código Penal")).toEqual(["Crimes contra a Pessoa"]);
    expect(topics("O crime do art. 312 do CP (peculato)")).toEqual(["Crimes contra a Administração Pública"]);
    expect(topics("art. 5º do Código de Processo Penal")).toEqual([]);
    expect(topics("art. 9º do Código Penal Militar")).toEqual([]);
    expect(topics("art. 5º da Constituição Federal e art. 121 do Código Penal")).toEqual([]);
  });

  it("ignores unknown laws and plain numbers", () => {
    expect(topics("Lei nº 1.234/2000")).toEqual([]);
    expect(topics("Em 2006, 11.340 pessoas")).toEqual([]);
  });
});
