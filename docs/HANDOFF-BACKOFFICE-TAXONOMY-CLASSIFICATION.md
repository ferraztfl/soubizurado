# Handoff — Backoffice, Taxonomia Canônica e Classificação Automática

**Atualizado em:** 26/09/2026, fim da sessão (estado conferido no banco — ver §1 e §12)
**Branch:** `feature/enem-pdf-ingestion` (contém todas as outras branches, ver §2)
**Documento anterior:** `docs/HANDOFF-ADMIN-QUESTION-BANK.md` (21/09/2026) — continua válido
para ingestão, mídia e regras gerais; este documento registra tudo o que veio depois.

> Para retomar numa nova conversa: leia `CLAUDE.md`, depois este arquivo (comece por §1 e §12),
> depois rode `git status --short`, `git log --oneline -15`, `npm run classification:status`,
> `npm run media:status`. As seções 3–11 são o histórico detalhado; onde divergirem de §1/§12,
> valem §1/§12.

---

## 1. Estado atual em uma página (conferido em 26/09/2026)

| Área | Estado |
|---|---|
| Backoffice `/admin` | Shell protegido (`requireAdminUser`), sidebar com rota ativa, menu móvel, dashboard operacional (KPIs, progresso por disciplina, próximas ações) |
| Revisão editorial | `/admin/questoes/revisao`: fila com filtros (disciplina, classificação, mídia, sugestão, busca) e paginação; detalhe em 2 colunas com sugestão automática, seletor Assunto › Tópico › Subtópico, checklist de publicação. Questões sem disciplina canônica (área apenas ou ENEM legado) oferecem todas as disciplinas da área |
| Central de Importações | `/admin/importacoes` → upload de prova + gabarito PDF → prévia → confirmar. **Leitor suportado: Instituto AOCP** (imagens, anuladas, variantes de idioma, blocos). Fundatec/Cebraspe detectados, sem leitor ainda (§10) |
| Taxonomia | Catálogo **v2** aplicado: 6 áreas do conhecimento, 34 disciplinas no banco (14 ENEM + 12 concursos + 8 legadas/Quest API), 111 assuntos, 446 tópicos, 475 subtópicos; revisões 1 e 2 |
| Questões | **3.093 `IN_REVIEW`, 0 publicadas**, 1 com tópico. Inclui 58 da SEJUSP-MG 2025 e 72 da PMPE 2023 2º Tenente (importadas pela Central) |
| Imagens | **1.963 MediaAssets em `SUPABASE_STORAGE`** (bucket privado `question-media`, 86 MB), 0 em `LOCAL_FS`. `.env`: `MEDIA_STORAGE_DRIVER=supabase` + `SUPABASE_SECRET_KEY`. Fila de mídia: 0 pendentes, 2 FAILED históricos (ENEM 2018 q136, LaTeX — manter) |
| Acesso a mídia | `/api/media/[id]`: publicada = pública/cache imutável; não publicada = só ADMIN (`private, no-store`), demais 404; CSP `sandbox` |
| Classificação | Provedor `openai-compatible` (Gemini) com **`CLASSIFIER_MODEL=gemini-3.5-flash-lite`**. **130 tarefas `oa-v2:gemini-3.5-flash-lite` PENDENTES** (58 SEJUSP + 72 PMPE Tenente) — rodar `classification:process`. Rodadas antigas: `rule-based-v1` (2.928), `oa-v1`/`oa-v2:gemini-flash-latest` (encerradas, FAILED "superseded") |
| Cota Gemini | `gemini-flash-latest` = 20 req/dia no plano grátis (inviável). `gemini-3.5-flash-lite` tem cota separada (limite diário exato desconhecido; usar `--rpm=4`) |
| Git | Tudo commitado e enviado até `e7f921e` + docs desta atualização. PR `main ← feature/enem-pdf-ingestion` ainda não aberto (usuário abre no GitHub; `gh` não instalado) |

---

## 2. Git e branches

Commits desta etapa (mais novo primeiro), todos enviados ao GitHub:

```
14e1214 feat(classification): add bulk apply and free-tier friendly processing
96aae91 docs(env): document question classifier settings
c518e06 feat(classification): add vendor-neutral question classifier and queue
cd9c630 feat(admin): add review queue filters and subtopic classification
c2fc393 feat(taxonomy): add deterministic legacy ENEM taxonomy backfill
11c50d3 fix(imports): stop importers from creating or rewriting taxonomy
9eff6bc feat(taxonomy): add canonical taxonomy foundation and ENEM catalog v1
ec88bb2 feat(admin): move question review into the backoffice
70739ab fix(app): restore sticky student topbar styles
6a5a8be feat(admin): add responsive navigation and legible type scale
cf2305e feat(admin): add active sidebar navigation and compact dashboard
```

**Consolidação:** todas as branches remotas (`main`, `develop`, `feature/enem-ingestion`,
`feature/design-system-app-shell`, `feature/question-bank-application`,
`feature/question-explorer`, `feature/question-ingestion-foundation`,
`feature/study-foundation`) são ancestrais de `feature/enem-pdf-ingestion`.
A exceção, `feature/question-review-taxonomy` (32 commits de uma implementação alternativa
de revisão), foi preservada na tag **`archive/question-review-taxonomy`** (→ `21ce289`).

**Pendente do usuário:** abrir o PR `main ← feature/enem-pdf-ingestion` no GitHub
(o `gh` CLI não está instalado). Depois do merge, as branches antigas podem ser apagadas.

**Observação:** o repositório é **público** no GitHub. `.env` e `data-private/` são ignorados.

---

## 3. Banco de dados

### Migrations (11, todas aplicadas)

As 9 anteriores + duas novas, ambas **aditivas**:

- `20260925220000_canonical_taxonomy_foundation`
  - `knowledge_areas` (áreas ENEM/BNCC), ligada a `disciplines.knowledge_area_id` e `questions.knowledge_area_id`
  - `discipline_aliases`, `area_aliases`, `topic_aliases`, `subtopic_aliases` (nome normalizado único por escopo)
  - `taxonomy_revisions` (versão monotônica da taxonomia)
  - FKs compostas `ON UPDATE RESTRICT`: assunto/tópico da questão ⊂ disciplina da questão; subtópico ⊂ tópico. `CHECK`s cobrem colunas NULL (MATCH SIMPLE)
- `20260926000000_question_classification_queue`
  - `question_classification_tasks` (fila de classificação; única por questão + versão do classificador + versão da taxonomia)

RLS habilitada em **todas** as tabelas (acesso só server-side via Prisma).

### Semântica da taxonomia

```
KnowledgeArea (Área do conhecimento, ex.: "Ciências Humanas e suas Tecnologias")
  └── Discipline (Disciplina real, ex.: História)
        └── Area (exibida como "Assunto", ex.: História do Brasil)
              └── Topic (Tópico, ex.: Era Vargas)
                    └── Subtopic (Subtópico)
```

Ano, banca, órgão, cargo e prova ficam em `Examination` / `ExaminingBoard` (já existiam).

**Disciplinas legadas:** as 4 "disciplinas" antigas do ENEM (`ciencias-humanas-e-suas-tecnologias`,
`ciencias-da-natureza-e-suas-tecnologias`, `linguagens-codigos-e-suas-tecnologias`,
`matematica-e-suas-tecnologias`) são na verdade áreas do conhecimento. Continuam no banco
(sem `knowledge_area_id`) porque ainda há questões nelas. As 4 disciplinas da Quest API
(Nutrição etc., 35 questões) ficam fora do catálogo canônico.

### Distribuição atual das 2963 questões (todas `IN_REVIEW`)

| Disciplina | Questões |
|---|---|
| Ciências Humanas (legada) | 844 |
| Matemática | 685 |
| Ciências da Natureza (legada) | 662 |
| Linguagens (legada) | 608 |
| Língua Espanhola | 67 |
| Língua Inglesa | 62 |
| Nutrição e afins (Quest API) | 35 |

---

## 4. Módulos novos / alterados

### `src/modules/taxonomy`
- `domain/taxonomy-term.ts` — `normalizeTaxonomyTerm` / `toTaxonomySlug` (acentos, caixa, pontuação, ordinais). **Regra única** de comparação de nomes e aliases.
- `domain/canonical-taxonomy-catalog.ts` — tipos do catálogo + validação que rejeita duplicata semântica por escopo.
- `infrastructure/catalog/enem-canonical-taxonomy-v1.ts` — **o catálogo**. Regras de edição no topo do arquivo (nunca renomear/remover entrada ligada a questões; sinônimos viram alias; incrementar `version`). Um teste valida o catálogo inteiro.
- `application/build-taxonomy-seed-plan.ts` + `infrastructure/prisma-taxonomy-seed-repository.ts` — seed **create-only** e idempotente.
- `application/legacy-enem-taxonomy-backfill.ts` + `infrastructure/prisma-legacy-taxonomy-backfill.ts` — reclassificação determinística das disciplinas legadas.

