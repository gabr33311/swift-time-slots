# Plano: Ícone de estado clicável + reverter menu das 3 barras

## Objetivo

1. **Reverter o menu das 3 barras** para a versão completa original (Confirmar, Marcar como concluída, Lembrar WhatsApp, Cancelar) com texto monocromático.
2. **Tornar o disco de estado (ícone colorido) interativo**:
   - O ícone dentro do disco passa a **cinzento** (muted-foreground) — só o **fundo** mantém a cor do estado.
   - Quando **Pendente**: clicar abre um menu rápido com **Confirmar** (verde) e **Cancelar** (vermelho).
   - Quando **Confirmada/Concluída/Cancelada**: clicar mostra um popover com o texto do estado (ex: "Confirmada").
3. O ícone de **notas** (post-it) no calendário também passa a cinzento, para ser consistente.

## Alterações

### 1. `src/components/appointment-actions.tsx` — reverter menu

Restaurar o menu completo que existia antes da última alteração:
- Confirmar (apenas quando pending)
- Marcar como concluída (quando não completed/cancelled)
- Lembrar cliente – WhatsApp (quando canRemind)
- Cancelar marcação (quando canCancel)

Todas as opções com `text-foreground` (monocromático), como antes.

Restaurar os imports removidos: `CheckCircle2`, `BellRing` de lucide-react; `normalizePhonePt` e `formatDateLong`/`formatTime` de `@/lib/*`.

O ícone `Menu` (3 barras) mantém-se cinzento (`text-muted-foreground`).

### 2. `src/components/appointment-status-indicator.tsx` — disco interativo

Transformar o `<span>` não-clicável num componente interativo:

- **Fundo**: mantém `appointment-status-disc` (gradiente colorido por estado).
- **Ícone**: passa a `text-muted-foreground` (cinzento), em vez de herdar a cor do estado.
- **Pendente**: o disco é um `DropdownMenuTrigger` que abre um menu com:
  - Confirmar (verde — `var(--appointment-confirmed-start)`)
  - Cancelar (vermelho — `var(--appointment-cancelled-start)`)
- **Outros estados** (confirmed, completed, cancelled, no_show): o disco é um `PopoverTrigger` que mostra o `statusLabel(status, lang)` num pequeno popover.

Este componente precisa de receber props adicionais: `id`, `businessId` (ou usar `useMyBusiness`), `customerName`, e callbacks de invalidação de cache — para poder executar `setAppointmentStatus` diretamente quando pending.

Alternativa mais simples: o disco pending passa a chamar as mesmas funções que o `AppointmentActions` já expõe. Para evitar duplicação, o disco pending abre o mesmo menu do `AppointmentActions` programaticamente, ou duplica a lógica mínima (confirm/cancel).

**Abordagem escolhida**: O `AppointmentStatusIndicator` recebe props `onConfirm` e `onCancel` (opcionais) do parent. Quando pending e essas props existem, renderiza como dropdown trigger. Quando não pending, renderiza como popover trigger com o label. O parent (`AppointmentActions`) passa essas callbacks.

### 3. `src/routes/_authenticated/calendar.tsx` — ícone de notas cinzento

No botão de notas (StickyNote), adicionar `text-muted-foreground` ao ícone para que fique cinzento, mantendo a borda colorida pelo estado.

## Detalhes técnicos

- `statusLabel(status, lang)` já existe em `src/lib/format.ts` com traduções PT/EN.
- O `Popover` e `PopoverContent` já são usados no calendário para as notas — reutilizar o mesmo padrão.
- O `DropdownMenu` já é usado em `AppointmentActions` — reutilizar.
- Animação `animate-status-shake` mantém-se no ícone pending.
- As cores verde/vermelho para Confirmar/Cancelar usam as variáveis CSS `--appointment-confirmed-start` e `--appointment-cancelled-start` já definidas.
- As ilhas dos contadores (alteração anterior) mantêm-se como estão (cor sólida, sem gradiente/animação).

## Ficheiros a alterar

1. `src/components/appointment-actions.tsx` — reverter menu completo
2. `src/components/appointment-status-indicator.tsx` — tornar interativo (dropdown quando pending, popover com label nos outros)
3. `src/routes/_authenticated/calendar.tsx` — ícone de notas cinzento
