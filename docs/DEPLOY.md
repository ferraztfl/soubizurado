# Publicação do SouBizurado (www.soubizurado.com.br)

Guia para colocar o sistema no ar. Estado em 01/10/2026: `npm run build` conclui sem erros; o banco, a
autenticação e a mídia já estão no Supabase (o mesmo projeto usado no desenvolvimento), então publicar é
hospedar a aplicação Next.js e apontar o domínio.

## 1. O que é preciso hospedar

- Aplicação **Next.js 16 com servidor Node** (Node 20.9 ou superior; desenvolvido em Node 24). Não é site
  estático nem PHP: hospedagem compartilhada só de WordPress/PHP **não serve**.
- Nada de banco na hospedagem: PostgreSQL, login e arquivos ficam no Supabase.
- Comandos: instalar `npm ci` (gera o cliente Prisma no `postinstall`), compilar `npm run build`, iniciar
  `npm run start` (porta da variável `PORT`).

## 2. Onde hospedar

| Opção | Quando usar | Observações |
|---|---|---|
| **Hostinger com aplicação Node.js** | Se o plano atual oferecer "Node.js" / "Web app" no hPanel (planos Business e Cloud) | Sem custo extra; conecta ao GitHub; domínio já está lá |
| **Vercel (plano Pro)** | Se o plano da Hostinger for só WordPress/PHP | Publicação mais simples para Next.js. O plano gratuito (Hobby) **não permite uso comercial**, e o site vende assinatura. Limite de 4,5 MB por envio: o upload de provas em PDF pelo admin não funciona lá (continua funcionando no computador local) |
| **Hostinger VPS** | Se quiser tudo na Hostinger sem trocar de plano compartilhado | Exige administrar o servidor (Node, PM2, Nginx, certificado) |

## 3. Variáveis de ambiente (produção)

Valores são colocados pelo dono do projeto no painel da hospedagem — nunca no Git nem em conversas.

Obrigatórias:

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | PostgreSQL do Supabase (usar a conexão com pool, "transaction pooler") |
| `NEXT_PUBLIC_SUPABASE_URL` | Endereço do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase |
| `SUPABASE_SECRET_KEY` | Chave secreta (só servidor): mídia privada, convites de usuário |
| `NEXT_PUBLIC_SITE_URL` | `https://www.soubizurado.com.br` (links, sitemap, e-mails, retorno de pagamento) |
| `VISITOR_HASH_SECRET` | Texto longo e aleatório: limites de visitantes e de pedidos de PDF sem guardar IP |
| `MEDIA_STORAGE_DRIVER`, `SUPABASE_MEDIA_BUCKET` | `MEDIA_STORAGE_DRIVER=supabase` (sem isso as imagens das questões não aparecem) e o nome do bucket privado, igual ao do `.env` local |

Quando forem ativadas:

| Variável | Para quê |
|---|---|
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Pagamentos (sem elas a loja mostra os produtos, mas não cobra) |
| `QUEST_API_KEY` / `QUEST_API_KEYS` | API de questões para parceiros |
| `CLASSIFIER_*` | Classificação por IA (hoje roda só no computador local) |
| `DATABASE_POOL_MAX` | Limite de conexões por instância (em hospedagem "serverless", usar 1 a 3) |

Só para uso local (não configurar em produção): `MEDIA_STAGING_LOCAL_ROOT`, `MEDIA_STORAGE_LOCAL_ROOT`,
`OFFICIAL_EXAMS_LOCAL_ROOT`, `BATCH_IMPORT_INBOX`, `NOTICE_AI_LOCAL_*`, `CLASSIFIER_LOCAL_*`.

## 4. Passo a passo

1. **Backup do WordPress** (arquivos + banco) pelo hPanel, e guardar fora da Hostinger. Só depois remover.
2. Definir o ramo de produção no GitHub (`main`) e levar para ele o trabalho de `feature/enem-pdf-ingestion`.
3. Criar a aplicação na hospedagem escolhida, ligada ao repositório `ferraztfl/soubizurado`, com as
   variáveis da seção 3.
4. Testar no endereço provisório da hospedagem (página inicial, login, uma questão, loja, admin).
5. **Supabase → Authentication → URL Configuration**: Site URL `https://www.soubizurado.com.br` e, em Redirect
   URLs, `https://www.soubizurado.com.br/**` (manter `http://localhost:3000/**` para desenvolvimento).
   Sem isso, cadastro, convite e redefinição de senha mandam o usuário para o endereço errado.
6. Apontar o domínio: `www` para a aplicação e `soubizurado.com.br` redirecionando para `www`. Conferir o
   certificado HTTPS.
7. Conferir `https://www.soubizurado.com.br/robots.txt` e `/sitemap.xml` e cadastrar o sitemap no Google
   Search Console.

## 5. O que continua sendo feito no computador local

Estas rotinas usam arquivos de `data-private/` e scripts de linha de comando, e gravam no mesmo banco:
importação de provas oficiais e de editais, classificação por IA, `taxonomy:seed`, `theory:drafts`,
`questions:annotate`, `media:*`. Migrations: `npm run db:migrate:deploy` a partir do computador local, antes
de publicar código que dependa delas.

## 6. Pendências conhecidas antes de divulgar

- Mercado Pago ainda não configurado: compras e assinaturas não concluem.
- Teoria Completa em pré-venda: aulas sem texto revisado não aparecem para o aluno.
- E-mails do Supabase (confirmação, redefinição de senha) saem pelo remetente padrão, com limite baixo de
  envios por hora; para volume real, configurar SMTP próprio no Supabase.
- Descadastro de leads por link ainda não existe.