### `src/modules/classification`
- `domain/question-classifier.ts` — porta `QuestionClassifier` (vendor-neutral). Provider devolve **nomes**, nunca ids.
- `domain/taxonomy-index.ts` — visão da taxonomia **ativa**; candidatos = disciplina canônica atual, senão disciplinas da área do conhecimento.
- `domain/resolve-classification.ts` — converte nomes → ids dentro dos candidatos, com códigos de pendência tipados; nunca cria taxonomia. `decideClassificationStatus` → `COMPLETED` (confiante e completa) ou `REVIEW_REQUIRED`.
- `infrastructure/rule-based/*` — classificador por regras (padrão, sem rede). Qualidade **mista**; confiança limitada a 0,9. Serve como linha de base/fallback.
- `infrastructure/openai-compatible/*` — adaptador para APIs `chat/completions` (OpenAI, Gemini, OpenRouter, Groq, vLLM, Ollama). Prompt restrito à taxonomia candidata, JSON validado com zod, https obrigatório (exceto localhost). Versão = `oa-v1:<modelo>`.
- `application/process-classification-queue.ts` — processamento no padrão da fila de mídia (claim `SKIP LOCKED`, recuperação de travadas, backoff exponencial, concorrência limitada, limitador de requisições por minuto).
- `infrastructure/apply-classification-suggestion.ts` — **função única** de aplicação de sugestão, usada pela tela e pelo script em massa (revalida contra a taxonomia atual, mudança de disciplina só dentro da mesma área do conhecimento, guarda `IN_REVIEW` + disciplina, marca quem aplicou). **Nunca publica.**

### `src/modules/imports`
- O importador **não renomeia nem reativa** disciplinas existentes e **não cria tópicos**: tópicos são resolvidos só por slug canônico ou alias ativo; sem correspondência → questão sem tópico → revisão.

### `src/app/admin`
- `layout.tsx` (requireAdminUser) → `admin-shell.tsx` (topbar + drawer) → `admin-sidebar.tsx` (rota ativa via `usePathname`).
- `page.tsx` — dashboard.
- `questoes/revisao/page.tsx` — fila: filtros (disciplina, classificação, mídia, sugestão, busca), contagem real, 25 por página.
- `questoes/revisao/[questionId]/page.tsx` + `actions.ts` — detalhe: sugestão automática, seletor agrupado por assunto com subtópicos, publicação. Actions: `saveQuestionClassificationAction`, `applyClassificationSuggestionAction`, `publishQuestionAction` — todas com `requireAdminUser` e guardas server-side.

### `src/modules/question-bank/presentation`
- `review-queue-search-params.ts`, `question-classification-choice.ts` (valor `topic:<id>` / `subtopic:<id>` do seletor).

---

## 5. Scripts operacionais

| Comando | O que faz | Escreve no banco? |
|---|---|---|
| `npm run taxonomy:seed` | Plano do catálogo canônico (dry-run) | não |
| `npm run taxonomy:seed -- --apply` | Cria o que falta do catálogo (idempotente) | sim, só cria |
| `npm run taxonomy:backfill-legacy` | Plano da reclassificação legada | não |
| `npm run taxonomy:backfill-legacy -- --apply` | Aplica; log em `data-private/backfills/` | sim |
| `npm run classification:enqueue [-- --apply] [--limit=N]` | Enfileira questões sem tópico (dry-run por padrão) | só tarefas |
| `npm run classification:process -- --limit=500 [--rpm=8]` | Processa a fila; grava **só sugestões** | só tarefas |
| `npm run classification:status` | Resumo da fila | não |
| `npm run classification:apply [-- --apply] [--min-confidence=0.9]` | Aplica em massa sugestões `COMPLETED` acima do limite, só em questões sem tópico; log em `data-private/classification-applies/` | sim (classificação, nunca publica) |

Logs de reversão existentes: `data-private/backfills/legacy-taxonomy-2026-09-25T22-35-56-653Z.json`.

---

## 6. Configuração do classificador (`.env`, server-only)

Documentado em `.env.example`. Para o Gemini gratuito (Google AI Studio):

```
CLASSIFIER_PROVIDER=openai-compatible
CLASSIFIER_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
CLASSIFIER_API_KEY=<chave criada pelo usuário — nunca commitar nem colar no chat>
CLASSIFIER_MODEL=gemini-flash-latest
CLASSIFIER_PROVIDER_LABEL=gemini
CLASSIFIER_REQUESTS_PER_MINUTE=4
CLASSIFIER_MIN_CONFIDENCE=0.8
```

Validado em 26/09/2026 com a chave do usuário (lista de modelos via `GET /v1beta/openai/models`):
`gemini-flash-latest` e `gemini-3.5-flash-lite` respondem JSON; `gemini-2.5-flash` não está
disponível para contas novas; `gemini-3.x-flash` retornavam 503 (alta demanda) no momento.
A 8 req/min o plano grátis devolveu 29× HTTP 429 e 13× HTTP 503 em 50 tarefas — usar
`--rpm=4 --concurrency=1`. Tarefas com erro voltam sozinhas à fila (backoff).

Sem essas variáveis, o padrão é `rule-based`. O texto das questões (conteúdo público do ENEM)
é enviado ao provedor configurado. As imagens ainda **não** são enviadas.

---

## 7. Plano combinado para a classificação por IA

1. ✅ Usuário configurou o `.env` (§6).
2. ✅ Teste `oa-v1`: das 8 concluídas, 7 plausíveis; 1 falhou por confusão de níveis no prompt
   (modelo devolveu o assunto como tópico). Prompt corrigido para rotular
   DISCIPLINA/ASSUNTO/TÓPICO/SUBTÓPICOS → versão `oa-v2`. As 42 pendentes da v1 foram
   marcadas FAILED ("Superseded by oa-v2"). Teste `oa-v2` com as mesmas 50 questões:
   `classification:process -- --limit=50 --concurrency=1 --rpm=4`; auditar o resultado.
   Resultado `oa-v2`: 0 concluídas, 50 com 429 (cota diária de 20 esgotada). As 50 tarefas
   `oa-v2:gemini-flash-latest` continuam PENDING; ao trocar de modelo, marcá-las FAILED
   ("superseded") como feito com a v1 e reenfileirar.
3. Se boa: enfileirar o restante e processar (retomar em dias seguintes se a cota diária acabar).
4. `classification:apply` (dry-run → `--apply`). Baixa confiança permanece em revisão.
5. Publicação em lote **somente** das que passam em `validateQuestionForPublication` — confirmar
   com o usuário antes (é o passo que expõe conteúdo aos alunos). Ainda não implementado.

---

## 8. Regras e armadilhas aprendidas

- **Depois de `npm run db:generate`, reinicie o `npm run dev`**: o Prisma Client fica em cache em `globalThis` e o servidor quebra com "Unknown field".
- **CSS modules não podem começar com BOM UTF-8**: o bundler descarta a primeira regra do arquivo. Já corrigido em `admin/layout.module.css`, `admin/page.module.css` e `student-topbar.module.css`.
- Nunca aplicar sugestões automaticamente sem passar por `applyClassificationSuggestion`.
- Nunca publicar fora de `publishQuestionAction` / política de publicação.
- Classificador nunca cria taxonomia; importador também não.
- Toda gravação em massa: dry-run primeiro, log de reversão em `data-private/`, transação/guardas.
- Os 2 `ImportMediaTask` FAILED do ENEM 2018 q136 (LaTeX) continuam intocados de propósito.
- `git push` às vezes demora mais de 2 minutos nesta máquina; rodar em segundo plano e conferir com `git ls-remote`.

---

## 9. Débitos conhecidos / próximos itens

- **Importação AOCP (próximo):** arquivos em `data-private/87762278-2c7e-4eee-bc79-731fd6076461{,-gabarito}.pdf`
  (SEJUSP-MG, Edital 01/2025, Policial Penal Fem./Masc., nível médio, Tipo 01, Instituto AOCP).
  60 questões: Língua Portuguesa 10, Informática Básica 5, Noções de Direito 10, Direitos
  Humanos 10, Legislação Especial 20, Raciocínio Lógico 5. Q58 anulada (gabarito "X").
  Q3, 4, 6, 7, 8, 9 citam "termo destacado" — sublinhado não é extraível; conferir no PDF.
  Falta: (1) catálogo de disciplinas de concurso (Direito Constitucional, Administrativo,
  Penal, Processual Penal, Legislação Penal Especial/Execução Penal, Direitos Humanos,
  Informática, Raciocínio Lógico) — hoje o catálogo só tem ENEM; (2) provider `QuestionProvider`
  AOCP + script de importação com metadados (banca, órgão, cargo, ano, edital) via CLI.
