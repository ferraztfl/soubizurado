# Study database foundation

This foundation introduces the first persistent records owned by the `study` context.

It covers the MVP requirements for answer history, multiple attempts, response timing and favorite questions without introducing study sessions or analytics aggregates prematurely.

## Tables

### `study_answer_attempts`

Each row is an immutable student answer attempt.

Stored fields include:

- internal profile ID;
- question ID;
- question type at the time of the attempt;
- selected multiple-choice alternative or True/False value;
- correctness computed by trusted server-side logic;
- optional response time in milliseconds;
- answer timestamp.

Multiple rows may exist for the same `(profile_id, question_id)` pair. Attempts are never overwritten merely because the same student answers the question again.

The database enforces the answer shape:

- `MULTIPLE_CHOICE` requires `selected_alternative_id` and forbids `selected_true_false`;
- `TRUE_FALSE` requires `selected_true_false` and forbids `selected_alternative_id`.

Negative response times are rejected.

Historical attempts use restrictive foreign keys so deleting a profile, question or referenced alternative cannot silently erase answer history.

### `study_favorites`

This table represents the student's current favorite state.

The composite primary key `(profile_id, question_id)` prevents duplicate favorites. Removing a favorite deletes this current-state row; favorites are not treated as immutable historical events.

## Indexes

The initial indexes target predictable MVP access paths:

- answer history by student and timestamp;
- attempts for one student/question pair;
- incorrect attempts by student;
- attempts by question;
- favorite listing by student;
- favorite membership by question/student.

No analytics summary table is introduced yet. Basic statistics can be derived from attempts first and optimized later if measured usage justifies it.

## Derived incorrect-question notebook

The initial incorrect-question notebook is derived from immutable answer attempts instead of introducing another source-of-truth table.

A question appears once when the student has at least one incorrect attempt for it. The query returns:

- the question ID;
- the timestamp of the most recent incorrect attempt;
- the number of incorrect attempts for that question.

Results are ordered by the most recent incorrect attempt. A later correct attempt does not erase the historical fact that the student previously missed the question.

This deliberately represents **incorrect-question history**, not a future review-queue state. A dedicated review workflow may later use its own explicit rules without rewriting answer history.

## Security

Row Level Security is enabled on both study tables. No public RLS policy is created in this migration. Trusted application access remains server-side, following the same foundation used by the existing identity and question-bank tables.

## Scope intentionally deferred

This migration does not add:

- study sessions;
- review queues;
- simulations;
- analytics aggregates;
- recommendation data;
- question-version snapshots.

Those capabilities remain separate later phases.
