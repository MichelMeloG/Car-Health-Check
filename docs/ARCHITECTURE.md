# Car Health — arquitetura do MVP

Status: proposta inicial  
Escopo atual: esqueleto do app com controle de gastos; OBD entra na próxima etapa

## 1. Objetivo arquitetural

Construir rapidamente um app utilizável para registrar e consultar gastos do veículo. A base deve permitir adicionar histórico de manutenção e, depois, sessões OBD sem precisar trocar a plataforma.

O primeiro incremento deve priorizar:

- cadastro do usuário e de um veículo;
- registro de gastos por categoria, data, valor, quilometragem e observação;
- listagem, edição e exclusão de lançamentos;
- totais por mês e por categoria;
- armazenamento local e sincronização com o backend;
- estrutura preparada para manutenção, OBD e relatórios futuros.

O objetivo técnico posterior permanece provar a promessa “algo mudou no seu carro”, mas ela não precisa estar no primeiro esqueleto.

## 2. Requisitos extraídos do documento da ideia

Estes pontos são requisitos de produto presentes no PDF, não decisões novas deste documento:

- uma conta pode começar com um veículo e uma variante suportada;
- o app deve executar uma sessão guiada, incluindo marcha lenta por aproximadamente 30 segundos;
- o app deve descobrir protocolo e PIDs suportados antes da coleta;
- deve armazenar DTCs, parâmetros essenciais, qualidade da sessão e histórico;
- deve detectar mudanças persistentes, sem concluir a partir de uma leitura isolada;
- regras, parser e conhecimento devem ser versionados;
- o relatório não pode apresentar conclusão forte quando a qualidade for insuficiente;
- apagar DTC exige confirmação explícita e auditoria;
- nenhuma interação manual deve ser exigida durante a condução;
- dados brutos devem ser minimizados; agregados e evidências devem ser preservados;
- OCR, passaporte, portal de oficinas, previsão financeira avançada, todas as centrais e hardware próprio ficam fora do MVP.

## 3. Decisões técnicas propostas

| Área | Decisão do MVP | Motivo |
|---|---|---|
| Mobile | React Native + Expo + TypeScript | Stack já conhecida pelo fundador e adequada para entregar o esqueleto rapidamente. Usar development build quando o OBD/BLE exigir módulo nativo. |
| BLE/OBD | Driver próprio como máquina de estados | Tolera eco residual, timeouts, `NO DATA`, headers, múltiplas ECUs e adaptadores imperfeitos. |
| Persistência local | SQLite via camada de repositório | Permite coletar sem internet e sincronizar depois. |
| API | Firebase SDK no primeiro incremento; REST versionada em `/api/v1` depois | Elimina um servidor próprio enquanto o app valida o uso. |
| Backend | Firebase no primeiro incremento; Node.js + TypeScript no Cloud Run depois | Só adicionar API própria quando houver regras que realmente precisem de servidor. |
| Banco | Cloud Firestore no primeiro incremento; Cloud SQL PostgreSQL depois | Firestore tem cota gratuita e combina com o CRUD simples de gastos; PostgreSQL entra quando relatórios e domínio relacional justificarem o custo fixo. |
| Arquivos | Object storage privado | Para evidências futuras; no MVP, anexos podem ser limitados ou adiados. |
| Processamento | Jobs assíncronos no mesmo backend | Reprocessamento de tendências e geração de relatório sem bloquear a API. |
| Inteligência | Regras determinísticas + estatística simples; IA só para redação | Reduz alarmismo, custo e risco de a IA inventar diagnóstico. |
| Autenticação | Firebase Authentication | Evita implementar armazenamento e recuperação de senha no backend; o backend valida o ID token. |

Essas escolhas atualizam a decisão aberta do documento da ideia: React Native + Expo passa a ser a opção adotada para o MVP. O BLE será adicionado depois via development build/config plugin se o Expo Go não atender ao driver necessário.

## 4. Hospedagem recomendada no GCP com custo mínimo

Para o estágio inicial, não vamos manter um backend e um banco sempre ligados. O Firebase roda dentro de um projeto GCP e fornece autenticação, banco e regras de acesso:

```text
Expo/EAS ── HTTPS ──> Firebase Authentication
       │              Cloud Firestore
       └────────────── Firebase Security Rules

Futuro: Cloud Run (API) + Cloud SQL PostgreSQL + Cloud Storage
```

### Fase de validação: Firebase sem servidor próprio

O app autentica o usuário no Firebase Authentication e acessa o Firestore usando o SDK. As Firebase Security Rules garantem que cada usuário só leia e altere seus próprios veículos e gastos. Nesta fase, o Firebase é o backend: não existe uma API Node.js para pagar e manter.

Para reduzir custo:

- usar login por e-mail/senha ou link; autenticação por SMS gera cobrança por mensagem;
- manter somente uma base Firestore;
- evitar listeners em tempo real onde uma consulta simples resolve;
- paginar listas e buscar apenas os campos necessários;
- não habilitar backups/PITR e jobs pagos antes de precisar;
- configurar alertas de orçamento e limites de uso.

O Firestore oferece cota gratuita diária de 50.000 leituras, 20.000 gravações, 20.000 exclusões, 1 GiB armazenado e 10 GiB/mês de saída. Ao exceder a cota, ou ao habilitar recursos pagos, a cobrança passa a ser por uso.

### Fase de crescimento: Cloud Run + Cloud SQL

Quando o produto precisar de regras privadas, integrações de pagamento, processamento OBD ou relatórios mais complexos, adicionaremos uma API Node.js no Cloud Run. Nesse momento o app passará a chamar a API, e a API acessará o banco.

Cloud SQL não é a melhor escolha para o primeiro protótipo de custo mínimo porque a instância gera custo enquanto está provisionada, mesmo com pouco tráfego. Quando for adotado, usaremos PostgreSQL gerenciado, backups e conexão segura pelo Cloud Run.

### Custos inevitáveis

- desenvolvimento local: pode ser zero, usando Firebase Emulator Suite;
- publicação nas lojas: taxas da Apple/Google e builds EAS podem existir, independentemente do GCP;
- Firebase/Firestore: pode ficar sem cobrança dentro das cotas gratuitas, mas é necessário monitorar consumo;
- Cloud Run: tem cobrança por uso e faixa gratuita, mas não é necessário na fase Firebase-only;
- Cloud SQL: deve ser adiado, pois é o componente com maior chance de custo mensal fixo;
- recursos pagos do GCP exigem faturamento configurado. Créditos promocionais, quando disponíveis, não são permanentes.

### Serviços auxiliares

- Firebase Authentication: identidade e sessão do usuário; a API aplica autorização por proprietário do veículo.
- Secret Manager: credenciais, chaves e configurações sensíveis.
- Artifact Registry: imagens Docker do backend.
- Cloud Logging e Cloud Monitoring: erros, latência, disponibilidade e alertas.
- Cloud Storage: somente quando documentos/notas entrarem no produto; objetos privados e URLs temporárias.
- Cloud Tasks ou Pub/Sub: somente quando houver processamento assíncrono real, como relatórios ou importações.

O esqueleto não precisa de Cloud Run, Cloud SQL, Kubernetes, Compute Engine, microserviços, Redis ou balanceador dedicado.

## 5. Visão dos componentes

```text
┌────────────────────────── Mobile React Native ─────────────────────────┐
│ Telas │ domínio de gastos │ SQLite/local │ Firebase SDK │ sync          │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ HTTPS
                               ▼
                  Firebase Auth + Firestore + Rules

Futuro:
Mobile → Cloud Run (API Node.js) → Cloud SQL PostgreSQL
                               └→ jobs / relatórios / OBD
```

No primeiro incremento, o celular gerencia a experiência de lançamento e o cache local; o Firestore é a fonte de verdade sincronizada. Quando o OBD e regras privadas entrarem, adicionaremos a API no Cloud Run.

## 6. Fluxo principal do controle de gastos