- **Mais provas AOCP em `data-private/`** (lidas sem problemas estruturais, ainda não importadas):
  - `1b343118-73f4-4014-9c62-94be3c85fd1d{,-gabarito}.pdf` — PMPE 2023 (Portaria Conjunta SAD/SDS
    83/2023), Soldado, nível médio, manhã, prova 01: 60 questões, 5 alternativas, blocos I–III
    (Língua Portuguesa, História de Pernambuco, Raciocínio Lógico, Informática, Direito
    Constitucional, Extravagante). Anuladas: 11, 16, 19, 37, 40, 53.
  - `5d5d7b61-b355-4af3-b50c-d6aceb15601e{,-gabarito}.pdf` — PMPE 2023, 2º Tenente, nível superior,
    tarde, prova 01: 70 questões + 5 variantes de Espanhol (11–15 repetem numeração de Inglês;
    gabarito lista ambas em ordem). 13 disciplinas (inclui Estatística, Direito Penal Militar,
    Processual Penal Militar). Anuladas: 7, 13 (Espanhol), 36.
  - O parser trata "BLOCO" como grupo, disciplinas como seção, variantes de idioma
    (`variant` + `answerFor`) e ignora dígitos em negrito de tabelas.
- Scraping de bancos de terceiros (ex.: Gran Cursos) foi **descartado**: termos de uso e proteção
  de base de dados/compilação. Fonte correta = PDFs oficiais publicados pelas bancas.

- Formatação inline: `src/shared/ui/inline-markdown.ts` + `rich-text.tsx` (negrito, itálico, links http; imagens Markdown removidas porque já aparecem via QuestionMedia). 26 referências de imagem `enem.dev` em textos de apoio não têm cópia local (pendência de mídia).
- Dashboard `/admin` refeito com indicadores operacionais, progresso por disciplina e próximas ações.
- UI/UX: detalhe da revisão redesenhado (duas colunas, painel de ações fixo, checklist de publicação, rótulos em português). Rótulos de enums ficam em `src/modules/question-bank/presentation/question-labels.ts` — **nunca renderizar valores crus como `IN_REVIEW`**; usar `labelFor(...)`. Próximas telas a polir: dashboard e fila (já usam tokens, mas podem ganhar componentes compartilhados de badge/card).
- Enunciados importados contêm marcações cruas de Markdown (`**negrito**`, `_itálico_`); falta um renderizador seguro de formatação inline (admin e área do aluno).
- `/api/media/[id]` serve mídia de questão não publicada a quem souber o UUID, e há 1 SVG servido no mesmo domínio sem CSP (hardening pendente).
- Enviar imagens das questões ao classificador (melhora questões com gráfico/mapa).
- `/admin/questoes` (lista geral), `/admin/questoes/nova`, `/admin/importacoes`, `/admin/taxonomia`, `/admin/midias`, `/admin/usuarios` ainda não existem.
- Publicação em lote respeitando a política.
- Deduplicar lógica de consultas Prisma nas páginas admin (hoje direto na página) quando houver repositórios de backoffice.

---

## 10. Central de Importações de provas oficiais (26/09/2026)

Fluxo: `/admin/importacoes` → **Nova importação** (upload do caderno + gabarito oficial em PDF)
→ análise automática → **prévia** `/admin/importacoes/nova/[uploadId]` → confirmar → questões
entram `IN_REVIEW` (nunca publicadas) → imagens processadas → classificação enfileirada.

- Arquivos e análise ficam em `data-private/imports/official-exams/<uuid>/` (prova.pdf,
  gabarito.pdf, workspace/ com imagens extraídas, analysis.json, result.json).
- Banca detectada pela capa. **Suportada: Instituto AOCP.** Fundatec e Cebraspe são detectadas e a
  prévia avisa que ainda não há leitor. Marca d'água do PCI Concursos é removida.
- Anuladas (gabarito "X") aparecem na prévia e **não são importadas**. Variantes de idioma
  (Inglês/Espanhol com mesma numeração) viram questões distintas (`12-v2`).
- Imagens do enunciado, das alternativas e do texto de apoio são extraídas (`pdftohtml` sem `-i`),
  staged em `data-private/media-staging/official-exams/...` e armazenadas pela fila de mídia.
- Seções → taxonomia por `resolveExamSection` (alias/nome contido/área); a prévia permite ajustar.
  Seções genéricas ("Noções de Direito") ficam só com a **área**; a revisão oferece todas as
  disciplinas da área e a sugestão da IA pode definir a disciplina.
- Questões que citam "termo destacado/sublinhado" são sinalizadas (sublinhado não é extraível).
- Código: `src/modules/imports/application/official-exams/*`,
  `src/modules/imports/infrastructure/official-exams/*`, `src/app/admin/importacoes/*`,
  rota de prévia de imagem `src/app/api/admin/official-exams/[uploadId]/media/[file]`.
- CLI equivalente: `npm run import:official-exam -- --prova=<pdf> --gabarito=<pdf>` (só analisa;
  confirmação na prévia).
- `next.config.ts`: `serverActions.bodySizeLimit` e `proxyClientMaxBodySize` = 40mb (o proxy
  trunca silenciosamente acima de 10MB). Reiniciar `npm run dev` após mudar o config.

**Importado até agora:** SEJUSP-MG 2025 Policial Penal (AOCP): 58 questões (Q58 anulada; Q20
retida como `POSSIBLE_DUPLICATE` por ter enunciado idêntico ao de outra questão, com alternativas
diferentes — falta UI para resolver duplicatas). 58 tarefas de classificação enfileiradas.

**Ainda não importadas (PDFs em `data-private/`):** PMPE 2023 Soldado e 2º Tenente (AOCP, prontos
para a tela), ALRS 2024 Agente de Polícia Legislativa (Fundatec) e PF 2025 Agente (Cebraspe,
Certo/Errado; gabarito em `gabarito.pdf` com todos os cargos: Agente = cadernos CB2 1–60,
CG1 61–96, cargo 16 97–120). Gabaritos da Fundatec e do Cebraspe recebidos são **preliminares**.

**Taxonomia v2 aplicada** (catálogo `canonical-taxonomy.ts`): + Ciências Jurídicas e Tecnologia da
Informação; 12 disciplinas de concurso; aliases para nomes de seção das bancas.

**Próximos passos:** leitor Fundatec (simples; gabarito traz a disciplina de cada questão);
leitor Cebraspe (Certo/Errado); tela para resolver `POSSIBLE_DUPLICATE`; mostrar na revisão o aviso
de "termo destacado" vindo do `rawPayload`; configurar IA com cota adequada para classificar.

---

## 11. Armazenamento de mídia para produção (26/09/2026)

- Bytes das imagens **não** ficam no Postgres: `media_assets` guarda metadados (provider, bucket,
  storageKey content-addressed `sha256/..`, checksum, mime, tamanho) e os links com questões/alternativas.
- Providers suportados na leitura: `LOCAL_FS` (`data-private/media-store`) e `SUPABASE_STORAGE`
  (bucket **privado**, padrão `question-media`). Escrita escolhida por `MEDIA_STORAGE_DRIVER`
  (`local` padrão | `supabase`). Código: `src/shared/infrastructure/media-storage/*`,
  `src/modules/imports/infrastructure/media/create-media-storage.ts`.
- Chave: `SUPABASE_SECRET_KEY` (sb_secret_…, substituta do service_role) **somente no servidor**
  (.env local e variáveis do hosting). Nunca `NEXT_PUBLIC_`.
- Migração: `npm run media:migrate-supabase` (dry-run valida tamanho+sha256 de cada arquivo local);
  `-- --apply` garante bucket privado, envia, baixa de volta e reconfere o sha256 antes de trocar o
  asset para `SUPABASE_STORAGE`. Retomável; não apaga arquivos locais.
- `/api/media/[id]`: mídia de questão publicada = pública com cache imutável; mídia só de questões
  não publicadas = somente ADMIN (`isCurrentUserAdmin`, sem bootstrap), `private, no-store`, demais 404;
  CSP com `sandbox` em toda resposta (neutraliza SVG); id inválido = 404.
- **Estado:** código pronto; aguardando o usuário criar a chave secreta e rodar a migração. Enquanto
  isso tudo continua em `LOCAL_FS`.

---

## 12. Fim da sessão de 26/09/2026 — de onde continuar

### Feito e verificado nesta sessão (em ordem)
1. Backoffice: sidebar ativa, menu móvel, rótulos pt-BR, dashboard operacional, formatação segura de
   texto (`RichText`: negrito/itálico/links; imagens Markdown removidas pois já vêm via QuestionMedia).
