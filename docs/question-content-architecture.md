# Question content architecture

## Purpose

This document records the content-model decisions for Sou Bizurado after reviewing common question-bank architectures and comparing them with the constraints already established for this project.

The goal is to support official exam questions, original questions, media, shared support passages, answer-key lifecycle, imports and future comments without coupling the product to one supplier, one PDF parser or one deployment model.

## Decisions kept from the current architecture

### Modular monolith remains the application architecture

The production application remains a Next.js modular monolith.

Question Bank, Study, Media, Imports and Comments are separate application/domain contexts. A separate FastAPI service is not introduced by default.

Python may be used by an import/parser tool when it is the best implementation choice, but it is an implementation detail of ingestion rather than the public application backend.

### PostgreSQL remains the system of record

Canonical taxonomy, examinations, question content, provenance, publication state and study data stay relational.

JSONB may be used for raw import metadata or parser diagnostics, but not as a substitute for canonical relational fields.

### Object storage remains external

PDFs, images and other binary media must not be stored as PostgreSQL BLOBs.

Cloudflare R2 is the preferred object storage.

The database should store stable object keys and media metadata instead of treating a public CDN URL as the canonical identifier. URLs may change, be signed or move behind another delivery domain.

### Import processing remains persistent

The ingestion pipeline remains:

Upload -> ImportJob -> Parser -> Normalizer -> Classifier -> Validator -> Deduplicator -> Review Queue -> Publish.

Scrapers/crawlers may become optional import adapters, but are not the center of the architecture.

Because the target Hostinger environment does not provide a permanent worker process, the product must not require an always-on BullMQ/Celery worker to remain correct. Import jobs are persisted in PostgreSQL and can be processed by an explicit worker/external execution environment when needed.

## Question types

Sou Bizurado keeps only the semantic product types:

- MULTIPLE_CHOICE;
- TRUE_FALSE.

The number of alternatives is data, not a question type. A multiple-choice question with four alternatives and one with five alternatives use the same model.

"Certo/Errado" and "Verdadeiro/Falso" also share the same boolean answer model. If source-specific labels need to be reproduced later, that belongs to presentation/source metadata rather than creating different evaluation domains.

## Answer-key model

QuestionAnswerKeyStatus remains an internal quality/readiness state:

- MISSING;
- DEFINED;
- VERIFIED.

This is different from the lifecycle of an official exam answer key.

A future source-metadata extension may add orthogonal official fields such as:

- official answer-key stage (preliminary/final);
- annulled status;
- answer changed after appeal;
- official board justification.

These fields must not replace the internal verification state.

Annulled questions must not be represented by inventing a correct alternative. Study grading rules will explicitly decide whether an annulled question is excluded from graded practice.

## Examinations and taxonomy

The existing normalized structures are retained:

- ExaminingBoard;
- PublicOrganization;
- CareerPosition;
- Examination;
- Discipline -> Area -> Topic -> Subtopic.

A free-text cargo column inside an exam record is intentionally avoided because CareerPosition is a reusable entity.

Booklet/caderno metadata and original question numbering may be added as source/exam occurrence metadata when ingestion requires them.

## Shared support content

Shared support passages are a valid requirement and are not modeled yet.

They should not be implemented as duplicated text inside every question.

The planned model is a reusable support-content entity associated with one or more questions, with ordering information. This supports cases such as:

"Leia o texto a seguir para responder às questões 1 a 5."

The association should allow future media attachments without coupling support content directly to a storage URL.

## Media

Question and alternative media will be modeled through the Media context.

Preferred direction:

MediaAsset
- id
- storageKey
- mimeType
- byteSize
- width/height when applicable
- altText/accessibility metadata
- checksum
- createdAt

Question Bank stores associations/references to MediaAsset for placements such as:

- question statement;
- alternative;
- shared support content;
- explanation.

Direct binary data is not stored in PostgreSQL.

A raw public URL is not used as the durable database identity.

Image-only alternatives will be supported only after this media association exists; until then, published alternatives continue to require text.

## Explanations and comments

QuestionExplanation remains the canonical curated explanation attached to a question.

Community comments do not belong in the Question Bank aggregate. They are part of the Comments context and will have their own authorship, moderation and voting model.

A future comment model should reference a real profile for student comments. Professor/editor authorship should reference application identities where possible instead of storing only a free-text author name.

AI-generated explanations/comments must preserve generation provenance such as provider/model/version and moderation/review state. They should not masquerade as human comments.

Vote counts should be backed by vote records or a deliberate aggregate strategy, rather than being the only source of truth in a mutable integer column.

## Deduplication and idempotency

questions.content_hash intentionally remains non-unique.

Identical normalized wording can legitimately appear in more than one exam, booklet or source occurrence.

The hash is a duplicate candidate signal, not universal identity.

Import idempotency should use source-specific identity when available, for example an import-item/external key derived from source + exam/booklet + question number. Review logic may combine that identity with content hashes and other metadata.

## Deletion behavior

Question/exam/taxonomy history must not disappear because a source entity was removed.

Restrictive deletion remains preferred for examination, taxonomy and provenance references.

