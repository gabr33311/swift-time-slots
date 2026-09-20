# Ajustes SYCRAS: password, estados, agenda

## 1. Autenticação
- Nova página pública `/reset-password`: formulário com "Nova password" + "Confirmar password", valida igualdade e regras mínimas, atualiza a password e redireciona para a app. O link do email passa a apontar para esta página.
- Remover por completo a opção de entrar/criar conta com Google: botões e separadores em `src/routes/auth.tsx` e `src/components/client-auth-step.tsx`, mais o ícone Google e os textos associados. Fica apenas email + password (e o código por email do cliente).

## 2. Estilos globais
- Reduzir cerca de 45% a opacidade dos fundos coloridos dos estados (confirmado, pendente, cancelado, concluído) nas barras de marcação, em tema claro e escuro, mantendo a cor reconhecível mas mais suave.
- Menu do sino: todas as opções passam a texto monocromático (preto/branco) com o respetivo ícone, sem fundos coloridos nem realces por opção.

## 3. Agenda e cartões
- Cada cartão de marcação passa a mostrar a hora exata em destaque, à esquerda do nome.
- Em dias com horário de trabalho, a agenda mostra a grelha completa por ordem cronológica: horas livres clicáveis intercaladas com as marcações existentes.
- Em dias sem horário definido e sem marcações, mostrar ao centro um ícone suave monocromático com "Dia livre! Sem marcações para hoje." (PT/EN).
- Se a marcação tiver nota do cliente, mostrar um ícone de post-it no cartão; ao clicar abre um pequeno painel com o texto da nota.
- O ícone de estado pendente passa a ter a mesma cor e estilo dos restantes, distinguindo-se apenas por uma animação suave de shake.

## 4. Agendamento
- Na criação manual de marcação, quando o negócio só tem um profissional ativo, esse profissional é selecionado automaticamente.

## Notas técnicas
- Rota nova `src/routes/reset-password.tsx` (pública, fora de `_authenticated`), usando `supabase.auth.updateUser({ password })` após sessão de recuperação; `resetPasswordForEmail` passa a usar `${origin}/reset-password`.
- Cores de estado: ajustar os tokens `--appointment-*` em `src/styles.css` para versões com alpha (~55% do atual) em `:root` e `.dark`.
- Agenda: a query de `calendar.tsx` já carrega `working_hours`; passa a fundir as horas geradas com as marcações numa única lista ordenada, e a selecionar `notes` das marcações.
- Auto-assign: em `new-appointment-dialog.tsx`, quando `staff.length === 1`, definir `staffId` por efeito ao carregar os dados.
- Traduções novas em `src/lib/i18n/calendar.ts` e nos dicionários de autenticação.
