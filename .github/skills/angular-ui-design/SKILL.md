---
name: angular-ui-design
description: >
  Diseño y cambios de interfaz para la app de finanzas personales con Angular
  NgModules, Angular Material, Signals y Chart.js. Úsalo al crear o rediseñar
  pantallas, layouts, formularios, diálogos, tablas, gráficos, modo oscuro,
  accesibilidad o comportamiento responsive.
---

# Diseño de interfaz (Angular Material)

## Antes de cambiar la UI

1. Lee `AGENTS.md` del repo y revisa `client/src/app/` para localizar los
   feature modules existentes: `auth`, `layout`, `dashboard`, `transactions`,
   `accounts`, `categories`, `budgets`.
2. Confirma el sistema de diseño: **Angular Material** (`@angular/material` +
   `@angular/cdk`) con un tema personalizado en `client/src/styles.scss`. No
   introduzcas otra librería de componentes (Bootstrap, PrimeNG, Tailwind UI,
   etc.) sin una decisión explícita.
3. Verifica qué hoja global está activa (`styles.scss` y sus imports parciales
   `_theme.scss`, `_typography.scss`, `_utilities.scss`). No dupliques reglas
   entre archivos; si añades un parcial, impórtalo desde `styles.scss`.
4. Reutiliza los **componentes shared** en `client/src/app/shared/`
   (`EmptyStateComponent`, `LoadingSkeletonComponent`, `ErrorStateComponent`,
   `CurrencyCentsPipe`, `ChartContainerDirective`) antes de crear variantes
   nuevas.
5. Confirma el feature module donde vive la pantalla: cada pantalla pertenece
   a **un solo** `features/<feature>/` y no comparte lógica de negocio fuera
   de su store.

## Stack y patrones de UI del proyecto

- Angular 19+ con **NgModules** (NO standalone components, decisión de
  proyecto). Cada feature es un `FeatureModule` con `RouterModule.forChild` y
  se carga vía `loadChildren`.
- **Signals** para estado (local con `signal()`/`computed()`/`effect()` y
  compartido en **Store Services** con `signal`/`computed`). No se usa NgRx.
- **Angular Material** para todos los controles. Importa módulos concretos
  (`MatButtonModule`, `MatTableModule`, `MatDialogModule`, etc.).
- **Chart.js 4** envuelto en el `ChartContainerDirective` de `shared/`. Ningún
  gráfico se instancia directo en un componente; todos pasan por la directiva
  (que gestiona `ngOnDestroy` para evitar leaks).
- **Formularios reactivos tipados**: `FormGroup<FormControls>` con
  `NonNullableFormBuilder` cuando aplique. No se usa `ngModel`.
- `ChangeDetectionStrategy.OnPush` en **todos** los componentes. Sin
  excepción.
- Los importes se manejan en **centavos (integer)** en toda la app. En la UI
  se formatean siempre con el `CurrencyCentsPipe` compartido.

## Principios de dashboard financiero

- La UI debe responder, en orden: **¿Estoy bien? → ¿Qué necesita mi atención?
  → ¿Qué puedo hacer ahora?**
- La parte superior (above the fold) está dominada por el **Verdict Row**:
  patrimonio neto + variación % vs periodo anterior. Es lo primero que ve el
  usuario.
- Usa **números tabulares** (`font-feature-settings: 'tnum'` o
  `font-variant-numeric: tabular-nums`) en todas las cifras para que no
  "bailen" al actualizarse.
- Tipografía: `Inter` (o la serif del tema, según contexto) con jerarquía
  clara. Las cifras grandes usan peso y tamaño, no colores llamativos.
- Diseña siempre el **estado vacío y el estado parcial** antes que el estado
  "todo lleno". Un dashboard sin datos no es un error; es una oportunidad de
  onboarding.

## Layout responsive y PWA

- La app es **web-first responsive**, no una landing. Desktop es el target
  principal (dashboards financieros se leen mejor en pantalla amplia).
- Usa los breakpoints de Angular CDK (`BreakpointObserver`) o `MediaMatcher`,
  no valores hardcodeados.
- **Evita scroll de página global** en desktop: el scroll vive en el panel de
  contenido (`main` con `overflow-y: auto`). En móvil, el scroll global es
  aceptable.
- El `MainLayoutComponent` (sidebar + toolbar) colapsa el sidenav a `over`
  antes de comprimir el contenido. Siempre hay una acción visible para abrir
  el sidenav en pantallas pequeñas.
- Si un panel se oculta por breakpoint, ofrece una acción visible para
  recuperarlo.
- La app es instalable (PWA): `manifest.webmanifest` con `theme_color`,
  `background_color`, iconos 192/512/maskable. El shell de la app debe
  cachearse en el service worker.

