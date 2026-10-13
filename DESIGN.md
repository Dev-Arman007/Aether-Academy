---
name: Lumina Academic
colors:
  surface: '#0d1515'
  surface-dim: '#0d1515'
  surface-bright: '#333b3b'
  surface-container-lowest: '#080f10'
  surface-container-low: '#151d1e'
  surface-container: '#192122'
  surface-container-high: '#232b2c'
  surface-container-highest: '#2e3637'
  on-surface: '#dce4e4'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dce4e4'
  inverse-on-surface: '#2a3232'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#ebb2ff'
  on-secondary: '#520072'
  secondary-container: '#b600f8'
  on-secondary-container: '#fff6fc'
  tertiary: '#f5f7ff'
  on-tertiary: '#213145'
  tertiary-container: '#ccdcf6'
  on-tertiary-container: '#516177'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#f8d8ff'
  secondary-fixed-dim: '#ebb2ff'
  on-secondary-fixed: '#320047'
  on-secondary-fixed-variant: '#74009f'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#0d1515'
  on-background: '#dce4e4'
  surface-variant: '#2e3637'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  container-padding: 32px
  gutter: 20px
---

## Brand & Style
The design system is engineered for high-performance academic management, blending the precision of developer-centric tools with a premium, focused atmosphere. The aesthetic prioritizes "Digital Sophistication," utilizing a **Dark-Mode Glassmorphic** style that minimizes cognitive load for administrators and students.

The target audience—students, faculty, and administrative staff—requires a UI that feels both authoritative and cutting-edge. We leverage deep obsidian backgrounds to reduce eye strain during long-form data entry, accented by neon-cyan and purple "energy lines" that guide the user’s eye toward critical actions and notifications. The result is a UI that feels less like a traditional bureaucratic tool and more like a high-end productivity workspace.

## Colors
This design system utilizes a "Void & Neon" palette. The core surface area is anchored in `#050505`, creating a true-black foundation that allows glassmorphic layers to achieve maximum contrast.

- **Primary (Neon Cyan):** Used exclusively for high-priority interactive elements, active states, and primary success indicators.
- **Secondary (Neon Purple):** Reserved for conceptual links, auxiliary actions, and academic milestones (e.g., grading, achievements).
- **Surface & Borders:** We use a hierarchy of slate grays. Borders are kept thin (1px) and low-contrast (`#1e293b`) to maintain the glass effect without creating visual "noise" around data-heavy tables.
- **Glows:** Accent colors are applied as 15% opacity radial gradients behind key cards to provide a sense of depth and "active" energy.

## Typography
The typography system is centered on **Inter** for its neutral, highly legible geometric qualities, ensuring that complex academic data remains readable at all sizes. We introduce **JetBrains Mono** for labels, metadata, and status tags to evoke a systematic, technical feel—ideal for a "Modern SaaS" ERP.

**Usage Rules:**
- **Headlines:** Use tight letter-spacing for large displays to create a "compact" premium look.
- **Body:** Always use `body-md` as the default for form fields and general reading. 
- **Labels:** Use uppercase for `label-sm` when used as category headers in the sidebar or section dividers.
- **Hierarchy:** Maintain a clear distinction between data (Inter) and system metadata (JetBrains Mono).

## Layout & Spacing
The design system employs a **Fluid-Fixed Hybrid** grid. The primary navigation sidebar is fixed at 280px, while the main content area utilizes a fluid 12-column grid.

- **Scale:** An 8px linear scale is the primary driver for spacing, with a 4px "half-step" used exclusively for tight UI elements like button icons or list item padding.
- **Rhythm:** Generous whitespace is a core requirement. Cards must never feel crowded; use `lg (24px)` padding as the minimum for card containers.
- **Mobile:** On devices below 768px, the sidebar collapses into a bottom navigation bar or a hamburger overlay, and container padding reduces to `md (16px)`.

## Elevation & Depth
Elevation is achieved through **Glassmorphism and Tonal Layering** rather than traditional shadows.

1.  **Level 0 (Base):** `#050505` background.
2.  **Level 1 (Cards/Sidebar):** Background: `rgba(15, 15, 15, 0.7)`; Backdrop Blur: `20px`; Border: `1px solid rgba(255, 255, 255, 0.08)`.
3.  **Level 2 (Modals/Popovers):** Background: `rgba(20, 20, 20, 0.9)`; Backdrop Blur: `40px`; Border: `1px solid rgba(255, 255, 255, 0.15)`.
4.  **Accent Elevation:** Interactive components like KPI cards use a subtle "Outer Glow" on hover—a 0px blur, 4px spread neon-cyan shadow with 20% opacity.

## Shapes
The shape language is "Soft-Modern." We avoid aggressive rounding (pill shapes) for structural elements to maintain a professional, organized ERP feel, but use significant rounding for cards to feel approachable.

- **Small Components (Buttons, Inputs):** `rounded (8px)`
- **Containers (Cards, Sections):** `rounded-lg (16px)`
- **System-level (Modals, Large Hero areas):** `rounded-xl (24px)`

## Components
Consistent implementation of the following components ensures a unified ERP experience:

- **Primary Buttons:** Solid `#00f2ff` background with black text. On hover, apply a `0 0 15px rgba(0, 242, 255, 0.4)` glow.
- **KPI Cards:** Use Level 1 Glassmorphism. Display values only when they come from persisted account records; show a calm empty state when a student has no records.
- **Command Search:** A centered, floating input bar (Level 2 Elevation) with a `CMD + K` shortcut label in `label-sm`. The background should be slightly more translucent than standard cards.
- **Account Roles:** Show the role assigned to the authenticated account. Users cannot choose or elevate their own role in the client.
- **Sidebar:** Icon-led navigation using 20px stroke icons. Active states use a "Glow-Vertical" indicator—a 2px wide Cyan line on the left edge with a soft cyan glow bleeding 8px into the menu item.
- **Chat Bubbles:** User messages use a subtle purple tint and border. Assistant messages remain Slate Gray; render the assistant's reply as escaped plain text.
