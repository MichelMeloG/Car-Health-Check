# Car Health — plano de sprints do primeiro MVP

## Premissas

- Um desenvolvedor, trabalhando em sprints de uma semana.
- Primeiro incremento: controle de gastos de um veículo.
- Stack: React Native + Expo SDK 54 + TypeScript.
- Backend inicial: Firebase Authentication + Cloud Firestore + Security Rules.
- Persistência local para permitir uma boa experiência sem rede.
- Cloud Run, Cloud SQL, OBD e BLE ficam fora destas sprints.

## Resultado esperado do MVP

O usuário consegue criar uma conta, cadastrar um veículo, registrar gastos, consultar totais e histórico, editar/excluir lançamentos e usar o app com sincronização com o Firestore.

## Sprint 0 — Preparação técnica

### Objetivo

Criar o projeto e deixar o ambiente reproduzível.

### Entregas

- projeto Expo com TypeScript;
- configuração de navegação;
- ESLint, Prettier e scripts de desenvolvimento;
- estrutura de pastas por domínio;
- projeto Firebase separado para desenvolvimento;
- Firebase Emulator Suite configurado;
- variáveis de ambiente documentadas;
- README com comandos para executar o projeto.

### Critérios de aceite

- novo clone consegue iniciar o app com um comando documentado;
- app abre em Android/iOS ou simulador;
- emuladores Firebase iniciam localmente;
- nenhum segredo é versionado.

## Sprint 1 — Esqueleto visual do app

### Objetivo

Construir a navegação e as telas principais sem dependência de backend.

### Entregas

- tela de boas-vindas;
- tela de login/cadastro com estados visuais;
- dashboard vazio;
- tela de gastos vazia;
- tela de cadastro/edição de veículo;
- tela de cadastro/edição de gasto;
- componentes de moeda, data, quilometragem e categoria;
- tema visual e estados de carregamento/erro/vazio.

### Critérios de aceite

- usuário consegue navegar entre Dashboard, Gastos e Veículo;
- formulário de gasto valida campos obrigatórios;
- layout funciona em telas pequenas;
- nenhuma tela depende de valores mockados espalhados pelo código.

## Sprint 2 — Controle de gastos local

### Objetivo

Entregar o primeiro fluxo realmente utilizável offline.

### Entidades

- `Vehicle`;
- `Expense`;
- `ExpenseCategory`.

### Entregas

- repositórios locais para veículo e gasto;
- criação, edição e exclusão de lançamentos;
- listagem ordenada por data;
- filtro por mês e categoria;
- resumo mensal: total, quantidade e total por categoria;
- armazenamento local persistente;
- testes unitários de validação e cálculo.

### Critérios de aceite

- fechar e abrir o app preserva os dados;
- criar um gasto atualiza lista e resumo imediatamente;
- edição e exclusão funcionam sem rede;
- valores monetários não usam ponto flutuante de forma insegura; preferir centavos inteiros.

## Sprint 3 — Autenticação e Firestore

### Objetivo

Adicionar conta e sincronização na nuvem sem criar API própria.

### Entregas

- Firebase Authentication por e-mail/senha ou magic link;
- login, logout e recuperação de acesso;
- modelo de dados no Firestore;
- Security Rules por `request.auth.uid`;
- sincronização de veículo e gastos;
- identificador estável por lançamento;
- tratamento de offline, retry e conflito simples por `updatedAt`;
- ambiente local usando Firebase Emulator.

### Critérios de aceite

- usuário A não consegue ler ou alterar dados do usuário B;
- gasto criado offline sincroniza depois da reconexão;
- repetir uma sincronização não duplica o lançamento;
- regras são testadas no emulador;
- logout limpa o estado privado em memória.

## Sprint 4 — Dashboard e qualidade do produto

### Objetivo

Transformar o CRUD em uma experiência simples de acompanhamento.

### Entregas

- dashboard com gasto do mês;
- comparação com mês anterior;
- distribuição por categoria;
- filtros de período;
- mensagens para primeiro uso;
- tratamento de erros de rede e autenticação;
- acessibilidade básica;
- analytics mínimos e anônimos: cadastro, primeiro veículo, primeiro gasto;
- testes de navegação e fluxo principal.

### Critérios de aceite

- usuário entende quanto gastou no mês sem abrir a lista completa;
- todos os estados principais têm loading, vazio e erro;
- fluxo de primeiro gasto pode ser concluído sem suporte;
- nenhuma informação financeira aparece em logs.

## Sprint 5 — Segurança, custos e publicação de teste

### Objetivo

Preparar uma versão de teste para usuários reais com controle de custo.

### Entregas

- regras Firestore revisadas;
- validação de orçamento e limites de uso no Firebase/GCP;
- monitoramento de leituras, gravações e armazenamento;
- política de privacidade inicial;
- opção de exportar ou excluir dados;
- build de teste pelo EAS;
- distribuição interna para Android/iOS;
- checklist de suporte e registro de incidentes;
- backup/exportação manual dos dados do piloto.

### Critérios de aceite

- build instalável por testadores;
- regras não permitem acesso cruzado entre contas;
- consumo do Firestore é acompanhado;
- existe procedimento para excluir uma conta;
- versão de teste pode ser revertida ou substituída.

## Sprint 6 — Piloto controlado

### Objetivo

Validar uso real antes de adicionar OBD ou backend próprio.

### Entregas

- 5–10 usuários iniciais;
- acompanhamento dos primeiros lançamentos;
- correção dos principais problemas de UX;
- medição de ativação e retorno;
- coleta de feedback sobre categorias, quilometragem e relatórios;
- decisão sobre a próxima funcionalidade.

### Métricas

- usuário cadastra veículo;
- usuário registra primeiro gasto;
- usuário retorna em até 7 dias;
- quantidade média de gastos por usuário;
- falhas de sincronização;
- leituras e gravações do Firestore por usuário;
- custo mensal estimado por usuário.

### Critérios de decisão

- se o uso for baixo: melhorar onboarding e proposta de valor;
- se o controle de gastos for usado: adicionar manutenção e lembretes;
- se houver necessidade de regras privadas ou integrações: avaliar Cloud Run;
- só adotar Cloud SQL quando Firestore limitar consultas, relatórios ou evolução do domínio.

## Backlog posterior

Depois da validação do controle de gastos:

1. manutenção preventiva e histórico de serviços;
2. anexos de notas e ordens de serviço;
3. relatórios compartilháveis;
4. Cloud Run para regras e integrações privadas;
5. OBD/BLE com Expo Development Build;
6. comparação longitudinal e alertas de saúde;
7. Cloud SQL se houver necessidade comprovada.

## Definition of Done

Uma tarefa só está concluída quando:

- funciona no fluxo normal e nos estados de erro/vazio;
- possui tipos TypeScript;
- não expõe segredos ou dados financeiros em logs;
- tem teste quando envolve regra, cálculo ou autorização;
- foi verificada em Android e, quando aplicável, iOS;
- está documentada quando altera configuração ou contrato;
- não aumenta infraestrutura paga sem justificativa.
