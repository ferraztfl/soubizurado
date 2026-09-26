# Importação por JSON — padrão `soubizurado.exam.v1`

Formato de troca para importar provas de **qualquer banca** sem escrever um leitor de PDF por
layout. Pode ser gerado por um app no Google AI Studio ([PROMPTS-AI-STUDIO.md](PROMPTS-AI-STUDIO.md)),
por script ou à mão.

## Fluxo

1. Gere o JSON (questões + gabarito aplicado).
2. `/admin/importacoes/nova` → **Importar arquivo JSON**: envie o JSON e, se ele tiver imagens,
   o PDF do caderno.
3. O sistema valida o formato e o conteúdo, recorta as imagens do PDF e abre a **mesma prévia**
   dos leitores de PDF (banca sugerida, concurso, matérias, questões, imagens).
4. Confirme: as questões entram **em revisão**, com deduplicação, mídia no Storage e
   classificação automática. Nada é publicado.

## Regras do formato (validadas no import)

| Regra | Onde |
|---|---|
| Campos desconhecidos são rejeitados (`strict`) | `exam-json.ts` |
| Números de 1 até o maior, sem lacunas nem repetição (`variant` para idiomas) | `validateExamJson` |
| Múltipla escolha: ≥ 2 alternativas, letras únicas A–F, gabarito entre as letras | idem |
| Certo/Errado ou V/F: sem alternativas, gabarito V/F/C/E | idem |
| Um tipo de questão por arquivo | idem |
| `supportTextId` precisa existir; alternativa sem texto precisa de imagem | idem |
| Imagem = `{page, box:[ymin,xmin,ymax,xmax] 0–1000, description}`; exige o PDF | `analyze-exam-json.ts` |

Anuladas: `annulled: true` e `answer: null` — não são importadas (como nos leitores de PDF).

Provas parciais: `exam.partial: true` aceita só algumas questões, com os números **originais**
(sem exigir 1..N). `exam.provenance` registra a origem da transcrição na fonte da questão. Arquivos
parciais da mesma prova (mesma banca, órgão, cargo e ano) usam o mesmo registro de prova.

## Código

- Esquema, validação e conversão (puro): `src/modules/imports/application/official-exams/exam-json.ts`
- Leitura, recorte de imagens (`pdftoppm`) e análise: `src/modules/imports/infrastructure/official-exams/analyze-exam-json.ts`
- Ação do upload: `uploadExamJsonAction` em `src/app/admin/importacoes/actions.ts`
- Formato no leitor: `OFFICIAL_EXAM_READERS.JSON`

Mudanças incompatíveis no formato devem criar `soubizurado.exam.v2`, mantendo o v1 aceito.