1. O usuário cria a conta e cadastra o veículo.
2. O app cria um lançamento local com valor, categoria, data, quilometragem e observação.
3. O lançamento aparece imediatamente na lista e nos totais.
4. O Firebase SDK sincroniza o lançamento com o Firestore.
5. As Security Rules validam autenticação e propriedade do documento.
6. Alterações e exclusões usam `updatedAt` e identificadores estáveis para evitar duplicidades.

Quando a API própria for criada, o SDK será substituído gradualmente por chamadas REST; o domínio e os contratos continuarão separados da interface do app.

Categorias iniciais: combustível, manutenção, seguro, impostos, lavagem, estacionamento, pedágio e outros.

## 7. Fluxo futuro de uma sessão OBD

1. O usuário escolhe o veículo e o app baixa o perfil OBD da variante.
2. O app verifica permissões, adaptador, ignição e compatibilidade.
3. O driver inicializa o adaptador (`ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATH0`, `ATSP0`) com timeout e retry.
4. O app consulta bitmaps de PIDs e monta uma coleta adaptativa.
5. O parser converte respostas OBD em amostras tipadas e registra falhas de qualidade.
6. O app calcula agregados por segmento (`warm_idle`, `controlled_rpm`, `normal_drive`) e salva uma sessão local.
7. A outbox sincroniza o resumo quando houver rede; o envio é idempotente por `sessionId`.
8. O backend valida o contrato, persiste evidências e executa regras/tendências.
9. O backend gera achados e recomendações com severidade, confiança, urgência e evidências.
10. O app exibe o relatório e a comparação com sessões anteriores.

## 8. Domínio e armazenamento

Entidades iniciais:

- `users`, `consents`, `vehicles`, `vehicle_variants`;
- `expenses`, `expense_categories`;
- `obd_adapters`, `adapter_compatibility`;
- `scan_sessions`, `scan_segments`, `dtc_events`, `freeze_frames`;
- `health_findings`, `rule_evaluations`, `trend_measurements`;
- `maintenance_events`, `recommendations`, `sync_operations`, `audit_events`.

Separação obrigatória em cada resultado:

- observado: valor lido ou evento recebido da ECU;
- derivado: média, mediana, tendência, qualidade ou classificação calculada;
- inferido: interpretação e próximo passo sugerido.

Todo resultado deve guardar `parserVersion`, `ruleSetVersion`, `knowledgeVersion` e referências às evidências usadas. Nunca sobrescrever a evidência original ao melhorar uma regra; reprocessar e criar uma nova versão do resultado.

### Contrato mínimo de resumo

```json
{
  "vehicleId": "veh_123",
  "startedAt": "2026-09-01T12:00:00Z",
  "odometerKm": 187320,
  "protocol": "ISO 15765-4 CAN",
  "quality": {"score": 0.92, "dropRate": 0.01},
  "dtcs": [],
  "segments": [
    {
      "type": "warm_idle",
      "durationSec": 30,
      "coolantAvgC": 89,
      "ltftAvgPct": 14.8,
      "stftMedianPct": 5.4,
      "voltageAvgV": 13.9
    }
  ],
  "clientVersions": {"app": "0.1.0", "parser": "0.1.0"}
}
```

## 9. API inicial

```text
POST /api/v1/auth/session
POST /api/v1/vehicles
GET  /api/v1/vehicles/{vehicleId}/expenses
POST /api/v1/vehicles/{vehicleId}/expenses
PATCH /api/v1/expenses/{expenseId}
DELETE /api/v1/expenses/{expenseId}
GET  /api/v1/vehicles/{vehicleId}/expense-summary
GET  /api/v1/vehicles/{vehicleId}/obd-profile
POST /api/v1/scan-sessions
POST /api/v1/scan-sessions/{sessionId}/summary
GET  /api/v1/vehicles/{vehicleId}/health
GET  /api/v1/vehicles/{vehicleId}/timeline
POST /api/v1/vehicles/{vehicleId}/maintenance-events
GET  /api/v1/recommendations/{recommendationId}
```

Regras de contrato:

- autenticação e autorização por proprietário do veículo;
- `Idempotency-Key` em criação e sincronização de sessão;
- respostas com `requestId` e erros codificados;
- nenhuma conclusão de saúde deve ser criada sem `quality` mínimo;
- payload de IA contém apenas dados estruturados validados, nunca bytes OBD crus;
- versionamento de API e de regras independente do app.

## 10. Regras de saúde (futuro)

Pipeline do MVP:

```text
dados recebidos
  → validação de schema e qualidade
  → normalização por variante/condição
  → agregação da sessão
  → comparação com baseline e sessões comparáveis
  → regra determinística
  → persistência de evidências/confiança
  → texto do relatório
```

O sistema deve distinguir:

- severidade: impacto caso a hipótese seja verdadeira;
- confiança: força e qualidade da evidência;
- urgência: quando agir (`agora`, `em_breve`, `acompanhar`, `registrar`).

Exemplos iniciais de regras (com limites revisados por profissional automotivo):

- temperatura do arrefecimento fora da faixa da variante e persistente;
- LTFT elevado em sessões equivalentes;
- tensão baixa com motor em funcionamento;
- DTC presente, sempre descrito como indício e não como peça defeituosa confirmada.

## 11. Segurança e privacidade mínimas

- TLS em todas as chamadas;
- dados locais protegidos pelo armazenamento seguro do sistema;
- criptografia e controle de acesso no banco;
- consentimentos separados para diagnóstico, telemetria, documentos, compartilhamento e melhoria;
- exportação e exclusão da conta/dados;
- auditoria para apagar DTC, alterar eventos e compartilhar histórico;
- logs sem VIN, placa ou payload bruto por padrão;
- documentação clara de que o resultado não substitui inspeção mecânica;
- revisão jurídica brasileira antes do piloto comercial.

## 12. Observabilidade e métricas

Instrumentar desde o primeiro spike:

- taxa de conexão por modelo de dongle, sistema operacional e veículo;
- taxa de sessão válida e motivo de falha;
- perda de amostras, latência e qualidade;
- tempo de sincronização e erros de idempotência;
- regras acionadas, confiança e contestação;
- ativação: veículo cadastrado → scan válido → relatório visualizado;
- retorno para segundo scan e conversão do check-up.

## 13. Sequência de implementação

### Fase 0 — esqueleto de gastos

Criar o app Expo, navegação, tema, domínio de veículo/gastos, persistência local, telas de dashboard, lista e formulário, além dos contratos TypeScript da API.

### Fase 1 — backend e sincronização de gastos

Criar a API Node.js, schema/migrations PostgreSQL, autenticação Firebase, CRUD de gastos, resumo mensal, Dockerfile e deploy no Cloud Run.

### Fase 2 — spike móvel OBD

Implementar driver BLE, máquina de estados ELM327, parser dos PIDs prioritários e SQLite. Testar 3–5 dongles e registrar compatibilidade Android/iOS.

### Fase 3 — sessão confiável

Adicionar sessão guiada em marcha lenta, qualidade, DTCs, resumo local e tela de resultado provisório.

### Fase 4 — backend e sincronização OBD

Adicionar autenticação, veículos, perfil OBD, criação idempotente de sessão, outbox e timeline.

### Fase 5 — inteligência longitudinal

Adicionar baseline, sessões comparáveis, regras versionadas, achados e relatório reproduzível.

### Fase 6 — piloto

Instrumentar métricas, suporte, consentimentos, revisão mecânica das regras e oferta paga de check-up.

## 14. Fora do primeiro incremento e gatilhos para evoluir

Não implementar agora OCR, QR/passaporte, portal multiusuário, todas as centrais, previsão financeira ampla, monitoramento 24/7 ou hardware próprio. Esses itens só entram após evidência de scans repetidos, qualidade técnica aceitável e disposição a pagar.

## 15. Decisões pendentes

- validar Expo development build contra os plugins BLE reais nos dongles escolhidos;
- definir o primeiro conjunto exato de variantes do Honda Fit;
- escolher hospedagem e serviço de object storage;
- definir o mecanismo de autenticação do piloto;
- obter revisão de um profissional automotivo para limites e protocolo;
- definir retenção do payload bruto e política de consentimento.
