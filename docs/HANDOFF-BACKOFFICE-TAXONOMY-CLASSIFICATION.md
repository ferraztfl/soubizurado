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
