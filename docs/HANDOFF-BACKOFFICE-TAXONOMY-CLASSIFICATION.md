# Handoff — Backoffice, Taxonomia Canônica e Classificação Automática

**Atualizado em:** 01/10/2026 (§1 e §12 refletem o estado atual; §13.43–13.48 são as mudanças mais recentes)
**Branch:** `feature/enem-pdf-ingestion` = `main` em `ferraztfl/soubizurado`; produção lê o repositório `deploy` (ver `docs/DEPLOY.md`)
**Documento anterior:** `docs/HANDOFF-ADMIN-QUESTION-BANK.md` (21/09/2026) — continua válido
para ingestão, mídia e regras gerais; este documento registra tudo o que veio depois.

> Para retomar numa nova conversa: leia `CLAUDE.md`, depois este arquivo (comece por §1 e §12),
> depois rode `git status --short`, `git log --oneline -15`, `npm run classification:status`,
> `npm run media:status`. As seções 3–11 são o histórico detalhado; onde divergirem de §1/§12,
> valem §1/§12.

---

## 1. Estado atual em uma página (conferido em 01/10/2026)

| Área | Estado |
|---|---|
| **Produção** | **No ar em `https://www.soubizurado.com.br`** (Hostinger Web App Node.js; DNS no registro.br; código via repositório `atelie33/soubizurado33`). Ver `docs/DEPLOY.md`. Banco, login e mídia no Supabase (o mesmo projeto do desenvolvimento) |
| Pagamentos | Mercado Pago com **credenciais de produção** nas variáveis da Hostinger; webhook `https://www.soubizurado.com.br/api/webhooks/mercadopago` (eventos Pagamentos e Planos e assinaturas). **Nenhuma compra real testada ainda; 0 pedidos** |
| Usuários | 1 perfil (o administrador). Ainda sem alunos reais |
| Questões | **4.101 publicadas, 131 `IN_REVIEW`** (conferido no banco). 10 já têm gabarito comentado (`question_explanations`) |
| Taxonomia | Catálogo **v9** aplicado (revisão 9): 10 áreas do conhecimento, 70 matérias, 206 tópicos, 785 subtópicos, 584 detalhes ativos. Administradores criam itens abaixo da matéria pela tela de revisão (§13.45); criações ficam no log de auditoria |
| Concursos e editais | 11 concursos, 7 editais verticalizados (PMPE e CBMPE, Soldado e Oficiais), 11 posts do blog; PDF do edital por cadastro de lead (2 leads) |
| Teoria Completa | **7 cursos publicados (pré-venda), 639 aulas: 186 em RASCUNHO (IA), 453 vazias, 0 revisadas**. O aluno só vê aulas REVISADAS. O dono vai fornecer o conteúdo (listas em `data-private/editorial/teoria/listas/`) |
| Loja | 8 ofertas ativas (7 combos R$ 29,90 de R$ 59,90 até 31/12/2026 + Premium anual R$ 118,80), assinatura mensal R$ 14,90 (recorrente). Loja pública `/loja` e **loja dentro da conta `/app/loja`** (quem já tem o combo vê "você já tem", sem botão de compra) |
| Área do aluno | Menu lateral com ícones e **recolhível** (cookie `sb_menu`); painel com topo compacto; "Meus cursos" com imagem de capa |
| Backoffice | `/admin`: revisão editorial (agora com busca na lista de classificação e criação de classificação), Central de Importações, loja, cursos, concursos/editais, leads, blog, usuários |
| Imagens | Mídia das questões no Supabase Storage privado. Imagens de ofertas (banner, card) e de cursos (capa) usam `/api/loja/banners/[id]`; tamanho ideal do card/capa **1200×675 (16:9)** |
| Classificação por IA | Provedor `openai-compatible` (Gemini). O dono revisa e classifica manualmente as questões em revisão; `questions:annotate` aplica lotes revisados |
| Git | `feature/enem-pdf-ingestion` e `main` em `ferraztfl/soubizurado`; o repositório `deploy` (`atelie33/soubizurado33`) recebe o código por commit de junção (ver `docs/DEPLOY.md` §8). Cada envio ao `deploy` dispara uma implantação |

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

## 12. De onde continuar (atualizado em 01/10/2026)

O histórico da sessão de 26/09/2026 que ocupava esta seção está em §12.1 (abaixo) e nas seções 3–11.

### Em andamento / próximos passos (ordem sugerida)
1. **Conferir a área logada no site publicado:** login, cadastro e redefinição de senha em
   `www.soubizurado.com.br` (Supabase → Authentication → URL Configuration já aponta para o domínio e
   também deve ter `https://soubizurado.com.br/**`); menu recolhível, Loja interna, "Meus cursos".
2. **Testar o checkout do Mercado Pago** (compra real de R$ 29,90 com estorno depois, ou até a tela de
   pagamento) e confirmar que o webhook libera o acesso (`orders`, `entitlements`). Pedir ao dono antes.
3. **Conteúdo da Teoria Completa:** o dono fornece os textos; carregar com `theory:drafts` (formato em
   §13.33–13.42). Compromisso público: todas as matérias até 31/12/2026. Os 186 rascunhos escritos pela IA
   precisam de revisão humana (`/admin/cursos` → aula → "Revisado").
4. **Classificação manual das 131 questões em revisão**: o dono envia lotes (classificação + gabarito
   comentado + análise das alternativas); aplicar com `npm run questions:annotate -- <lote>.json` (dry-run,
   depois `--apply`; log de reversão em `data-private/logs/`). Um único `git push` ao fim do lote.
5. **Imagens dos cards:** o dono sobe a imagem de cada um dos 7 cursos em `/admin/cursos` (aparece em
   "Meus cursos" e, como padrão, nos cards da Loja); ofertas podem ter imagem própria em `/admin/loja`.
