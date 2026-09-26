# SouBizurado — instruções para agentes

Plataforma de estudos (ENEM/concursos) em Next.js 16 + TypeScript, Prisma 7 (PostgreSQL/Supabase),
autenticação Supabase, mídia no Supabase Storage (bucket privado). Comunicação com o usuário em
**português**.

## Antes de qualquer coisa

1. Leia `docs/HANDOFF-BACKOFFICE-TAXONOMY-CLASSIFICATION.md` — **§1 (estado atual) e §12 (de onde
   continuar)** primeiro; as demais seções são histórico. Para ingestão antiga/mídia local,
   `docs/HANDOFF-ADMIN-QUESTION-BANK.md`.
2. Rode `git status --short`, `git log --oneline -15`, `npm run classification:status` e
   `npm run media:status` e confira se bate com o handoff.
3. Trabalhe em passos pequenos; peça aprovação antes de gravações reais no banco ou no Storage.

## Mapa rápido

- Backoffice: `src/app/admin/*` (dashboard, `questoes/revisao`, `importacoes`).
- Módulos: `src/modules/{identity,imports,question-bank,study,taxonomy,classification}`.
- Taxonomia: catálogo em `src/modules/taxonomy/infrastructure/catalog/canonical-taxonomy.ts` (v2).
- Importação de provas oficiais: `src/modules/imports/{application,infrastructure}/official-exams/*`
  (leitor AOCP em `infrastructure/providers/aocp-pdf-parser.ts`).
- Mídia: `src/shared/infrastructure/media-storage/*`, rota `src/app/api/media/[mediaAssetId]/route.ts`.
- Scripts: ver `package.json` (`taxonomy:*`, `classification:*`, `media:*`, `import:*`).

## Regras obrigatórias

- Não resetar o projeto nem descartar trabalho; nada de `git reset --hard`, `npm audit fix`.
- Migrations aplicadas são imutáveis; mudanças de schema só por migration **aditiva**.
- RLS sempre habilitada em tabelas novas; nunca usar `service_role`/secret key no client.
- Não expor `.env` nem segredos; chaves (Gemini, `SUPABASE_SECRET_KEY`) são colocadas pelo próprio
  usuário no `.env`. Nunca pedir que colem chaves no chat.
- Autorização sempre server-side (`requireAdminUser` em layout **e** em cada server action);
  nunca confiar em `user_metadata` ou no frontend. Em arquivos `"use server"`, só exportar actions.
- Publicar questões só pela política (`validateQuestionForPublication` / `publishQuestionAction`).
- Taxonomia é controlada: nem IA nem importadores criam disciplinas/tópicos.
- Aplicar sugestões de classificação só via `applyClassificationSuggestion`.
- Não reimportar ENEM 2024 nem refazer importações para corrigir taxonomia ou mídia.
- Não raspar bancos de questões de terceiros (ex.: Gran Cursos); fonte = PDFs oficiais das bancas.
- `data-private/` (PDFs, uploads, staging, logs de reversão) não vai para o Git — ausência é esperada.
- Gravações em massa: dry-run primeiro + log de reversão em `data-private/`.

## Verificação após mudanças

```
npm run typecheck
npm run lint -- --max-warnings=0
npm test
```

Só commitar se o **código de saída** de lint e typecheck for 0. Mudanças visíveis: conferir no
navegador em 375px e 1366px. Commits contêm só arquivos relacionados e terminam com a linha de
coautoria usada no histórico.

## Armadilhas conhecidas

- Reinicie o `npm run dev` após `npm run db:generate`, após mudar `next.config.ts` e após mudar o `.env`.
- Não edite TS/TSX por heredoc Python/shell com barras invertidas (`\n`, `\b`, `\s` viram caracteres
  de controle). Use Edit/Write ou um script em arquivo que recuse caracteres de controle.
- CSS modules sem BOM UTF-8 no início (o bundler descarta a primeira regra).
- `pdftohtml` sem `-i` (senão as imagens são ignoradas).
- `git push` pode demorar >2 min: rode em segundo plano e confira com `git ls-remote`.
- Avisos LF → CRLF no Windows não são erro.
