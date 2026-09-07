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
