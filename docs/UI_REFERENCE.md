# UI Reference — AgentGov

> Референс: [wist.chat](https://www.wist.chat/)
> Стиль: Минималистичный enterprise B2B с editorial-типографикой

---

## Цветовая палитра

| Название | Значение | Использование |
|----------|----------|---------------|
| Background | `#FFFFFF` | Основной фон |
| Background Dark | `#000000` | Тёмные секции, hero |
| Text Primary | `#000000` | Заголовки, основной текст |
| Text Secondary | `rgba(0,0,0,0.6)` | Описания, подписи |
| Text Inverted | `#FFFFFF` | Текст на тёмном фоне |
| Accent | `#3950CD` | Кнопки, ссылки, hover |
| Border | `#E5E5E5` | Разделители, границы карточек |
| Surface | `#F5F5F5` | Фон карточек, input'ы |

### Tailwind конфиг

```js
// tailwind.config.js
colors: {
  accent: '#3950CD',
  border: '#E5E5E5',
  surface: '#F5F5F5',
}
```

---

## Типографика

### Шрифты

| Роль | Шрифт | Fallback |
|------|-------|----------|
| Заголовки | Inter или аналог serif | system-ui |
| Body | Inter | system-ui, sans-serif |
| Mono | JetBrains Mono | monospace |

### Размеры

| Элемент | Desktop | Mobile | Line Height | Letter Spacing |
|---------|---------|--------|-------------|----------------|
| H1 (Hero) | 72px | 48px | 1.0 | -0.03em |
| H2 (Section) | 48px | 32px | 1.1 | -0.02em |
| H3 (Card) | 20px | 18px | 1.3 | -0.01em |
| Body | 16px | 16px | 1.6 | 0 |
| Small | 14px | 14px | 1.5 | 0 |
| Caption | 12px | 12px | 1.4 | 0.02em |

### Tailwind классы

```jsx
// Hero заголовок
<h1 className="text-5xl md:text-7xl font-semibold tracking-tight">

// Section заголовок
<h2 className="text-3xl md:text-5xl font-semibold tracking-tight">

// Card заголовок
<h3 className="text-lg md:text-xl font-medium">

// Body text
<p className="text-base text-black/60">
```

---

## Layout

### Контейнер

```jsx
// Центрированный контент с max-width
<div className="mx-auto max-w-[1330px] px-6 md:px-8">
```

### Grid система

```jsx
// Feature cards — 3 колонки
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">

// Split layout (hero)
<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

// Pricing — 4 колонки
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
```

### Секции

```jsx
// Светлая секция
<section className="py-20 md:py-32 bg-white">

// Тёмная секция
<section className="py-20 md:py-32 bg-black text-white">

// С разделителем
<section className="py-20 border-t border-border">

// С dotted background (светлая)
<div
  className="bg-neutral-50"
  style={{
    backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)`,
    backgroundSize: "24px 24px",
  }}
>

// С dotted background (тёмная)
<section
  className="bg-black text-white"
  style={{
    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
    backgroundSize: "24px 24px",
  }}
>
```

---

## Компоненты

### Кнопки

```jsx
// Primary
<button className="
  px-6 py-3
  bg-accent text-white
  rounded-xl
  font-medium
  hover:bg-accent/90
  transition-colors
">
  Get Started
</button>

// Secondary
<button className="
  px-6 py-3
  bg-surface text-black
  rounded-xl
  font-medium
  hover:bg-surface/80
  transition-colors
">
  Learn More
</button>

// Ghost
<button className="
  px-6 py-3
  text-black
  rounded-xl
  font-medium
  hover:bg-surface
  transition-colors
">
  Cancel
</button>
```

### Карточки

```jsx
// Feature card
<div className="
  p-6
  bg-white
  rounded-3xl
  border border-border
  shadow-sm
">
  <div className="w-10 h-10 mb-4">
    <Icon />
  </div>
  <h3 className="text-lg font-medium mb-2">Feature Title</h3>
  <p className="text-black/60">Feature description goes here.</p>
</div>

// Product screenshot card
<div className="
  p-4
  bg-surface
  rounded-3xl
  overflow-hidden
">
  <img
    src="/screenshot.png"
    className="rounded-2xl shadow-lg"
  />
</div>
```

### Inputs

```jsx
<input
  type="text"
  className="
    w-full
    px-4 py-3
    bg-surface
    border border-transparent
    rounded-xl
    focus:border-accent focus:outline-none
    transition-colors
  "
  placeholder="Enter your email"
/>
```

### Navigation

```jsx
<header className="
  fixed top-0 left-0 right-0
  z-50
  bg-white/80 backdrop-blur-sm
  border-b border-border
