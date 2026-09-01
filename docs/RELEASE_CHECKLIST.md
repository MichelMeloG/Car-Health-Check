# Checklist de publicação de teste

## Antes do build

- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run format:check`
- [ ] `npm.cmd run test`
- [ ] regras Firestore publicadas no projeto correto
- [ ] `google-services.json` não está versionado
- [ ] versão e `versionCode` conferidos no EAS

## Teste funcional

- [ ] novo usuário consegue criar conta e recuperar senha
- [ ] login e logout funcionam
- [ ] usuário A não enxerga dados do usuário B
- [ ] gasto e veículo funcionam offline e sincronizam ao reconectar
- [ ] repetir abertura/sincronização não duplica gastos
- [ ] exportação gera arquivo JSON legível
- [ ] exclusão remove conta e dados
- [ ] nenhum valor financeiro aparece nos logs

## Reversão/substituição

- manter o último build aprovado disponível no EAS;
- distribuir a versão anterior se o novo build apresentar regressão;
- para uma correção, incrementar `versionCode`/versão e gerar novo build `preview`;
- registrar incidente, versão afetada, impacto e correção.