6. **Redação** (1 correção por mês nos combos): ainda não prometida nas ofertas nem construída.
7. **Pendências técnicas:** descadastro de leads por link e envio do PDF por e-mail; SMTP próprio no Supabase;
   10 alertas de dependências de desenvolvimento no painel da Hostinger (não corrigir com `npm audit fix`);
   endereço sem `www` redirecionando para `www`; Google Search Console com o sitemap.
8. Leitores Fundatec e Cebraspe, tela de `POSSIBLE_DUPLICATE` e demais itens de §9 continuam abertos.

### Armadilhas desta etapa (evitar repetir)
- **Hostinger:** o servidor de build tem glibc antiga. Por isso o projeto compila com `next build --webpack`,
  traz `@next/swc-wasm-nodejs` (mesma versão do Next) e usa `next.config.mjs` (JS puro). Não usar o botão
  "Corrigir e reimplantar" do painel. Ao atualizar o Next, atualizar `@next/swc-wasm-nodejs` e
  `eslint-config-next` para a mesma versão.
- **Conexões com o banco:** em produção o cliente Prisma é um só por processo (`globalThis`); um cliente por
  chamada esgotava o pooler do Supabase (HTTP 500 sob carga).
- **Dois repositórios:** `origin` = `ferraztfl/soubizurado` (trabalho). `deploy` = `atelie33/soubizurado33`
  (a Hostinger lê). O remoto `deploy` usa `https://ferraztfl@github.com/...` para não pedir conta.
- **DNS:** o domínio usa os servidores do registro.br; registros A/CNAME ficam em "Configurar
  endereçamento" no registro.br, não no hPanel. O IP do Web App aparece em hPanel → Web App → Domínios.
- Windows: heredoc/`node -e` perdem barras invertidas; usar Edit/Write ou script em arquivo (já no CLAUDE.md).
- Migrations só aditivas; `db:migrate:deploy` roda a partir do computador local antes de publicar código
  que dependa delas.

### 12.1 Histórico: fim da sessão de 26/09/2026

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

### 13.24 Nova página inicial (29/09/2026)

- `src/app/page.tsx` + `home.module.css`: faixa de promoção (só se houver oferta em destaque com preço
  "de/por"), topo público (`_components/site-header.tsx`: busca de questões, Entrar/Criar conta ou Minha
  área), destaque com busca e os planos reais da Loja (sem ofertas ativas: cartões Grátis/Premium),
  números reais, "Qual é o seu próximo objetivo?", questões por matéria e por banca, benefícios em
  sanfona, notícias do blog (some sem posts), newsletter (faixa; `source = home`) e rodapé compartilhado
  (`_components/site-footer.tsx`, usado também no blog).
- Números/matérias/bancas: `home-highlights.ts` (SQL de contagem, cache de 1 h via `unstable_cache`).
- Sem cronômetro falso, percentuais de aprovação ou depoimentos (não temos esses dados).
- Próximo: cadastro próprio de concursos (não usar a concursosPublicosAPI: raspa site de terceiro).

### 13.25 Cadastro de concursos (29/09/2026)

- Migration aditiva `20260929060000_contests` (RLS on, CHECKs de situação, UF, slug, vagas, salários, datas,
  escolaridade e link https): tabela `contests` + `blog_posts.contest_id` (opcional).
- Regras em `src/modules/contests/domain/contest.ts` (validação, rótulos de vagas/salário, abas); consultas em
  `infrastructure/contest-queries.ts`.
- Admin `/admin/concursos` (+ `/novo`, `/[id]`), menu Operação → Concursos. O órgão digitado é ligado ao
  órgão do banco de questões quando o nome bate. No editor do blog, campo "Concurso da notícia".
- Público: `/concursos` (abas Mais procurados / Edital publicado / Em breve / Previstos / Encerrados, filtros
  UF e carreira; filtros = noindex), `/concursos/[slug]` (dados, questões da banca e do órgão, edital oficial,
  combo, resumo, notícias do concurso, relacionados). Seção "Principais concursos" na página inicial (some
  sem concursos publicados). Sitemap e robots atualizados; link "Concursos" nos menus.
- Correção: `parseBRL("1.299")` agora é R$ 1.299,00 (antes virava R$ 1,29).
- Fonte: dados do edital oficial, digitados pela equipe. Não usar a concursosPublicosAPI (raspa site de terceiro).
- Não conferido com dados: cartões e página do concurso (banco sem concursos) e telas do admin (sessão expirada).

### 13.26 Assinatura Premium R$ 9,90/mês + menu único (29/09/2026)

- Decisão do usuário: R$ 9,90 por mês com **renovação automática** (Mercado Pago Assinaturas / preapproval).
- Migration aditiva `20260929080000_subscriptions` (RLS on, CHECKs): `subscriptions` e `subscription_payments`.
- Preço no servidor: `src/modules/store/domain/subscription.ts` (`SUBSCRIPTION_PLANS.PREMIUM_MONTHLY` = 990).
  Cada cobrança aprovada cria um `entitlement` QUESTION_BANK (source SUBSCRIPTION, sourceId = cobrança) de
  1 mês + 3 dias de folga; estorno revoga só aquele período; cancelar não tira o tempo pago.
- Fluxo: `/assinatura` (Grátis x Premium, cria conta na hora) → `subscribeAction` cria a assinatura PENDING e o
  preapproval (`back_url` = `/assinatura/retorno`) → o aluno autoriza no Mercado Pago → webhook
  `subscription_preapproval` (status) e `subscription_authorized_payment` (cobranças) em
  `/api/webhooks/mercadopago`; a página de retorno também sincroniza pela API. Valor conferido sempre.
- `/app/assinatura`: status, próxima cobrança, histórico e cancelamento (PUT preapproval cancelled).
- **Ação do usuário:** no painel do Mercado Pago (Webhooks), marcar também os tópicos "Planos e assinaturas"
  (subscription_preapproval e subscription_authorized_payment). `NEXT_PUBLIC_SITE_URL` precisa ser https
  público para o `back_url` e os avisos. Em teste, o comprador precisa ser um usuário de teste do Mercado Pago.