">
  <nav className="
    mx-auto max-w-[1330px]
    px-6
    h-16
    flex items-center justify-between
  ">
    <Logo />

    <div className="hidden md:flex items-center gap-8">
      <a href="#features" className="text-sm hover:text-accent">Features</a>
      <a href="#pricing" className="text-sm hover:text-accent">Pricing</a>
    </div>

    <div className="flex items-center gap-4">
      <button className="text-sm font-medium">Log in</button>
      <button className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium">
        Sign up
      </button>
    </div>
  </nav>
</header>
```

---

## Паттерны секций

### Hero (Split Layout)

```jsx
<section className="min-h-screen bg-white">
  <div className="mx-auto max-w-[1330px] px-6 py-20">
    <div className="grid lg:grid-cols-2 gap-12 items-center">

      {/* Left: Product Preview */}
      <div className="bg-black rounded-3xl p-6">
        <ProductDemo />
      </div>

      {/* Right: Copy */}
      <div>
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight mb-6">
          AI Agent<br />Governance.
        </h1>
        <p className="text-xl text-black/60 mb-8 max-w-md">
          Monitor, secure, and control your AI agents
          with enterprise-grade governance.
        </p>
        <div className="flex gap-4">
          <Button>Get Started</Button>
          <Button variant="secondary">View Demo</Button>
        </div>
      </div>

    </div>
  </div>
</section>
```

### Features Grid

```jsx
<section className="py-20 bg-white border-t border-border">
  <div className="mx-auto max-w-[1330px] px-6">

    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">
        Everything you need.
      </h2>
      <p className="text-lg text-black/60 max-w-2xl mx-auto">
        Complete visibility into your AI agent operations.
      </p>
    </div>

    <div className="grid md:grid-cols-3 gap-6">
      {features.map(feature => (
        <FeatureCard key={feature.id} {...feature} />
      ))}
    </div>

  </div>
</section>
```

### Dark Section (CTA)

```jsx
<section
  className="py-20 bg-black text-white"
  style={{
    backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)`,
    backgroundSize: "24px 24px",
  }}
>
  <div className="mx-auto max-w-[1330px] px-6 text-center">

    <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">
      Ready to get started?
    </h2>
    <p className="text-lg text-white/60 mb-8 max-w-xl mx-auto">
      Start monitoring your AI agents today. Free tier available.
    </p>
    <Button>Start Free Trial</Button>

  </div>
</section>
```

### Section Label

```jsx
function SectionLabel({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-sm text-black/40 font-mono">[{number}]</span>
      <span className="text-sm text-black/40 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// Использование
<SectionLabel number="01" label="How it works" />
```

### Bordered Container

Контейнер с вертикальными границами по бокам (как на wist.chat).

```jsx
function BorderedContainer({ children, className = "" }) {
  return (
    <div className={`mx-auto max-w-[1330px] border-x border-black/10 ${className}`}>
      {children}
    </div>
  );
}
```

### Dotted Separator

```jsx
<div className="border-b border-black/10">
  <div
    className="h-12 sm:h-24 w-full"
    style={{
      backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.15) 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
    }}
  />
</div>
```

### How It Works (Interactive)

Секция с авто-переключением шагов, прогресс-баром и mockup справа.

```jsx
// apps/web/src/components/landing/how-it-works.tsx
import { HowItWorks } from "@/components/landing/how-it-works";

<section className="border-b border-black/10">
  <BorderedContainer>
    {/* Header */}
    <div className="px-6 py-16 border-b border-black/10">
      <SectionLabel number="01" label="How it works" />
      <h2 className="font-serif text-5xl tracking-tight">
        <span className="text-black">Title.</span>{" "}
        <span className="text-black/40">Description in muted color.</span>
      </h2>
    </div>

    {/* Interactive grid */}
    <HowItWorks />
  </BorderedContainer>
</section>
```

**Особенности:**
- Авто-переключение каждые 4 секунды
- Прогресс-бар как левый border активного шага
- Пауза при клике, возобновление через 10 секунд
- Mockup с fade-in-up анимацией

### Integrations Section

```jsx
// apps/web/src/components/landing/trusted-by.tsx
import { TrustedBy } from "@/components/landing/trusted-by";

const integrations = [
  { name: "OpenAI", text: "OpenAI" },
  { name: "Anthropic", text: "Anthropic" },
  { name: "Vercel AI", text: "▲ Vercel AI" },
  { name: "LangChain", text: "🦜 LangChain" },
];

<section className="border-b border-black/10">
  <BorderedContainer>
    <TrustedBy logos={integrations} title="Integrates with" />
  </BorderedContainer>
</section>
```

### Pricing Table

```jsx
<section className="py-20 bg-white">
  <div className="mx-auto max-w-[1330px] px-6">

    <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-center mb-16">
      Simple pricing.
    </h2>

    <div className="grid md:grid-cols-4 gap-4">
      {plans.map(plan => (
        <div
          key={plan.name}
          className="p-6 rounded-2xl border border-border"
        >
          <h3 className="font-medium mb-2">{plan.name}</h3>
          <div className="text-3xl font-semibold mb-4">
            ${plan.price}<span className="text-base font-normal text-black/60">/mo</span>
          </div>
          <ul className="space-y-2 text-sm text-black/60">
            {plan.features.map(f => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <Button className="w-full mt-6">Choose Plan</Button>
        </div>
      ))}
    </div>

  </div>
</section>
```

---

## Dashboard паттерны

### Layout структура

Dashboard использует двухуровневый header + опциональный sidebar.

```jsx
// apps/web/src/app/dashboard/layout.tsx
<div
  className="min-h-screen bg-neutral-50 flex flex-col"
  style={{
    backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.12) 1px, transparent 1px)`,
    backgroundSize: '24px 24px',
  }}
