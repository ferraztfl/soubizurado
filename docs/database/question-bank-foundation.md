# Question Bank Foundation

## Scope

This foundation introduces the first physical relational model for:

- Taxonomy;
- Exams;
- Question Bank.

It intentionally does not implement Study, Comments, Imports or Billing.

## Taxonomy

The hierarchy is:

Discipline -> Area -> Topic -> Subtopic

Area is optional for a Topic. Topic retains a direct Discipline reference so a topic may exist directly under a discipline.

Draft questions may be only partially classified.

Publication rules require at least:

- a Discipline;
- a Topic;
- a QuestionSource.

## Exams

The initial examination metadata model contains:

- ExaminingBoard;
- PublicOrganization;
- CareerPosition;
- Examination.

Questions may exist without an Examination because original or manually authored questions are valid platform content.

## Question types

Only the product-supported types are modeled:

- MULTIPLE_CHOICE;
- TRUE_FALSE.

Multiple-choice correctness belongs to ordered alternatives.

True/False correctness is stored in `correct_true_false`.

Application-level publication policy prevents the two answer models from being mixed.

## Provenance

QuestionSource is structured and reusable.

It records:

- source type;
- source name/reference;
- URL when applicable;
- licensing/publication metadata.

A source is mandatory at publication time even though the database relation remains nullable to support incomplete import staging and draft authoring.

## Publication lifecycle

QuestionStatus:

- DRAFT;
- IN_REVIEW;
- PUBLISHED;
- ARCHIVED.

QuestionAnswerKeyStatus:

- MISSING;
- DEFINED;
- VERIFIED.

Database nullability supports safe drafting.

Application/domain policy controls publication eligibility.

## Deduplication

`questions.content_hash` stores a SHA-256-compatible 64-character digest.

The field is indexed but deliberately not unique.

A repeated normalized statement is a duplicate candidate, not automatically proof that two records represent the same legal/examination question.

## RLS

Row Level Security is enabled on the new domain tables in the migration.

Policies and least-privilege runtime roles remain separate security decisions and must be introduced deliberately rather than granting broad public table access.

## Deletion behavior

Classification, exam and source references use restrictive deletion.

Question-owned dependent data such as alternatives, explanations and tag associations use cascade deletion.

This avoids accidental loss of question history through taxonomy or examination maintenance.