- Menu único: `_components/site-shell.tsx` (topo + rodapé + faixa fixa do Premium para quem não é Premium,
  fechável por 7 dias) em página inicial, blog (com barra própria de Notícias e regiões), concursos, loja e
  assinatura. Login aceita `?next=` (só caminhos internos, `safeNextPath`).
- Não testado ponta a ponta: cobrança real/teste no Mercado Pago (faltam credenciais e URL pública).

### 13.27 Página de notícia no estilo portal (29/09/2026)

- `/blog/[slug]`: coluna central (780px), breadcrumb, editoria, título grande, lead, autor com data completa,
  "atualizado em", tempo de leitura, compartilhar em linha e trilho fixo ao lado (copiar link, WhatsApp,
  Telegram, Facebook, X, LinkedIn, e-mail), capa larga, barra de progresso de leitura, chamada para questões
  da banca/combo, convite ao Premium (R$ 9,90/mês), "Leia também" e "Últimas notícias" embaixo.
- Formato do texto ganhou (sem HTML): caixas `!!! resumo|atencao|dica|chamada Título` + linhas (`- item`;
  botão = linha só com `[rótulo](https://…)`, só https) e tabelas `| a | b |` (1ª linha = cabeçalho, até
  8 colunas / 80 linhas). Ajuda atualizada no editor.
- Não conferido com post real (banco sem posts publicados).

### 13.28 Visitante com o topo do site, app instalável e carrossel de combos (29/09/2026)

- Usuário: integração real com o Mercado Pago fica para depois (credenciais/URL pública).
- `/questoes` para visitante: `VisitorAppShell` (topo e rodapé do site, barra "resposta grátis de hoje" com
  A−/A+/tema, faixa do Premium). Aluno logado continua com a área do aluno. Em dev, `127.0.0.1` está em
  `allowedDevOrigins` para testar como visitante sem sair da sessão em `localhost`.
- App instalável: `src/app/manifest.ts`, ícones em `public/icons` + `src/app/icon.png`/`apple-icon.png` (gerados
  do `logo-mark.png`), página `/aplicativo` (botão de instalar ou passo a passo por aparelho, QR Code via
  pacote `qrcode`). Item "App" no menu. Sem service worker (não prometemos offline).
- Carrossel de combos na página inicial (`_components/combo-carousel.tsx`): ofertas à venda, banner opcional
  (migration aditiva `20260929100000_offer_banners`: `offers.banner_asset_id`; envio no admin da Loja,
  convertido para WebP; servido só para ofertas ativas em `/api/loja/banners/[id]`). Sem banner, o slide é
  montado com nome, chamada e preço. Não conferido com dados (nenhuma oferta ativa).

### 13.29 Primeira carga editorial (29/09/2026)

- `npm run editorial:seed -- <json> [--apply] [--publish]` (`scripts/seed-editorial.ts`): carrega concursos e posts de
  um JSON revisado em `data-private/editorial/` (fontes anotadas por item), casando banca/órgão/editoria com o
  catálogo (nada é criado nos catálogos), pula slugs existentes e grava log de reversão em `data-private/logs/`.
- Aplicado com `--publish` (autorizado pelo usuário): 11 concursos (PM AL, TJRS Juiz, Sesa AP, PMPE, PCPE, CBMPE,
  Polícia Penal PE, Bacen, Receita, CGU, ANPD) e 8 posts (7 notícias + 1 artigo). Log:
  `data-private/logs/editorial-seed-2026-09-28T18-59-27-263Z.json`. Salários só onde a fonte era oficial ou
  consistente; demais "a definir". Nenhum concurso ficou ligado a órgão do banco de questões (nomes diferentes).
- Ajustes: post mostra "Ver a página do concurso"; "atualizado em" só para edições reais; selo do concurso usa a
  sigla entre parênteses (ex.: BACEN).

### 13.30 Logos dos órgãos nos concursos (29/09/2026)

- Migration aditiva `20260929120000_contest_logos` (`contests.logo_asset_id`). Admin do concurso: campo "Logo /
  brasão do órgão" (PNG/JPG/WebP/SVG; `contest-logo.ts` recorta a borda vazia, encaixa em 256×256 e mantém a
  transparência, WebP). Servida só para concursos publicados em `/api/concursos/logos/[id]` (liberada no robots).
- Cartão e página do concurso mostram a logo num quadro branco; sem logo, continua o selo com a sigla.

### 13.31 Fontes do site e nova página do concurso (29/09/2026)

- Fontes (pedido do usuário, iguais às do CFP; ambas OFL): Inter (texto) e Plus Jakarta Sans (títulos h1–h4), via
  `next/font/google` em `src/app/layout.tsx` (servidas pelo próprio site). Antes o CSS pedia Inter mas nunca carregava.
- Migration aditiva `20260929140000_contest_details`: `contests.fee_text`, `stages`, `exam_locations`, `authorization`
  e tabela `contest_positions` (cargo, vagas, CR, salário, escolaridade, requisitos; RLS on, CHECKs).
- Admin do concurso: cargos um por linha (`Cargo | vagas | salário | escolaridade | requisitos`, `parsePositionLines`),
  taxa, autorização, locais e etapas.
- `/concursos/[slug]` refeita (`contest-page.module.css`): hero escuro com logo, números-chave e ações; barra de
  seções fixa; visão geral, tabela de cargos, cronograma (linha do tempo por situação + datas), etapas, questões da
  banca por matéria (dados reais do banco), notícias, perguntas frequentes (JSON-LD FAQPage), coluna lateral fixa
  (resumo, combo ou Premium, compartilhar) e relacionados.
