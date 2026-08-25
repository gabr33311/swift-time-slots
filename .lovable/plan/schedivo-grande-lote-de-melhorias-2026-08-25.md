# Schedivo — grande lote de melhorias

O pedido cobre quase toda a app. Proponho executar por fases, na ordem abaixo, sem reconstruir nada do que já funciona.

## Fase 1 — Página pública de marcação (`/book/:slug`)

- Cabeçalho compacto: foto à esquerda, nome/descrição ao lado, contactos (morada, telemóvel, Instagram) numa linha horizontal com ícones pequenos; tag de profissional logo abaixo.
- Cartões de serviço: borda roxa (primária) quando selecionados, além da elevação.
- Calendário: dia selecionado com círculo cheio roxo e texto branco.
- Horários agrupados em "Manhã" e "Tarde" (separados pela pausa de almoço), secções colapsáveis.
- Passo 3 passa a ser **conta de cliente**: criar conta / entrar com nome, telemóvel e email, com código de confirmação enviado para o email (OTP). Inputs mais baixos e menos espaçamento; botão de confirmar sempre visível.
- Máscara de telemóvel (`912 345 678`, +351 implícito) reutilizável em toda a app.
- Ecrã de confirmação: um único menu "Adicionar ao calendário" (Google, Apple, Outlook, .ics) + botão "Ir para o meu painel".

## Fase 2 — Marcações pendentes e notificações do admin

- Marcações de cliente entram como **pendentes** e geram notificação na app para o admin.
- Nova página `/pendentes` (a partir do cartão "Pendentes" do Hoje) com separadores: Pendentes, Aceites, Recusadas.
- Aceitar / recusar diretamente na lista, com registo de histórico.
- Estado **No-show** com bloqueio sugerido para clientes reincidentes.

## Fase 3 — Área de cliente

- Página de cliente com marcações atuais e antigas, foto de perfil, definições e preferências.

## Fase 4 — Painel de gestão (UI)

- Inputs com borda subtil e fundo de contraste leve (ativos e inativos); menos padding vertical nos formulários longos.
- Badges de KPI (Confirmadas / Pendentes / Concluídas / Canceladas) com mais contraste e separação clara entre etiqueta e número.
- "Voltar" passa a ícone de seta minimalista no topo esquerdo.
- Fim do botão "Editar": os campos são sempre editáveis e aparece uma barra "Guardar alterações / Cancelar" quando há mudanças.
- Ordem dos serviços por arrastamento (drag handle) em vez de setas.
- Partilhar: remover "Copiar link"; o botão PNG transfere o QR imediatamente.
- Contactos: botão flutuante para adicionar novo contacto (como na agenda).
- Ficha técnica do cliente (notas: fórmula de tinta, alergias, preferências).

## Fase 5 — Hoje, landing page e idioma

- "Próximas marcações" mostra só o dia atual; ao continuar, cada dia seguinte tem cabeçalho com a data (ex. "terça-feira, 22-03-2027") e pode ser minimizado.
- Landing page: cartões de funcionalidades em grelha 2x2 compacta + secção com imagens do interior da app antes do "Começar agora".
- Tradução EN completa (dicionário aplicado a todos os textos).

## Fase 6 — Lembretes automáticos

- Avisos 24h antes por WhatsApp/SMS. Isto exige um serviço externo pago (ex. Twilio ou WhatsApp Cloud API) com chaves próprias. Sem isso, implemento o agendamento e a fila de envios, com envio por email como canal disponível.

## Nota técnica

Base de dados: adicionar notas de ficha técnica ao cliente, estado no-show + contagem, tabela de lembretes e ajuste do estado inicial das marcações de cliente para pendente. Alterações via migração, com RLS por negócio.
