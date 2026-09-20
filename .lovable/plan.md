# Subscrição e alertas

## Objetivo
Dar destaque ao acesso aos planos e apresentar duas variantes visuais de alerta de subscrição, sem integrações ou alterações de dados.

## Alterações
- Adicionar no fim da Gestão um cartão alto de “Subscrição e Planos”, com tratamento premium, plano atual e ação de upgrade.
- Criar uma página dedicada aos Planos com alternador visual Mensal/Anual e comparação estática entre Base e Pro.
- Criar componentes reutilizáveis para alerta de fim de período gratuito e falha de pagamento.
- Mostrar temporariamente ambos os alertas no topo para aprovação visual, com ações que levam à página de Planos.
- Manter toda a experiência traduzida em português e inglês e coerente com os temas claro e escuro.

## Detalhes técnicos
- Criar uma rota autenticada própria para Planos e adicionar metadados específicos.
- Usar apenas estado local e dados fixos; sem Stripe, Lovable Cloud ou qualquer alteração de backend.
- Reutilizar os botões, tokens e padrões visuais existentes.
- Validar a interface em telemóvel e desktop.