2. Revisão migrada para `/admin/questoes/revisao` com filtros, sugestões, seletor com subtópicos.
3. Taxonomia canônica v1 (ENEM) + v2 (concursos) aplicadas; reclassificação legada aplicada.
4. Classificador vendor-neutral + fila + aplicação em lote (`classification:apply`) — nada é aplicado
   automaticamente sem passar por `applyClassificationSuggestion`.
5. Central de Importações de provas oficiais (AOCP) com imagens e anuladas; SEJUSP-MG 2025 e PMPE 2023
   Tenente importadas.
6. Mídia migrada para Supabase Storage privado (1.963/1.963, sha256 conferido após upload);
   endurecimento do `/api/media`. Corrigida corrida na fila de mídia (mesma imagem em 2 questões).

### Pendências abertas (ordem sugerida)
1. **Classificar as 130 questões importadas:** `npm run classification:process -- --limit=130 --concurrency=1 --rpm=4`;
   auditar ~20 sugestões (texto da questão × sugestão); se boas, `npm run classification:apply` (dry-run
   → `--apply`). Depois considerar enfileirar as ~2.900 antigas (`classification:enqueue -- --apply`).
2. **Importar PMPE 2023 Soldado** pela Central (PDFs `data-private/1b343118-…{,-gabarito}.pdf`, AOCP, pronto).
3. **Leitor Fundatec** (ALRS 2024 Agente de Polícia Legislativa: `data-private/agente_de_policia_legislativo.pdf`
   + `gabaritos_preliminares.pdf`, Cargo 1; gabarito traz a disciplina de cada questão).
4. **Leitor Cebraspe** (PF 2025 Agente, Certo/Errado: `data-private/agente_de_policia_federal.pdf` +
   `gabarito.pdf`; Agente = CB2 itens 1–60, CG1 61–96, cargo 16 97–120). Gabaritos recebidos são preliminares.
5. Tela para resolver `POSSIBLE_DUPLICATE` (SEJUSP Q20 retida: enunciado idêntico, alternativas diferentes).
6. Mostrar na revisão o aviso "termo destacado" (hoje só na prévia; está em `ImportItem.rawPayload.refersToHighlight`).
7. Publicação em lote respeitando a política (confirmar com o usuário antes — expõe conteúdo aos alunos).
8. Abrir o PR para `main`; configurar `SUPABASE_SECRET_KEY` e `MEDIA_STORAGE_DRIVER=supabase` também no hosting.

### Armadilhas desta sessão (evitar repetir)
- **Não editar arquivos TS/TSX via heredoc Python com barras invertidas** (`\n`, `\b`, `\s`): o shell/Python
  converteu escapes em caracteres de controle (backspace/quebra real) e quebrou regex/strings. Usar a
  ferramenta Edit/Write, ou um script em arquivo que recusa gravar caracteres de controle
  (padrão usado: `splice.py` que aborta se encontrar `[\x00-\x08\x0b\x0c\x0e-\x1f]`).
- Gate de commit: usar o **código de saída** de `npm run lint -- --max-warnings=0` (grep por "warning"
  dá falso positivo com o nome da flag).
- `pdftohtml` **sem** `-i` (com `-i` as imagens são ignoradas).
- Reiniciar `npm run dev` após `db:generate`, após mudar `next.config.ts` e após mudar variáveis do `.env`.
- Navegadores podem ter guardado respostas antigas de `/api/media` com `public, immutable` (rota antiga);
  o servidor atual responde `private, no-store` para mídia não publicada — use `cache: 'no-store'` ao testar.
- `git push` pode demorar >2 min nesta máquina: rodar em segundo plano e conferir com `git ls-remote`.

---

## 13. Continuação de 26/09/2026 (tarde) — edição, bancas e nomenclatura

Vale sobre §1/§12 onde divergir.

### Feito
1. **Alternativas só com imagem** passam na política de publicação (`mediaCount` em
   `PublicationAlternative`). Commit `e1658e8`.
2. **Edição de questões** — `/admin/questoes/[id]/editar` (botão "Editar conteúdo" na revisão):
   enunciado, texto das alternativas e gabarito, para questões em revisão **e publicadas**.
   Regras puras em `question-bank/domain/question-content-edit.ts` (testadas). Motivo obrigatório,
   confirmação explícita para trocar gabarito de publicada, revalidação da política, concorrência
   otimista por `updatedAt`. Cada gravação cria `question_revisions` (antes/depois, editor, motivo) —
   migration aditiva `20260927000000_question_revisions` **aplicada** (RLS ligada). Letras/ordem das
   alternativas nunca mudam (tentativas de alunos apontam para elas). Commit `3af9169`.
3. **Bancas** — catálogo `question-bank/domain/examining-board-catalog.ts`. "Instituto AOCP" e
   "AOCP" são **bancas diferentes** (pedido do usuário). `npm run boards:seed` (dry-run/`--apply`)
   **aplicado**: 13 bancas criadas, siglas/sites preenchidos, as 16 provas ENEM ligadas a **INEP**
   (log em `data-private/backfills/examining-boards-*.json`).
   - Importação: o *leitor* (`OFFICIAL_EXAM_READERS`: formato AOCP/Fundatec/Cebraspe) **não é a banca**.
     A prévia exige escolher a banca (sugerida pelo texto da capa; `analysis.suggestedBoardSlug`).
     A chave do leitor continua no slug da prova para reimportação idempotente.
   - Política de publicação: fonte ≠ `ORIGINAL` exige prova com banca e ano
     (`EXAMINATION_REQUIRED`, `BOARD_REQUIRED`, `YEAR_REQUIRED`). Commit `9fbda26`.
4. **Nomenclatura (só rótulos, sem mudança de dados)** — decisão do usuário:
   `Discipline` = **Matéria**, `Area` = **Tópico**, `Topic` = **Subtópico**, `Subtopic` = **Detalhe**.
   Publicação continua exigindo `topicId` (= Subtópico). O prompt do classificador mantém os
   rótulos internos (DISCIPLINA/ASSUNTO/TÓPICO) — mudar exigiria nova versão `oa-v3`.
   ENEM: 4 macroáreas oficiais como filtro principal; matérias internas para estudo. Commit `dee54fe`.

### Pendências novas (antes das de §12)
1. Lista **"Todas as questões"** (`/admin/questoes`) com filtros por situação/banca/ano — único jeito
   de achar publicadas para editar.
2. Trocar classificação de questões publicadas; trocar/adicionar imagens; editar dados da origem.
3. Aluno: exibir órgão e cargo em linhas próprias; filtro por macroárea para ENEM.
4. Tela de administração de bancas (hoje só pelo catálogo + `boards:seed`).
5. As 35 questões A.C.Camargo (VUNESP) vieram da Quest API, não de PDF oficial — conferir origem.

### 13.1 Esteira de classificação em camadas (26/09/2026, fim da tarde)
- **Camada 1 (metadados):** o importador fixa a Matéria (seção do caderno) — restringe as demais
  camadas; questões que já têm Subtópico nem entram na fila.
- **Camada 2 (regras):** `RuleBasedQuestionClassifier` (palavras-chave + nomes/aliases da taxonomia).
- **Camada 3 (IA):** só quando as regras não resolvem com confiança ≥ `CLASSIFIER_RULES_THRESHOLD`.
- `LayeredQuestionClassifier` (versão `lay1:<versão da IA>`) é o padrão com `openai-compatible`
  (`CLASSIFIER_LAYERED=false` volta à IA pura). `rawResult.provider.layer` registra RULES/AI.
- **Limite das regras = 0,8** (o usuário propôs 0,6; teste real mostrou regra a 0,625 mandando questão
  da Era Vargas para Geografia, e nesse intervalo a questão não era gravada nem ia à IA). Configurável.
  Calibração: `npm run classification:calibrate-rules` (somente leitura).
- **Gravação automática** (decisão do usuário): status COMPLETED (≥ `CLASSIFIER_MIN_CONFIDENCE`, 0,8)
  é aplicado via `applyClassificationSuggestion` (só questões em revisão e sem classificação; nunca
  publica). Desligar: `CLASSIFIER_AUTO_APPLY=false` ou `classification:process -- --no-auto-apply`.
  Desfazer: tarefas com `applied_at` preenchido e `applied_by_profile_id` NULO foram aplicadas pela esteira.
- O limite de requisições por minuto vale só para chamadas à IA (`beforeRemoteCall`).
- **Na importação:** após confirmar, `after()` roda `runClassificationBatch` em segundo plano
  (em hospedagem serverless pode ser interrompido; o que sobrar fica na fila para `classification:process`).
- Aplicado nesta sessão: 122 sugestões `oa-v2` (lote das 130 importadas) e teste de 10 questões ENEM
  com a esteira (1 pelas regras, 9 pela IA, 8 gravadas).
