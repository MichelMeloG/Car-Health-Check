import type { HealthFinding, ScanSession } from '../../data/types';

export function evaluateHealth(sessions: ScanSession[]): HealthFinding[] {
  const latest = sessions[0];
  if (!latest) return [];
  const findings: HealthFinding[] = [];
  if (latest.dtcs.length)
    findings.push({
      id: 'dtc',
      title: 'Códigos de falha encontrados',
      severity: 'high',
      urgency: 'soon',
      confidence: 0.9,
      evidence: latest.dtcs.map((code) => `DTC ${code} na última leitura`),
      nextStep:
        'Procure uma oficina para diagnóstico e não apague os códigos antes de registrar a evidência.',
      limitations: ['Um DTC não confirma uma peça defeituosa isoladamente.'],
    });
  const ltft = latest.telemetry.ltftPct;
  if (typeof ltft === 'number' && Math.abs(ltft) >= 15)
    findings.push({
      id: 'fuel-trim',
      title: 'Correção de combustível elevada',
      severity: 'medium',
      urgency: 'soon',
      confidence: 0.65,
      evidence: [`LTFT de ${ltft.toFixed(1)}% na última sessão`],
      nextStep: 'Verifique admissão de ar, alimentação e sensores com uma oficina.',
      limitations: ['Uma única leitura não define a causa; compare sessões equivalentes.'],
    });
  const voltage = latest.telemetry.voltageV;
  if (typeof voltage === 'number' && voltage < 12.4)
    findings.push({
      id: 'voltage',
      title: 'Tensão baixa registrada',
      severity: 'medium',
      urgency: 'monitor',
      confidence: 0.6,
      evidence: [`Tensão de ${voltage.toFixed(2)} V`],
      nextStep:
        'Repita a leitura com o motor ligado e verifique bateria e alternador se persistir.',
      limitations: ['A leitura depende da condição do motor e do adaptador.'],
    });
  return findings;
}
