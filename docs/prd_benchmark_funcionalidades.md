# PRD — Benchmark Funcional Completo do Car Health

**Produto:** Car Health  
**Status:** Visão de produto completa / implementação por fases  
**Plataforma:** React Native + TypeScript  
**Público inicial:** proprietários brasileiros de carros usados fora da garantia  
**Promessa central:** “Algo mudou no seu carro.”

## 1. Objetivo

Este documento define o conjunto de funcionalidades que o Car Health deverá cobrir para competir com apps de gestão veicular, abastecimento, diagnóstico OBD e manutenção inteligente — sem perder o posicionamento de **sistema de saúde automotiva**.

O objetivo não é copiar telas nem lançar todas as funções ao mesmo tempo. É construir uma arquitetura capaz de alcançar paridade funcional ao longo do tempo e, principalmente, integrar essas funções em uma experiência mais útil:

```text
histórico + custos + manutenção + OBD + tendências + evidências + orientação simples
```

## 2. Benchmark de referência

| Categoria | Referências | O que o mercado já entrega | Resposta do Car Health |
|---|---|---|---|
| Gestão do veículo | Drivvo, Fuelio, Simply Auto | Abastecimento, despesas, serviços, lembretes, rotas, relatórios | Cobrir o núcleo completo e conectar cada evento à saúde do veículo |
| Diagnóstico genérico | Car Scanner | Live data, dashboards, DTC, freeze frame, readiness, gravação | Cobrir leitura e histórico; trocar painel técnico por sessões e achados explicáveis |
| Diagnóstico com hardware | FIXD, Carly, OBDeleven | Código explicado, severidade, manutenção, check-up, alguns recursos por fabricante | Começar no OBD-II genérico e evoluir por variante, sem prometer todas as centrais cedo |
| Uso profissional/frota | Drivvo Fleet, Simply Auto | Múltiplos veículos, motoristas, custo operacional, exportação e colaboração | Criar B2B2C via oficina/loja e, depois, frota leve |