- Aplicado (autorizado pelo usuário): `npm run editorial:enrich -- data-private/editorial/enrich-2026-09-29.json --apply`
  — cargos, taxa, etapas, locais e autorização nos 11 concursos. Log de reversão (valores anteriores):
  `data-private/logs/contest-enrich-2026-09-28T19-50-21-943Z.json`.

### 13.32 Importar concurso do edital em PDF (29/09/2026)

- `/admin/concursos/importar` (botão "Importar do edital (PDF)" na lista): PDF oficial (até 30 MB, com texto) + link
  https opcional + "atualizar concurso existente" opcional → `pdftotext` → IA configurada em `CLASSIFIER_API_*` (a mesma
  da classificação; hoje Gemini) com prompt "só fatos do edital, null quando não houver" → `noticeExtractionSchema`
  (zod) → `toNoticeSuggestion` → formulário normal do concurso preenchido para revisão + rascunho de notícia.
- Nada é salvo pela IA: o concurso só grava ao clicar em salvar (mesmas regras do cadastro); a notícia vira RASCUNHO
  no Blog (editoria Editais, ligada ao concurso quando for atualização). Banca só casa com nome exato do catálogo.
- `contest-form-values.ts` centraliza os valores do formulário (edição e importação).
- Não testado ponta a ponta com um edital real (precisa de um PDF; custo de IA de centavos por edital).
- IA local (sem saldo na chave online — Gemini respondeu HTTP 402): importação escolhe "Local (Ollama)" ou "Online".
  Local = `qwen2.5:3b` em `http://localhost:11434` (`NOTICE_AI_LOCAL_URL` / `NOTICE_AI_LOCAL_MODEL` opcionais), só CPU
  nesta máquina: recebe ~18 mil caracteres escolhidos por `selectNoticeExcerpts`, resposta travada por JSON schema do
  Ollama; resumo e rascunho da notícia saem do template (`buildContestSummary`/`buildNewsDraft`), sem texto livre do modelo.
- Conferências determinísticas contra o texto do edital (`toNoticeSuggestion(..., { noticeText })`): situação pelas datas
  de inscrição, CR só se o edital menciona, data da prova por regex perto de "prova objetiva", nomes em MAIÚSCULAS
  normalizados, requisitos vazios descartados.
- Teste real com o edital TJRS Juiz (FGV, `data-private/editorial/editais/`): 3 min 49 s, 5.862 tokens; após as
  conferências, todos os campos conferidos batem (30 vagas, R$ 30.505,36, FGV, 15/09–14/10, taxa R$ 305,00, prova
  13/12/2026, etapas). Locais de prova não vieram.
- Progresso da importação (pedido do usuário): `startNoticeImportAction` cria uma tarefa em memória
  (`notice-import-jobs.ts`, por admin, expira em 1 h, máx. 2 simultâneas) e roda `runNoticeImport` em `after()`;
  a tela consulta `GET /api/admin/notice-import/[jobId]` a cada 1 s e mostra barra (%), etapa, tempo decorrido e
  estimativa restante. Fases: PDF recebido 5% → texto 10% → trechos 18% → IA lendo 20–70% (estimado pelo tempo e pela
  velocidade medida) → IA escrevendo 70–95% (medido: Ollama em streaming, token a token) → conferência 97% → 100%.
  Velocidade medida nesta máquina (Ryzen 3 4350G, só CPU): leitura ~42 tok/s, escrita ~5,4 tok/s; valores iniciais
  calibrados e reaprendidos a cada leitura. Teste real (TJRS): 3 min 19 s, resultado igual ao conferido.
  Limitação: tarefas vivem na memória do processo (reiniciar o `npm run dev` perde as em andamento).

### 13.33 Edital lido por regras primeiro (29/09/2026)

- Teste do usuário com o edital PMAL (Cebraspe, impresso pelo navegador) saiu "TUDO ERRADO": o modelo local copiava o
  exemplo do prompt ("Concurso TJRS Juiz 2026"), o trecho enviado não tinha as linhas com R$ e o cabeçalho de
  impressão ("28/09/2026, 17:43 …") virava data de prova.
- Novo `src/modules/contests/domain/notice-text-facts.ts`: `cleanNoticeText` (tira cabeçalho/rodapé de impressão;
  aceita CRLF e `\f` do pdftotext no Windows), `readNoticeTextFacts` (órgão + sigla, UF, ano, banca pelo catálogo com
  "Instituto AOCP" ≠ "AOCP", taxa, locais, etapas, cargos/vagas/salário/escolaridade, período de inscrição),
  `groundExtraction` (descarta o que a IA disse e não está no texto; nome sempre refeito), `mergeNoticeFacts` (regras
  vencem; nome = `Concurso {SIGLA} {ano}`), `anchoredExcerpt` (trecho para a IA ancorado em R$, vagas, taxa, datas).
- Tela: "Como ler o edital" com padrão **Somente regras** (~1 s); "Regras + IA local" e "Regras + IA online" são opcionais.
  Avisos na tela: campos descartados e datas não encontradas.
- Resultado PMAL (regras): Concurso PMAL 2026; PMAL; AL; Cebraspe; 530 + CR; Oficial de Estado-Maior 30 + CR
  R$ 11.563,77 e Soldado 500 + CR R$ 6.067,51 (médio); taxa R$ 150,00; Arapiraca/AL e Maceió/AL; 7 etapas. O PDF
  impresso não traz o cronograma (datas ficam para preencher, com aviso). TJRS também confere por regras.
- Barra "travada em 20%": não reproduzida; no reteste pela tela com IA local ela avançou 23% → 56% → 80% → 95% → fim.

### 13.34 Preço novo e comparação com o concorrente (30/09/2026)

