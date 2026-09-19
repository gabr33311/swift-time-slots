# Reformulação global SYCRAS

## Objetivo
Atualizar a identidade e o sistema visual em toda a aplicação, incluindo área de gestão, página inicial e páginas dos clientes.

## Alterações
- Substituir o nome Schedivo por **SYCRAS** em textos visíveis, títulos, descrições, instalação da app e ficheiros de calendário.
- Mudar a base visual para preto, branco e cinzentos, mantendo cor apenas nos estados das marcações.
- Criar gradientes animados próprios para tema claro e escuro:
  - verde para confirmado;
  - amarelo/laranja para pendente;
  - vermelho para cancelado;
  - roxo para concluído.
- Aplicar as barras coloridas de estado em todos os locais que apresentam marcações, incluindo páginas dos clientes.
- Adicionar à esquerda do sino um ícone de estado colorido; ao tocar, mostrar uma pequena legenda com o estado atual.
- Uniformizar os botões principais com gradiente monocromático animado: preto no tema claro e branco no tema escuro, preservando contraste, ações destrutivas e acessibilidade.
- Remover as descrições abaixo dos títulos das abas para libertar espaço vertical.
- Atualizar o endereço público apresentado e codificado no QR para `bookflow.pt`.
- Atualizar a página inicial e a experiência pública do cliente para a nova identidade preto/branco.
- Tornar a página Partilhar estática quando o conteúdo couber no ecrã, evitando scroll desnecessário sem cortar conteúdo em ecrãs pequenos.

## Detalhes técnicos
- Centralizar cores e gradientes em tokens globais com variantes claras e escuras.
- Reutilizar um único indicador de estado nas diferentes listas de marcações.
- Manter tradução PT/EN e funcionamento atual de autenticação, marcações, QR e ações.
- Validar visualmente em telemóvel nos dois temas e confirmar que páginas, menus e diálogos continuam legíveis e utilizáveis.
