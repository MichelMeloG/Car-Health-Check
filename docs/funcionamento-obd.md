# PRD — Inteligência de Frota e Baseline de Saúde Automotiva

**Produto:** Car Health  
**Status:** Futuro / pós-MVP OBD  
**Plataforma atual:** React Native + TypeScript  
**Objetivo do documento:** definir como o produto usará telemetria OBD de usuários com consentimento para criar referências de funcionamento por veículo, sem confundir esse mecanismo com RAG.

## 1. Resumo

O Car Health coleta dados OBD-II de sessões guiadas, cria uma linha de base individual para cada veículo e identifica mudanças persistentes ao longo do tempo.

Após existir volume e qualidade de dados suficientes, o sistema poderá calcular uma **referência de frota**: faixas de funcionamento observadas em veículos comparáveis. A referência de frota complementa — nunca substitui — o histórico do próprio carro.

Exemplo de resultado esperado:

> O LTFT atual é +14,8%. No seu histórico, a mediana era +5,2%. Em Honda Fit 1.4 2004–2008 comparáveis, em marcha lenta com motor aquecido, a faixa central observada é +1% a +8%. A leitura merece acompanhamento e possível investigação.

## 2. Problema

Uma leitura isolada de OBD é insuficiente para concluir que há defeito. Sensores variam por:

- motor, câmbio e ano do veículo;
- combustível;
- temperatura ambiente e altitude;
- condição de uso;
- qualidade do adaptador;
- protocolo e PIDs disponíveis;
- estado individual do veículo.

O usuário precisa de respostas melhores que “o valor atual é X”. Ele quer saber:

1. Meu carro mudou em relação a ele mesmo?
2. Essa leitura está distante do normal para carros semelhantes?
3. A evidência é confiável o suficiente para agir?

## 3. Objetivos

### Objetivos de produto

- Criar linha de base individual por veículo.
- Criar referência estatística por grupo de veículos equivalentes.
- Detectar mudanças persistentes, não leituras isoladas.
- Exibir evidência, confiança, limitações e próximo passo.
- Melhorar recomendações sem afirmar diagnóstico definitivo.

### Objetivos técnicos

- Receber sessões OBD agregadas e validadas.
- Normalizar dados por condição de coleta.
- Calcular estatísticas robustas por coorte.
- Versionar regras, modelos, fontes e resultados.
- Permitir exclusão, opt-out e reprocessamento de dados.

### Não objetivos

- Não diagnosticar ou indicar troca de peça com certeza.
- Não usar média simples de todos os carros.
- Não comparar modelos, motores ou condições incompatíveis.
- Não enviar dados brutos ao modelo de IA para “adivinhar” um defeito.
- Não ativar inteligência de frota antes de alcançar amostra e qualidade mínimas.

## 4. Conceitos fundamentais

| Conceito | Definição |
|---|---|
| Sessão OBD | Coleta com início, fim, condição, PIDs disponíveis, qualidade e agregados. |
| Linha de base individual | Comportamento histórico do mesmo veículo em sessões comparáveis. |
| Coorte | Grupo de veículos comparáveis usado para criar referência de frota. |
| Referência de frota | Distribuição estatística de uma métrica em uma coorte válida. |
| Achado | Evento gerado por regra/análise com evidência, confiança e ação sugerida. |
| RAG | Busca de conteúdo textual técnico para explicar um achado; não calcula normalidade de sensores. |

## 5. Fluxo de dados

```text
ELM327 BLE
  → app React Native
  → parser e validação local
  → agregados da sessão
  → API / banco de eventos
  → normalização e segmentação
  → baseline individual + referência de frota
  → regras de tendência / anomalia
  → achado estruturado
  → RAG opcional para conteúdo técnico
  → explicação ao usuário
```

### Princípio de processamento

**Regras e estatística decidem; RAG e IA explicam.**

O motor de análise deve produzir um objeto estruturado antes de qualquer geração de texto. A IA não recebe telemetria bruta sem contexto e não pode criar uma conclusão além da permitida pelo motor.

## 6. Dados de entrada

### PIDs prioritários

| PID | Métrica | Uso |
|---|---|---|
| `0104` | Carga calculada | Contexto de esforço do motor |
| `0105` | Temperatura do arrefecimento | Aquecimento e operação térmica |
| `0106` | STFT banco 1 | Correção instantânea de combustível |
| `0107` | LTFT banco 1 | Correção persistente de combustível |
| `010B` | MAP | Carga, vácuo e coerência da admissão |
| `010C` | RPM | Estado da sessão e estabilidade |
| `010D` | Velocidade | Segmentação da condição de uso |
| `010F` | Temperatura do ar | Contexto de admissão |
| `0110` | MAF | Massa de ar, quando suportado |
| `0111` | Borboleta | Demanda do motorista |
| `0142` | Tensão do módulo | Sistema de carga e qualidade da leitura |