- Estrutura e preços do Estratégia Militar levantados (apenas páginas públicas e menus; nada copiado): assinaturas
  R$ 29,90/R$ 39,90 por mês (anual R$ 159/R$ 249), produtos avulsos por concurso (teoria R$ 59, 6 simulados R$ 59,
  redação R$ 19,90, "conciliação" de 2 editais R$ 89,90) e ~25 módulos na área do aluno (flashcards, lei seca,
  cronograma, TAF, "pergunte ao edital", comunidade…). Meta do usuário: mesma estrutura, preço menor; simulados e
  teoria produzidos pelo usuário/professores, IA só como rascunho.
- Premium mensal agora R$ 14,90 (`SUBSCRIPTION_PLANS`; textos usam `monthlyPriceLabel()`); anual = oferta da loja
  `premium-anual` (R$ 118,80 = R$ 9,90/mês, 365 dias, criada no banco com log em `data-private/logs`).

### 13.35 Editais PMPE e CBMPE 2026 (30/09/2026)

- Editais publicados no DOE-PE de 29/09/2026 (Instituto AOCP). PDFs em `data-private/editorial/editais/{pmpe,cbmpe}-2027.pdf`.
- Os concursos `concurso-pmpe-2026` e `concurso-cbmpe-2026` foram atualizados (status "Edital publicado", cargos,
  requisitos, soldo, datas, taxa, locais, etapas) com dados conferidos página a página; estado anterior em
  `data-private/logs/contests-pmpe-cbmpe-before-*.json`. Notícias "Edital … publicado" publicadas via `editorial:seed`
  (`data-private/editorial/seed-2026-09-30-editais-pe.json`).
- Limitação: o leitor por regras não entende o layout do Diário Oficial (várias colunas e tabelas) — devolveu datas de
  leis como data de prova. Pendente: suporte a DOE no importador.

### 13.36 Edital verticalizado (30/09/2026)

- Base da estrutura de conteúdo por edital (teoria, simulados e cronograma virão dela). Migration aditiva
  `20260930120000_contest_syllabi`: `contest_syllabi` (um por cargo, slug único no concurso), `contest_syllabus_subjects`
  (matéria, nº de questões, bloco, `discipline_id` quando o nome casa com a taxonomia — nada é criado nela),
  `contest_syllabus_topics` e `study_syllabus_progress` (checklist do aluno). RLS habilitada, CHECKs no banco.
- Domínio `src/modules/contests/domain/syllabus.ts` (texto "# Matéria | nº | bloco" + um assunto por linha);
  gravação em `infrastructure/syllabus-store.ts` preserva as linhas que não mudaram (o checklist sobrevive a edições).
- Admin: `/admin/concursos/[id]/edital`. Público: seção "O que estudar" na página do concurso e
  `/concursos/[slug]/o-que-estudar/[cargo]` (checklist para logados, links "Resolver questões" por banca + matéria).
- Carga: 7 cargos (PMPE Soldado, QOPM, QOM Clínica Geral, QOM Cirurgia Geral, QOD; CBMPE Soldado, QOC) montados do
  Anexo II por `data-private/editorial/editais/build-syllabi.cjs`; log em `data-private/logs/syllabi-pmpe-cbmpe-*.json`.
  Sem matéria correspondente na taxonomia: História de Pernambuco, Direitos Humanos e Legislação Extravagante, Gestão de
  Saúde, Conhecimentos Específicos, Legislações pertinentes aos militares de PE (decisão do usuário criar/aliasar).
- `data-private/**` passou a ser ignorado pelo ESLint.

### 13.37 Taxonomia v8 e ligação explícita do edital (30/09/2026)

- Catálogo v8 (`concursos-taxonomy-v8.ts`, aprovado pelo usuário): Clínica Médica, Cirurgia Geral, Odontologia (área Saúde)
  e área "Gestão em Saúde" em Saúde Pública (`withAreas` agora aplica áreas extras a matérias de qualquer versão).
  Seed aplicado: 3 matérias, 11 áreas, 65 tópicos, 25 aliases, 0 conflitos.
- Edital verticalizado: 4ª coluna opcional "Disciplina" ou "Disciplina > Área ou Tópico" (migration aditiva
  `20260930150000_contest_syllabus_links`: `area_id`/`topic_id`, CHECK de exclusividade). Ligação inexistente é
  recusada no admin. "Resolver questões" usa `topic=`/`area=` (sem filtro de banca nesse caso).
- Os 7 cargos PMPE/CBMPE foram religados (todas as matérias ligadas; log em `data-private/logs/syllabi-links-before-*`).
  Gravação do edital agora só atualiza linhas alteradas e usa transação de até 60 s (a de 5 s estourava com 172 assuntos).
- Lacunas de questões (30/09): História de PE 7, Estatística 8, Atualidades 1, Saúde Pública 1, Gestão em Saúde 0,
  Clínica/Cirurgia/Odontologia 0, Penal Militar 16, Processual Penal Militar 14, Direitos Humanos 22. Fonte decidida:
  provas oficiais anteriores (PDFs das bancas), importadas com dry-run.

### 13.38 CBMPE 2023, banner do combo e Teoria Completa (30/09/2026)

- CBMPE 2023 (Instituto AOCP) importado do visualizador oficial (`link.institutoaocp.org.br`, cadernos Tipo 1 +
  gabarito definitivo em texto; arquivos em `data-private/official-exams/cbmpe-2023/`): Soldado 50 + Oficial 68
  questões novas, em revisão; classificação automática em andamento; publicar depois com `questions:publish`
  (dry-run). O importador aceita o gabarito oficial como PDF **ou texto** ("1 A 2 X…").
- Página inicial: o banner da oferta passou a ser o **fundo** do slide do combo (texto por cima). Banner do
  `premium-anual` enviado (log em `data-private/logs/offer-banner-*`).
