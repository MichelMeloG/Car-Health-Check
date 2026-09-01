# Monitoramento de custos e consumo

## Firebase/GCP

- Conferir no Firebase Console o uso de leituras, gravações, exclusões e armazenamento do Firestore.
- Conferir Authentication e evitar login por telefone no MVP, pois SMS é cobrado por envio.
- Não ativar Cloud SQL, Cloud Run, Functions, Storage ou exportação automática para BigQuery durante o piloto.
- Se o projeto estiver no plano Spark, acompanhar as cotas para evitar interrupção ao atingir o limite.
- Se uma conta de faturamento for vinculada, confirmar que o projeto mudou para Blaze e criar um orçamento no Google Cloud Billing.

## Limites operacionais do MVP

- sincronizar somente ao abrir, salvar ou recuperar conexão;
- não usar listeners em tempo real para todas as coleções;
- manter os eventos de Analytics sem valores financeiros ou identificadores pessoais;
- revisar o consumo semanalmente durante o piloto;
- registrar a data, versão do app e ação tomada quando houver alerta.

## Build e distribuição

O EAS Build pode consumir a cota da conta Expo. Reutilizar builds de desenvolvimento durante o ciclo de testes e gerar novo build somente quando houver alteração nativa.
