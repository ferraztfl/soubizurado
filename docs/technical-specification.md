# SOUBIZURADO — TECHNICAL SPECIFICATION v1.0

## 1. Product Vision & Scope

### 1.1 Product Name

**Sou Bizurado**

Primary domain:

**[www.soubizurado.com.br](http://www.soubizurado.com.br)**

---

### 1.2 Product Vision

Sou Bizurado is a digital platform for preparation for Brazilian public service examinations.

Its purpose is to provide candidates with a structured, fast and measurable study environment centered initially on the resolution of questions.

The platform shall enable users to practice, review mistakes, monitor performance and progressively identify strengths and weaknesses across disciplines, topics, examining boards and examinations.

The product shall begin with a deliberately controlled scope that can be developed and operated by a small team or individual developer, while preserving architectural foundations capable of supporting future growth.

The long-term architecture shall be capable of evolving from an initial installation with a very small number of users into a platform supporting:

* thousands of active users;
* hundreds of examinations;
* hundreds of thousands or millions of questions;
* large volumes of answer history;
* digital subscriptions;
* digital products;
* content publication;
* recommendations and intelligent study features.

Scalability shall not be achieved through premature infrastructure complexity.

The system shall favor a well-structured modular monolith, relational data modeling, explicit domain boundaries and replaceable infrastructure integrations.

---

### 1.3 Product Mission

The mission of Sou Bizurado is to help public examination candidates study more effectively by transforming question solving and performance history into structured, actionable learning information.

The product shall prioritize:

**practice → feedback → history → measurement → improvement**

The main user experience shall therefore be optimized around solving questions with minimal distraction.

---

### 1.4 Primary User

The initial primary user is:

**Public examination candidate / student**

The student needs to:

* find relevant questions;
* filter questions;
* answer questions;
* immediately understand whether an answer was correct;
* access explanations when available;
* preserve answer history;
* revisit mistakes;
* favorite useful questions;
* monitor performance;
* identify weak subjects;
* prepare for specific examinations.

---

### 1.5 Administrative Users

The platform shall also support internal operational users responsible for managing the content and the platform.

Expected administrative profiles include:

* Moderator;
* Editor;
* Content Manager;
* Administrator;
* Super Administrator.

Administrative capabilities shall be controlled by backend authorization and explicit permissions.

Administrative interfaces shall not constitute an independent source of business data.

They shall execute use cases belonging to the appropriate domain modules.

---

### 1.6 Core Product Proposition

The central product proposition is:

> Provide a structured question bank that does more than display questions: it learns from the user's study history and turns question solving into measurable preparation.

The strategic asset of the platform shall be the combination of:

**structured question data**

plus

**structured user performance history**

These datasets shall be preserved with appropriate provenance, consistency and historical integrity.

---

### 1.7 Initial Product Capabilities

The product architecture shall support the following capability groups:

#### Question Bank

Support for:

* multiple-choice questions;
* True/False questions;
* alternatives;
* correct answers;
* explanations;
* source information;
* examining boards;
* examinations;
* disciplines;
* hierarchical topics;
* tags;
* difficulty;
* associated media;
* question versioning.

#### Study

Support for:

* answering questions;
* answer history;
* incorrect questions;
* favorites;
* review items;
* study sessions;
* answer timing;
* attempts.

#### Search and Filtering

Questions may progressively be filtered by dimensions including:

* examination;
* public organization;
* career/position;
* examining board;
* year;
* discipline;
* topic;
* subtopic;
* difficulty;
* question type;
* previous answer state;
* incorrect status;
* favorite status.

#### Analytics

The product shall progressively calculate metrics including:

* questions solved;
* correct answers;
* incorrect answers;
* accuracy rate;
* average response time;
* performance by discipline;
* performance by topic;
* performance by examining board;
* performance by examination;
* performance evolution.

#### Content Operations

Authorized administrators shall eventually be able to:

* create questions;
* edit questions;
* review questions;
* publish questions;
* unpublish questions;
* import question datasets;
* manage taxonomies;
* manage examinations;
* manage examining boards;
* moderate comments.

---

### 1.8 Commercial Scope

Sou Bizurado shall use a freemium business model.

Initial plans:

**FREE**

and

**PREMIUM**

The defined Premium price is:

**R$ 9,99/month**

The product architecture shall support configurable capabilities and usage limits rather than scattering plan-specific rules throughout the application.

The system shall later support recurring payments through payment gateway adapters.

Supported gateway architecture shall allow providers such as:

* Stripe;
* Mercado Pago.

The domain shall not depend directly on a particular payment provider.

---

### 1.9 Extended Product Scope

Beyond the core study system, the target architecture shall allow the progressive introduction of:

#### Simulations

Timed or configurable mock examinations based on filters and examination rules.

#### User Comments

Discussion, reporting and moderation of question comments.

#### Digital Store

Sale and controlled download of:

* study guides;
* PDFs;
* digital study materials.

#### Blog

Editorial content focused on:

* public examinations;
* careers;
* notices;
* examining boards;
* questions;
* physical tests;
* study guidance.

#### Programmatic SEO

Generation of scalable public pages for entities such as:

* examinations;
* positions;
* examining boards;
* question collections;
* simulations.

#### Intelligent Recommendations

Recommendation features based initially on deterministic rules and statistical performance.

Generative AI shall not be a dependency of the initial product.

AI-based functionality may be added only where it provides measurable value and shall not be considered authoritative for official answer keys or regulated/legal subject matter without appropriate validation.

---

### 1.10 First Validation Dataset

The first real examination dataset used to validate the platform shall be:

**CBMPE — Oficial**

CBMPE is a validation dataset and not an architectural boundary.

No database table, domain model, route hierarchy or business rule shall be designed exclusively for CBMPE.

The architecture shall remain capable of representing unrelated municipal, state and federal examinations.

---

### 1.11 MVP Definition

The first operational MVP shall focus on the core study loop.

The earliest useful product shall allow:

1. authenticated user access;
2. structured question registration;
3. disciplines, topics, examinations and examining boards;
4. multiple-choice and True/False questions;
5. correct answers and explanations;
6. question solving;
7. answer history;
8. favorites;
9. incorrect-question review;
10. basic filtering.

Mass imports, advanced analytics, simulations, comments, Premium subscriptions, payments, the digital store, blog, advanced SEO and intelligent recommendations shall be added incrementally after the underlying modules on which they depend have been validated.

---

### 1.12 Non-Goals of the Initial MVP

The initial MVP shall not attempt to:

* implement every future question type;
* implement microservices;
* implement Kubernetes;
* depend on Docker in production;
* depend on SSH access in production;
* introduce Kafka;
* implement complex distributed workers;
* introduce AI into every workflow;
* implement semantic deduplication;
* build a complete recommendation engine;
* implement the digital store;
* implement the full blog platform;
* optimize every operation for millions of records before real usage justifies it.

The architecture may preserve expansion points for those capabilities without implementing them prematurely.

---

### 1.13 Product Principles

Development of Sou Bizurado shall follow these principles:

**Correctness before feature volume.**

Critical study, authorization and payment data must remain consistent.

**Simple first, extensible second.**

The simplest implementation that preserves the required architectural boundary shall be preferred.

**PostgreSQL is the system of record.**

Caches, object storage and temporary systems must not become hidden sources of truth.

**Server-side authorization.**

The client shall never be trusted to determine user roles, subscription state, payment state, prices or access to protected resources.

**Data provenance.**

Question origins, licensing and copyright status shall be traceable.

**Historical preservation.**

Important user performance history shall not be silently discarded.

**Infrastructure portability.**

Business rules shall not depend directly on Hostinger, Supabase, Cloudflare, Upstash or a payment provider.

**Incremental delivery.**

Each major phase shall be testable and reviewed before the following major phase begins.

**No premature distribution.**

The initial deployment model shall be a modular monolith.

---

### 1.14 Product Success Criteria

The architecture shall be considered successful when the platform can begin with a small dataset and minimal traffic without unnecessary operational complexity while retaining a clear evolution path toward substantially larger datasets and user volumes.

The product itself shall be considered successful when a student can reliably:

**find → answer → receive feedback → review → measure improvement**

without unnecessary friction.

---

### 1.15 Scope Boundary for Technical Specification v1.0

Technical Specification v1.0 shall describe the target architecture required to support the complete planned product while distinguishing between:

**architecture that must exist from the beginning**

and

**functionality that may be implemented in later phases.**

The specification is not authorization to implement every described capability immediately.

Implementation shall continue to follow the approved technical roadmap and phase gates.

---

# 2. Functional Requirements

## 2.1 Requirement Conventions

Functional requirements describe observable capabilities and business behaviors that Sou Bizurado shall support.

Each requirement receives a permanent identifier using the format:

**FR-XXX**

These identifiers shall remain stable whenever reasonably possible so that future architecture decisions, database structures, implementation tasks, automated tests and acceptance criteria may reference them.

The presence of a requirement in Technical Specification v1.0 does not mean that it must be implemented in the initial MVP.

Requirements are classified using the following delivery scopes:

- **MVP** — required for the first operational study product;
- **POST-MVP** — planned capability to be introduced after the core product has been validated;
- **PLATFORM** — foundational or cross-cutting capability that may be introduced incrementally as dependent features require it.

The implementation roadmap determines when each requirement becomes active.

---

## 2.2 Identity and Access

### FR-001 — User Registration

**Scope:** MVP

The system shall allow a person to create a student account using a supported authentication method.

### FR-002 — User Authentication

**Scope:** MVP

The system shall allow registered users to authenticate securely and establish an authenticated session.

### FR-003 — User Logout

**Scope:** MVP

The system shall allow authenticated users to terminate their active session.

### FR-004 — Account Recovery

**Scope:** MVP

The system shall provide a secure mechanism for users to recover access to their account.

### FR-005 — User Profile

**Scope:** MVP

The system shall maintain an application profile associated with each registered user.

### FR-006 — Profile Update

**Scope:** MVP

The system shall allow users to modify profile information that they are authorized to manage.

### FR-007 — Roles

**Scope:** PLATFORM

The system shall support explicit application roles.

Initial administrative role candidates include:

- Moderator;
- Editor;
- Content Manager;
- Administrator;
- Super Administrator.

### FR-008 — Permission-Based Authorization

**Scope:** PLATFORM

The system shall authorize protected operations based on backend-controlled permissions rather than trusting client-provided role or permission information.

### FR-009 — Student Access

**Scope:** MVP

The system shall provide authenticated students with access to the study capabilities permitted by their account and entitlement state.

### FR-010 — Administrative Access

**Scope:** PLATFORM

The system shall restrict administrative capabilities to users with the required backend authorization.

### FR-011 — Disabled Account Enforcement

**Scope:** PLATFORM

The system shall prevent an account that has been administratively disabled from accessing protected application capabilities.

### FR-012 — Account Identity Integrity

**Scope:** PLATFORM

The system shall ensure that authenticated application activity is associated with the correct internal user identity.

---

## 2.3 Taxonomy and Examination Metadata

### FR-013 — Discipline Management

**Scope:** MVP

The system shall support the creation, retrieval, update and controlled deactivation of disciplines.

### FR-014 — Area Management

**Scope:** PLATFORM

The system shall support areas that may group or organize related academic content.

### FR-015 — Topic Management

**Scope:** MVP

The system shall support topics associated with the appropriate taxonomy hierarchy.

### FR-016 — Subtopic Management

**Scope:** MVP

The system shall support subtopics associated with topics.

### FR-017 — Hierarchical Taxonomy

**Scope:** MVP

The system shall support hierarchical organization using the conceptual structure:

**Discipline → Area → Topic → Subtopic**

where levels may be introduced or used according to the needs of the content.

### FR-018 — Tag Management

**Scope:** POST-MVP

The system shall support reusable tags that may be associated with questions and other applicable content.

### FR-019 — Examining Board Management

**Scope:** MVP

The system shall maintain examining board records independently from individual examinations.

### FR-020 — Public Organization Management

**Scope:** MVP

The system shall maintain public organizations or institutions associated with examinations when applicable.

### FR-021 — Career or Position Management

**Scope:** MVP

The system shall represent careers, positions or equivalent examination targets independently from individual examinations.

### FR-022 — Examination Management

**Scope:** MVP

The system shall maintain examination records containing the metadata required to classify questions and study content.

### FR-023 — Examination Year

**Scope:** MVP

The system shall allow an examination or question source to be associated with the appropriate year.

### FR-024 — Examination Relationships

**Scope:** MVP

The system shall allow examinations to reference relevant entities such as:

- public organization;
- examining board;
- career or position;
- year.

### FR-025 — Generic Examination Modeling

**Scope:** PLATFORM

The system shall model examinations generically and shall not introduce CBMPE-specific database structures or business rules.

---

## 2.4 Question Bank

### FR-026 — Question Creation

**Scope:** MVP

Authorized users shall be able to create questions.

### FR-027 — Question Editing

**Scope:** MVP

Authorized users shall be able to modify question content while preserving the integrity required by question history and publication rules.

### FR-028 — Question Retrieval

**Scope:** MVP

The system shall allow eligible users to retrieve published questions for study.

### FR-029 — Multiple-Choice Questions

**Scope:** MVP

The system shall support multiple-choice questions containing a defined set of alternatives.

### FR-030 — True/False Questions

**Scope:** MVP

The system shall support True/False questions.

### FR-031 — Alternative Management

**Scope:** MVP

The system shall support ordered alternatives for question types that require alternatives.

### FR-032 — Correct Answer

**Scope:** MVP

Each published question shall contain sufficient answer-key information for the system to determine whether a submitted answer is correct.

### FR-033 — Question Explanation

**Scope:** MVP

The system shall allow a question to contain an explanation or resolution when available.

### FR-034 — Question Difficulty

**Scope:** POST-MVP

The system shall allow a question to be associated with a difficulty classification.

### FR-035 — Question Taxonomy

**Scope:** MVP

The system shall allow questions to be classified using relevant disciplines, topics, subtopics and other supported taxonomy dimensions.

### FR-036 — Examination Association

**Scope:** MVP

The system shall allow a question to be associated with an examination when the question originates from or belongs to that examination.

### FR-037 — Examining Board Association

**Scope:** MVP

The system shall allow a question to be associated with an examining board.

### FR-038 — Source Provenance

**Scope:** MVP

The system shall maintain provenance information identifying the source or origin of a question.

### FR-039 — Licensing Status

**Scope:** PLATFORM

The system shall maintain sufficient information to represent the licensing, copyright or publication status of a question source.

### FR-040 — Publication Status

**Scope:** MVP

Questions shall have a publication state that determines whether they are available to students.

### FR-041 — Publish Question

**Scope:** MVP

Authorized users shall be able to publish an eligible question.

### FR-042 — Unpublish Question

**Scope:** MVP

Authorized users shall be able to remove a question from normal student availability without requiring destructive deletion.

### FR-043 — Question Versioning

**Scope:** POST-MVP

The system shall support preservation of relevant question revisions when version history becomes necessary.

### FR-044 — Question Media

**Scope:** POST-MVP

The system shall allow supported media to be associated with a question.

### FR-045 — Alternative Media

**Scope:** POST-MVP

The system shall allow supported media to be associated with an alternative when required.

### FR-046 — Explanation Media

**Scope:** POST-MVP

The system shall allow supported media to be associated with a question explanation when required.

### FR-047 — Question Search

**Scope:** MVP

The system shall allow eligible questions to be queried according to supported filtering criteria.

### FR-048 — Filter by Examination

**Scope:** MVP

Students shall be able to filter questions by examination.

### FR-049 — Filter by Examining Board

**Scope:** MVP

Students shall be able to filter questions by examining board.

### FR-050 — Filter by Year

**Scope:** MVP

Students shall be able to filter questions by year.

### FR-051 — Filter by Discipline

**Scope:** MVP

Students shall be able to filter questions by discipline.

### FR-052 — Filter by Topic

**Scope:** MVP

Students shall be able to filter questions by topic.

### FR-053 — Filter by Subtopic

**Scope:** MVP

Students shall be able to filter questions by subtopic when subtopic classification exists.

### FR-054 — Filter by Question Type

**Scope:** MVP

Students shall be able to filter questions by supported question type.

---

## 2.5 Study

### FR-055 — Answer Question

**Scope:** MVP

An authenticated student shall be able to submit an answer to an eligible question.

### FR-056 — Answer Evaluation

**Scope:** MVP

The system shall determine whether a submitted answer is correct according to the applicable answer key.

### FR-057 — Immediate Feedback

**Scope:** MVP

After a valid answer submission, the system shall be able to inform the student whether the submitted answer was correct.

### FR-058 — Explanation Display

**Scope:** MVP

After answering a question, the student shall be able to access the question explanation when an explanation is available and the applicable study flow permits it.

### FR-059 — Answer History

**Scope:** MVP

The system shall preserve a history of student answers.

### FR-060 — Answer Timestamp

**Scope:** MVP

Each recorded answer shall contain the time at which the answer was submitted.

### FR-061 — Attempt Tracking

**Scope:** MVP

The system shall support multiple attempts at a question while preserving the appropriate answer history.

### FR-062 — Response Time

**Scope:** MVP

The system shall be capable of recording the time spent answering a question.

### FR-063 — Favorite Question

**Scope:** MVP

An authenticated student shall be able to add a question to favorites.

### FR-064 — Remove Favorite

**Scope:** MVP

An authenticated student shall be able to remove a question from favorites.

### FR-065 — Favorite Questions View

**Scope:** MVP

Students shall be able to retrieve questions they have favorited.

### FR-066 — Incorrect Questions View

**Scope:** MVP

Students shall be able to retrieve questions they previously answered incorrectly.

### FR-067 — Previous Answer State Filter

**Scope:** MVP

Students shall be able to filter questions according to relevant previous-answer state.

### FR-068 — Incorrect Status Filter

**Scope:** MVP

Students shall be able to filter questions based on whether they previously answered them incorrectly.

### FR-069 — Favorite Status Filter

**Scope:** MVP

Students shall be able to filter questions based on favorite status.

### FR-070 — Study Session

**Scope:** POST-MVP

The system shall support grouping question-solving activity into study sessions.

### FR-071 — Review Items

**Scope:** POST-MVP

The system shall support identifying or organizing questions for later review.

---

## 2.6 Simulations

### FR-072 — Simulation Creation

**Scope:** POST-MVP

The system shall allow eligible users to create or start a simulation according to supported configuration rules.

### FR-073 — Simulation Question Selection

**Scope:** POST-MVP

A simulation shall be able to select questions according to supported filters or predefined examination rules.

### FR-074 — Timed Simulation

**Scope:** POST-MVP

The system shall support simulations with a time limit.

### FR-075 — Simulation Submission

**Scope:** POST-MVP

A student shall be able to finalize and submit a simulation.

### FR-076 — Simulation Result

**Scope:** POST-MVP

The system shall calculate and present the student's simulation result.

### FR-077 — Simulation History

**Scope:** POST-MVP

The system shall preserve the student's completed simulation history.

---

## 2.7 Analytics

### FR-078 — Questions Solved Metric

**Scope:** POST-MVP

The system shall calculate the number of questions solved by a student.

### FR-079 — Correct Answers Metric

**Scope:** POST-MVP

The system shall calculate the number of correct answers.

### FR-080 — Incorrect Answers Metric

**Scope:** POST-MVP

The system shall calculate the number of incorrect answers.

### FR-081 — Accuracy Rate

**Scope:** POST-MVP

The system shall calculate student accuracy based on applicable answer records.

### FR-082 — Average Response Time

**Scope:** POST-MVP

The system shall be able to calculate average response time from eligible recorded answers.

### FR-083 — Performance by Discipline

**Scope:** POST-MVP

The system shall calculate student performance grouped by discipline.

### FR-084 — Performance by Topic

**Scope:** POST-MVP

The system shall calculate student performance grouped by topic.

### FR-085 — Performance by Examining Board

**Scope:** POST-MVP

The system shall calculate student performance grouped by examining board.

### FR-086 — Performance by Examination

**Scope:** POST-MVP

The system shall calculate student performance grouped by examination.

### FR-087 — Performance Evolution

**Scope:** POST-MVP

The system shall support measuring student performance over time.

---

## 2.8 Comments and Moderation

### FR-088 — Question Comment

**Scope:** POST-MVP

An eligible authenticated user shall be able to publish a comment on a question.

### FR-089 — Comment Retrieval

**Scope:** POST-MVP

Eligible users shall be able to retrieve visible comments associated with a question.

### FR-090 — Comment Reporting

**Scope:** POST-MVP

Users shall be able to report a question comment for moderation.

### FR-091 — Comment Moderation

**Scope:** POST-MVP

Authorized moderators shall be able to review reported or moderated comments.

### FR-092 — Hide Comment

**Scope:** POST-MVP

Authorized moderators shall be able to hide a comment from normal public display.

### FR-093 — Moderation State

**Scope:** POST-MVP

The system shall maintain the moderation state required to determine whether a comment may be displayed.

---

## 2.9 Media

### FR-094 — Media Registration

**Scope:** PLATFORM

The system shall maintain metadata for uploaded media used by supported application features.

### FR-095 — Media Association

**Scope:** PLATFORM

The system shall allow media metadata to be associated with the domain entity that uses the media.

### FR-096 — Media Availability State

**Scope:** PLATFORM

The system shall maintain sufficient state to determine whether uploaded media is available for use.

### FR-097 — Media Removal

**Scope:** PLATFORM

Authorized operations shall be able to remove or deactivate media according to applicable business and retention rules.

---

## 2.10 Question Imports

### FR-098 — Import File Submission

**Scope:** POST-MVP

Authorized users shall be able to submit supported files for question import.

### FR-099 — CSV Import

**Scope:** POST-MVP

The initial import system shall support CSV question datasets.

### FR-100 — XLSX Import

**Scope:** POST-MVP

The initial import system shall support XLSX question datasets.

### FR-101 — JSON Import

**Scope:** POST-MVP

The system shall later support JSON question datasets.

### FR-102 — Import Job

**Scope:** POST-MVP

Each import operation shall be represented by a persistent import job.

### FR-103 — Import Job Status

**Scope:** POST-MVP

The system shall maintain the processing state of an import job.

### FR-104 — Parsing

**Scope:** POST-MVP

The import pipeline shall parse supported source formats into an internal representation.

### FR-105 — Normalization

**Scope:** POST-MVP

Imported question data shall pass through normalization before publication.

### FR-106 — Classification

**Scope:** POST-MVP

The import process shall support classification of imported questions into the applicable taxonomy.

### FR-107 — Validation

**Scope:** POST-MVP

Imported records shall be validated before they may become published questions.

### FR-108 — Duplicate Detection

**Scope:** POST-MVP

The import process shall identify likely duplicate question content using the approved deterministic deduplication strategy.

### FR-109 — Review Queue

**Scope:** POST-MVP

Imported records requiring human review shall be placeable in a review queue.

### FR-110 — Import Review

**Scope:** POST-MVP

Authorized users shall be able to review imported records before publication.

### FR-111 — Import Error Reporting

**Scope:** POST-MVP

The system shall provide sufficient import error information for an authorized operator to identify rejected or invalid records.

### FR-112 — Controlled Publication

**Scope:** POST-MVP

Imported questions shall not become publicly available until they have satisfied the required validation and publication rules.

---

## 2.11 Plans, Entitlements and Premium Access

### FR-113 — Free Plan

**Scope:** POST-MVP

The system shall support a FREE access plan.

### FR-114 — Premium Plan

**Scope:** POST-MVP

The system shall support a PREMIUM access plan.

### FR-115 — Premium Price

**Scope:** POST-MVP

The defined initial recurring Premium price shall be:

**R$ 9,99/month**

### FR-116 — Centralized Entitlements

**Scope:** PLATFORM

The system shall determine access to restricted product capabilities through centralized entitlements or equivalent backend-controlled authorization rules.

### FR-117 — Feature Entitlement

**Scope:** POST-MVP

The system shall support granting or restricting product features according to the user's applicable entitlement state.

### FR-118 — Usage Limits

**Scope:** POST-MVP

The system shall support usage limits for capabilities that differ between plans.

### FR-119 — Backend Enforcement

**Scope:** POST-MVP

Premium access and usage limits shall be enforced by trusted backend logic.

### FR-120 — Subscription State

**Scope:** POST-MVP

The system shall maintain the application-level subscription state required to determine Premium eligibility.

### FR-121 — Subscription Activation

**Scope:** POST-MVP

A successfully recognized subscription event shall be able to activate the appropriate Premium entitlement.

### FR-122 — Subscription Cancellation

**Scope:** POST-MVP

The system shall support cancellation of a recurring subscription according to applicable billing rules.

### FR-123 — Subscription Expiration

**Scope:** POST-MVP

The system shall revoke or update Premium access when the applicable subscription no longer grants entitlement.

---

## 2.12 Payments

### FR-124 — Payment Gateway Abstraction

**Scope:** POST-MVP

The application shall support payment processing through a provider-independent payment capability.

### FR-125 — Stripe Adapter

**Scope:** POST-MVP

The payment architecture shall be capable of supporting Stripe through an adapter.

### FR-126 — Mercado Pago Adapter

**Scope:** POST-MVP

The payment architecture shall be capable of supporting Mercado Pago through an adapter.

### FR-127 — Payment Record

**Scope:** POST-MVP

The system shall maintain application-level records required to represent payment transactions.

### FR-128 — Payment Status

**Scope:** POST-MVP

The system shall maintain the payment state required by the billing domain.

### FR-129 — Payment Webhook Processing

**Scope:** POST-MVP

The system shall process supported asynchronous payment-provider events.

### FR-130 — Idempotent Payment Event Handling

**Scope:** POST-MVP

Repeated delivery of the same supported payment event shall not create duplicate business effects.

### FR-131 — Trusted Payment State

**Scope:** POST-MVP

The client shall not be authoritative for payment success, subscription activation or Premium entitlement.

---

## 2.13 Digital Store

### FR-132 — Digital Product Management

**Scope:** POST-MVP

Authorized users shall be able to manage digital products.

### FR-133 — Product Publication

**Scope:** POST-MVP

Digital products shall have a publication state controlling their availability in the store.

### FR-134 — Product Price

**Scope:** POST-MVP

The system shall maintain the authoritative price of each sellable digital product.

### FR-135 — Product Purchase

**Scope:** POST-MVP

Eligible users shall be able to initiate the purchase of an available digital product.

### FR-136 — Order Record

**Scope:** POST-MVP

The system shall maintain an order record for applicable store transactions.

### FR-137 — Purchase Confirmation

**Scope:** POST-MVP

The system shall only grant purchased digital access after trusted confirmation of the corresponding payment state.

### FR-138 — Controlled Digital Download

**Scope:** POST-MVP

Users entitled to a purchased digital product shall be able to access its downloadable material according to applicable access rules.

### FR-139 — Download Authorization

**Scope:** POST-MVP

The system shall prevent unauthorized users from obtaining protected digital products.

---

## 2.14 Blog and Editorial Content

### FR-140 — Blog Post Creation

**Scope:** POST-MVP

Authorized editorial users shall be able to create blog posts.

### FR-141 — Blog Post Editing

**Scope:** POST-MVP

Authorized editorial users shall be able to edit blog posts.

### FR-142 — Blog Post Publication

**Scope:** POST-MVP

Blog posts shall have a publication workflow determining public availability.

### FR-143 — Blog Post Retrieval

**Scope:** POST-MVP

Public users shall be able to retrieve published blog posts.

### FR-144 — Editorial Metadata

**Scope:** POST-MVP

Blog content shall support metadata required for editorial organization and discoverability.

### FR-145 — Blog Media

**Scope:** POST-MVP

Published editorial content shall be able to reference supported media.

---

## 2.15 Public and Programmatic SEO Pages

### FR-146 — Public Examination Pages

**Scope:** POST-MVP

The system shall support public indexable pages representing eligible examinations.

### FR-147 — Public Position Pages

**Scope:** POST-MVP

The system shall support public indexable pages representing eligible careers or positions.

### FR-148 — Public Examining Board Pages

**Scope:** POST-MVP

The system shall support public indexable pages representing eligible examining boards.

### FR-149 — Public Question Collection Pages

**Scope:** POST-MVP

The system shall support public pages representing eligible question collections or filtered question sets where appropriate.

### FR-150 — Public Simulation Pages

**Scope:** POST-MVP

The system shall support public pages for eligible simulation-related content where appropriate.

### FR-151 — Page Metadata

**Scope:** PLATFORM

Public indexable pages shall provide appropriate page metadata.

### FR-152 — Sitemap Participation

**Scope:** POST-MVP

Eligible public pages shall be capable of participating in sitemap generation.

### FR-153 — Search Indexing Control

**Scope:** PLATFORM

The system shall support controlling whether applicable public pages should be indexable by search engines.

---

## 2.16 Administration

### FR-154 — Administrative Interface

**Scope:** PLATFORM

The system shall provide authorized internal users with interfaces for executing administrative use cases.

### FR-155 — Domain Ownership Preservation

**Scope:** PLATFORM

Administrative interfaces shall invoke the appropriate domain capabilities rather than becoming an independent owner of users, questions, payments, products or editorial content.

### FR-156 — Question Administration

**Scope:** MVP

Authorized administrative users shall be able to execute permitted question-management operations.

### FR-157 — Taxonomy Administration

**Scope:** MVP

Authorized administrative users shall be able to execute permitted taxonomy-management operations.

### FR-158 — Examination Administration

**Scope:** MVP

Authorized administrative users shall be able to execute permitted examination-management operations.

### FR-159 — Import Administration

**Scope:** POST-MVP

Authorized users shall be able to inspect and manage permitted question-import operations.

### FR-160 — Comment Administration

**Scope:** POST-MVP

Authorized moderators shall be able to execute supported comment-moderation operations.

### FR-161 — Billing Administration

**Scope:** POST-MVP

Authorized administrative users shall be able to inspect application-level subscription and payment information according to their permissions.

### FR-162 — Store Administration

**Scope:** POST-MVP

Authorized users shall be able to manage applicable digital-store content and operations.

### FR-163 — Blog Administration

**Scope:** POST-MVP

Authorized editorial users shall be able to manage blog content according to their permissions.

---

## 2.17 Auditability

### FR-164 — Administrative Audit Events

**Scope:** PLATFORM

The system shall record applicable security-sensitive or administratively significant actions.

### FR-165 — Audit Actor

**Scope:** PLATFORM

An audit record shall identify the actor responsible for an auditable authenticated action when an actor exists.

### FR-166 — Audit Target

**Scope:** PLATFORM

An audit record shall identify the relevant affected resource or business object when applicable.

### FR-167 — Audit Timestamp

**Scope:** PLATFORM

An audit record shall preserve the time at which the auditable event occurred.

---

## 2.18 Intelligent Study Features

### FR-168 — Deterministic Recommendations

**Scope:** POST-MVP

The system shall be capable of producing study recommendations based on deterministic rules and structured performance information.

### FR-169 — Weakness Identification

**Scope:** POST-MVP

The system shall be capable of identifying comparatively weak areas of student performance using recorded study data.

### FR-170 — Recommendation Traceability

**Scope:** POST-MVP

Where practical, recommendation results shall be explainable through the structured performance information or rule that produced them.

### FR-171 — AI Independence

**Scope:** PLATFORM

Core question solving, official answer-key handling, entitlement decisions and payment decisions shall not depend on generative AI.

---
---

## 2.19 Baseline Coverage Completion

The following requirements complete capabilities already defined by the approved product scope but not explicitly represented in the preceding functional requirement groups.

### FR-172 — Filter by Public Organization

**Scope:** MVP

Students shall be able to filter eligible questions by public organization or institution when that classification is available.

### FR-173 — Filter by Career or Position

**Scope:** MVP

Students shall be able to filter eligible questions by career, position or equivalent examination target when that classification is available.

### FR-174 — Filter by Difficulty

**Scope:** POST-MVP

Students shall be able to filter eligible questions by difficulty when difficulty classification is available.

### FR-175 — Question Source Management

**Scope:** PLATFORM

The system shall maintain structured question-source records that may be referenced by questions and used to preserve provenance, licensing and copyright information.

### FR-176 — DOCX Import

**Scope:** POST-MVP

The import architecture shall be capable of supporting question datasets obtained from DOCX documents when that import format is introduced.

### FR-177 — PDF Import

**Scope:** POST-MVP

The import architecture shall be capable of supporting question datasets obtained from PDF documents when that import format is introduced.

---

## 2.20 Functional Requirement Completion Rule

A functional requirement shall not be considered implemented merely because a corresponding user interface exists.

When a requirement enters an implementation phase, completion shall require the applicable combination of:

- domain behavior;
- backend authorization;
- persistence;
- validation;
- user-facing behavior;
- automated testing;
- observability where relevant;
- documented acceptance criteria.

Implementation details shall be defined in later sections of this specification and in the approved technical roadmap.