- **Teoria Completa** (migration aditiva `20260930180000_theory_courses`): curso gerado do edital verticalizado
  (`generateTheoryCourse`: módulo por matéria, aula por assunto; reaproveita texto do mesmo assunto), situação da aula
  `EMPTY/DRAFT/REVIEWED` (aluno só vê REVISADA; admin vê rascunho com aviso), leitor com grifo em 4 cores, anotações,
  ouvir (speechSynthesis pt-BR), continuar de onde parei (`course_reading_states`), "Questões deste assunto", concluir
  aula marca o checklist do edital. 7 cursos gerados (634 aulas, não publicados).
- Conteúdo: `npm run theory:drafts -- <json> [--apply] [--overwrite-drafts]` carrega rascunhos por módulo
  (`data-private/editorial/teoria/*.json`), nunca sobrescreve REVISADA e replica para aulas idênticas de outros cargos.
  Piloto: PMPE Soldado – Direito Constitucional (6 aulas, escritas pelo Claude) → 16 aulas em rascunho.
- Ofertas: `promo_ends_at` + `effectiveOfferPrice` — depois do último dia da promoção o site e o checkout cobram o
  preço "de" automaticamente. Admin da loja tem "Promoção até".
- Pendente (decisão do usuário 30/09): combos por cargo "de R$ 59,90 por R$ 29,90 até 31/12/2026" com Teoria +
  Premium 6 meses + 1 correção de redação/mês — criar junto com o **módulo de redação** (ainda não existe).

### 13.39 Premium inclui todos os cursos; combos por cargo (01/10/2026)

- Decisão do usuário: assinatura Premium (mensal R$ 14,90 e anual R$ 118,80) dá acesso a **todos os cursos**; os combos
  de cargo dão Premium (questões) por 6 meses + **só o curso do cargo**. Novo tipo de acesso `ALL_COURSES` (migration
  `20260930200000_all_courses_access`, só amplia os CHECKs): concedido pela assinatura a cada cobrança aprovada e por
  ofertas com "Premium inclui todos os cursos" (admin da loja). `hasCourseAccess`/`listMyCourses` consideram.
- Gravado: `premium-anual` + `ALL_COURSES` 365 dias; 7 combos ativos (`combo-pmpe-2026-soldado`, `-oficial-qopm`,
  `-oficial-medico-clinica-geral`, `-oficial-medico-cirurgia-geral`, `-oficial-dentista`, `combo-cbmpe-2026-soldado`,
  `-oficial-qoc`): de R$ 59,90 por R$ 29,90 até 31/12/2026, Teoria Completa sem prazo + Premium 180 dias, texto de
  **pré-venda** (aulas liberadas progressivamente, todas as matérias até 31/12/2026). Os 7 cursos foram publicados;
  combos de Soldado ligados às páginas dos concursos. Log: `data-private/logs/combos-teoria-*.json`.
- Pendente: escrever/revisar as aulas até 31/12/2026 (compromisso da pré-venda); módulo de redação (1 correção/mês no
  combo ainda **não** é prometida na oferta); Mercado Pago real.

### 13.40 Leads: edital verticalizado em PDF mediante cadastro (01/10/2026)

- Decisão: a página do edital verticalizado continua pública (SEO); o **PDF** exige nome, e-mail e WhatsApp.
  Consentimento de divulgação é separado, opcional e desmarcado (LGPD); o PDF é liberado de qualquer forma.
- Módulo `src/modules/leads`: `planLead`/`normalizeWhatsapp` (celular BR com DDD), `saveSyllabusLead` (uma linha por
  e-mail + cargo; IP só como HMAC; limite de 8 pedidos/hora por rede; honeypot no formulário), `buildSyllabusPdf`
  (pdf-lib 1.17.1, fontes padrão: capa com a marca, resumo da prova, tabela por matéria com caixas Teoria / Questões /
  Rev. 1 / Rev. 2, página final com o site). Migration aditiva `20261001100000_leads` (RLS, CHECKs).
- Rotas: formulário em `/concursos/[slug]/o-que-estudar/[cargo]#pdf` (link também nos cards da página do concurso);
  download em `/api/edital-verticalizado/[leadId]` (id não adivinhável, até 30 downloads por link, `noindex`).
- Admin: `/admin/leads` (filtro por origem e por consentimento) e `/admin/leads/exportar` (CSV `;` com BOM, células
  protegidas contra fórmulas). Política de privacidade atualizada (item "Materiais gratuitos").
- Pendente: descadastro por link (hoje `unsubscribed_at` só pelo banco); envio do PDF por e-mail; mesma captura para
  outros materiais (o campo `source` já existe).

### 13.41 Conteúdo: Língua Portuguesa (01/10/2026)

- Rascunhos das 18 aulas de Língua Portuguesa (escritos pelo Claude; `data-private/editorial/teoria/lingua-portuguesa-{01-09,10-18}.json`)
  carregados com `theory:drafts` → 72 aulas em RASCUNHO (PMPE Soldado e QOPM, CBMPE Soldado e QOC). Falta revisão humana.
- `theory:drafts` agora acha aulas gêmeas ignorando maiúsculas (os editais variam "Textuais"/"textuais").
- Correção de carga: 4 assuntos dos cargos de Oficial terminavam com "Língua Estrangeira -" (sobra do rótulo seguinte);
  texto e título das aulas corrigidos (log `data-private/logs/syllabus-topic-fix-*`), montador `build-syllabi.cjs` ajustado.
- Situação da Teoria Completa do Soldado PMPE: 24 de 60 aulas em rascunho (Português 18, Direito Constitucional 6);
  faltam História de PE (8), Raciocínio Lógico (4), Informática (7) e Direitos Humanos e Legislação Extravagante (17).

### 13.42 Conteúdo: Soldado PMPE com todas as aulas em rascunho (01/10/2026)

- Rascunhos carregados com `theory:drafts` (arquivos em `data-private/editorial/teoria/`): História de Pernambuco
  (8 assuntos → 40 aulas com as gêmeas dos outros cursos), Raciocínio Lógico (4 → 12), Informática (7 → 28) e
  Direitos Humanos e Legislação Extravagante (18, só Soldado PMPE; `direitos-humanos-legislacao-{01-09,10-18}.json`).