- **Próximo passo sugerido:** enfileirar as ~2.925 restantes (`classification:enqueue -- --apply`) e
  processar em lotes respeitando a cota diária do Gemini.
- Bancas: catálogo com 40 bancas + tela `/admin/bancas` (nome imutável; desativar em vez de renomear).

### 13.2 Regras de referência legal, botão e IA local (26/09/2026, noite)
- **Regras `rule-based-v2`** (`rule-based/legal-references.ts`): número de lei (aceita "Lei no 11.340"
  do texto de PDF), leis citadas por nome, artigos da CF e do Código Penal → Subtópicos existentes.
  Calibração: 15 de 131 resolvidas a ≥0,8 (antes 1), 100% corretas. Ampliar o mapa `LAWS` quando novas
  provas trouxerem outras leis (sempre para Subtópicos que já existem).
- **`/admin/classificacao`**: botão "Classificar pendentes" → `classification-run-manager.ts` enfileira
  todas as pendentes e processa em lotes de 20 em segundo plano (estado em memória no processo do
  servidor; para em fila vazia, cota esgotada ou "Interromper"). **Não foi clicado nesta sessão** —
  decisão do usuário (≈2.927 questões, consome cota do Gemini).
- **IA local opcional** (Ollama): `CLASSIFIER_LOCAL_API_BASE_URL` (só localhost) + `CLASSIFIER_LOCAL_MODEL`;
  limite próprio `CLASSIFIER_LOCAL_THRESHOLD` (0,9); falha/offline → pula para o Gemini. Versão da esteira
  vira `lay2:<local>><remoto>` (tarefas antigas `lay1` continuam válidas para a configuração sem IA local).
  Máquina do usuário: Ryzen 3 4350G, 11 GB RAM, sem GPU dedicada → só modelos ~3B, lentos (~30–90 s/questão).
  Ollama **ainda não instalado** (download precisa de aprovação explícita do usuário).

### 13.3 Rodada completa, custo real e testes de prompt (26/09/2026, manhã)
- **Botão usado:** ENEM + restantes classificadas com regras → Gemini (`gemini-3.5-flash-lite`, nível pago,
  60 req/min, concorrência 4): 2.871 processadas em ~50 min, 2.731 gravadas, 17 pelas regras, 140 para revisão,
  0 falhas (4 "fetch failed" reprocessadas; corrigido o fim prematuro com retries pendentes). Restam **144**
  sem classificação (59 com sugestão pronta, 85 sem subtópico sugerido). Nada publicado.
- **Custo real:** R$ 16,07 (6,37 M tokens entrada, 0,45 M saída) → ~US$ 0,30/M entrada e ~US$ 2,40/M saída
  (deduzido da fatura; a estimativa inicial de ~US$ 0,10/M estava errada). ≈ R$ 0,006 por questão.
  Conta pré-paga (limite = saldo). `.env` do usuário: `CLASSIFIER_MAX_AI_CALLS_PER_RUN=3000` (voltar a 500).
- **IA local (Ollama `qwen2.5:3b`) reprovada:** 33% de acerto com confiança 0,95 declarada; ~38 s/questão.
  Linhas `CLASSIFIER_LOCAL_*` comentadas no `.env`. Modelo continua instalado.
- **Testes de prompt (mesmas 50 questões, Matéria oculta, referência = classificação gravada):**
  | estilo | concordância | ≥0,95 | tokens entrada+saída | custo relativo |
  |---|---|---|---|---|
  | `labelled` (v2, padrão) | 88% | 94% | 2.399 + 157 | 100% |
  | `labelled-short` (v4) | 84% | 91% | 2.395 + 82 | ~83% |
  | `compact` (v3) | 66% | 83% | 1.084 + 57 | ~44% |
  Decisão: manter `labelled`. A lista de Detalhes ajuda a IA a escolher o Subtópico; ENEM não pode ser
  restrito a uma Matéria (regras erram a Matéria do ENEM em 20–35%). Ferramentas: `classification:calibrate-ai`
  (paga, somente leitura) e `classification:calibrate-rules` (grátis).

### 13.4 Leitor V/F e importação por JSON (26/09/2026, tarde)
- **Leitor `AOCP_VF`** (`aocp-true-false-parser.ts`): cadernos Instituto AOCP "julgue como VERDADEIRO ou
  FALSO" (UFBA 2016). Gabarito com todos os cargos → cargo = linha da capa que casa com um único bloco.
  Testado com os PDFs reais (85/85). Prévia pronta no upload `85838b76-…` — **importação não confirmada**.
- **Importação por JSON** (`soubizurado.exam.v1`): `exam-json.ts` + `analyze-exam-json.ts`; imagens =
  página + caixa 0–1000, recortadas do PDF com `pdftoppm`. Prompts e esquema para um app no Google AI
  Studio em `docs/importacao-json/`. Próximo passo possível: embutir a conversão (Gemini com PDF) no /admin.
- Simulados exportados da Gran Cursos (ex.: "INSTITUTO AOCP - 2010 - COM GABARITO.pdf") **não** são
  importados (regra de fontes); usar como lista para baixar as provas oficiais.
- Testes de "IA treinada": Naive Bayes 31%; vizinhos TF-IDF 42% (93% de acerto com confiança ≥0,7, cobrindo
  11%). Candidato a camada grátis antes do Gemini; embeddings locais (Ollama) ainda não medidos.

### 13.5 Importação em lote (26/09/2026, fim da tarde)
- `/admin/importacoes/lote`: pasta de entrada `data-private/imports/lote-entrada/` (subpasta por prova ou
  `prova.pdf` + `prova-gabarito.pdf`; gabarito único na raiz vale para subpastas sem gabarito). "Ler pasta"
  analisa em segundo plano (manifesto em `data-private/imports/lotes/<id>/lote.json`, originais movidos para
  `…/originais`); "Importar todas as prontas" importa em sequência e classifica uma vez no fim.
- Confirmação compartilhada: `confirm-official-exam-import.ts` (usada pela prévia individual e pelo lote;
  agora também recusa no servidor análises com pendências).
- Capa AOCP: cargo detectado nas linhas acima de "Nível" (ex.: "SOLDADO DA POLÍCIA MILITAR").
- Teste real: Libras (V/F, pronta 85/85) e PMPE Soldado 2023 (pronta 54/60) — **analisadas, não importadas**
  (último lote `e1f017a0-…`; Libras no lote `29e4901e-…`).
- Estado do lote em memória do processo (um lote por vez); em hospedagem serverless precisaria de fila externa.

### 13.6 Varredura final e publicação (26/09/2026, noite)
- **Resgate de classificação** (`classification:rescue`): `--apply` amplia para todas as matérias da área
  (27 gravadas); `--enem --apply` usa as 4 áreas do ENEM e corrige a área de questões antigas sem matéria
  canônica (97 gravadas; a importação antiga do ENEM atribuía a área pelo caderno do dia). Custo ≈ R$ 2,70.
- 6 sugestões confiantes que exigiam troca de área e 4 decisões de revisor gravadas por script (log em
  `data-private/classification-applies/manual-*.json`). Taxonomia v4: "Estatuto da Pessoa com Deficiência".
- **Publicação em lote** (`questions:publish`, mesma política da tela + trava de enunciado incompleto;
  não marca gabarito como verificado): **3.013 publicadas** (log em `data-private/publications/`).
  Em revisão: **85** com enunciado provavelmente incompleto (ENEM antigo sem contexto/alternativas em imagem
  perdidas — precisam de correção de conteúdo) e **47** sem subtópico (35 de Nutrição/Quest API, sem matéria
  na taxonomia, e 12 restantes).
- Área do aluno conferida: 3.015 publicadas, filtro por banca (INEP, Instituto AOCP), resolução e correção OK.
- V/F: cabeçalho "Texto N" sem faixa de itens e formatação do texto de apoio (título/autor/fonte) corrigidos.

### 13.7 Código público e Explorar questões estilo lista (27/09/2026)

- `questions.public_number` (Q100001…), rota `/app/questoes/Q100001` aceita código ou UUID.
- **Fase 1 do explorador (concluída):** `/app/questoes` virou lista de questões respondíveis
  (`_components/question-list-item.tsx`): código, Matéria › Tópico › Subtópico, Ano/Banca como
  links de filtro, texto de apoio recolhível, resposta inline (`QuestionAnswerPanel compact`) com
  botão de riscar alternativa, selo "Resolvida · acertou/errou" (`study/infrastructure/queries/
  answered-question-status.ts`, só leitura). Barra com "Questões por página" (`por` = 10/20/50) e
  "Ordenar por" (`ordem` = recentes/antigas/ano). `question-preview-card` removido.
- **Preferências:** "por página" (padrão 20; 10/20/50/100) e ordenação ficam em cookies
  (`sb_questoes_por`, `sb_questoes_ordem`); a URL vale quando tem `por`/`ordem`.