>
  <header className="border-b border-black/10 bg-white sticky top-0 z-50">
    {/* Row 1: Logo + Project Selector + User */}
    <div className="flex items-center justify-between h-14 px-5 border-b border-black/5">
      ...
    </div>
    {/* Row 2: Tabs */}
    <nav className="flex items-center gap-1 px-5 h-11">
      ...
    </nav>
  </header>

  <div className="flex-1 flex">
    {children}
  </div>
</div>
```

### Tab Navigation

Табы с underline-индикатором активного состояния.

```jsx
<Link
  href={tab.href}
  className={cn(
    'px-3 py-2 text-sm font-medium transition-colors relative',
    pathname.startsWith(tab.href)
      ? 'text-black'
      : 'text-black/50 hover:text-black/70',
    // Underline для активного таба
    pathname.startsWith(tab.href) &&
      'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-black'
  )}
>
  {tab.name}
</Link>
```

### Page Header

Стандартный header для страниц dashboard.

```jsx
<div className="bg-white border-b border-black/10 px-6 py-4 flex items-center justify-between">
  <div>
    <h1 className="font-semibold text-lg">Page Title</h1>
    <p className="text-sm text-black/50">Optional description</p>
  </div>
  <Button>Action</Button>
</div>
```

### Sidebar (только для Traces)

Sidebar используется только на странице Traces для фильтров.

```jsx
<aside className="w-64 border-r border-black/10 flex-shrink-0 bg-white">
  <div className="p-4 border-b border-black/5">
    <h2 className="font-medium flex items-center gap-2">
      <Filter className="h-4 w-4 text-black/40" />
      Filters
    </h2>
  </div>
  <div className="p-4 space-y-5">
    {/* Filter controls */}
  </div>
</aside>
```

### Content Area

```jsx
<main className="flex-1 overflow-auto">
  <div className="p-6">
    {/* Content */}
  </div>
</main>
```

### Project Card

Карточка проекта с выделением активного.

```jsx
<div
  className={`bg-white rounded-lg border p-5 hover:shadow-sm transition-all cursor-pointer ${
    isSelected ? 'border-primary ring-1 ring-primary' : 'border-black/10'
  }`}
  onClick={() => setSelectedProjectId(project.id)}
>
  <div className="flex items-start justify-between mb-3">
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <h3 className="font-medium truncate">{project.name}</h3>
        {isSelected && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
            Active
          </span>
        )}
      </div>
      <p className="text-sm text-black/50 truncate">
        {project.description || 'No description'}
      </p>
    </div>
    <DropdownMenu>...</DropdownMenu>
  </div>
  <div className="flex justify-between text-sm text-black/40">
    <span>{project._count?.traces || 0} traces</span>
    <span>{formatDistanceToNow(...)}</span>
  </div>
</div>
```

### Settings Card

Карточка настроек с иконкой и статус-бейджем.

```jsx
<div className="bg-white rounded-lg border border-black/10 p-6">
  <div className="flex items-start gap-4 mb-4">
    <div className="p-2 bg-black/5 rounded-lg">
      <Icon className="h-5 w-5 text-black/60" />
    </div>
    <div className="flex-1">
      <h2 className="font-medium mb-1">Setting Title</h2>
      <p className="text-sm text-black/50">Description</p>
    </div>
    <StatusBadge configured={!!value} />
  </div>
  <div className="space-y-3">
    {/* Form controls */}
  </div>
</div>
```

### Status Badge

```jsx
function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
      <Check className="h-3.5 w-3.5" />
      Configured
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-black/40 bg-black/5 px-2.5 py-1 rounded-full">
      <X className="h-3.5 w-3.5" />
      Not set
    </span>
  );
}
```

### Empty State

```jsx
<div className="bg-white rounded-lg border border-black/10 p-16 text-center max-w-md mx-auto">
  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-black/20" />
  <h3 className="font-medium text-lg mb-2">No items yet</h3>
  <p className="text-black/50 mb-4">
    Description of what to do next.
  </p>
  <Button>
    <Plus className="mr-2 h-4 w-4" />
    Create Item
  </Button>