O conjunto é adaptativo. Antes da sessão, o app consulta os bitmaps de PIDs suportados (`0100`, `0120`, `0140`). A ausência de MAF, por exemplo, não é defeito; o motor pode trabalhar com MAP e outros sinais.

### Eventos complementares

- DTCs atuais, pendentes e permanentes quando suportados.
- Freeze frame.
- Readiness monitors.
- Quilometragem e origem da quilometragem.
- Manutenções informadas/documentadas.
- Metadados do adaptador: modelo, firmware, transporte e qualidade.

## 7. Sessão OBD

### Condições mínimas

Cada sessão deve registrar uma ou mais fases:

1. `warm_idle`: motor aquecido, veículo parado, marcha lenta estável.
2. `controlled_rpm`: rotação controlada quando seguro e aplicável.
3. `normal_drive`: percurso normal, sem interação manual durante a condução.

O app não deve instruir o usuário a operar o telefone enquanto dirige.

### Objeto de sessão

```json
{
  "id": "scan_01J...",
  "vehicleId": "veh_01J...",
  "startedAt": "2026-09-02T12:00:00Z",
  "odometerKm": 187320,
  "protocol": "ISO 15765-4 CAN",
  "adapter": { "model": "homologado", "transport": "ble" },
  "quality": { "score": 0.92, "dropRate": 0.01 },
  "supportedPids": ["0104", "0105", "0106", "0107", "010B", "010C"],
  "segments": [
    {
      "type": "warm_idle",
      "durationSec": 30,
      "coolantAvgC": 89,
      "rpmMedian": 780,
      "stftMedianPct": 5.4,
      "ltftAvgPct": 14.8,
      "mapMedianKpa": 31,
      "voltageAvgV": 13.9
    }
  ],
  "dtcs": [],
  "freezeFrames": []
}
```

### Armazenamento

O app pode coletar leituras em alta frequência localmente, mas deve enviar como padrão apenas agregados da sessão: mínimo, máximo, média, mediana, percentis, dispersão, duração e qualidade.

Respostas brutas ficam retidas apenas pelo tempo necessário para depuração, sob consentimento explícito e política de retenção definida.

## 8. Normalização

Antes de comparar qualquer métrica, o backend deve derivar um `comparisonContext`.

```json
{
  "vehicleVariant": "honda_fit_2004_2008_l13a_manual",
  "fuelType": "gasoline",
  "segment": "warm_idle",
  "engineState": "warmed",
  "rpmBand": "650_950",
  "qualityTier": "good",
  "softwareVersion": "obd-parser@1.0.0"
}
```

### Regras de comparabilidade

Uma sessão só é comparável quando:

- pertence à mesma variante ou variante explicitamente compatível;
- usa a mesma fase de sessão;
- tem qualidade mínima aprovada;
- possui métricas com unidade e fórmula conhecidas;
- não contém condição que invalide o sinal (ex.: motor frio em comparação de lenta aquecida);
- não está marcada como adaptador instável;
- respeita faixas mínimas de duração e estabilidade.

## 9. Linha de base individual

### Criação

- A linha de base começa após uma sessão válida.
- Achados longitudinais exigem no mínimo **três sessões comparáveis**.
- A baseline deve usar estatísticas robustas: mediana, intervalo interquartil e MAD (median absolute deviation).
- Sessões mais recentes podem ter peso maior, mas o sistema não pode apagar evidência histórica.

### Exemplo

| Data | Condição | LTFT médio | Leitura |
|---|---|---:|---|
| 10/01 | lenta aquecida | +3% | Base inicial |
| 10/02 | lenta aquecida | +4% | Sem mudança relevante |
| 15/03 | lenta aquecida | +5% | Variação pequena |
| 10/04 | lenta aquecida | +8% | Tendência em observação |
| 15/05 | lenta aquecida | +11% | Mudança persistente |
| 10/06 | lenta aquecida | +14% | Criar achado |

## 10. Referência de frota

### Definição de coorte

Uma coorte deve ser o mais específica possível, sem perder tamanho mínimo de amostra:

```text
marca + modelo + geração + ano/faixa de ano
+ motor + transmissão + combustível
+ condição de coleta + faixa de RPM
+ PID / fórmula / unidade
```

Exemplo inicial:

```text
Honda Fit | 2004–2008 | L13A | manual
gasolina | warm_idle | 650–950 RPM | LTFT banco 1
```

### Estatísticas calculadas

Para cada `cohort + metric + context`, guardar:

- quantidade de veículos únicos;
- quantidade de sessões válidas;
- mediana;
- P10, P25, P75, P90;
- IQR e MAD;
- tendência temporal agregada;
- versão do pipeline;
- período de observação;
- indicadores de cobertura e confiança.