- **Soldado PMPE: 61 de 61 aulas em RASCUNHO.** Nenhuma está REVISADA — o aluno ainda não vê texto. Falta a revisão
  humana em `/admin/cursos` (aula por aula, mudar para "Revisado").
- Correção de carga: 5 assuntos vinham colados no edital ("…2025.).18. Súmulas"); separados em assuntos próprios, com
  aulas geradas e reordenadas (log `data-private/logs/syllabus-topic-split-*`; título da aula 17 corrigido depois,
  log `lesson-title-fix-*`). `build-syllabi.cjs` ganhou a regra de "descolar". Direitos Humanos passou de 17 para 18.
- Pontos para o revisor conferir com cuidado em Direitos Humanos e Legislação:
  - Aula 14 (Lei Estadual 6.783/1974): escrita a partir do texto em legis.alepe.pe.gov.br; conferir a redação atual
    (círculos, estabilidade com 10 anos, limite de 30 dias) e o que o Código Disciplinar (Lei 11.817/2000) mudou.
    O art. 5º, § 2º, da lei ainda fala em carreira de Oficial privativa de brasileiro nato — não entrou na aula.
  - Aulas 9 e 17 tratam da mesma lei (o edital lista a Maria da Penha duas vezes): a 9 traz conceitos, a 17 o
    atendimento policial e as medidas protetivas.
  - Aula 12: rol de hediondos e frações de progressão; aula 13: tese do STF sobre maconha (RE 635.659);
    aulas 10 e 17: penas alteradas em 2023 e 2024. Conferir se houve mudança legislativa depois.
- Próximo: matérias que faltam nos outros cursos (CBMPE Soldado: Matemática, Física, Biologia, Atualidades e o resto de
  Direito Constitucional; Oficiais; saúde). Compromisso público: todas as matérias até 31/12/2026.

### 13.43 Taxonomia v9 e classificação manual (01/10/2026)

- Catálogo v9 (`concursos-taxonomy-v9.ts`): áreas, subtópicos e detalhes pedidos durante a revisão manual
  (Direito Penal Militar: Teoria do Crime › Exclusão do Crime, Extinção da Punibilidade › Prescrição,
  Crimes Militares em Tempo de Guerra › Favorecimento ao Inimigo › Traição, Lei penal no tempo;
  História › Brasil Colônia › Invasões holandesas). Só acrescenta, dentro de pais já existentes
  (`withV9Additions` falha se o pai não existe). `taxonomy:seed` (dry-run, depois `--apply`).
- **Gabarito comentado:** campo na tela `/admin/questoes/[id]/editar` (salvo à parte, entra no histórico da
  questão); o aluno o vê com negrito e tabelas (renderizador do blog) depois de responder.
- **`npm run questions:annotate -- <lote>.json [--apply]`** (JSON por questão: `number`, `discipline`,
  `topic`, `subtopic`, `correct`, `explanation`, `changeKnowledgeArea`): classifica por nomes existentes,
  confere o gabarito informado, grava comentário e revisão, log de reversão em `data-private/logs/`.
  Em lote, um único push ao fim.
- Questão importada na área errada: `changeKnowledgeArea: true` no item (decisão explícita do revisor).

### 13.44 Busca na classificação e no explorar (01/10/2026)

- A lista de classificação da revisão (centenas de opções) ganhou um campo de busca (sem acento, sem
  caixa). A busca do explorar (`/app/questoes?q=`) agora também acha pelo nome do tópico, subtópico e detalhe
  (via slug, sem acento). Só aparecem no filtro classificações com ao menos uma questão **publicada**.

### 13.45 Criar classificação pela tela (01/10/2026)

- Na revisão da questão: "Não achou? Criar nova classificação" (matéria + Tópico › Subtópico › Detalhe).
  `classifyWithManualPath`: reaproveita o que existe (nome normalizado ou apelido), cria só o que falta,
  classifica a questão e registra `taxonomy.create` em `admin_audit_logs`. Só administrador; matéria nova
  continua só por catálogo. Subtópico já existente em outro tópico é barrado com indicação do lugar.
- `npm run taxonomy:export-manual` lista as criações manuais para incorporar ao catálogo do código
  (o banco já as tem; o catálogo só importa se o banco for recriado).

### 13.46 Publicação em produção (01/10/2026)

- Site em `www.soubizurado.com.br` (Hostinger Business, Web App Node.js, Node 22). Guia completo e
  particularidades do host em `docs/DEPLOY.md`. Next.js 16.3.8 (corrige a CVE crítica de `next/og`).
- Problemas resolvidos no caminho: build na glibc antiga (webpack + SWC wasm + `next.config.mjs`); HTTP 500 por
  pool de conexões (cliente Prisma único por processo); conta GitHub ligada à Hostinger diferente da de
  trabalho (dois repositórios, commit de junção); DNS (domínio no registro.br, registros A/CNAME lá).
- Mercado Pago: app "SouBizurado" com Checkout Pro (API de Preferences). Variáveis na Hostinger:
  `MERCADOPAGO_ACCESS_TOKEN` (Access Token de produção) e `MERCADOPAGO_WEBHOOK_SECRET` (assinatura secreta).
  Public Key, Client ID e Client Secret não são usados. Valores nunca no Git nem no chat.

### 13.47 Loja: imagens, alinhamento e loja interna (01/10/2026)

- `offers.card_image_asset_id` (migration `20261001150000_offer_card_image`): imagem no topo do card da
  Loja (16:9, 1200×675), enviada em `/admin/loja`. Sem imagem própria, o card usa a capa do primeiro curso
  da oferta (`courses.cover_asset_id`, enviada em `/admin/cursos`). Imagens servidas por
  `/api/loja/banners/[id]` (ofertas ativas e cursos publicados).
