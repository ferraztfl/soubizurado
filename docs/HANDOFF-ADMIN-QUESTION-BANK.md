# Handoff — SouBizurado — Backoffice Administrativo e Banco de Questões

**Data do handoff:** 21/09/2026
**Branch no momento da geração:** `feature/enem-pdf-ingestion`
**HEAD no momento da geração:** `20f474a`

---

## 1. Objetivo deste documento

Este documento registra o estado exato do trabalho relacionado a:

- ingestão de questões;
- ingestão e renderização de mídias;
- revisão editorial;
- autorização administrativa;
- classificação taxonômica;
- publicação de questões;
- futura automação por IA;
- cadastro manual de questões;
- importação em massa via PDF, JSON, CSV, XLSX e outros formatos;
- criação do verdadeiro Backoffice Administrativo do SouBizurado.

Se uma nova conversa for iniciada, a continuidade deve partir deste arquivo.

---

# 2. Estado geral atual

O pipeline técnico principal para importação de questões e mídias já foi provado.

Fluxo validado:

```text
PDF
 ↓
parser/provider
 ↓
QuestionCandidate
 ↓
importação
 ↓
deduplicação
 ↓
Question / QuestionAlternative
 ↓
fila de mídia
 ↓
MediaAsset
 ↓
storage local
 ↓
API /api/media/:id
 ↓
interface React

A renderização real de imagem extraída de PDF foi validada visualmente com uma questão do ENEM 2024 contendo gráfico.

Portanto, o problema atual NÃO é mais:

parsing básico do PDF;
armazenamento da imagem;
associação da imagem à questão;
leitura física do arquivo;
endpoint HTTP da mídia;
renderização da mídia no navegador.

O trabalho passa agora para:

Backoffice + Taxonomia + Automação Editorial + Importações Administrativas.

3. ENEM 2024 — estado congelado

O ENEM 2024 já foi importado e NÃO deve ser reimportado apenas para corrigir classificação.

Arquivo utilizado:

D:\SouBizurado\data-private\ENEM 2024.pdf

Checksum conhecido:

34babb45c6c4849495c413a8ba8248a473839f88877516ddb1b98a9b43f35f44

Source reference:

gran-enem-2024-pdf-29401523

Resultado da ingestão:

Questões parseadas:       189
Referências de mídia:     132
  - questão:               72
  - alternativas:          60

Importadas:                65
Duplicadas:               108
Revisão necessária:        16
Falhas:                      0

Jobs de aceitação:

fa9c89d6-0944-4b02-9528-5785bf1e048f
received: 100
imported: 32
duplicates: 58
review: 10
d17e2a13-139a-4a91-99b3-301c1acb2920
received: 89
imported: 33
duplicates: 50
review: 6

A fila de mídia do ENEM 2024 foi processada.

Os dois itens FAILED históricos existentes na fila são mídias LaTeX antigas do ENEM 2018 e NÃO devem ser tratados como falhas do ENEM 2024.

Não apagar, resetar ou reprocessar indiscriminadamente essas entradas.

4. Storage de mídia — decisão importante

Foi confirmado que LocalMediaStorage.put() salva usando:

rootDirectory + storageKey

e NÃO:

rootDirectory + bucket + storageKey

O bucket é metadado lógico.

Estrutura física observada:

data-private/
└── media-store/
    └── sha256/

O helper correto é:

src/modules/question-bank/infrastructure/media/local-public-media.ts

Commit relevante:

ebfaa19 fix(question-bank): align local media paths

Não reintroduzir bucket na resolução física do arquivo.

5. Renderização de mídia

Já existe suporte para mídia em:

enunciado da questão;
alternativas;
preview de questão;
documentos associados quando aplicável.

Arquivos principais:

src/app/app/questoes/_components/question-media.tsx
src/app/app/questoes/_components/question-media.module.css
src/app/app/questoes/[questionId]/page.tsx
src/app/app/questoes/[questionId]/_components/question-answer-panel.tsx
src/app/app/questoes/_components/question-preview-card.tsx

Commit relevante:

5d84817 feat(question-bank): render question media

A imagem real do gráfico da questão do ENEM 2024 foi validada no navegador.

6. Problema editorial identificado

Foi executado diagnóstico em 200 questões IN_REVIEW contendo mídia.

Resultado:

{
  "inspected": 200,
  "missingSource": 0,
  "missingDiscipline": 0,
  "missingTopic": 200,
  "definedAnswerKey": 200,
  "publicationIssues": {
    "TOPIC_REQUIRED": 200,
    "ALTERNATIVE_CONTENT_REQUIRED": 35
  }
}

Conclusão:

200/200 possuem source;
200/200 possuem discipline;
200/200 possuem gabarito DEFINED ou VERIFIED;
200/200 não possuem topicId;
35 possuem pelo menos uma alternativa sem conteúdo textual.

A ausência de tópico é atualmente o principal bloqueio em massa.

As 35 questões com alternativas vazias precisam de tratamento editorial adicional e NÃO devem ser autopublicadas apenas após classificação taxonômica.

7. Política de publicação

A política existente deve continuar sendo a autoridade.

Arquivo:

src/modules/question-bank/domain/question-publication-policy.ts

Para uma questão de múltipla escolha ser publicável, entre outras regras, precisa possuir:

enunciado;
origem;
disciplina;
tópico;
alternativas válidas;
exatamente uma alternativa correta.

Questões TRUE_FALSE seguem a regra específica do domínio.

Nunca alterar diretamente status = PUBLISHED para contornar essa política.

8. Preview/revisão administrativa atual

Foi criada uma tela de revisão para visualizar questões IN_REVIEW com mídia real.

Rota provisória:

/app/revisao-questoes

Detalhe:

/app/revisao-questoes/[questionId]

Ela permite verificar:

enunciado;
imagens;
alternativas;
gabarito;
disciplina;
prova;
pendências de publicação.

Posteriormente foi adicionada uma interface de:

seleção de tópico;
salvar classificação;
botão de publicação condicionado às regras.

A interface já foi visualizada no navegador.

Observação importante:

o SHA do eventual commit da etapa de classificação/publicação deve ser confirmado com:

git log -5 --oneline
git status --short

pois o terminal dessa implementação não foi registrado integralmente na conversa.

9. Autorização administrativa

O projeto JÁ possuía RBAC.

Enum atual:

AppRole:
- STUDENT
- EDITOR
- MODERATOR
- ADMIN

Modelos existentes:

Profile
UserRole

Não criar um sistema paralelo de permissões.

Foi criado:

src/modules/identity/application/require-admin-user.ts

Também foram criados testes:

src/modules/identity/application/require-admin-user.test.ts

E proteção da revisão:

src/app/app/revisao-questoes/layout.tsx

Commit confirmado:

34b741d feat(identity): protect question review as admin

Após esse commit:

Test Files: 31 passed
Tests:      127 passed

A abertura da área administrativa foi validada no navegador.

10. Bootstrap administrativo atual

Por enquanto existe apenas um administrador operacional.

Variável local:

SOUBIZURADO_ADMIN_EMAIL=thiagoferrazdm@gmail.com

O bootstrap:

valida usuário pelo Supabase Auth;
exige e-mail confirmado;
compara com SOUBIZURADO_ADMIN_EMAIL;
cria UserRole.ADMIN apenas para essa conta;
acessos posteriores dependem do papel persistido no banco.

Não confiar em user_metadata como fonte de autorização.

Não liberar ADMIN automaticamente para outros usuários.

11. Decisão arquitetural tomada neste ponto

A revisão questão-a-questão NÃO escala.

O SouBizurado precisa de um verdadeiro:

Backoffice Editorial do Banco de Questões

O administrador não deve trabalhar como alguém que "corrige importações".

Deve operar um pipeline editorial.

Arquitetura conceitual:

                     ÁREA ADMINISTRATIVA
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
 Questão manual       Importação em massa     Taxonomia
        │                    │                    │
        │        PDF / JSON / CSV / XLSX         │
        │                    │                    │
        └────────────► NORMALIZAÇÃO ◄────────────┘
                             │
                       QuestionCandidate
                             │
                ┌────────────┴────────────┐
                │                         │
        Deduplicação                 Mídias
                │              otimização/storage
                │                         │
                └────────────┬────────────┘
                             │
                   CLASSIFICAÇÃO AUTOMÁTICA
                             │
           disciplina / tópico / subtópico / tags
                             │
                      score de confiança
                             │
              ┌──────────────┴──────────────┐
              │                             │
        alta confiança               baixa confiança
              │                             │
       fluxo automático             fila humana
              │                             │
              └──────────────┬──────────────┘
                             │
                  política de publicação
                             │
                         PUBLISHED
12. Área administrativa definitiva

A rota provisória /app/revisao-questoes deve futuramente deixar de ser o centro administrativo.

Estrutura desejada:

/admin
/admin/dashboard

/admin/questoes
/admin/questoes/nova
/admin/questoes/[id]
/admin/questoes/revisao

/admin/importacoes
/admin/importacoes/nova
/admin/importacoes/[jobId]

/admin/taxonomia
/admin/taxonomia/disciplinas
/admin/taxonomia/topicos
/admin/taxonomia/subtopicos
/admin/taxonomia/aliases

/admin/midias

/admin/usuarios

/admin/layout.tsx deve executar:

requireAdminUser()

Além da proteção do layout, toda Server Action sensível também deve executar autorização server-side.

Nunca depender apenas da interface para segurança.

13. Cadastro manual de questões

Criar:

/admin/questoes/nova

Campos previstos:

Tipo da questão
Enunciado

Imagem(ns) do enunciado

Alternativa A
  texto
  imagem opcional

Alternativa B
  texto
  imagem opcional

...

Gabarito

Banca
Prova
Ano

Disciplina
Área
Tópico
Subtópico

Fonte

Resolução / explicação
Tags

Ações:

Salvar rascunho
Classificar automaticamente
Enviar para revisão
Publicar

Também deve existir um modo de cadastro rápido de várias questões manualmente.

14. Importação administrativa

Criar Central de Importações:

/admin/importacoes

Nova importação:

/admin/importacoes/nova

Formatos inicialmente previstos:

PDF
JSON
CSV
XLSX

Futuramente:

ZIP
DOCX
API
URL

Todos os formatos devem convergir para o MESMO pipeline interno.

Não implementar bancos de questões paralelos para cada formato.

15. PDF

A infraestrutura existente do ENEM PDF deve ser reutilizada.

O que hoje é executado via CLI:

npm run import:questions ...

deverá futuramente poder ser acionado pelo painel administrativo.

Exemplo:

/admin/importacoes/nova

[Arrastar ENEM 2025.pdf]

Arquivo recebido
189 questões detectadas
132 mídias detectadas

[Processar]

Tela de resultado deverá mostrar algo como:

Questões encontradas
Importadas
Duplicadas
Revisão necessária
Falhas

Mídias detectadas
Mídias processadas
Falhas de mídia
16. JSON

Definir um schema oficial de importação SouBizurado.

Exemplo conceitual:

{
  "questions": [
    {
      "statement": "...",
      "alternatives": [
        {
          "label": "A",
          "content": "..."
        }
      ],
      "answer": "A",
      "discipline": "Matemática",
      "topic": "Funções",
      "subtopic": "Função Afim",
      "year": 2024
    }
  ]
}

Disponibilizar no painel:

Baixar modelo JSON
17. CSV / XLSX

Importação tabular deverá aceitar colunas como:

statement
alternative_a
alternative_b
alternative_c
alternative_d
alternative_e
answer
discipline
area
topic
subtopic
board
year
source

Antes de persistir definitivamente, mostrar preview:

1.245 linhas detectadas

1.203 válidas
19 possíveis duplicatas
18 incompletas
5 inválidas
18. Mídias enviadas manualmente

Deve ser possível anexar imagem:

ao enunciado;
às alternativas.

Pipeline desejado:

arquivo original
      ↓
validação
      ↓
normalização de orientação
      ↓
limite de dimensões
      ↓
compressão
      ↓
WebP/AVIF otimizado
      ↓
MediaAsset

Não destruir automaticamente o original na ingestão.

Preferência futura:

original
optimized

Interface do aluno utiliza versão otimizada.

A compressão deve preservar leitura de:

fórmulas;
gráficos;
mapas;
tabelas;
diagramas;
textos embutidos em imagem.
19. Taxonomia canônica

A IA NÃO deve criar tópicos arbitrariamente.

A taxonomia deve ser controlada.

Estrutura atual prevista:

Discipline
  ↓
Area
  ↓
Topic
  ↓
Subtopic

Exemplo:

Matemática
└── Funções
    ├── Função Afim
    ├── Função Quadrática
    ├── Função Exponencial
    └── Função Logarítmica

Uma mesma ideia NÃO pode virar cinco registros:

Função Afim
Função do Primeiro Grau
Função 1 Grau
Funções Afins
Função de 1º Grau
20. TaxonomyAlias

Planejar uma estrutura de aliases.

Conceito:

TaxonomyAlias

Exemplo:

Canônico:

Função Afim

Aliases:

Função do 1º grau
Função do primeiro grau
Função linear
Funções afins

O classificador pode receber um termo externo e resolver para uma entidade canônica.

IA nunca deverá criar automaticamente uma nova entidade taxonômica em produção sem fluxo controlado.

21. Classificação automática por IA

A classificação deverá ser restrita às opções existentes.

Exemplo de saída conceitual:

{
  "discipline": "Matemática",
  "area": "Álgebra",
  "topic": "Funções",
  "subtopic": "Função Afim",
  "tags": [
    "interpretação de gráficos",
    "coeficiente angular",
    "reta de tendência"
  ],
  "confidence": 0.96
}

IDs devem ser resolvidos pelo backend.

Nunca confiar em IDs inventados pelo modelo.

22. Exemplo da questão atualmente analisada

Questão ENEM 2024 sobre receitas anuais de uma indústria e uma reta de tendência.

Classificação conceitual discutida:

Disciplina:
Matemática

Área:
Álgebra / Funções

Tópico:
Funções

Subtópico:
Função Afim

Tags possíveis:
Interpretação de gráficos
Coeficiente angular
Reta de tendência
Modelagem matemática

Essa classificação não deve ser usada como justificativa para cadastro manual em centenas de questões.

Ela serviu para demonstrar a necessidade de automação.

23. Score de confiança

A classificação automática deve possuir confidence.

Regra conceitual inicial, ainda não congelada:

confiança alta
→ classificação automática

confiança intermediária
→ classifica + auditoria humana/amostral

confiança baixa
→ revisão humana obrigatória

Os thresholds exatos devem ser calibrados posteriormente com um conjunto de validação real.

Não congelar valores arbitrários sem métricas.

24. Classifier Provider

Não acoplar o SouBizurado a um único fornecedor de IA.

Criar uma porta semelhante a:

interface QuestionClassifier {
  classify(
    input: QuestionClassificationInput,
  ): Promise<QuestionClassificationResult>;
}

Adapters possíveis:

RuleBasedClassifier
LocalModelClassifier
OpenAIClassifier
GeminiClassifier
OpenSourceApiClassifier

A escolha do modelo é infraestrutura, não regra de negócio.

25. Modelos open source

É desejável suportar modelos open source/localmente ou via API.

Entretanto, a arquitetura deve funcionar mesmo sem IA.

Pipeline inicial pode combinar:

aliases
regras
palavras-chave
similaridade textual
embeddings
classificador LLM

IA deve aumentar produtividade, não virar fonte única da verdade.

26. Fila de classificação

Não classificar milhões de questões dentro do request HTTP.

Criar futuramente algo conceitualmente semelhante a:

QuestionClassificationTask

Estados possíveis:

PENDING
PROCESSING
COMPLETED
REVIEW_REQUIRED
FAILED

Campos conceituais:

questionId
status
attempts
nextAttemptAt
provider
model
classifierVersion
taxonomyVersion
confidence
rawResult
errorMessage
createdAt
updatedAt

Seguir o padrão robusto já usado na fila de mídia:

persistente;
retries;
backoff;
processamento concorrente;
idempotência;
retomada após falha.
27. Revisão editorial

Evitar transformar QuestionStatus em dezenas de estados.

Manter:

DRAFT
IN_REVIEW
PUBLISHED
ARCHIVED

Questões específicas de revisão podem ser representadas separadamente.

Possíveis issues:

NEEDS_TAXONOMY
NEEDS_ANSWER_REVIEW
NEEDS_MEDIA_REVIEW
POSSIBLE_DUPLICATE
ALTERNATIVE_CONTENT_MISSING
AI_LOW_CONFIDENCE

Avaliar futuramente uma entidade como:

QuestionReviewIssue
28. Processamento em lote

O backoffice deve permitir:

selecionar 1
selecionar 100
selecionar 10.000

e executar ações como:

Classificar
Reclassificar
Enviar para revisão
Publicar elegíveis
Arquivar
Reprocessar IA
Reprocessar mídia

Sempre respeitando:

política de publicação;
segurança;
idempotência;
limites operacionais.
29. Deduplicação

Reutilizar a infraestrutura existente.

Não remover a deduplicação para facilitar importação em massa.

Com grandes volumes, deduplicação será ainda mais importante.

A classificação por IA também pode contribuir futuramente para detecção de duplicidade semântica, mas não substituir os fingerprints atuais.

30. Segurança obrigatória

Usuários comuns JAMAIS devem acessar a área administrativa.

Regras:

/admin/*
→ ADMIN server-side

Server Actions sensíveis:

requireAdminUser()

O frontend não é uma barreira de segurança.

Não confiar em:

rota escondida;
botão escondido;
variável client-side;
user_metadata;
e-mail enviado pelo browser.
31. Decisões que NÃO devem ser revertidas

Não:

reimportar ENEM 2024 apenas por falta de tópico;
contornar validateQuestionForPublication;
transformar todos os usuários em ADMIN;
criar sistema paralelo de roles;
expor backoffice na Área do Aluno definitivamente;
permitir que IA crie livremente tópicos no banco;
executar classificação pesada dentro de request HTTP;
apagar as duas falhas históricas de mídia do ENEM 2018;
usar bucket como parte física do caminho de LOCAL_FS;
substituir toda a estrutura atual de importação.
32. Ordem recomendada para continuar
Fase 1 — Backoffice

Criar:

/admin
/admin/layout.tsx
/admin/dashboard

Usando:

requireAdminUser()

Depois mover/absorver:

/app/revisao-questoes

para:

/admin/questoes/revisao
Fase 2 — Banco de Questões administrativo

Criar:

/admin/questoes
/admin/questoes/nova
/admin/questoes/[id]
/admin/questoes/revisao

Com:

filtros;
estados;
busca;
seleção em lote;
edição;
revisão;
publicação.
Fase 3 — Taxonomia

Criar gestão de:

Discipline
Area
Topic
Subtopic
TaxonomyAlias

Primeiro garantir catálogo canônico.

Só depois automatizar IA em escala.

Fase 4 — Classificação automática

Criar:

QuestionClassifier
QuestionClassificationTask
worker
confidence
taxonomyVersion
classifierVersion

Começar com uma implementação substituível.

Fase 5 — Cadastro manual

Criar tela para cadastrar:

questão individual;
várias questões manualmente;
imagens;
metadados;
classificação;
gabarito;
origem;
resolução.
Fase 6 — Central de Importações

Criar UI para:

PDF
JSON
CSV
XLSX

reutilizando os providers/pipeline já existentes.

Fase 7 — Automação em massa

Adicionar:

classificação em lote;
revisão em lote;
publicação em lote;
auditoria por amostragem;
métricas de confiança;
reclassificação por nova versão de taxonomia/modelo.
33. Próximo passo exato ao retomar

ANTES de alterar código:

Set-Location 'D:\SouBizurado'
git status --short
git branch --show-current
git log -8 --oneline

Objetivo:

confirmar se a implementação mais recente de classificação/publicação já está commitada;
preservar qualquer working tree existente;
NÃO resetar;
continuar na branch atual;
iniciar a implementação do /admin.

A primeira tarefa arquitetural após essa conferência é:

Criar o shell administrativo /admin, protegido por requireAdminUser(), sem ainda remover a rota provisória de revisão.

Depois:

mover/replicar a experiência de revisão para /admin/questoes/revisao.

34. Arquivos importantes para consultar ao retomar

Autorização:

src/modules/identity/application/require-admin-user.ts
src/modules/identity/application/ensure-profile.ts

Review atual:

src/app/app/revisao-questoes/

Política de publicação:

src/modules/question-bank/domain/question-publication-policy.ts

Banco público:

src/modules/question-bank/

Importações:

src/modules/imports/

Fila de mídia:

src/modules/imports/application/services/process-media-queue.ts

Storage/media pública:

src/modules/question-bank/infrastructure/media/local-public-media.ts
src/app/api/media/[mediaAssetId]/route.ts

Schema:

prisma/schema.prisma
35. Comandos/proibições operacionais

Preservar:

UTF-8
migrations aplicadas
dados existentes
branch atual

Evitar:

git reset --hard
npm audit fix
reimportações destrutivas
alteração de migrations já aplicadas
service_role no client
secrets no repositório

Criar migrations somente quando houver mudança real de schema.

36. Critério de sucesso do próximo ciclo

Ao concluir o próximo grande ciclo, espera-se que exista:

/admin
/admin/questoes
/admin/questoes/nova
/admin/questoes/revisao
/admin/importacoes
/admin/taxonomia

e que:

somente ADMIN tenha acesso;
seja possível cadastrar uma questão manualmente;
seja possível anexar mídia;
seja possível importar lote;
classificação seja compatível com taxonomia controlada;
exista caminho para classificação automática;
questões problemáticas permaneçam em revisão;
publicação continue dependendo da política do domínio.
37. Frase de retomada para uma nova conversa

Em uma nova conversa, utilizar:

Retome o projeto SouBizurado a partir de docs/HANDOFF-ADMIN-QUESTION-BANK.md. Não reimporte o ENEM 2024. Leia primeiro o handoff, depois confira git status, branch e últimos commits. O próximo objetivo é construir o Backoffice /admin e evoluir o Banco de Questões para cadastro manual, importações em massa, taxonomia canônica e classificação automática por fila.

38. Resumo executivo

O motor de ingestão já existe.

O pipeline de mídia já funciona.

A visualização da mídia já funciona.

A política de publicação já existe.

A autenticação e o RBAC já existem.

O acesso ADMIN já foi validado.

O gargalo atual é editorial e operacional:

classificar, revisar, cadastrar e importar grandes volumes sem intervenção manual questão por questão.

Portanto, a próxima fase do SouBizurado é:

BACKOFFICE EDITORIAL + TAXONOMIA + AUTOMAÇÃO

Esse handoff também deixa registrada uma coisa crucial: **quando retomarmos, não vamos voltar a classificar questão por questão nem reabrir o problema da mídia**. O ponto de retomada será diretamente o **Backoffice `/admin` + taxonomia canônica + pipeline de classificação automática + cadastro/importações administrativas**.

Depois que rodar, me envie somente a parte final com `HANDOFF REGISTRADO`, porque aí eu confirmo o commit e seguimos para o `/admin`.