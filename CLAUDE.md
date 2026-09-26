# SouBizurado — instruções para agentes

Plataforma de estudos (ENEM/concursos) em Next.js 16 + TypeScript, Prisma 7 (PostgreSQL/Supabase),
autenticação Supabase. Comunicação com o usuário em **português**.

## Antes de qualquer coisa

1. Leia `docs/HANDOFF-BACKOFFICE-TAXONOMY-CLASSIFICATION.md` (estado atual e próximos passos)
   e, para ingestão/mídia, `docs/HANDOFF-ADMIN-QUESTION-BANK.md`.
2. Rode `git status --short` e `git log --oneline -15` e confira se bate com o handoff.
3. Trabalhe em passos pequenos; peça aprovação antes de gravações reais no banco.

## Regras obrigatórias

- Não resetar o projeto nem descartar trabalho; nada de `git reset --hard`, `npm audit fix`.
- Migrations aplicadas são imutáveis; mudanças de schema só por migration **aditiva**.
- RLS sempre habilitada em tabelas novas; nunca usar `service_role` no client.
- Não expor `.env` nem segredos; chaves de API são colocadas pelo próprio usuário no `.env`.
- Autorização sempre server-side (`requireAdminUser` em layout **e** em cada server action);
  nunca confiar em `user_metadata` ou no frontend.
- Publicar questões só pela política (`validateQuestionForPublication` / `publishQuestionAction`).
- Taxonomia é controlada: nem IA nem importadores criam disciplinas/tópicos.
- Aplicar sugestões de classificação só via `applyClassificationSuggestion`.
- Não reimportar ENEM 2024 nem refazer importações para corrigir taxonomia ou mídia.
- `data-private/` (mídias, PDFs, logs de reversão) não vai para o Git — ausência no repositório é esperada.
- Gravações em massa: dry-run primeiro + log de reversão em `data-private/`.

## Verificação após mudanças

```
npm run typecheck
npm run lint -- --max-warnings=0
npm test
```

Mudanças visíveis: conferir no navegador em 375px e 1366px. Commits contêm só arquivos
relacionados e terminam com a linha de coautoria usada no histórico.

## Armadilhas conhecidas

- Após `npm run db:generate`, reinicie o `npm run dev` (Prisma Client fica em cache).
- CSS modules sem BOM UTF-8 no início (o bundler descarta a primeira regra).
- Avisos LF → CRLF no Windows não são erro.
