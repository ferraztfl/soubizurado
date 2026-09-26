# Sou Bizurado

Plataforma de preparação para concursos públicos, centrada em resolução de questões, histórico de desempenho e evolução do candidato.

## Status

Projeto em desenvolvimento.

A arquitetura inicial utiliza um **Modular Monolith** com Next.js, React e TypeScript.

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
npm run lint
npm run build
```

## Documentação

A especificação técnica está em:

```text
docs/technical-specification.md
```

## Produção

O ambiente inicial de produção previsto é **Hostinger Business Web Hosting**.

A aplicação deverá permanecer portável e não possuir regras de negócio dependentes do provedor de hospedagem.

## Branches

```text
main
develop
feature/*
```
