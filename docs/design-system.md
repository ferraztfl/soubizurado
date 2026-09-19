# Sou Bizurado design system foundation

This document defines the initial visual foundation for the student application.

The goal is to keep the product visually consistent as the Question Bank, Study, Analytics and future product areas are exposed through the UI.

## Product principles

- Study content has priority over decoration.
- The interface should feel mature, focused and trustworthy.
- Gamification may support retention, but must not make the product feel childish.
- Dense data should remain readable through hierarchy, spacing and restrained color.
- Repeated interaction patterns must be shared instead of recreated page by page.
- Loading, empty, error and retry states are part of the design, not afterthoughts.

## Visual identity

Sou Bizurado keeps its own identity rather than reproducing another study platform.

The core palette uses:

- brand red for primary actions and active navigation;
- neutral light surfaces for the application shell;
- dark text for legibility;
- semantic green, amber, red and blue for status feedback.

Reference products may inform information architecture and interaction patterns, but not copied branding, mascots, wording or distinctive visual assets.

## Semantic tokens

Global tokens live in `src/app/globals.css`.

Prefer semantic tokens such as:

- `--sb-background`;
- `--sb-surface`;
- `--sb-text`;
- `--sb-text-muted`;
- `--sb-border`;
- `--sb-brand`;
- `--sb-success`;
- `--sb-warning`;
- `--sb-danger`;
- `--sb-info`.

Legacy aliases remain temporarily available while existing screens are migrated.

## Application shell

The authenticated student area follows three responsive regions:

1. persistent sidebar on desktop;
2. sticky top bar;
3. constrained main content area.

Contextual right rails may be introduced only on pages that materially benefit from them, such as dashboards, missions or subscription surfaces.

On tablet and mobile the sidebar becomes a navigation drawer.

## Planned shared primitives

The first reusable UI layer should include:

- Button;
- Card;
- Badge;
- PageHeader;
- MetricCard;
- ProgressBar;
- Tabs;
- SearchInput;
- EmptyState;
- LoadingState / Skeleton;
- ErrorState / RetryState;
- Drawer / Dialog;
- Toast.

Question resolution receives its own purpose-built components instead of being treated as a generic dashboard card.

## Accessibility baseline

- visible keyboard focus;
- sufficient color contrast;
- reduced-motion support;
- semantic landmarks;
- descriptive labels for icon-only controls;
- no interaction that depends only on color.

## Responsive baseline

Desktop navigation is persistent from 1100px upward. Below that breakpoint the application uses a drawer.

Content widths should remain constrained enough for comfortable reading, especially on question statements and explanations.