As funcionalidades benchmarkadas incluem abastecimento, despesas, manutenção, rotas, lembretes, relatórios e exportação ([Drivvo](https://www.drivvo.com/en-US/personal-use/)); GPS, múltiplos combustíveis, backups e relatórios ([Fuelio](https://www.fuel.io/)); recibos, sincronização e compartilhamento entre motoristas ([Simply Auto](https://simplyauto.app/)); telemetria, DTC, freeze frame, readiness e PIDs customizados ([Car Scanner](https://play.google.com/store/apps/details?id=com.ovz.carscanner)); e diagnóstico em linguagem simples e alertas de manutenção ([FIXD](https://www.fixd.com/)).

## 3. Princípios de produto

1. **Um registro deve gerar valor automaticamente.** Uma manutenção não é só um gasto; ela atualiza o plano, o histórico e a confiança do veículo.
2. **OBD é fonte de dados, não o produto inteiro.** O diferencial está na comparação longitudinal, contexto e orientação.
3. **Tudo deve ter evidência e incerteza.** O app apresenta indícios, não confirma peça defeituosa sem diagnóstico profissional.
4. **O usuário leigo vem primeiro.** Dados técnicos ficam disponíveis, mas a home mostra prioridade e ação.
5. **Paridade funcional não significa igual prioridade.** Gestão básica entra cedo; codificação de central e recursos OEM entram apenas após cobertura técnica comprovada.
6. **Cada veículo precisa de contexto próprio.** Modelo, ano, motor, câmbio, combustível, quilometragem e condições de uso alteram as recomendações.

## 4. Arquitetura de módulos

```text
Conta e garagem
├── Identidade do veículo
├── Abastecimento e energia
├── Despesas e financeiro
├── Manutenção e documentos
├── Rotas, quilometragem e uso
├── Lembretes e tarefas
├── Diagnóstico OBD
├── Saúde, tendências e IA
├── Relatórios, exportação e passaporte
├── Oficina, loja e colaboração
└── Frota e operação empresarial
```

## 5. Módulo: Conta, garagem e identidade

### Objetivo

Permitir que uma conta cuide de um ou mais veículos e que cada veículo tenha identidade técnica suficiente para receber recomendações corretas.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| GAR-01 | Cadastro de conta | E-mail, Apple, Google e autenticação segura. | MVP |
| GAR-02 | Garagem | Um veículo gratuito; múltiplos conforme plano. | MVP |
| GAR-03 | Perfil do veículo | Marca, modelo, ano/modelo, placa opcional, VIN opcional, apelido, foto, cor e quilometragem. | MVP |
| GAR-04 | Variante técnica | Motor, câmbio, combustível, tração e versão. | MVP |
| GAR-05 | Tipos de veículo | Carro, moto, picape, van, caminhão, híbrido, elétrico e futura extensibilidade. | Pós-MVP |
| GAR-06 | Status de propriedade | Proprietário, condutor, oficina, loja, comprador convidado ou veículo vendido. | Fase 2 |
| GAR-07 | Linha do tempo unificada | Reunir abastecimento, manutenção, scans, DTCs, documentos, rotas e alertas. | MVP |
| GAR-08 | Importação | Importar CSV/Excel e, futuramente, dados de outros apps. | Fase 3 |
| GAR-09 | Transferência de veículo | Transferir histórico compartilhável ao novo proprietário com permissões. | Fase 4 |

### Critérios de aceite

- O usuário consegue cadastrar um Honda Fit 1.4 2004 com motor, câmbio e combustível.
- A quilometragem possui fonte: digitada, nota, oficina, rota ou OBD quando possível.
- O app mostra claramente o que é declarado pelo usuário e o que é documentado/verificado.

## 6. Módulo: Abastecimento e energia

### Objetivo

Cobrir o núcleo de Fuelio/Drivvo/Simple Auto e transformar consumo em indicador de saúde e custo.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| FUE-01 | Lançar abastecimento | Data, odômetro, litros, valor total, valor/litro, posto, combustível e tanque cheio/parcial. | Fase 2 |
| FUE-02 | Cálculo de consumo | Consumo por tanque cheio, média móvel, custo/km e custo mensal. | Fase 2 |
| FUE-03 | Combustíveis múltiplos | Gasolina, etanol, diesel, GNV, híbrido e bi-fuel; tanques separados quando aplicável. | Fase 3 |
| FUE-04 | Localização/posto | Local do abastecimento, favoritos e histórico de preços. | Fase 3 |
| FUE-05 | Preço de combustível | Comparação de preços por região, mediante fonte confiável e consentimento. | Fase 4 |
| FUE-06 | Recarga elétrica | kWh, tarifa, duração, carregador, custo/kWh, autonomia e percentual de bateria quando disponível. | Fase 4 |
| FUE-07 | Lançamento rápido | Widget, atalho, voz, QR/código de comprovante ou integração futura. | Fase 3 |
| FUE-08 | Anomalia de consumo | Detectar piora persistente e cruzar com OBD/manutenção. | Fase 3 |

### Regras

- Consumo por tanque só é calculado como oficial com eventos compatíveis de tanque cheio.
- Abastecimentos parciais entram no histórico, mas não devem gerar um consumo falso.
- A queda de consumo é um indício; o app verifica quilometragem, combustível, rota e OBD antes de alertar.

## 7. Módulo: Despesas, receitas e planejamento financeiro

### Objetivo

Dar ao motorista visão completa do custo de propriedade e preparar a reserva para manutenção, sem reduzir o produto a uma planilha.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| FIN-01 | Despesa manual | Valor, data, categoria, fornecedor, odômetro, observação e anexo. | Fase 2 |
| FIN-02 | Categorias padrão | Seguro, IPVA, licenciamento, multa, estacionamento, pedágio, lavagem, pneu, peça, mão de obra e outros. | Fase 2 |
| FIN-03 | Categorias personalizadas | Usuário define categorias e subcategorias. | Fase 3 |
| FIN-04 | Despesa recorrente | Seguro, assinatura, financiamento e impostos periódicos. | Fase 3 |
| FIN-05 | Receita | Ganhos de motorista de aplicativo, aluguel, reembolso ou frota. | Fase 4 |
| FIN-06 | Custo total de propriedade | Combustível/energia + manutenção + despesas + depreciação opcional. | Fase 3 |
| FIN-07 | Custo por km | Por período, veículo, categoria e rota. | Fase 3 |
| FIN-08 | Reserva de manutenção | Faixa de gastos previstos por prazo, com hipóteses explícitas. | Fase 3 |
| FIN-09 | Orçamento vs. realizado | Planejamento mensal/anual e alertas de desvio. | Fase 4 |
| FIN-10 | Estimativa de reparo | Faixas por serviço/região, nunca valor garantido. | Fase 4 |

### Critérios de aceite

- Uma manutenção registrada aparece tanto na aba financeira quanto na linha do tempo técnica.
- A previsão financeira mostra faixa, horizonte, evidências e itens excluídos.
- Nenhuma estimativa é apresentada como orçamento de oficina.

## 8. Módulo: Manutenção, serviços e documentos

### Objetivo

Criar o histórico mecânico confiável que torna OBD, lembretes, venda e previsão mais úteis.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| MNT-01 | Registrar serviço | Tipo, data, odômetro, oficina, mão de obra, peças, fluido e valor. | MVP básico |
| MNT-02 | Itens de serviço | Óleo, filtros, velas, bobinas, pneus, freios, suspensão, correias, fluidos e itens customizados. | Fase 2 |
| MNT-03 | Intervalos | Por tempo, km, condição, motor/variante e recomendação manual. | Fase 2 |
| MNT-04 | Preventiva/corretiva | Diferenciar revisão, reparo, inspeção e melhoria. | Fase 2 |
| MNT-05 | Peças e marcas | Fabricante, código, quantidade, garantia e procedência. | Fase 3 |
| MNT-06 | Anexos | Foto de NF, ordem de serviço, PDF, foto de peça e laudo. | Fase 2 |
| MNT-07 | OCR de nota | Extrair oficina, data, odômetro, peças e valores; exigir confirmação humana. | Fase 4 |
| MNT-08 | Checklist de revisão | Checklists por veículo, oficina e tipo de inspeção. | Fase 3 |
| MNT-09 | Antes/depois | Vincular DTC, scan, serviço e scan posterior. | Fase 3 |
| MNT-10 | Garantia de serviço | Prazo/quilometragem de garantia e alerta de vencimento. | Fase 4 |
| MNT-11 | Solicitar orçamento | Criar lista de itens e compartilhar com oficinas parceiras. | Fase 5 |

### Níveis de evidência

| Nível | Origem |
|---|---|
| Declarado | Registro do proprietário sem anexo |
| Documentado | Nota, foto ou ordem de serviço anexada |
| Verificado | Oficina identificada confirma o serviço |
| Corroborado | Evento tem evidência objetiva posterior, como scan coerente |

## 9. Módulo: Lembretes, tarefas e checklists

### Objetivo

Evitar manutenção esquecida e substituir a necessidade de planilha/WhatsApp consigo mesmo.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| REM-01 | Lembrete por data | Seguro, IPVA, licenciamento, revisão e vencimentos. | Fase 2 |
| REM-02 | Lembrete por quilometragem | Óleo, filtros, pneus, freios e serviços customizados. | Fase 2 |
| REM-03 | Lembrete por condição | Disparado por DTC, tendência, consumo ou leitura OBD. | Fase 3 |
| REM-04 | Tarefas recorrentes | Repetição semanal, mensal, anual ou por km. | Fase 3 |
| REM-05 | Checklist pré-viagem | Pneus, óleo, fluido, luzes, documentos e itens customizados. | Fase 3 |
| REM-06 | Notificações inteligentes | Agrupar alertas, evitar spam e priorizar urgência. | Fase 3 |
| REM-07 | Agenda de oficina | Agendar serviço com parceiro ou salvar compromisso. | Fase 5 |

## 10. Módulo: Rotas, quilometragem e uso

### Objetivo

Cobrir o trip log dos concorrentes, atender motoristas profissionais e fornecer contexto de uso para consumo e saúde.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| TRP-01 | Viagem manual | Origem, destino, km, motivo, categoria pessoal/trabalho e observação. | Fase 3 |
| TRP-02 | Rastreamento GPS | Iniciar/finalizar viagem manualmente, com mapa e distância. | Fase 4 |
| TRP-03 | Detecção automática | Identificar viagens em background com controles de privacidade e bateria. | Fase 5 |
| TRP-04 | Custo da rota | Combustível/energia, pedágio, estacionamento e custo/km. | Fase 4 |
| TRP-05 | Reembolso/dedução | Classificar viagem de trabalho e gerar relatório. | Fase 5 |
| TRP-06 | Correlação com OBD | Associar sessão de percurso a consumo, temperatura e sinais relevantes. | Fase 4 |
| TRP-07 | Privacidade de localização | Desligar rastreio, excluir rotas e reduzir precisão quando necessário. | Fase 3 |

## 11. Módulo: Diagnóstico OBD-II genérico

### Objetivo

Entregar paridade com scanner genérico nos recursos OBD relevantes ao motorista, mas com uma UX guiada e segura.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| OBD-01 | Descoberta BLE | Listar, conectar e testar ELM327 BLE homologados. | MVP |
| OBD-02 | Máquina de estados ELM327 | Inicialização AT, timeout, reconexão, `NO DATA`, eco, headers e múltiplas ECUs. | MVP |
| OBD-03 | Detecção de PIDs | Consultar `0100`, `0120`, `0140` e adaptar a coleta. | MVP |
| OBD-04 | Live data | RPM, temperatura, tensão, trims, MAP/MAF, velocidade e demais PIDs suportados. | MVP |
| OBD-05 | Sessão guiada | Lenta aquecida, rotação controlada e percurso opcional. | MVP |
| OBD-06 | DTCs | Ler códigos atuais, pendentes e permanentes quando suportados. | MVP |
| OBD-07 | DTC em linguagem simples | Descrição, severidade, hipóteses, riscos e próximos passos. | Fase 2 |
| OBD-08 | Freeze frame | Salvar o contexto de sensores no momento de falha. | Fase 2 |
| OBD-09 | Readiness | Mostrar prontidão de emissões e seus limites. | Fase 3 |
| OBD-10 | Mode 06 | Exibir testes de autodiagnóstico quando suportados; inicialmente técnico/avançado. | Fase 4 |
| OBD-11 | Dashboard customizável | Medidores, gráficos e tela de dados ao vivo para entusiastas. | Fase 4 |
| OBD-12 | Gravação de telemetria | Gravar sessões, segmentos e exportar dados estruturados. | Fase 3 |
| OBD-13 | PIDs customizados | Definir PIDs estendidos por fabricante, com fonte, versão e risco. | Fase 5 |
| OBD-14 | Limpar DTC | Ação explícita, aviso, auditoria e cópia de evidências antes de apagar. | Fase 2 |
| OBD-15 | VIN/identificação | Ler VIN e informações genéricas quando suportadas; permitir confirmação manual. | Fase 3 |
| OBD-16 | Simulador | Dados simulados para desenvolvimento, demonstração e testes sem veículo. | Fase 2 |

### Limites do OBD genérico

O MVP não promete diagnóstico completo de ABS, airbag, transmissão, BCM ou todas as centrais. OBD-II genérico é majoritariamente powertrain/emissões; centrais OEM exigem protocolos, cobertura e validação por fabricante.

## 12. Módulo: Diagnóstico OEM, inspeção e codificação

### Objetivo

Criar caminho para cobrir capacidades avançadas de Carly/OBDeleven sem colocar o produto em risco técnico ou comercial.

### Requisitos funcionais futuros

| ID | Funcionalidade | Estratégia |
|---|---|---|
| ADV-01 | Scan de múltiplas centrais | Só para variantes com protocolo e testes aprovados. |
| ADV-02 | Dados ao vivo por central | Perfil de veículo versionado e documentação por sinal. |
| ADV-03 | Saúde da bateria | 12V primeiro; híbrida/alta tensão somente com fontes e testes específicos. |
| ADV-04 | Inspeção de usado | DTCs, readiness, quilometragem disponível, pendências e evidências. |
| ADV-05 | Relatório de inspeção | PDF/QR com escopo, limitações e estado no momento do scan. |
| ADV-06 | Codificação/adaptações | Somente em programa separado, com compatibilidade explícita e múltiplas confirmações. |
| ADV-07 | Funções de serviço | Reset de manutenção e testes controlados quando tecnicamente seguros. |
| ADV-08 | Histórico de alterações | Registrar comando, usuário, veículo, resultado e reversibilidade. |

### Regra de segurança

Codificação, programação e comandos ativos não entram no fluxo comum do consumidor. Primeiro, o Car Health precisa consolidar leitura, histórico e orientação; depois, poderá oferecer recursos avançados em veículos certificados.

## 13. Módulo: Saúde, tendências, inteligência de frota e IA

### Objetivo

Transformar dados de gestão e OBD em decisões úteis. Este é o principal diferencial do Car Health.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| HLT-01 | Home de saúde | Estado atual, achados, pendências, próximos gastos e último scan. | Fase 2 |
| HLT-02 | Linha de base individual | Comparar o veículo com ele mesmo em sessões equivalentes. | Fase 2 |
| HLT-03 | Tendência | Detectar alteração persistente após pelo menos três sessões comparáveis. | Fase 2 |
| HLT-04 | Severidade/confiança/urgência | Dimensões separadas em todo achado. | Fase 2 |
| HLT-05 | Motor de regras | Regras versionadas, fontes, escopo e pré-condições. | Fase 2 |
| HLT-06 | Previsão de manutenção | Cruzar intervalo, histórico, condição e quilometragem. | Fase 3 |
| HLT-07 | Previsão financeira | Gerar faixa de reserva, não preço garantido. | Fase 3 |
| HLT-08 | Inteligência de frota | Percentis por coorte consentida de veículos comparáveis. | Fase 4 |
| HLT-09 | RAG técnico | Recuperar manuais, DTCs, procedimentos e fontes para explicar achados. | Fase 4 |
| HLT-10 | Assistente de IA | Responder sobre o próprio veículo usando dados estruturados e fontes. | Fase 4 |
| HLT-11 | Feedback do usuário/oficina | Confirmar se o achado foi útil, resolvido ou incorreto. | Fase 3 |
| HLT-12 | Reprocessamento | Rodar regras novas em histórico preservando evidência e versão anterior. | Fase 4 |

### Formato mínimo de achado

```json
{
  "title": "Correção de combustível aumentou",
  "severity": "medium",
  "urgency": "soon",
  "confidence": 0.78,
  "evidence": ["LTFT +5,2% → +14,8% em 90 dias", "motor aquecido", "sem DTC armazenado"],
  "nextStep": "Verificar admissão de ar, alimentação e sensores com oficina",
  "limitations": ["não identifica uma peça defeituosa isoladamente"]
}
```

## 14. Módulo: Relatórios, exportação e passaporte

### Objetivo

Oferecer transparência ao proprietário, oficina, loja e comprador sem depender de planilhas.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| REP-01 | Relatório de saúde | Resumo de scan, achados, confiança e próximos passos. | MVP |
| REP-02 | Histórico por período | Manutenção, gastos, abastecimento, rotas e scans. | Fase 2 |
| REP-03 | Gráficos | Consumo, custo/km, gastos por categoria, métricas OBD e tendência. | Fase 3 |
| REP-04 | Exportação CSV/Excel | Dados selecionados por veículo e período. | Fase 3 |
| REP-05 | Exportação PDF | Relatório de saúde, custo, manutenção, inspeção e viagem. | Fase 3 |
| REP-06 | Relatórios agendados | E-mail/notificação semanal, mensal ou por evento. | Fase 4 |
| REP-07 | Compartilhamento controlado | Link temporário, escopo limitado e revogável. | Fase 3 |
| REP-08 | Passaporte de manutenção | Linha do tempo com níveis de evidência e QR Code. | Fase 4 |
| REP-09 | Relatório de venda | Histórico, pendências, último check-up e limitações. | Fase 4 |
| REP-10 | Relatório B2B | Antes/depois de serviço, inspeção de estoque e cliente. | Fase 5 |

## 15. Módulo: Oficina, loja e colaboração B2B2C

### Objetivo

Usar oficinas e lojas como canal de distribuição e melhorar a qualidade do histórico.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| B2B-01 | Perfil de oficina | Dados, especialidades, localização e identidade verificada. | Fase 5 |
| B2B-02 | Check-up de recepção | Oficina conecta, executa sessão e gera relatório ao cliente. | Fase 5 |
| B2B-03 | Confirmação de manutenção | Oficina confirma serviço, itens, odômetro e anexa ordem de serviço. | Fase 5 |
| B2B-04 | Antes/depois | Comparar scan e achados anteriores/posteriores ao serviço. | Fase 5 |
| B2B-05 | Portal de clientes | Histórico compartilhado com consentimento do proprietário. | Fase 5 |
| B2B-06 | Loja de usados | Check-up de estoque, QR no anúncio e passaporte. | Fase 5 |
| B2B-07 | Orçamentos | Solicitação, resposta, aprovação e registro de serviço. | Fase 6 |
| B2B-08 | Reputação | Avaliação baseada em serviço concluído; moderada e com política própria. | Fase 6 |

## 16. Módulo: Frota e múltiplos motoristas

### Objetivo

Cobrir as necessidades de Drivvo Fleet e Simply Auto sem misturar a experiência pessoal com operação empresarial prematuramente.

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| FLT-01 | Compartilhar veículo | Proprietário convida condutor com permissões específicas. | Fase 4 |
| FLT-02 | Múltiplos condutores | Atribuir motorista, registrar uso e manter auditoria. | Fase 5 |
| FLT-03 | Gestão de documentos | CNH, seguro, licenciamento e vencimentos. | Fase 5 |
| FLT-04 | Dashboard operacional | Custo, manutenção pendente, consumo e disponibilidade por veículo. | Fase 5 |
| FLT-05 | Controle de frota leve | Veículos, motoristas, despesas e relatórios por período. | Fase 5 |
| FLT-06 | Centros de custo | Projeto, filial, motorista, rota e cliente. | Fase 6 |
| FLT-07 | Integrações empresariais | API, CSV, ERP, contabilidade e telemetria de terceiros. | Fase 6 |

## 17. Plataforma, dados e privacidade

### Requisitos funcionais

| ID | Funcionalidade | Descrição | Prioridade |
|---|---|---|---|
| PLT-01 | Offline-first | Registrar abastecimentos, manutenção e sessões sem internet; sincronizar depois. | MVP |
| PLT-02 | Cloud sync | Sincronizar dados em dispositivos autorizados. | Fase 2 |
| PLT-03 | Backup/restauração | Backups, recuperação e exportação pelo usuário. | Fase 3 |
| PLT-04 | Consentimento | Separar diagnóstico, telemetria, documentos, compartilhamento e inteligência de frota. | Fase 2 |
| PLT-05 | Exclusão/exportação | Usuário exporta, corrige e exclui seus dados conforme política aplicável. | Fase 3 |
| PLT-06 | Auditoria | Registrar acessos, edição de manutenção, limpeza de DTC e compartilhamentos. | Fase 2 |
| PLT-07 | Observabilidade | Medir erro BLE, timeout, PID ausente, qualidade da sessão e uso de regras. | MVP |
| PLT-08 | Localização e idioma | Português-BR, moeda R$, km/l, km e data brasileira; arquitetura i18n. | Fase 2 |
| PLT-09 | Acessibilidade | Leitura por tela, contraste, tamanho de fonte e linguagem não técnica. | Fase 2 |
| PLT-10 | Segurança de direção | Nenhuma ação manual exigida durante condução. | MVP |

## 18. Telas principais do produto final

| Tela | Conteúdo principal |
|---|---|
| Home | Saúde, achados, pendências, reserva estimada e CTA para scan/registro |
| Garagem | Veículos, status, última atividade e custo resumido |
| Veículo | Linha do tempo, saúde, manutenção, gastos, consumo e documentos |
| Diagnóstico | Conexão, sessão guiada, live data, DTCs e relatório |
| Manutenção | Plano, histórico, próxima ação, comprovantes e garantia |
| Abastecimento | Novo lançamento, consumo, custos e preços históricos |
| Financeiro | Gastos, categorias, custo/km, previsão e orçamento |
| Relatórios | PDF, CSV, compartilhamento e passaporte |
| Oficina/loja | Fluxos B2B, check-up, clientes e confirmações |
| Configurações | Conta, dados, consentimento, dongles, unidades e notificações |

## 19. Roadmap de prioridade

### Fase 1 — Fundamento e MVP OBD

- Conta, garagem e veículo.
- ELM327 BLE, detecção de PIDs e sessão guiada.
- RPM, temperatura, tensão, STFT/LTFT, MAP/MAF e DTC.
- Histórico de scans e relatório simples.
- Registro essencial de manutenção.
- Offline-first, qualidade e observabilidade.

### Fase 2 — Paridade básica de gestão

- Abastecimento, despesas, serviços e lembretes por km/data.
- Anexos de manutenção.
- DTC explicado, freeze frame e limpeza auditada.
- Home de saúde, baseline individual e motor de regras.
- Sync, consentimento e auditoria.

### Fase 3 — Valor recorrente

- Consumo/custo/km, relatórios, exportação e gráficos.
- Tendências, previsão de manutenção e reserva financeira.
- Checklists, garantia de serviços e viagens manuais.
- Compartilhamento controlado e feedback de achados.

### Fase 4 — Diferencial e confiança

- Inteligência de frota consentida.
- RAG técnico e IA com fontes/limitações.
- OCR de nota, passaporte, QR Code e relatório de venda.
- Rotas GPS, multiusuário leve e recursos avançados de OBD selecionados.

### Fase 5 — B2B2C e diagnóstico ampliado

- Oficina, loja de usados, check-up de recepção e antes/depois.
- Frota leve, condutores, documentos e dashboard operacional.
- Dados OEM e inspeções para veículos com cobertura validada.

### Fase 6 — Expansão controlada

- Orçamentos, marketplace, integração empresarial e centros de custo.
- Funções avançadas de serviço/codificação apenas em veículos certificados.
- Hardware próprio somente se software, compatibilidade e suporte provarem demanda.

## 20. Métricas de sucesso

| Área | Métrica |
|---|---|
| Ativação | Veículo cadastrado + primeira sessão válida + relatório visualizado |
| Retenção | Usuários que fazem segundo/terceiro scan e registram eventos úteis |
| Gestão | Abastecimentos, despesas e manutenções registrados por veículo ativo |
| Diagnóstico | Taxa de conexão, sessão concluída e achados úteis |
| Confiança | Contestação/falso positivo e taxa de explicação compreendida |
| Receita | Conversão de check-up, Pro, kit e B2B |
| B2B2C | Relatórios por oficina e clientes que ativam o histórico |

## 21. Critérios globais de aceite

- Cada módulo possui dono de dados, permissão e auditoria definidos.
- Todo dado técnico possui unidade, origem, versão de parser e qualidade quando aplicável.
- Todo alerta mostra severidade, urgência, confiança, evidência e limitação.
- O app não exige interação manual durante direção.
- Ações perigosas, como apagar DTC ou comandos ativos, exigem confirmação explícita e registram auditoria.
- Funcionalidades OEM/codificação só aparecem em veículos suportados e testados.
- O usuário consegue exportar seu histórico e revogar compartilhamentos.
- Funcionalidades de benchmark entram por fase sem remover a promessa central de saúde automotiva.

## 22. Decisão estratégica

O Car Health deve, sim, chegar a cobrir as ferramentas importantes que hoje estão fragmentadas entre Drivvo, Fuelio, Simply Auto, Car Scanner, FIXD, Carly e OBDeleven. Porém, o produto não deve tentar vencê-los por quantidade de botões.

O resultado final precisa fazer a gestão e o scanner trabalharem juntos:

> Um abastecimento pode mostrar piora de consumo. Um scan pode revelar mudança de fuel trim. Um serviço documentado pode explicar a mudança. O sistema transforma isso em uma recomendação com evidência, não em uma lista desconexa de dados.
