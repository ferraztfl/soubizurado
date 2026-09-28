import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { z } from "zod";

import { noticeExtractionSchema, type NoticeExtraction } from "../domain/notice-extraction";

/*
 * Reads an official notice (edital) PDF and asks the configured AI
 * (CLASSIFIER_API_* — the same OpenAI-compatible endpoint used for
 * classification) for the facts. Server-only. The result is a suggestion
 * the admin reviews; nothing here writes to the database.
 */

const execFileAsync = promisify(execFile);

export const MAX_NOTICE_BYTES = 30 * 1024 * 1024;
const MAX_NOTICE_CHARS = 300_000;
const TIMEOUT_MS = 180_000;

export class NoticeReadError extends Error {}

/** PDF → plain text with pdftotext (poppler). */
export async function readNoticePdf(file: File): Promise<string> {
  if (file.size > MAX_NOTICE_BYTES) throw new NoticeReadError("O PDF passa de 30 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new NoticeReadError("O arquivo não é um PDF.");
  }

  const dir = await mkdtemp(join(tmpdir(), "sb-edital-"));
  try {
    const path = join(dir, "edital.pdf");
    await writeFile(path, bytes);
    const { stdout } = await execFileAsync("pdftotext", ["-enc", "UTF-8", "-layout", path, "-"], {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 64,
      timeout: 60_000,
    });
    const text = stdout.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 500) throw new NoticeReadError("Não consegui ler o texto do PDF (ele pode ser uma imagem escaneada).");
    return text.slice(0, MAX_NOTICE_CHARS);
  } catch (error) {
    if (error instanceof NoticeReadError) throw error;
    throw new NoticeReadError("Não foi possível ler o PDF.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const SYSTEM_PROMPT = `Você lê editais oficiais de concursos públicos brasileiros e devolve SOMENTE um objeto JSON.

Regras:
- Use apenas fatos escritos no edital. Se uma informação não estiver no texto, use null (ou lista vazia). Nunca invente nem estime.
- Datas no formato AAAA-MM-DD. Valores em reais no formato brasileiro, sem "R$" (ex.: "5.617,92").
- "status": use "REGISTRATION_OPEN" se o edital abre inscrições com datas; senão "NOTICE_PUBLISHED".
- "stateCode": sigla da UF do órgão (ex.: "PE"); null se for concurso nacional/federal.
- "boardName": nome da banca organizadora como aparece no edital (ex.: "Instituto AOCP", "Cebraspe", "FGV").
- "positions": um item por cargo, com vagas imediatas (número), "reserve" true se houver cadastro de reserva, salário/remuneração inicial, escolaridade ("fundamental", "médio" ou "superior") e requisitos principais em uma frase curta.
- "salaryMin"/"salaryMax": menor e maior remuneração inicial entre os cargos.
- "stages": etapas da seleção em ordem, com a data quando houver (ex.: "Prova objetiva (31/01/2027)").
- "summary": 2 ou 3 parágrafos curtos, em português, escritos por você, com o essencial (órgão, cargos, vagas, remuneração, inscrições, prova). Sem copiar trechos longos do edital.
- "news": rascunho de notícia ORIGINAL em português do Brasil para um portal de concursos, com:
  "title" (até 110 caracteres, informativo), "excerpt" (até 280 caracteres) e "body" no formato:
  parágrafos separados por linha em branco; "## Subtítulo" sozinho numa linha; uma caixa de resumo começando com a linha
  "!!! resumo <título>" seguida de linhas "- **Rótulo:** valor"; tabelas com linhas "| Cargo | Vagas | Remuneração |"
  (primeira linha é o cabeçalho, depois "|---|---|---|"); e ao final uma linha "!!! atencao Confira sempre o edital"
  seguida de uma frase. Não use HTML. Não prometa nada que não esteja no edital.

Formato exato do JSON:
{"name": string|null, "organizationName": string|null, "stateCode": string|null, "boardName": string|null,
 "status": string|null, "vacancies": number|null, "hasReserveList": boolean|null, "salaryMin": string|null,
 "salaryMax": string|null, "educationLevels": string[], "positions": [{"name": string, "vacancies": number|null,
 "reserve": boolean|null, "salary": string|null, "education": string|null, "requirements": string|null}],
 "registrationStart": string|null, "registrationEnd": string|null, "examDate": string|null, "feeText": string|null,
 "stages": string[], "examLocations": string|null, "summary": string|null,
 "news": {"title": string, "excerpt": string, "body": string} | null}`;

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() }).optional(),
});

export type NoticeAiResult = Readonly<{ extraction: NoticeExtraction; inputTokens: number; outputTokens: number }>;

export function isNoticeAiConfigured(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return Boolean(env.CLASSIFIER_API_BASE_URL?.trim() && env.CLASSIFIER_MODEL?.trim());
}

/** Sends the notice text to the configured AI and validates its JSON answer. */
export async function extractNoticeFacts(noticeText: string, sourceUrl: string | null): Promise<NoticeAiResult> {
  const baseUrl = process.env.CLASSIFIER_API_BASE_URL?.trim();
  const model = process.env.CLASSIFIER_MODEL?.trim();
  const apiKey = process.env.CLASSIFIER_API_KEY?.trim();
  if (!baseUrl || !model) throw new NoticeReadError("A IA não está configurada (CLASSIFIER_API_BASE_URL / CLASSIFIER_MODEL).");
  if (!/^https:\/\//.test(baseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(baseUrl)) {
    throw new NoticeReadError("CLASSIFIER_API_BASE_URL precisa usar https.");
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${sourceUrl ? `Endereço oficial do edital: ${sourceUrl}\n\n` : ""}Texto do edital:\n\n${noticeText}`,
          },
        ],
      }),
    });
  } catch {
    throw new NoticeReadError("A IA não respondeu a tempo. Tente de novo.");
  }

  // The body may echo request data; keep only the status.
  if (response.status === 402 || response.status === 429) {
    throw new NoticeReadError(
      `A IA recusou por cota ou créditos esgotados (HTTP ${response.status}). Confira o faturamento e os limites da chave no painel do provedor (Google AI Studio) e tente de novo.`,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new NoticeReadError(`A chave da IA foi recusada (HTTP ${response.status}). Confira CLASSIFIER_API_KEY no .env.`);
  }
  if (!response.ok) throw new NoticeReadError(`A IA respondeu com erro HTTP ${response.status}.`);

  const completion = completionSchema.safeParse(await response.json());
  const content = completion.success ? completion.data.choices[0]?.message.content : null;
  if (!content) throw new NoticeReadError("A IA devolveu uma resposta vazia.");

  let json: unknown;
  try {
    json = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new NoticeReadError("A IA devolveu um JSON inválido. Tente de novo.");
  }

  const extraction = noticeExtractionSchema.safeParse(json);
  if (!extraction.success) throw new NoticeReadError("A resposta da IA veio fora do formato esperado. Tente de novo.");

  return {
    extraction: extraction.data,
    inputTokens: completion.success ? completion.data.usage?.prompt_tokens ?? 0 : 0,
    outputTokens: completion.success ? completion.data.usage?.completion_tokens ?? 0 : 0,
  };
}