### Regras de publicação

- Não exibir referência de frota com amostra pequena.
- Valor inicial recomendado: pelo menos `30 veículos únicos` e `100 sessões válidas` por coorte; ajustar após o piloto.
- Se a coorte específica não atingir o mínimo, subir para uma coorte explicitamente mais ampla e reduzir a confiança.
- Não agregar variantes incompatíveis somente para aumentar volume.

### Hierarquia de referência

```text
1. histórico do próprio veículo
2. mesma variante + mesma condição
3. mesma família de motor + condição compatível
4. referência genérica do protocolo
```

Quanto mais abaixo na hierarquia, menor a confiança e mais conservadora a comunicação.

## 11. Detecção de anomalia

### Sinais analisados

1. **Desvio individual:** valor atual distante da linha de base do próprio carro.
2. **Tendência:** mudança consistente em múltiplas sessões comparáveis.
3. **Desvio de frota:** valor fora dos percentis esperados na coorte.
4. **Coerência multissensor:** combinação de trims, MAP, MAF, RPM, temperatura e DTCs.
5. **Contexto de manutenção:** serviço pendente, sem comprovação ou realizado recentemente.

### Pseudocódigo

```text
IF session.quality >= threshold
  AND comparableSessions >= 3
  AND metricTrend is persistent
THEN create finding(type = "individual_change")

IF cohort.coverage >= minimum
  AND metricValue outside cohort.p10_to_p90
THEN add evidence(type = "cohort_deviation")

IF DTC exists
THEN increase urgency according to DTC policy

IF evidence is insufficient
THEN do not issue a strong conclusion
```

### Achado estruturado

```json
{
  "id": "finding_01J...",
  "vehicleId": "veh_01J...",
  "ruleId": "fuel_trim_persistent_increase",
  "ruleVersion": "1.0.0",
  "severity": "medium",
  "urgency": "soon",
  "confidence": 0.78,
  "evidence": [
    { "type": "individual_trend", "from": 5.2, "to": 14.8, "windowDays": 90 },
    { "type": "cohort_percentile", "percentile": 94, "cohortId": "cohort_..." }
  ],
  "allowedConclusions": [
    "persistent_fuel_correction_change",
    "investigate_admission_fuel_or_sensor"
  ],
  "disallowedConclusions": [
    "replace_specific_part"
  ]
}
```

## 12. RAG e IA

### Papel do RAG

RAG é usado para recuperar conteúdo textual confiável e versionado, por exemplo:

- manual de serviço;
- intervalos de manutenção;
- explicações de DTC;
- procedimentos de teste;
- limitações por veículo;
- artigos técnicos revisados pela equipe.

### Papel da IA

A IA recebe o achado estruturado, o contexto do veículo e os trechos recuperados pelo RAG. Ela deve:

- explicar em português simples;
- dizer o que mudou;
- apresentar evidências e nível de confiança;
- listar hipóteses como hipóteses;
- orientar uma ação segura;
- declarar incerteza e limitações.

A IA não deve decidir regra, calcular média de frota nem declarar que uma peça está defeituosa.

## 13. Privacidade e governança

### Consentimento

O usuário deve escolher separadamente:

- uso do OBD para gerar seu próprio relatório;
- uso de dados agregados/pseudonimizados para melhorar referências de frota;
- retenção temporária de resposta bruta para depuração;
- compartilhamento com oficina ou terceiro.

### Minimização

Não incluir em datasets analíticos de frota:

- placa;
- VIN completo;
- nome, e-mail ou telefone;
- localização precisa;
- fotos, notas fiscais ou texto livre;
- identificador direto da conta.

Usar um identificador pseudônimo rotacionável para deduplicar veículos quando necessário. A exclusão/opt-out deve remover o veículo de agregações futuras e acionar reprocessamento conforme a política de retenção.

### Segurança

- Criptografia em trânsito e repouso.
- Acesso por menor privilégio.
- Auditoria de leitura, alteração e exportação.
- Separação entre dados operacionais e analíticos.
- Revisão jurídica/LGPD antes do lançamento comercial.

## 14. Modelo de dados inicial

| Tabela/coleção | Responsabilidade |
|---|---|
| `vehicles` | Identidade e variante do veículo |
| `vehicle_variants` | Modelo, ano, motor, câmbio, combustível e cobertura |
| `scan_sessions` | Sessão, protocolo, qualidade e resumo |
| `obd_segments` | Agregados por fase da sessão |
| `dtc_events` | Código, status, ECU e ocorrências |
| `freeze_frames` | Contexto da falha |
| `maintenance_events` | Serviços e evidências |
| `cohorts` | Definição versionada de grupos comparáveis |
| `cohort_metric_snapshots` | Estatísticas de frota por métrica/contexto |
| `vehicle_baselines` | Estatísticas históricas do próprio veículo |
| `rule_results` | Evidências e resultado de regras |
| `findings` | Achados apresentados ao usuário |
| `consents` | Finalidade, versão, aceite e revogação |
| `audit_events` | Ações sensíveis e rastreabilidade |