Question-owned dependent content may use cascading deletion when it cannot exist independently.

## Public reads and answer-key isolation

Public question browsing must never load answer-key fields merely to remove them later.

The Question Explorer uses a dedicated public read repository/select that excludes:

- correct alternative markers;
- True/False correct value;
- answer-key readiness;
- explanation before answer submission when the product flow requires it.

Answer evaluation uses a separate server-only repository path that may load answer-key data.

This is a defense-in-depth rule, not only a DTO-mapping convention.

## Implementation order

1. Finish the Question Explorer using safe public reads.
2. Implement the question-resolution UI and Study submission flow.
3. Add support-content and media persistence before building the full import pipeline.
4. Add official answer-key outcome metadata when official ingestion begins.
5. Build Comments as its own bounded context.
6. Add scraper/parser adapters only for sources that are operationally and legally appropriate.


## Provider APIs are ingestion sources, not runtime dependencies

External question APIs are used only to acquire/import content into the Sou Bizurado canonical database.

The student-facing Question Bank and Study flows must never require a provider request in order to list, open, answer or review a question.

For the Quest API integration, the intended lifecycle is:

Quest API -> ImportJob -> raw staging -> normalization -> deduplication -> local Question/QuestionOccurrence -> review/publication.

After a question is materialized locally, runtime reads use PostgreSQL only.

Provider IDs are preserved in QuestionOccurrence for provenance and idempotency, while Question.id remains a Sou Bizurado UUID.

## Duplicate prevention

The ingestion foundation uses layered duplicate controls:

1. unique source occurrence: source + external question id;
2. unique canonical fingerprint for exact normalized content;
3. trigram similarity against existing question statements;
4. review blocking for possible duplicates.

A source occurrence or exact canonical duplicate does not create a second Question.

A fuzzy match above the configured threshold is stored as an import duplicate candidate and remains REVIEW_REQUIRED instead of being auto-created.

The raw provider payload is preserved in ImportItem for audit/reprocessing.

## Current media gate

Questions containing provider media are staged as REVIEW_REQUIRED until MediaAsset/R2 persistence is implemented.

They are not discarded and they are not published with missing figures.

Initial automated imports may deliberately request questions without attachments so that statement, support text, alternatives, answer key, taxonomy and examination metadata can be validated end-to-end first.


## Quest API live compatibility notes

As of 2026-09-19, the published Quest API documentation lists `alternative_type` on `GET /v2/questoes`, but the live endpoint returned HTTP 422 with "property alternative_type should not exist". The adapter therefore does not send that parameter on the question search route until the provider behavior and documentation converge.

The broad `GET /v2/questoes` search also returned HTTP 503 with `search_quest_api não respondeu em 4000ms` even with matter/year filters. For operational resilience, the adapter supports direct question lookup via `GET /v2/questoes/{id}`, which bypasses the catalog search path and can be used to validate local persistence independently of search availability.

Provider outages or metadata lookup failures must never make already-imported Sou Bizurado questions unavailable to students.


### Exam-first Quest API ingestion

When the global question search is unavailable, the preferred fallback is exam-first ingestion:

1. discover a current exam through `GET /v1/provas`;
2. fetch its complete question payload through `GET /v1/provas/{id}`;
3. fetch `GET /v1/provas/{id}/gabarito`;
4. join answer keys locally by provider question id;
5. send the resulting candidates through the same Sou Bizurado normalization, deduplication and persistence pipeline.

The CLI supports this mode with `npm run import:quest-api -- --prova=<provider-exam-id>`.

This mode still materializes questions locally; the provider is never required during student runtime.


## ENEM open-dataset ingestion

The ENEM ingestion adapter reads the public dataset from `yunger7/enem-api` as an **ingestion source only**. Runtime study and question explorer flows continue reading exclusively from Sou Bizurado PostgreSQL.

Source strategy:

- provider code: `ENEM_DATA`;
- source reference: `enem-api-yunger7`;
- upstream repository: `https://github.com/yunger7/enem-api`;
- upstream repository license: GNU GPL-2.0;
- original exam provenance remains ENEM / INEP and is stored separately from the repository packaging/license metadata;
- examination records use `ENEM <year>`, organization `INEP`, no invented examining board;
- the four ENEM areas are imported as the initial discipline classification;
- topic remains nullable while the question is `IN_REVIEW`;
- imports are review-first and the ENEM CLI intentionally does not publish directly.

Question mapping:

- `context` becomes reusable support content when an alternatives introduction is present;
- `alternativesIntroduction` becomes the question statement;
- alternatives and official answer key are persisted through the common provider-neutral pipeline;
- source URL points back to the exact upstream question JSON;
- questions with files, alternative media, or Markdown image references remain `REVIEW_REQUIRED / MEDIA_NOT_PERSISTED_YET` until Media/R2 ingestion exists;
- text-only questions can be materialized immediately as canonical `Question` rows in `IN_REVIEW`.

The 2023 upstream exam index currently exposes 183 question entries because language-choice variants are represented separately. Pagination remains capped at 100 per import job; `import:enem -- --ano=2023 --all` iterates jobs until the year is exhausted.
