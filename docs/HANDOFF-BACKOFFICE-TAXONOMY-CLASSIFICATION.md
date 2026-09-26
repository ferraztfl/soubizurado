# Handoff — Backoffice, Taxonomia Canônica e Classificação Automática

**Atualizado em:** 26/09/2026
**Branch:** `feature/enem-pdf-ingestion` (contém todas as outras branches, ver §2)
**Documento anterior:** `docs/HANDOFF-ADMIN-QUESTION-BANK.md` (21/09/2026) — continua válido
para ingestão, mídia e regras gerais; este documento registra tudo o que veio depois.

> Para retomar numa nova conversa: leia `CLAUDE.md`, depois este arquivo, depois rode
> `git status --short`, `git log --oneline -15`, `npm run classification:status`.

---

## 1. Estado atual em uma página

| Área | Estado |
|---|---|
| Backoffice `/admin` | Shell protegido por `requireAdminUser`, sidebar com rota ativa, navegação móvel (drawer < 1100px), dashboard com KPIs |
| Revisão editorial | Em `/admin/questoes/revisao` (fila com filtros/paginação + detalhe). `/app/revisao-questoes` só redireciona |
| Taxonomia canônica | Aplicada no banco: 4 áreas do conhecimento, 14 disciplinas, 68 assuntos, 306 tópicos, 381 subtópicos, 41 aliases, revisão v1 |
| Reclassificação legada | Aplicada: 685 → Matemática, 62 → Língua Inglesa, 67 → Língua Espanhola |
| Classificador | Fila persistente + classificador por regras (padrão) + adaptador OpenAI-compatível (IA). Rodada `rule-based-v1` feita: 2928 tarefas, 1191 com tópico sugerido, 19 de alta confiança, 0 aplicadas |
| Publicação | 0 questões publicadas; 2963 em `IN_REVIEW`; 0 com tópico (em 26/09/2026) |
| IA configurada | Gemini gratuito (Google AI Studio) no `.env`, modelo `gemini-flash-latest`. Rodada de teste `oa-v2:gemini-flash-latest` com 50 questões em andamento/concluída (ver §7) |
| Próximo passo combinado | Auditar as 50 do teste; se boas, enfileirar o restante e processar em dias sucessivos (cota grátis); depois `classification:apply` |

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

- Formatação inline: `src/shared/ui/inline-markdown.ts` + `rich-text.tsx` (negrito, itálico, links http; imagens Markdown removidas porque já aparecem via QuestionMedia). 26 referências de imagem `enem.dev` em textos de apoio não têm cópia local (pendência de mídia).
- Dashboard `/admin` refeito com indicadores operacionais, progresso por disciplina e próximas ações.
- UI/UX: detalhe da revisão redesenhado (duas colunas, painel de ações fixo, checklist de publicação, rótulos em português). Rótulos de enums ficam em `src/modules/question-bank/presentation/question-labels.ts` — **nunca renderizar valores crus como `IN_REVIEW`**; usar `labelFor(...)`. Próximas telas a polir: dashboard e fila (já usam tokens, mas podem ganhar componentes compartilhados de badge/card).
- Enunciados importados contêm marcações cruas de Markdown (`**negrito**`, `_itálico_`); falta um renderizador seguro de formatação inline (admin e área do aluno).
- `/api/media/[id]` serve mídia de questão não publicada a quem souber o UUID, e há 1 SVG servido no mesmo domínio sem CSP (hardening pendente).
- Enviar imagens das questões ao classificador (melhora questões com gráfico/mapa).
- `/admin/questoes` (lista geral), `/admin/questoes/nova`, `/admin/importacoes`, `/admin/taxonomia`, `/admin/midias`, `/admin/usuarios` ainda não existem.
- Publicação em lote respeitando a política.
- Deduplicar lógica de consultas Prisma nas páginas admin (hoje direto na página) quando houver repositórios de backoffice.