## 15. APIs futuras

| Método | Rota | Finalidade |
|---|---|---|
| `POST` | `/scan-sessions` | Criar sessão e reservar identificador |
| `POST` | `/scan-sessions/{id}/summary` | Enviar agregados e evidências da sessão |
| `GET` | `/vehicles/{id}/health` | Estado, achados e pendências |
| `GET` | `/vehicles/{id}/baseline` | Histórico individual e comparações |
| `GET` | `/vehicles/{id}/cohort-context` | Referência de frota permitida para a variante |
| `GET` | `/findings/{id}` | Evidências, confiança, explicação e fontes |
| `POST` | `/consents` | Registrar ou revogar consentimento |

## 16. Requisitos para o app React Native

Módulos esperados:

```text
src/obd/
  bleTransport.ts
  elm327Session.ts
  obdCommands.ts
  obdParser.ts
  supportedPids.ts
  dtcParser.ts
  scanOrchestrator.ts
  sessionAggregator.ts
  sessionSync.ts
```

Requisitos:

- Usar BLE com `react-native-ble-plx`.
- Manter driver ELM327 como máquina de estados.
- Tolerar timeout, `NO DATA`, eco residual, múltiplas ECUs e adaptadores ruins.
- Salvar localmente antes de sincronizar.
- Não bloquear a interface durante a coleta.
- Não permitir interação manual durante o trecho de condução.
- Exibir quando um PID não é suportado sem tratá-lo como defeito.

## 17. Métricas de sucesso

### Qualidade técnica

- Taxa de sessões concluídas.
- Taxa de descoberta de PIDs.
- Taxa de desconexão e timeout por adaptador.
- Percentual de sessões com qualidade suficiente.

### Produto

- Percentual de usuários que conclui o primeiro scan.
- Percentual que retorna para um segundo e terceiro scan.
- Percentual de achados marcados como úteis.
- Taxa de contestação/falso positivo.

### Inteligência de frota

- Número de veículos únicos por coorte.
- Cobertura de coortes por variante/PID.
- Percentual de comparações baseadas em coorte válida.
- Redução de achados genéricos à medida que a base cresce.

## 18. Fases de implementação

### Fase 1 — MVP individual

- Conectar ELM327 BLE.
- Detectar PIDs suportados.
- Coletar PIDs essenciais, DTC e freeze frame básico.
- Salvar sessão e criar baseline individual.
- Mostrar tendência após três sessões comparáveis.

### Fase 2 — Análise robusta

- Score de qualidade de sessão.
- Regras versionadas.
- Achados estruturados, severidade, urgência e confiança.
- Histórico de manutenção como contexto.

### Fase 3 — Frota consentida

- Implementar consentimentos e pipeline analítico segregado.
- Criar coortes para os primeiros veículos suportados.
- Calcular percentis/medianas e cobertura.
- Exibir comparação com frota somente acima do mínimo de amostra.

### Fase 4 — RAG técnico e explicação

- Base de conhecimento curada e versionada.
- Recuperação por variante, métrica e tipo de achado.
- IA com saída estruturada, fontes e linguagem de indício.

## 19. Critérios de aceite

- Uma sessão válida salva agregados, qualidade, contexto e PIDs suportados.
- O sistema não gera achado longitudinal antes de três sessões comparáveis.
- O sistema não mostra referência de frota abaixo da cobertura mínima.
- O usuário vê quais evidências originaram cada achado.
- A explicação nunca afirma troca de componente sem evidência suficiente.
- Revogar consentimento interrompe o uso futuro para inteligência de frota.
- O usuário pode excluir seus dados conforme a política aplicável.
- O app funciona offline para registrar a sessão e sincroniza depois.

## 20. Decisões em aberto

- Lista inicial de variantes suportadas além do Honda Fit 2004.
- Número mínimo definitivo de veículos e sessões por coorte.
- Política de retenção de respostas OBD brutas.
- Estratégia para combustível misto, GNV e modificações.
- Modelo estatístico inicial: percentis robustos, MAD e/ou modelo hierárquico.
- Processo de revisão mecânica e fontes do RAG.
- UX para explicar baixa confiança sem alarmar o usuário.

## 21. Decisão recomendada

Implementar primeiro a comparação do veículo contra ele mesmo. A inteligência de frota deve ser lançada gradualmente, por variante e com cobertura explícita. Ela é um diferencial importante, mas depende de dados confiáveis, consentimento e tempo de uso.

> A promessa continua sendo: **“Algo mudou no seu carro.”** A frota ajuda a explicar se essa mudança também é incomum para veículos comparáveis.