## Componentes e interacción

- Toda acción importante funciona con teclado. `mat-dialog` ya gestiona foco
  inicial, Escape y retorno al invocador: no implementes diálogos caseros.
- **Foco visible** y selección son estados distintos. No elimines el outline
  de Angular Material ni lo sustituyas por `outline: none`.
- Los botones de solo icono requieren `aria-label` (o `mat-tooltip` cuando el
  tooltip sea el nombre accesible). No dependas solo de hover.
- En formularios Material: `mat-form-field` con `mat-label` visible y
  `mat-error` asociado al campo. Los estados inválidos no dependen solo del
  color; el mensaje explica el error.
- En operaciones asíncronas muestra **loading en el botón** (spinner en el
  propio botón, no overlay de pantalla completa) y **error en snackbar**
  (`MatSnackBar`). No pierdas el borrador del formulario si falla el submit.
- Para listas grandes (transacciones), usa `mat-table` con `trackBy` y
  `MatPaginator` sincronizado con backend; no cargues toda la colección en
  cliente.

## Angular Material: reglas concretas

- No modifiques el tema de Angular Material con overrides profundos. Extiende
  con mixins (`mat.define-palette`, `mat.define-light-theme`,
  `mat.define-dark-theme`) y crea tokens semánticos propios si hace falta
  (ej. `--color-income`, `--color-expense`, `--color-warning`).
- Los colores verde/rojo para ingresos/gastos se definen como **tokens
  semánticos**, no como hex en componentes. El modo oscuro reajusta esos
  tokens (los mismos nombres, distinta luminosidad).
- `MatTableDataSource` solo cuando el filtrado sea **en cliente** (raro). Si
  filtras/paginas en backend, la tabla consume un Signal con `data` y `total`
  del servidor.
- Los diálogos se abren con `MatDialog.open(Component, { data, width,
autoFocus })` y devuelven `MatDialogRef<Component, Result>`. El cierre
  normal devuelve un valor; `Escape`/backdrop devuelve `undefined`.
- Los `mat-snack-bar` de error son accionables cuando aplica (botón
  "Reintentar" en errores 5xx).
- Los chips de categorías/etiquetas usan `MatChipSet`/`MatChip` con
  `removable` cuando se puedan eliminar.

## Chart.js: rendimiento y accesibilidad

- Todos los gráficos van dentro de `ChartContainerDirective`. La directiva
  destruye el chart en `ngOnDestroy` y reacciona a cambios de tema (modo
  oscuro).
- **Desactiva animaciones** de chart en actualizaciones por filtro
  (`animation: false` en updates). La animación inicial está bien; cada
  interacción debe ser instantánea.
- Respeta `prefers-reduced-motion`: si está activo, todos los charts sin
  animación.
- Los gráficos tienen un texto alternativo (`aria-label` o descripción
  textual) con el resumen del dato principal. Chart.js no es accesible por sí
  solo.
- Colores de gráficos derivados de tokens semánticos; nunca hex hardcodeados.

## Modo oscuro

- El tema oscuro es un requisito de producto, no un extra. `ThemeService` con
  Signal `currentTheme: 'light' | 'dark' | 'system'`.
- `mat.define-dark-theme` en `styles.scss`; aplicar clase `.dark-theme` al
  `<body>`.
- Al cargar la app, el tema se aplica **antes** del bootstrap para evitar
  flash: script inline en `index.html` que lea `localStorage` (esto sí va en
  localStorage; es preferencia de UI, no dato de negocio).
- Chart.js necesita actualización explícita al cambiar de tema
  (`Chart.defaults.color`, colores de datasets). El `ThemeService` emite un
  Signal y el `ChartContainerDirective` reacciona.

## Verificación

Comandos:

- `npm run lint`
- `npm run typecheck -w client`
- `npm run test -w client`
- `npm run test:e2e` (Playwright para flujos críticos)

En UI comprueba, cuando corresponda:

1. Responsive en ~360px, ~768px, ~1280px y ~1920px, sin overflow horizontal
   ni scroll global accidental en desktop.
2. Teclado, foco visible, diálogos (`mat-dialog`) y retorno de foco.
3. Estados vacío, cargando, error y éxito, con el borrador conservado en
   formularios.
4. Modo oscuro en todas las pantallas (incluidos charts).
5. Zoom de texto (200%) y `prefers-reduced-motion`.
6. Que los componentes usados son de Angular Material y no hay overrides
   profundos del tema.

En la entrega informa qué se verificó realmente; no afirmes haber probado
tamaños, accesibilidad o navegadores si no se ejecutó esa comprobación.