- **Fase 2 (concluída):** filtros Matéria → Tópico (`area`) → Subtópico (`topic`) em cascata, Órgão
  (`org`), Cargo (`cargo`), "Minhas questões" (`situacao` = nao-resolvidas/erradas/acertadas; "erradas"
  e "acertadas" = ao menos uma tentativa assim), chips de filtros aplicados com ×, trilha da questão
  clicável. No celular o painel começa recolhido ("Filtros (n)"). Hoje só 4 órgãos e 145 questões com
  cargo — os filtros crescem com as importações.
- **Fase 3 (concluída):** A−/A+ (`sb_fonte`, escala `--sb-reading-scale` no texto das questões) e tema
  escuro (`sb_tema`; tokens redefinidos em `[data-theme="dark"]` só no shell do aluno — o admin segue
  claro; imagens de prova ganham fundo branco). Estatísticas após responder (`% por opção` e taxa de
  acerto, só contagens agregadas). Favoritar (tabela antiga `study_favorites`), Anotar (`study_question_notes`,
  1 por aluno/questão) e Reportar erro (`question_error_reports`, 1 aberto por aluno/questão) — migration
  `20260927120000_study_notes_and_question_reports` (aditiva, RLS). "Minhas questões › Favoritas" no
  explorador. Admin: `/admin/questoes/reportes` (resolver/descartar; correção pela página de edição).
- **Mídia repetida:** `npm run media:dedupe-links` removeu 15 ligações repetidas em 8 questões ENEM
  (símbolos do texto extraídos como imagem); log em `data-private/media-dedupe/`. O texto dessas
  questões continua quebrado — entra na recuperação das ~85 questões ENEM pelos PDFs oficiais.
- **Drift conhecido:** `prisma migrate diff` aponta 6 renomeações de índices antigos (nomes longos). Não
  foram incluídas em migration; inofensivo.

### 13.8 Gabaritos ENEM, Desempenho, Simulados e novas matérias (27/09/2026, noite)

- **Alternativas perdidas (ENEM):** as 18 questões com < 5 alternativas foram reconstruídas pelas provas
  oficiais do INEP (`data-private/enem-oficial/`, cadernos azuis) com `npm run questions:rebuild-alternatives
  -- <correcoes.json> [--apply]` (casa por texto, `replaces` ou `currentLabel`; recorta imagem do PDF com
  `image`; grava `question_revisions`; pula as já corretas). 7 tinham gabarito errado (Q102816, Q102830,
  Q100867, Q100374, Q100534, Q102718, além do "0" perdido). Todas republicadas. `questions:publish` recusa
  ENEM com < 5 alternativas. O `data-private/ENEM 2024.pdf` é exportação do Gran — não usar como fonte.
- **Imagens no texto:** `RichText` desenha imagens do texto no lugar (símbolos em linha, figuras em bloco
  pelo tamanho real — `text-image.tsx`), usando o mapa URL→asset de `import_media_tasks`; não repete nos
  anexos. Escapes Markdown (`\+`) viram o caractere.
- **Desempenho (`/app/desempenho`)** e **Início com dados reais** (`student-performance.ts`, fuso
  America/Sao_Paulo). Menu: Desempenho, Revisar (= erradas) e Simulados ativos.
- **Simulados (`/app/simulados`)**: migration `20260927200000_study_simulations` (aditiva, RLS). Sorteio
  pelos filtros do explorador, cronômetro opcional, respostas salvas ao marcar, correção pelo caso de uso
  normal de resposta (conta no Desempenho), resultado por matéria e gabarito.
- **Taxonomia v5/v6:** "Administração Geral" (área "Administração e Gestão") e "Libras". Seção de prova
  "Administração Pública" agora fixa só a área jurídica. Cadernos UFBA 2016 Administrador (100) e Libras
  (85) importados, classificados (184 aplicadas; custo ~US$ 0,09) e publicados.
- **Pendências:** 85 ENEM com contexto perdido (precisam das provas oficiais de 2010–2017 e uma ferramenta
  para reescrever enunciado/texto de apoio), 47 sem tópico, 1 sem matéria (Libras), `.env`
  `CLASSIFIER_MAX_AI_CALLS_PER_RUN` → 500.

### 13.9 Contextos perdidos do ENEM restaurados (27/09/2026, madrugada)

- 56 questões ENEM (2012–2023) tinham só o comando final. Contextos recuperados das provas oficiais do INEP
  (`data-private/enem-oficial/`): `scripts/enem-context-extract.ts` localiza a região (posição do texto no
  PDF, colunas, páginas de coluna única, cabeçalho/rodapé e marca d'água descartados; ajustes manuais em
  `contexts-manual.json`), recorta imagens e monta parágrafos (itálico `_…_`, ligaduras, listas).
- Gravação: `questions:attach-context` (imagem da prova como texto de apoio `![…](media:<id>)`), depois
  `questions:context-to-text` trocou 55 por texto revisado (`contexts-as-text.json`; fórmulas em Unicode) —
  legível no celular e com A+/A−. Q100938 segue como imagem (índices dₐ). Tudo com `question_revisions`
  e logs em `data-private/revisions/`. 45 publicadas; 10 aguardam tópico.
- A tela aceita `media:<id>` em textos (só imagens ligadas à própria questão); figuras abrem ampliadas.
- `questions:publish`: trava de "enunciado incompleto" só para ENEM (39 questões de concurso liberadas);
  `--list` mostra o que seria publicado.

### 13.10 Importação pela Quest API (27/09/2026, noite)

- Uso: só para importar (nada de consulta em tempo real para alunos). `scripts/quest-api-exams.ts`:
  `quest:plan` (lista provas da banca, descarta as já importadas/no banco, orçamento de créditos,
  `--orgaos`, `--somente`, `--excluir`) e `quest:import -- --apply`. Respostas pagas ficam em cache em
  `data-private/imports/quest-api/cache/` — reimportar do cache não gasta crédito. Chaves no `.env`
  (`QUEST_API_KEY` / `QUEST_API_KEYS`, troca de chave em 402). API V2 (`/v2/provas`).
- Taxonomia sempre nossa: a "matéria" da Quest só serve de pista — matéria canônica ou área (por palavras-
  chave; senão `--area-padrao`, padrão `ciencias-juridicas`). Tópico/matéria final: classificador.
  `classification:rescue -- --quest --apply` reclassifica as da Quest sem matéria entre todas as áreas.
- Enunciados guardam parágrafos e tabelas ("célula | célula" por linha); `quest:refresh-statements`
  reformatou 53 já importadas a partir do cache (só formatação, com revisão e log de reversão).
- Importadas (Instituto AOCP, segurança pública): Polícia Penal PR 2024, Polícia Científica PR 2023,
  PM PR Cadete 2025, PMDF 2º Tenente 2023, PC GO Escrivão 2023 — 388 questões, 360 publicadas.
  Em revisão: 22 sem matéria no nosso catálogo (Direito Civil, Medicina Legal, Criminologia, Direito
  Financeiro, legislação estadual/PMDF) e 7 sem tópico. Duplicadas excluídas do plano: 24581447,
  26298314, 24344269. Créditos: ~217 restantes na chave (janela até 27/10/2026).

### 13.11 Taxonomia v7 para importação em larga escala (28/09/2026)

- `concursos-taxonomy-v7.ts`: +3 áreas do conhecimento (Contabilidade e Economia, Saúde, Educação) e
  35 matérias — Direito Civil, Processual Civil, Tributário, Financeiro, do Trabalho, Processual do
  Trabalho, Previdenciário, Empresarial, Ambiental, Eleitoral, do Consumidor, Internacional, Ética no
  Serviço Público, Medicina Legal, Criminologia, Criminalística, AFO, Arquivologia, Gestão Pública,
  Contabilidade Geral/Pública, Auditoria, Economia, Matemática Financeira, Banco de Dados,
  Desenvolvimento/Engenharia de Software, Redes, Governança de TI, Saúde Pública (SUS), Enfermagem,
  Primeiros Socorros, Conhecimentos Pedagógicos, Legislação Educacional, Atualidades — e Geografia/
  História regionais (GO, PR, PE, MG, DF, RS). Aplicada com `taxonomy:seed -- --apply` (sem conflitos).
- "Gestão Pública" não usa o alias "Administração Pública" (essa seção continua jurídica, §13.8).
- `classification:rescue -- --quest --reset --apply`: limpa a matéria automática das questões da Quest
  em revisão sem subtópico (log em `data-private/revisions/rescue-quest-reset-*`) e reclassifica entre
  todas as áreas. `questions:publish -- --excluir=Q…` mantém questões duvidosas em revisão.
