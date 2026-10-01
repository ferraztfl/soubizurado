# Sou Bizurado

Plataforma de preparação para concursos públicos, centrada em resolução de questões, histórico de desempenho e evolução do candidato.

## Status

**Em produção:** https://www.soubizurado.com.br (banco de questões, área do aluno, loja com Mercado Pago, cursos Teoria Completa em pré-venda, notícias de concursos).

Arquitetura: **Modular Monolith** com Next.js 16, React e TypeScript; Prisma 7 sobre PostgreSQL (Supabase); autenticação e mídia no Supabase.

## Requisitos de desenvolvimento

- Node.js
- npm
- Git

## Desenvolvimento local

```powershell
npm install
npm run dev
```

A aplicação ficará disponível em:

```text
http://localhost:3000
```

## Validação

Antes de considerar uma alteração pronta:

```powershell
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run build
```

## Documentação

- `CLAUDE.md` — regras do projeto e mapa rápido (para quem trabalha no código).
- `docs/HANDOFF-BACKOFFICE-TAXONOMY-CLASSIFICATION.md` — **estado atual (§1) e de onde continuar (§12)**; histórico das etapas.
- `docs/DEPLOY.md` — publicação, variáveis de ambiente, Hostinger, DNS e repositórios.
- `docs/HANDOFF-ADMIN-QUESTION-BANK.md` — ingestão antiga e mídia.
- `docs/technical-specification.md` — especificação técnica inicial (partes do desenho original).

## Produção

Hospedada na **Hostinger (Web App Node.js)**, com banco, login e arquivos no Supabase. Detalhes e passo a passo em `docs/DEPLOY.md`.

A aplicação permanece portável: nenhuma regra de negócio depende do provedor de hospedagem.

## Branches

```text
main
develop
feature/*
```
