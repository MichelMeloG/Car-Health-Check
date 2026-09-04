# Armazenamento, sincronização e privacidade de dados

O app utiliza duas camadas de armazenamento com responsabilidades diferentes:

| Local | Finalidade |
| --- | --- |
| **SQLite no celular** | Base operacional local, usada para permitir que o app funcione mesmo sem internet. |
| **Firebase Firestore** | Cópia persistente e sincronizada na nuvem, vinculada à conta do usuário. |

No armazenamento local, o app mantém os veículos cadastrados, o livro financeiro central, os detalhes de abastecimento e manutenção, lembretes, sessões OBD, o veículo ativo da Home e o estado de sincronização de cada registro.

Cada lançamento financeiro possui um `vehicle_id`, permitindo que o app identifique a qual veículo aquele custo pertence mesmo sem conexão. O identificador do veículo ativo é salvo localmente em `app_preferences`, no campo `active_vehicle_id`, para que o app seja reaberto mostrando o mesmo carro selecionado. A opção “Todos os carros” é apenas uma visualização e não substitui o veículo ativo.

Abastecimentos e manutenções têm registros técnicos próprios, vinculados ao lançamento correspondente por `transaction_id`. Eles também criam automaticamente um registro em `financial_transactions`, que é a fonte usada por Home, Finanças, categorias, totais e custo por quilômetro.

No Firestore, os dados são organizados por usuário:

```text
users/{uid}/vehicles/{vehicleId}
users/{uid}/expenses/{expenseId}
users/{uid}/financialTransactions/{transactionId}
users/{uid}/maintenance/{maintenanceId}
users/{uid}/fuelEntries/{fuelEntryId}
users/{uid}/reminders/{reminderId}
users/{uid}/scanSessions/{scanId}
```

Cada lançamento financeiro sincronizado contém informações como:

```text
vehicleId
type
category
amountCents
occurredAt
supplierOrWorkshop
odometerKm
notes
sourceEntityType
sourceEntityId
updatedAt
deleted
```

Veículos guardam identidade e informações técnicas opcionais, como modelo, marca, apelido, ano, motor, câmbio, combustível, cor, placa, VIN e quilometragem.

O SQLite é a fonte operacional para o uso offline. Quando houver conexão disponível, os registros pendentes são sincronizados com o Firestore e alterações recebidas de outro dispositivo são conciliadas. Conflitos seguem a estratégia **última alteração vence**, utilizando `updatedAt`.

A exclusão de lançamentos utiliza exclusão lógica: o registro recebe `deleted: true` para que a remoção seja propagada aos demais dispositivos. A remoção definitiva desses registros após um período de retenção depende de uma política de retenção definida e de um processo de limpeza no backend.

O Firebase Authentication é usado exclusivamente para gerenciar a conta do usuário. Ele mantém identificadores como `uid`, e-mail e credenciais de autenticação gerenciadas pelo próprio Firebase. O aplicativo não armazena, acessa nem envia senhas para o Firestore.

As regras de segurança do Firestore restringem o acesso aos dados do usuário autenticado. Um usuário só pode acessar documentos no seu próprio caminho:

```text
users/{uid}/...
```

desde que:

```text
request.auth.uid == uid
```

O Firebase Analytics recebe apenas eventos técnicos e pseudônimos, como criação de conta, cadastro do primeiro veículo ou do primeiro gasto. Não enviamos e-mail, valores financeiros, categorias, descrições, quilometragem ou outras informações automotivas nos eventos de Analytics.

Atualmente, a base SQLite local não possui criptografia adicional implementada pelo aplicativo. Ela depende das proteções padrão do sistema operacional e do armazenamento do dispositivo.