- Resultado: +21 publicadas. Em revisão: Q103595 (LC 94/1998 – RIDE-DF, caiu em História) e Q103459
  (congresso de 1947, caiu em Processo Penal) excluídas por dúvida; 5 sem matéria; 1 sem tópico.
  Q103446 (Tanatologia) está publicada em Direito Processual Penal — corrigir pelo editor para Medicina Legal.

### 13.12 Nova rodada Quest e backoffice completo (28/09/2026)

- Quest: nova chave (3000 créditos). A Quest guarda uma cópia por prova (`provas` nunca lista duas), então
  cargos do mesmo concurso repetem o bloco comum e só viram "duplicata" depois de pagos. O planejador agora
  pega **um cargo por concurso** (inclusive contra concursos que já temos); outros cargos só com `--extras`.
  Rodada AOCP 2025: CODERN, IDEMA, MPE MA (Promotor), MPE RS (Analista Direito), Paraná Previdência (TI),
  SANESUL — 429 importadas, 406 publicadas; 2646 + 148 (listagem) créditos. 231 cargos repetidos evitados.
- Mantidas em revisão por classificação duvidosa: Q103595, Q103459, Q103856, Q103921, Q103930. Publicadas
  com matéria errada (corrigir pelo editor → Medicina Legal): Q103446, Q103460.
- Backoffice: todas as páginas do menu ativas.
  - `/admin/questoes` Todas as questões: busca por código ou trecho (≥4 caracteres), filtros de situação,
    matéria, banca e ano, contagem por situação, paginação por cursor (publicNumber).
    Escala: busca por trecho usa ILIKE; com milhões, criar índice trigram (migration aditiva `pg_trgm`).
  - `/admin/questoes/nova`: questão autoral (fonte `soubizurado-original`, ORIGINAL), catálogo em cascata,
    bloqueio de duplicata por fingerprint, nasce em revisão com `question_revisions` ("Criação").
  - `/admin/taxonomia`: catálogo somente leitura com contagens por Matéria/Tópico/Subtópico.
  - `/admin/midias`: fila, armazenamento, falhas com "tentar de novo" (o download segue no `media:process`).
  - `/admin/usuarios`: contas, papéis (somente leitura), atividade; e-mails pela API admin do Supabase
    (servidor) — o papel do banco não lê o schema `auth` (correto).
- Pool do Postgres limitado (`DATABASE_POOL_MAX`, padrão 4) — erro EMAXCONNSESSION no pooler de sessão.
- (28/09) `questions:reclassify -- "Q…=Matéria/Tópico/Subtópico" [--apply]`: reclassificação manual (também
  de publicadas), só com itens do catálogo, com `question_revisions` ("Classificação") e log de reversão.
  Aplicado: Q103446 → Medicina Legal; Q103460 e Q103459 → Criminalística; Q103593–5 → Geografia do DF
  (RIDE); Q103856 → Legislação Institucional; Q103921 → Direito Civil; Q103930 → Legislação Educacional.
  7 publicadas.
- Busca por trecho em Todas as questões usa o índice trigram existente (`questions_statement_trgm_idx`,
  sobre `lower(statement)`) via SQL parametrizado — sem migration nova. Até 5.000 resultados exatos;
  termos mais amplos pedem refinamento.

### 13.13 Nova questão de prova e ações em Usuários (28/09/2026)

- `/admin/questoes/nova`: origem "Questão de prova" (banca do catálogo, ano, órgão, cargo, nº; reusa a prova
  se banca+ano+órgão+cargo já existir; senão cria `manual-…`) ou "Autoral". Fontes: `soubizurado-manual-exam`
  (OFFICIAL_EXAM) e `soubizurado-original` (ORIGINAL). Texto de apoio opcional; até 6 imagens no enunciado
  (`[imagem N]` posiciona no texto → `![Imagem N](media:<id>)`) e 1 por alternativa (alternativa pode ser só
  imagem). Uploads re-codificados no servidor com `sharp` (WebP, ≤1600px, sem metadados, ≤8 MB) →
  bucket privado. Nasce em revisão; publicação só pela política. `sharp` agora é dependência direta.
- `/admin/usuarios`: convidar conta (e-mail do Supabase; a pessoa define a senha em `/definir-senha`),
  tornar/remover administrador, bloquear/desbloquear (ban no Supabase Auth), enviar redefinição de senha.
  Proteções (`account-admin-policy.ts`): sem auto-remoção/auto-bloqueio; sempre ≥1 admin ativo.
  Auditoria em `admin_audit_logs` (migration aditiva `20260928100000_admin_audit_logs`, RLS on, sem
  policies; aplicada com `prisma migrate deploy`).
- Configuração no painel do Supabase (usuário): em Auth → URL Configuration, incluir
  `<site>/definir-senha` nas Redirect URLs; para volume de convites, configurar SMTP próprio (o envio
  padrão tem limite de poucos e-mails por hora).

### 13.14 Área do aluno: Perfil e Configurações (28/09/2026)

- Fila de prioridades da área do aluno: 1) Perfil + Configurações ✅ 2) Estudar (sessão guiada + revisão
  espaçada) 3) Missões 4) Ranking (com opt-out) 5) Comunidade 6) Loja/Premium (depende de decisões do
  usuário: pagamento, preços). Pendente de configuração: links de acesso sem e-mail (convites) — adiado.
- `study_preferences` (migration aditiva `20260928120000_study_preferences`, RLS on, CHECK da meta 1–500):
  meta diária, concurso-alvo, banca-alvo (catálogo), data da prova, `show_in_ranking`.
- `/app/perfil`: identidade, resumo (resolvidas, acerto, sequência, simulados), meta de hoje, contagem
  regressiva para a prova; editar nome (perfil + metadata da sessão) e objetivo.
- `/app/configuracoes`: tema e tamanho do texto (contexto `ReadingPreferencesContext` do shell — muda na
  hora), itens por página/ordem do explorador (cookies), aparecer no ranking, alterar senha (confere a
  atual), sair de todos os dispositivos.

### 13.15 Estudar: sessões guiadas + revisão espaçada (28/09/2026)

- Migration aditiva `20260928140000_study_review_and_sessions` (RLS on, CHECKs): `study_review_items`
  (fila de revisão por aluno/questão), `study_sessions` + `study_session_questions`. Preencheu a fila com
  as questões cuja última resposta foi errada (vencendo hoje).
- Revisão espaçada (`spaced-review.ts`): erro → volta amanhã; acerto na revisão vencida → 1, 3, 7, 15,
  30, 60 dias; depois sai da fila (aprendida). Acerto antes do vencimento não pula etapas. Atualizada na
  mesma transação que grava a resposta (`PrismaStudyRepository.createAnswerAttempt`) — vale para
  explorador, simulados e sessões.
- `/app/estudar`: card de revisões vencidas ("Revisar agora"), continuar sessões, nova sessão (matéria,
  tópico opcional, modo Misto/Só novas/Só revisão, 5–30 questões), sessões recentes.
  `/app/estudar/[id]?q=N`: questão com o painel de resposta do explorador, progresso por bolinhas,
  navegação; `/resultado`: placar e lista. Uma questão conta como respondida na sessão se houver
  resposta após o início da sessão (a primeira conta).
- Sorteio escalável: `drawPublishedIds` (contagem + janela aleatória, sem carregar todos os ids).
  Pendente: os simulados ainda usam `listPublishedIds` (carrega todos os ids) — trocar para
  `drawPublishedIds` antes de milhões de questões.

### 13.16 Missões (28/09/2026)

- `/app/missoes`: diárias (meta do Perfil; acertar 60% da meta; revisões em dia) e semanais (5 dias de
  estudo; 70% de acerto com ≥30 respostas; 3 sessões do Estudar; 1 simulado). Calculadas na hora a partir
  das respostas, fila de revisão, sessões e simulados (`missions.ts` + `mission-progress.ts`, fuso de
  São Paulo, semana começa na segunda) — sem tabela nova, nada para "resgatar".
- Simulados agora sorteiam com `drawPublishedIds` (não carregam mais todos os ids).

### 13.17 Ranking (28/09/2026)

- `/app/ranking` (semana desde segunda / mês desde o dia 1, São Paulo): pontos = questões **diferentes**
  acertadas no período (repetir não soma); desempate por taxa de acerto. Top 50 + a posição do aluno se
  estiver fora. Só quem não desativou `show_in_ranking`; só o nome de exibição sai do banco.
- Índice `study_answer_attempts(answered_at)` (migration aditiva `20260928160000_…`) para agregar o período
  sem varrer todas as respostas.

### 13.18 Ecossistema — decisões e Fase 1a: acesso freemium (28/09/2026)

- Decisões do usuário: Mercado Pago; limites **por dia** (visitante 1, logado 10, assinante ilimitado);
  vídeo decidir depois; ordem 1) questões públicas + limites + direitos de acesso 2) Loja + checkout
  (logado compra direto; visitante cria conta no checkout; acesso só no webhook) 3) área de membros
  4) blog. "Revisar" foi unificado dentro de "Estudar".
