# Implementação — Home enxuta e múltiplos veículos

## Objetivo

Reorganizar o aplicativo para que a tela inicial mostre o contexto de um único veículo ativo, reduza o excesso de ações e permita alternar entre carros. Uma visão consolidada de todos os carros deve existir somente após ação explícita do usuário.

## Decisões de produto

### Veículo ativo

A Home sempre abre com um único veículo ativo: o último carro selecionado pelo usuário. Se não houver preferência salva, o primeiro veículo cadastrado passa a ser o ativo.

O cabeçalho terá este formato:

```text
Car Health                                      [avatar]

Olá, {primeiro nome}
[ Honda Fit · 187.320 km                         ▾ ]
```

O seletor não mostra “Todos os carros” diretamente na Home. Ao tocar no veículo ativo, abre uma folha/modal:

```text
Selecionar veículo

✓ Honda Fit · 187.320 km
  Toyota Corolla · 84.500 km

────────────────────────────
  Ver resumo de todos os carros
+ Adicionar veículo
```

### Visão consolidada

“Ver resumo de todos os carros” abre uma tela própria de visão geral. Ela não substitui o veículo ativo nem passa a ser o estado inicial da Home.

A visão consolidada mostra:

- total de gastos de todos os veículos no período escolhido;
- comparação com o período anterior;
- distribuição por categoria;
- últimos lançamentos com etiqueta do veículo;
- atalho para selecionar um carro específico.

### Home enxuta

A Home do veículo ativo terá somente:

- identificação do usuário e veículo;
- total gasto no mês e comparação curta;
- até três gastos recentes;
- ação primária “Adicionar gasto”.

Filtros detalhados, gráficos por categoria e histórico completo ficam na aba Gastos. A leitura OBD fica dentro da aba Veículo.

## Navegação proposta

Barra inferior com quatro destinos:

```text
[ Início ] [ Gastos ] [ Veículo ] [ Menu ]
```

| Destino | Responsabilidade |
| --- | --- |
| Início | resumo do veículo ativo, últimos gastos e adicionar gasto |
| Gastos | filtros, comparações, categorias, lista completa e novo gasto |
| Veículo | dados do veículo ativo, quilometragem, edição e check-up OBD-II |
| Menu | perfil, exportação, privacidade, suporte, logout e exclusão de conta |

O avatar do topo abre Perfil. Perfil contém e-mail, preferências futuras e ações pessoais; Menu concentra as ações menos frequentes e sensíveis.

## Modelo de dados

O app atual trata um único veículo. Para suportar múltiplos veículos, cada gasto deve ser vinculado a `vehicleId`.

### SQLite

Alterações necessárias:

```sql
ALTER TABLE expenses ADD COLUMN vehicle_id TEXT;
CREATE INDEX IF NOT EXISTS expenses_owner_vehicle_occurred_at
  ON expenses(owner_id, vehicle_id, occurred_at DESC);
```

Novas preferências locais:

```text
app_preferences
├── owner_id
├── active_vehicle_id
└── updated_at
```

Regras locais:

- gastos sempre possuem `owner_id` e `vehicle_id`;
- o veículo ativo é armazenado por usuário;
- dados de usuários diferentes nunca compartilham o veículo ativo;
- o modo consolidado não é persistido como veículo ativo.

### Firestore

Manter coleções por usuário e adicionar `vehicleId` ao gasto:

```text
users/{userId}
├── vehicles/{vehicleId}
└── expenses/{expenseId}
    ├── vehicleId
    ├── amountCents
    ├── occurredAt
    ├── category
    ├── updatedAt
    └── deleted
```

O gasto não deve usar valor monetário em Analytics ou logs. O `vehicleId` é usado apenas para segmentar o dado do usuário no banco e para consultas da interface.

### Migração do veículo único atual

1. Criar/identificar o veículo existente como `vehicle_primary`.
2. Preencher `expenses.vehicle_id` com `vehicle_primary` para os gastos antigos daquele usuário.
3. Sincronizar o veículo e gastos atualizados preservando os IDs atuais dos lançamentos.
4. Marcar a migração concluída por usuário para que ela seja idempotente.
5. Definir `vehicle_primary` como veículo ativo inicial.

Nenhum gasto deve ser duplicado durante a migração.

## Regras de interface

### Sem veículo cadastrado

```text
Olá, Michel
Você ainda não cadastrou um veículo.

[ Cadastrar meu primeiro veículo ]
```

Não exibir seletor, OBD ou resumo financeiro até existir um veículo.

### Um veículo cadastrado

Exibir o veículo no cabeçalho. O toque ainda abre o seletor, com a opção de adicionar outro veículo e ver a visão consolidada.

### Vários veículos cadastrados

Exibir somente o veículo ativo na Home. Trocar o carro atualiza imediatamente Home, Gastos e Veículo.

### OBD-II

O check-up exige um veículo ativo. Na visão consolidada, o usuário deve escolher um carro antes de iniciar a leitura OBD.

## Serviços e estado

Criar um `VehicleContext` ou evoluir `AppDataProvider` com:

```ts
activeVehicleId: string | null
activeVehicle: Vehicle | null
vehicles: Vehicle[]
selectVehicle(vehicleId: string): Promise<void>
getExpensesForActiveVehicle(): Expense[]
getAllVehiclesSummary(): VehicleSummary[]
```

Os dados devem continuar offline-first:

- salvar localmente primeiro;
- marcar sincronização pendente;
- sincronizar após salvar, abrir o app ou recuperar conexão;
- aplicar conflito simples por `updatedAt`;
- manter o `vehicleId` em todo retry e em toda sincronização.

## Fases de implementação

### Fase 1 — Base de dados e migração

- adicionar `vehicle_id` aos gastos SQLite;
- adicionar índice local;
- criar preferências do veículo ativo;
- migrar veículo/gastos existentes;
- incluir `vehicleId` no Firestore e sincronização;
- revisar índices Firestore se a consulta por veículo for feita remotamente.

### Fase 2 — Estado e seleção

- listar veículos do usuário;
- persistir veículo ativo;
- criar modal/folha de seleção;
- criar tela consolidada “Resumo de todos os carros”; 
- bloquear OBD sem veículo específico selecionado.

### Fase 3 — Navegação e telas

- substituir a navegação atual por abas inferiores;
- reduzir Home ao resumo e últimos gastos;
- mover filtros, categorias e histórico para Gastos;
- mover OBD para Veículo;
- criar Perfil e Menu.

### Fase 4 — Qualidade e migração de release

- testar dados existentes após migração;
- testar usuário com zero, um e vários veículos;
- testar modo offline e sincronização em dois dispositivos;
- validar regras Firestore no Emulator;
- gerar build interno novo pelo EAS.

## Critérios de aceite

- a Home abre com um único veículo ativo;
- “Todos os carros” é acessível somente pelo seletor e abre tela consolidada;
- gastos não aparecem no veículo errado;
- trocar de veículo atualiza Home, Gastos e Veículo;
- cada gasto possui `vehicleId` local e remoto;
- OBD não é iniciado sem um veículo específico;
- dados antigos do veículo único são migrados sem duplicação;
- logout limpa o veículo ativo e o contexto privado em memória;
- exportação e exclusão de conta incluem todos os veículos do usuário.

## Fora de escopo nesta etapa

- compartilhamento de veículos entre usuários;
- múltiplos motoristas e permissões por veículo;
- histórico de manutenção avançado;
- seleção automática de veículo por Bluetooth/OBD;
- comparação de custos entre usuários.