- Cards alinhados: preço e botão na base de cada card (flex coluna, `margin-top:auto`); borda do card
  destacado por `box-shadow` para não alterar a altura.
- **Loja dentro da conta:** `/app/loja` e `/app/loja/[slug]` (componentes compartilhados em
  `src/app/loja/_components/`). Usuário logado que abre `/loja` é redirecionado. `loadOfferOwnership`
  (`offer-ownership.ts`): oferta "já adquirida" quando tudo que ela concede está ativo (Premium; curso próprio
  ou `ALL_COURSES`); mostra "acesso até DD/MM/AAAA" e "Ir para meus cursos". Assinante Premium vê os combos
  como já incluídos. O retorno do pagamento continua em `/loja/retorno` (público).

### 13.48 Área do aluno: menu recolhível e painel (01/10/2026)

- Menu lateral com ícones (`nav-icons.tsx`, SVG próprio) e botão de recolher (só desktop ≥ 1100 px; a gaveta
  móvel não muda). Estado no cookie `sb_menu` (`recolhido`/`expandido`), lido no servidor (sem "piscar").
  Largura recolhida 76 px (`--sb-sidebar-width` via `data-sidebar`).
- Painel: bloco do topo compacto (sem parágrafo, título menor). "Meus cursos": capa 16:9 e barra de progresso +
  botão alinhados na base.

### 13.49 Importação de provas AOCP de 2016 a 2020 (01/10/2026)

- Pasta `data-private/imports/provas-instituto-aocp` (88 PDFs = 42 provas com gabarito). Fluxo usado:
  1. `npm run import:analyze-folder -- <pasta>`: pareia prova e gabarito (nomes `-prova`/`-gabarito`, `(1)` idênticos
     ignorados), analisa tudo **sem gravar no banco** e gera um CSV em `data-private/logs/analise-pasta-*.csv`.
  2. Escrever um manifesto (`data-private/imports/manifesto-aocp-*.json`: órgão, cargo, ano, mapeamento das seções,
     `ranges` para recortar seções, `skip` para questões que o leitor não consegue ler).
  3. `npm run import:manifest -- <manifesto>` (dry-run) e depois `--apply`: importa uma prova por vez, idempotente.
     As questões entram **em revisão**. Para uma prova avulsa: `npm run import:confirm-analysis`.
- Leitor AOCP ampliado (`aocp-pdf-parser.ts`, `analyze-official-exam.ts`, `aocp-grid-answer-key.ts`): número da
  questão na mesma linha do enunciado ("3. Assinale..."); gabarito em grade por cargo e por "Prova N" (letras de A a E
  e X = anulada); PDF com 4 versões da prova (lê só a da capa); cadernos Certo/Errado (PM-CE 2016, leitor V/F com
  C/E); órgão e cargo lidos da capa de 2019-2020; conferência do total anunciado na capa ("01 a 50").
- A transação de importação de cada questão passou de 5 s para 60 s (questões lentas falhavam sozinhas).
- Resultado da análise: 29 provas importáveis; **ficaram de fora** (leitor ainda não cobre): Novo Hamburgo ×4
  (número da questão sem negrito), UFOB TI ×2 (leitor V/F lê só metade), IBGE Web Design (cargo não casa no
  gabarito), Emprel (alternativas ausentes), Prodeb ×3 (seções ilegíveis).
- Questões fora das provas importadas por alternativas que são fórmulas/imagens vetoriais: Câmara de Cabo Advogado
  Q16 e Q18, PC-ES Investigador Q14 (cadastrar à mão se quiser).

### 13.50 Camada de classificação aprendida (01/10/2026)

- Contexto: a IA remota (Gemini) respondeu **HTTP 402** (sem crédito) e o modelo local (Ollama `qwen2.5:3b`) levou
  ~40 s por questão (1.366 pendentes = ~15 h). Em vez de depender de IA, o pipeline ganhou uma camada que **aprende
  com as questões já classificadas e publicadas**: `src/modules/classification/infrastructure/similar/`.
- Como funciona (`SimilarQuestionClassifier`): vetores TF-IDF (palavras e pares) de enunciado + alternativas;
  dentro da Matéria da questão combina (1) vizinhas mais parecidas e (2) "centróide" de cada Subtópico (vocabulário
  médio). Confiança calibrada em leave-one-out: **≥ 0,95 ≈ 93% de acerto, ~7% de cobertura** sobre as publicadas;
  nas pendentes de hoje responderia ~9% (122 de 1.366). Medir de novo: `npm run classification:calibrate-similar`.
- Só questões **publicadas** servem de exemplo (as em revisão podem ter sugestão de máquina não conferida). Logo,
  **cada lote que você classifica e publica melhora a camada** (e a cobertura cresce).
- Pipeline agora: metadados → regras → **aprendida** → IA local (opcional) → IA remota. Versões `lay3`/`lay4`
  (nova versão = tarefas novas). Variáveis: `CLASSIFIER_SIMILAR` (padrão ligado), `CLASSIFIER_SIMILAR_THRESHOLD` (0,95),
  `CLASSIFIER_REMOTE_AI=false` (só camadas gratuitas; o que não responde fica sem sugestão para revisão manual).
- Rodada de hoje (`CLASSIFIER_REMOTE_AI=false`, versão `lay3:no-remote`): 1.366 tarefas → **147 classificadas**
  (51 por regras, 96 pela camada aprendida) e **1.219 sem sugestão**. Painel `/admin/classificacao` mostra também
  "Aprendidas de questões já classificadas".
- Limite honesto: a base publicada tem ruído (mesma questão em Subtópicos diferentes) e muitos Subtópicos com poucos
  exemplos; a precisão não passa de ~93%. Para ampliar a cobertura: classificar e publicar mais, e recarregar crédito
  da IA externa (`CLASSIFIER_REMOTE_AI` volta ao normal).
