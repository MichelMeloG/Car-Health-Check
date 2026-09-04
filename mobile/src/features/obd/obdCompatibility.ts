export type CompatibilityStatus = 'candidate' | 'validated';

export type CompatibilityProfile = {
  id: string;
  title: string;
  detail: string;
  status: CompatibilityStatus;
  note: string;
};

/**
 * A lista só recebe status validated depois de testes físicos documentados.
 * Enquanto isso, os itens candidate servem apenas para orientar o piloto.
 */
export const VEHICLE_COMPATIBILITY: CompatibilityProfile[] = [
  {
    id: 'honda_fit_2004_2008_l13a',
    title: 'Honda Fit 1.4, 2004–2008',
    detail: 'Perfil inicial do piloto: motor L13A e OBD-II genérico.',
    status: 'candidate',
    note: 'Aguardando validação física de PIDs, protocolo e qualidade da sessão.',
  },
];

export const ADAPTER_COMPATIBILITY: CompatibilityProfile[] = [
  {
    id: 'elm327_ble_gatt',
    title: 'ELM327 BLE com GATT gravável/notificável',
    detail: 'Adaptador BLE que exponha características de escrita e notificação.',
    status: 'candidate',
    note: 'Compatibilidade depende do firmware, da ECU e do comportamento real do dongle.',
  },
  {
    id: 'elm327_ble_fff0_fff1',
    title: 'Perfil BLE FFF0 / FFF1',
    detail: 'Perfil preferencial reconhecido pelo driver atual.',
    status: 'candidate',
    note: 'Não é homologação automática; deve ser marcado como validado após teste registrado.',
  },
];

export function adapterProfileForName(name: string | null) {
  const normalized = name?.toUpperCase() ?? '';
  if (/OBD|ELM|VLINK|V-GATE/.test(normalized)) return 'ELM327 BLE / candidato';
  return 'Adaptador BLE não identificado';
}