</div>
```

### Global Project Context

Используется для синхронизации выбранного проекта между страницами.

```jsx
// hooks/use-selected-project.ts
export const SelectedProjectContext = createContext<{
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
} | null>(null)

export function useSelectedProject() {
  const context = useContext(SelectedProjectContext)
  if (!context) {
    throw new Error('useSelectedProject must be used within SelectedProjectProvider')
  }
  return context
}

// В layout.tsx
<SelectedProjectContext.Provider value={contextValue}>
  {children}
</SelectedProjectContext.Provider>
```

---

## Анимации

### Fade In Up

```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out forwards;
}
```

### Border Beam

Анимированная рамка с бегущим светом. Использует CSS `@property` для анимации угла градиента.

```css
/* globals.css */
@property --border-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes border-beam-rotate {
  to {
    --border-angle: 360deg;
  }
}

.border-beam {
  --border-beam-color-from: #3950cd;
  --border-beam-color-to: #8b5cf6;
  --border-beam-duration: 8s;
  position: relative;
  isolation: isolate;
}

.border-beam::before {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 1.2rem;
  background: conic-gradient(
    from var(--border-angle),
    transparent 25%,
    var(--border-beam-color-from) 35%,
    var(--border-beam-color-to) 50%,
    var(--border-beam-color-from) 65%,
    transparent 75%
  );
  animation: border-beam-rotate var(--border-beam-duration) linear infinite;
  z-index: -1;
}

/* Glow effect */
.border-beam::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 1.4rem;
  background: /* same gradient */;
  filter: blur(12px);
  opacity: 0.5;
  z-index: -2;
}
```

```jsx
// Использование
import { BorderBeam } from "@/components/ui/border-beam";

<BorderBeam duration={8} colorFrom="#3950cd" colorTo="#8b5cf6">
  <Card />
</BorderBeam>
```

**Browser Support:** Chrome, Edge, Safari. Firefox не поддерживает `@property`.

### Animation Delays

```css
.animate-delay-100 { animation-delay: 0.1s; }
.animate-delay-200 { animation-delay: 0.2s; }
.animate-delay-300 { animation-delay: 0.3s; }
.animate-delay-400 { animation-delay: 0.4s; }
```

---

## Spacing System

| Name | Value | Usage |
|------|-------|-------|
| xs | 4px | Между иконкой и текстом |
| sm | 8px | Внутренний padding мелких элементов |
| md | 16px | Gap в grid, padding карточек |
| lg | 24px | Между элементами секции |
| xl | 32px | Между блоками |
| 2xl | 48px | Padding секций (mobile) |
| 3xl | 80px | Padding секций (desktop) |
| 4xl | 128px | Между major секциями |

---

## Радиусы

| Element | Radius |
|---------|--------|
| Buttons | 12px (`rounded-xl`) |
| Cards | 24px (`rounded-3xl`) |
| Inputs | 12px (`rounded-xl`) |
| Images | 16px (`rounded-2xl`) |
| Badges | 9999px (`rounded-full`) |

---

## Shadows

```js
// tailwind.config.js
boxShadow: {
  'sm': '0 1px 2px rgba(0,0,0,0.12)',
  'card': '0 4px 12px rgba(0,0,0,0.08)',
  'elevated': '0 8px 24px rgba(0,0,0,0.12)',
}
```

---

## Чеклист для реализации

### Landing Page
- [x] Настроить цвета в `globals.css` (@theme inline)
- [x] Добавить шрифт serif для заголовков
- [x] Сверстать Navigation (fixed, backdrop-blur)
- [x] Сверстать Hero секцию (split layout)
- [x] Добавить BorderBeam анимацию
- [x] Сверстать Integrations секцию
- [x] Сверстать How It Works (интерактив)
- [x] Сверстать Code Preview (тёмная секция)
- [x] Сверстать Features grid
- [x] Сверстать Pricing
- [x] Сверстать CTA секцию
- [x] Сверстать Footer
- [x] Добавить анимации (fadeIn, fadeInUp)
- [x] Добавить dotted backgrounds
- [x] Адаптив для мобильных

### Dashboard
- [x] Two-row header (logo + project selector / tabs)
- [x] Global project context
- [x] Project selector в header
- [x] Tab navigation с underline
- [x] Sidebar для фильтров (Traces)
- [x] Traces table
- [x] Projects page (карточки + CRUD)
- [x] Settings page (API keys)
- [x] Empty states
- [x] Dotted background
- [ ] Trace detail view
- [ ] Spans timeline
- [ ] Cost analytics charts
- [ ] Real-time updates
