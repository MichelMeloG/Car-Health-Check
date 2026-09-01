# Car Health

Aplicativo mobile inicial para acompanhar os gastos de um veículo.

## Estrutura

- `mobile/`: app React Native + Expo SDK 54 + TypeScript;
- `docs/`: arquitetura e plano de sprints;
- `Car_Health_Documento_Completo_da_Ideia.pdf`: documento conceitual do produto.

## Executar o app

Requisitos: Node.js 24+, Java (para os emuladores Firebase) e Expo CLI via dependência local.

```bash
cd mobile
npm install
npm start
```

Depois, pressione `a` para Android, `i` para iOS (macOS) ou `w` para web.

## Verificações

```bash
cd mobile
npm run typecheck
npm run lint
npm run format:check
```

## Firebase local

1. Copie `.env.example` para `.env.local` e preencha as configurações do app.
2. O arquivo `.env.local` não deve ser commitado.
3. Inicie os emuladores:

```bash
cd mobile
npm run firebase:emulators
```

O Emulator UI ficará disponível em `http://127.0.0.1:4000`.

O Firebase Emulator Suite precisa encontrar `java` no `PATH` e o Firebase CLI autenticado. Se o comando falhar com `spawn java ENOENT`, instale um JDK e abra um novo terminal. Para autenticar o CLI, execute `npx firebase login`.

Para testar o app contra os emuladores, defina `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true`. No Android Emulator use `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2`; em um celular físico use o IP local do computador.

Para publicar as regras do Firestore no projeto de desenvolvimento:

```bash
cd mobile
npx firebase deploy --only firestore:rules
```

O app usa Firebase Authentication por e-mail/senha, Firestore por usuário e SQLite como fila local. Gastos e veículo são gravados primeiro no dispositivo e sincronizados automaticamente; cada lançamento tem um ID estável e conflitos usam o `updatedAt` mais recente.

## Sprint 5

Consulte [política de privacidade inicial](docs/PRIVACY_POLICY.md), [monitoramento de custos](docs/COST_MONITORING.md) e [checklist de publicação](docs/RELEASE_CHECKLIST.md). O dashboard permite exportar os dados do usuário em JSON e solicitar a exclusão da conta e dos documentos sincronizados.

## OBD-II por Bluetooth

O app possui uma primeira implementação de BLE para adaptadores ELM327 compatíveis. Ela procura adaptadores, faz a sequência de inicialização do ELM327 e lê DTCs e PIDs básicos.

Essa funcionalidade **não funciona no Expo Go**. É necessário criar um Development Build, porque Bluetooth BLE usa código nativo:

```bash
cd mobile
npx expo prebuild
npx expo run:android
```

Depois de instalar o Development Build no celular, execute `npm.cmd start -- --dev-client` para abrir o projeto. Caso prefira gerar o binário na nuvem, configure uma conta Expo e use `eas build --profile development --platform android`.

Use somente adaptadores BLE homologados e faça o check-up com o veículo parado. A leitura é informativa e não substitui diagnóstico mecânico.

Compatibilidade inicial: adaptadores ELM327 que expõem um serviço BLE gravável/notificável, com preferência para `FFF0/FFF1`. Adaptadores Bluetooth Classic não são suportados por esta primeira integração.