- `entitlements` (migration aditiva `20260928180000_entitlements`, RLS on, CHECKs): direitos
  QUESTION_BANK/COURSE com período, origem ADMIN/ORDER/SUBSCRIPTION e revogação — base das ofertas.
- Limite aplicado no servidor antes de corrigir (`submitStudyAnswerAction` → `LIMIT_REACHED`; gabarito não
  é revelado). Simulados no gratuito exigem respostas restantes ≥ tamanho (respostas gravadas ao final).
  Administradores = ilimitado. Topo e barra lateral mostram "Grátis · X/10 hoje" ou "Premium".
- `/admin/usuarios`: conceder Premium (30/90/180/365 dias ou sem prazo) e retirar o concedido pelo painel;
  auditado. Próximo: Fase 1b — questões públicas (SEO) + limite de visitante (1/dia).

### 13.19 Fase 1b: questões públicas + visitante 1/dia + SEO (28/09/2026)

- Proxy (`supabase/proxy.ts`) exige sessão em `/app/*`, exceto `/app/questoes*` (públicas). O layout de
  `/app` sem sessão renderiza o modo visitante (topo "Visitante · X/1 hoje", barra com "Criar conta
  grátis"/"Entrar"); favoritar/anotar/reportar viram convite para criar conta.
- Visitante: `submitStudyAnswerAction` sem sessão → corrige sem gravar tentativa, 1 resposta/dia contada
  por cookie aleatório `sb_visitante` **e** por IP — só hashes HMAC em `visitor_answer_usage` (migration
  aditiva `20260928200000_…`, RLS on). Segredo: `VISITOR_HASH_SECRET` (fallback: SUPABASE_SECRET_KEY).
- URLs públicas `/questoes` e `/questoes/Q123` (rewrites no next.config) com título/descrição/canônica;
  `metadataBase` = NEXT_PUBLIC_SITE_URL. Sitemaps: `/sitemap.xml` + `/questoes/sitemap/[id].xml` (blocos de
  45 mil por faixa de número público); `robots.txt` bloqueia admin/api/áreas privadas.
- Home com "Questões grátis" e "Resolver uma questão agora, sem cadastro".
- Próximo: Fase 2 — Loja + checkout Mercado Pago (ofertas → entitlements via webhook).

### 13.20 Fase 2: Loja + checkout Mercado Pago (28/09/2026)

- Migration aditiva `20260928220000_store_offers_orders` (RLS on, CHECKs): `offers`, `offer_grants`
  (QUESTION_BANK N dias ou sem prazo; COURSE na Fase 3), `orders` (PENDING/PAID/FAILED/CANCELLED/REFUNDED).
- Mercado Pago Checkout Pro via REST (`store/infrastructure/mercado-pago`): preferência com
  `external_reference` = id do pedido; o comprador paga na página do MP (sem dados de cartão aqui).
  `processMercadoPagoPayment(paymentId)` sempre relê o pagamento na API, confere valor/moeda com o pedido,
  move PENDING→PAID uma vez (update guardado) e cria o entitlement (Premium soma ao tempo ativo); estorno
  revoga. Testado com mocks (idempotência, valor adulterado, estorno).
- Webhook `/api/webhooks/mercadopago`: assinatura `x-signature` verificada (manifest oficial
  `id:{data.id};request-id:{x-request-id};ts:{ts};`, HMAC-SHA256, tempo constante); 401 sem assinatura.
  Página `/loja/retorno` também processa (funciona em localhost, sem webhook público).
- Vitrine pública `/loja` e `/loja/[slug]`: logado compra em um clique; visitante cria a conta no checkout
  (signUp) e segue para o pagamento. Aceite obrigatório de `/termos` e `/privacidade` (versões iniciais —
  revisar com advogado). `/app/compras` (pedidos + validade do Premium). Admin `/admin/loja`: ofertas,
  pedidos, faturamento, "Conferir pagamento" por número do MP.
- Configuração do usuário (.env, credenciais de TESTE primeiro): `MERCADOPAGO_ACCESS_TOKEN`,
  `MERCADOPAGO_WEBHOOK_SECRET` (Suas integrações > Webhooks), `NEXT_PUBLIC_SITE_URL`. O webhook e o retorno
  automático só funcionam com URL pública HTTPS.

### 13.21 Fase 3: área de membros (29/09/2026)

- Migration aditiva `20260929000000_courses_member_area` (RLS on, CHECKs): `courses`, `course_modules`,
  `course_lessons` (TEXT/PDF/VIDEO/QUESTIONS, aula grátis de amostra), `course_lesson_questions`,
  `course_lesson_progress`; FKs de `offer_grants.course_id` e `entitlements.course_id` para `courses`.
- Ofertas podem incluir cursos (com prazo próprio) e/ou Premium; pedido pago cria entitlement COURSE.
- Admin `/admin/cursos`: cursos, módulos (reordenar, excluir só vazios), aulas (texto markdown, PDF até 50 MB
  validado por `%PDF-` no bucket privado, vídeo por link de incorporação de Panda/Bunny/Vimeo/YouTube —
  lista permitida, verificada ao salvar e ao exibir —, lista de questões por códigos publicados).
- Aluno: `/app/cursos` (meus cursos + progresso + outros à venda), `/app/cursos/[slug]` (módulos, cadeados,
  continuar), `/app/cursos/[slug]/[lessonId]` (vídeo, PDF embutido + baixar, texto, questões com o painel de
  resposta, concluir e ir para a próxima). PDF só por `/api/cursos/aulas/[id]/pdf` (confere acesso; 404
  igual para inexistente e sem acesso; `no-store`). Questões de aula com acesso não consomem o limite diário.
- Pendente: marca d'água com e-mail do comprador nos PDFs; escolher o serviço de vídeo; capa do curso.

### 13.22 Fase 4: blog de notícias (29/09/2026)

- Migration aditiva `20260929020000_blog` (RLS on, CHECKs): `blog_categories`, `blog_posts` (rascunho /
  publicado; `published_at` futuro = agendado), `blog_post_images`.
- Formato do texto (`blog.ts`): subconjunto seguro de Markdown, sem HTML — `## `/`### ` títulos (sozinhos no
  bloco), listas `- `/`1. `, citações `> `, `[imagem N]` sozinho na linha, blocos separados por linha em
  branco; negrito/itálico/links pelo RichText. Resumo automático e tempo de leitura.
- Admin `/admin/blog` (+ `/novo`, `/[id]`): título, slug, categoria (criada na hora), resumo, texto, situação,
  data/hora de publicação (Brasília), capa e imagens (convertidas para WebP no servidor), oferta em destaque
  e banca (chamada "resolva questões da banca"). Exclusão com confirmação. **Editor não conferido no
  navegador** (sessão do usuário expirou no painel durante o teste).
- Público `/blog` (categorias, paginação; listas filtradas com noindex) e `/blog/[slug]` (Open Graph,
  canônica, JSON-LD NewsArticle com `<` escapado, chamadas para Loja/questões, "Leia também").
  Imagens só de posts no ar em `/api/blog/imagens/[id]` (liberadas no robots). `/blog/sitemap.xml`,
  `/blog/rss.xml`; links "Blog" na home e no topo público.

### 13.23 Blog com cara de portal de notícias (29/09/2026)

- Migration aditiva `20260929040000_blog_portal` (RLS on, CHECKs): categorias ganham grupo (CARREIRA /
  EXAME / GERAL), ícone, descrição e ordem (editorias semeadas com `ON CONFLICT DO NOTHING`); posts ganham
  formato (NEWS/ARTICLE), UF e destaque; tabela `newsletter_subscribers` (e-mail minúsculo, consentimento).
- Layout em `src/app/blog/layout.tsx` + `portal.module.css`: topo com busca, CTA, menu com dropdown de
  editorias (e menu sanfona no celular), barra de regiões (27 UFs), rodapé com colunas (carreiras, bancas).
- Home: banner da oferta, ticker "Em destaque", manchete + grade de 4, últimas notícias, artigos em
  destaque, barra lateral (editorias + newsletter), vitrine da plataforma (sem depoimentos inventados),
  texto SEO. Páginas: `/blog/noticias`, `/artigos`, `/editoria/[slug]`, `/regiao/[uf]`, `/busca` (noindex).
- Post: breadcrumb, lead, autor e tempo relativo, compartilhar (WhatsApp, Telegram, X, Facebook,
  LinkedIn), chamada para questões/oferta, "Leia também" e últimas notícias ao lado.
- Admin: formato, UF e destaque no formulário do post. Conferido 375px/1366px **sem posts** (banco
  vazio); manchete/cards com capa ainda não vistos com dados reais.
