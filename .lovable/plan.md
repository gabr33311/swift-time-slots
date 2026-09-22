# Ajustes da Agenda e seleção de clientes

## O que será alterado

- Centrar o texto e o botão do estado vazio, com espaçamento equilibrado.
- Reagrupar as setas, a data e o botão “Hoje” num único controlo compacto e coerente.
- Adicionar ao formulário de nova marcação uma escolha pesquisável de clientes existentes.
- Ao escolher um cliente, preencher automaticamente nome e telemóvel, mantendo possível editar os campos.
- Manter a criação automática de um novo cliente quando nenhum cliente existente for selecionado.

## Detalhes técnicos

- A lista de clientes será filtrada pelo negócio atual e carregada apenas enquanto o formulário estiver aberto.
- A marcação guardará diretamente o identificador do cliente selecionado, evitando duplicar a ficha.
- Os novos textos serão disponibilizados em português e inglês.
- A interface será validada em ecrã móvel e desktop.