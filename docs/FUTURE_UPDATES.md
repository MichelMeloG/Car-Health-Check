# Atualizações futuras

Este documento registra melhorias planejadas que não serão ativadas agora. O objetivo é manter o custo operacional baixo enquanto o app evolui.

## Privacidade e retenção de dados

### Remoção definitiva de dados excluídos

Atualmente, gastos excluídos recebem `deleted: true`. Isso é necessário para propagar a exclusão entre dispositivos que possam estar offline.

Em uma versão futura, será criada uma rotina automática para remover definitivamente os registros excluídos após um período de retenção definido pelo produto.

Decisões pendentes:

- definir o período de retenção, com sugestão inicial de 30 dias;
- habilitar faturamento Blaze no Firebase/GCP;
- configurar Cloud Scheduler e Cloud Functions, ou serviço equivalente;
- registrar logs de execução sem dados financeiros;
- documentar a política de retenção e exclusão na política de privacidade.

### Criptografia adicional da base local

O banco SQLite local usa atualmente as proteções padrão do sistema operacional. Em uma versão futura, será avaliada criptografia adicional do banco no dispositivo.

A implementação deverá considerar:

- biblioteca de SQLite com criptografia compatível com React Native e Expo Development Build;
- armazenamento seguro da chave no Keychain (iOS) e Keystore (Android);
- comportamento após restauração de backup, troca de aparelho e logout;
- testes em dispositivos comprometidos/rootados;
- impacto de tamanho, desempenho e manutenção do aplicativo.

## Sincronização e confiabilidade

- Criar testes de integração no Firebase Emulator para múltiplos veículos, sincronização offline e conflitos por `updatedAt`.
- Criar testes de integração de sincronização bidirecional para manutenção, abastecimentos, lembretes e sessões OBD em dois dispositivos.
- Sincronizar de volta eventos de auditoria e consentimentos quando uma futura interface desses recursos for criada.
- Exibir uma indicação visual quando uma versão local for substituída pela estratégia “última alteração vence”.
- Implementar restauração de registros excluídos e fluxos de exclusão para lembretes e scans na interface.
- Dividir lotes de sincronização acima de 500 documentos, limite do Firestore.
- Criar telemetria técnica de falhas de sincronização sem enviar gastos ou dados pessoais.
- Avaliar backup/exportação automatizada do piloto com acesso restrito.

### Evolução do schema local

- Criar versionamento explícito das migrações SQLite, com histórico de versões e testes de atualização para instalações existentes.
- Validar e tratar dados inválidos/corrompidos ao desserializar telemetria, DTCs e respostas de diagnóstico salvas localmente.

## Conta e privacidade

- Permitir alteração de e-mail e redefinição de senha dentro do perfil.
- Criar tela de consentimentos, com versão da política, data de aceite e opções separadas para diagnóstico, telemetria, documentos, compartilhamento e inteligência de frota.
- Registrar em auditoria a limpeza de DTC, alterações relevantes, compartilhamentos e revogações de consentimento.
- Criar canal de contato de privacidade e suporte antes da publicação pública.
- Definir controlador, operador e bases legais aplicáveis à LGPD com revisão jurídica.
- Registrar versão aceita da política de privacidade e consentimentos necessários.

## Produto

- Categorias configuráveis pelo usuário.
- Anexos de comprovantes de manutenção via Firebase Storage, com regras por usuário, limites de tamanho/tipo, exclusão e política de armazenamento definida.
- Notificações locais para lembretes por data e quilometragem, com permissões, agrupamento e prevenção de excesso de alertas.
- Registrar a fonte e a data da quilometragem, além do valor atual do odômetro.
- Cálculo de consumo oficial para abastecimentos compatíveis de tanque cheio e tratamento correto de abastecimentos parciais.
- Relatórios por veículo e por período.
- Histórico visual de check-ups OBD vinculado ao veículo, com sessão guiada, segmentos e comparação de linha de base.
- DTCs em linguagem simples, com severidade, riscos, hipóteses, limitações e próximo passo.
- Leitura e armazenamento de freeze frame quando suportado pelo veículo/adaptador.
- Readiness, simulador de OBD e gravação estruturada de telemetria.
- Distribuição de testes para Android e iOS com checklist de incidentes e reversão.

## Infraestrutura

- Configurar ambientes separados de desenvolvimento, homologação e produção.
- Aplicar alertas de orçamento, consumo de Firestore e erros de autenticação.
- Avaliar uma API no Cloud Run apenas quando regras privadas ou processamento mais complexo exigirem backend próprio.
