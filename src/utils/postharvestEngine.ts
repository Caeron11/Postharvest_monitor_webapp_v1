import type {
  AlertItem,
  BatchRecommendation,
  CropThresholdRule,
  CropType,
  FacilityKpis,
  InventoryBatch,
  MetricState,
  RoomEvaluation,
  ScenarioProjection,
  ScenarioType,
  SeverityLevel,
  StorageRoom,
  ThresholdValidationErrors,
} from '../types/postharvest';

export const SEVERITY_RANK: Record<SeverityLevel, number> = {
  critical: 0,
  warning: 1,
  no_data: 2,
  in_range: 3,
};

export function evaluateRoomStatus(
  room: StorageRoom,
  rule: CropThresholdRule
): RoomEvaluation {
  if (!room.online) {
    return {
      severity: 'no_data',
      primaryMetric: 'sensor',
      statusLabel: 'NO DATA',
      tempState: 'no_data',
      humidityState: 'no_data',
      co2State: 'no_data',
      gasState: 'no_data',
    };
  }

  let tempState: MetricState = 'in_range';
  if (room.tempC > rule.tempMax) tempState = 'above';
  else if (room.tempC < rule.tempMin) tempState = 'below';

  let humidityState: MetricState = 'in_range';
  if (room.humidityPct > rule.humidityMax) humidityState = 'above';
  else if (room.humidityPct < rule.humidityMin) humidityState = 'below';

  const co2State: MetricState =
    room.co2Ppm > rule.co2Max ? 'above' : 'in_range';

  let gasState: MetricState = 'in_range';
  if (room.gasIndex > rule.gasIndexMax) gasState = 'above';
  else if (room.gasRising && room.gasIndex >= rule.gasIndexMax * 0.8) {
    gasState = 'rising';
  }

  if (tempState !== 'in_range') {
    return {
      severity: 'critical',
      primaryMetric: 'temperature',
      statusLabel: 'CRITICAL: temperature',
      tempState,
      humidityState,
      co2State,
      gasState,
    };
  }

  if (gasState === 'above') {
    return {
      severity: 'critical',
      primaryMetric: 'gas',
      statusLabel: 'CRITICAL: gas index',
      tempState,
      humidityState,
      co2State,
      gasState,
    };
  }

  if (humidityState !== 'in_range') {
    return {
      severity: 'warning',
      primaryMetric: 'humidity',
      statusLabel: 'WARNING: humidity',
      tempState,
      humidityState,
      co2State,
      gasState,
    };
  }

  if (co2State !== 'in_range') {
    return {
      severity: 'warning',
      primaryMetric: 'co2',
      statusLabel: 'WARNING: CO2',
      tempState,
      humidityState,
      co2State,
      gasState,
    };
  }

  if (gasState === 'rising') {
    return {
      severity: 'warning',
      primaryMetric: 'gas',
      statusLabel: 'WARNING: gas rising',
      tempState,
      humidityState,
      co2State,
      gasState,
    };
  }

  return {
    severity: 'in_range',
    primaryMetric: null,
    statusLabel: 'IN RANGE',
    tempState,
    humidityState,
    co2State,
    gasState,
  };
}

export function sortRoomsBySeverity(
  rooms: StorageRoom[],
  rules: Record<CropType, CropThresholdRule>
): StorageRoom[] {
  return [...rooms].sort((a, b) => {
    const evalA = evaluateRoomStatus(a, rules[a.crop]);
    const evalB = evaluateRoomStatus(b, rules[b.crop]);
    const diff = SEVERITY_RANK[evalA.severity] - SEVERITY_RANK[evalB.severity];
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

export function validateThresholdRule(
  rule: CropThresholdRule
): ThresholdValidationErrors {
  const errors: ThresholdValidationErrors = {};

  if (!Number.isFinite(rule.tempMin) || !Number.isFinite(rule.tempMax)) {
    errors.tempMin = 'Enter numeric temperature bounds.';
  } else if (rule.tempMin >= rule.tempMax) {
    errors.tempMin = 'Error: Temp min must be lower than temp max.';
    errors.summary = 'Error: Temp min must be lower than temp max.';
  } else if (rule.tempMin < -10 || rule.tempMax > 35) {
    errors.tempMax = 'Temperature limits must stay within -10 to 35 C.';
  }

  if (!Number.isFinite(rule.humidityMin) || !Number.isFinite(rule.humidityMax)) {
    errors.humidityMin = 'Enter numeric humidity bounds.';
  } else if (rule.humidityMin >= rule.humidityMax) {
    errors.humidityMin = 'Error: Humidity min must be lower than humidity max.';
    if (!errors.summary) {
      errors.summary = 'Error: Humidity min must be lower than humidity max.';
    }
  } else if (rule.humidityMin < 20 || rule.humidityMax > 100) {
    errors.humidityMax = 'Humidity limits must stay within 20 to 100 %.';
  }

  if (!Number.isFinite(rule.co2Max) || rule.co2Max <= 100) {
    errors.co2Max = 'CO2 max must be greater than 100 ppm.';
    if (!errors.summary) {
      errors.summary = 'Error: CO2 max must be greater than 100 ppm.';
    }
  }

  if (!Number.isFinite(rule.gasIndexMax) || rule.gasIndexMax <= 0.2) {
    errors.gasIndexMax = 'Gas index max must be greater than 0.2.';
    if (!errors.summary) {
      errors.summary = 'Error: Gas index max must be greater than 0.2.';
    }
  }

  if (!errors.summary) {
    const first =
      errors.tempMin ||
      errors.tempMax ||
      errors.humidityMin ||
      errors.humidityMax ||
      errors.co2Max ||
      errors.gasIndexMax;
    if (first) errors.summary = first;
  }

  return errors;
}

export function computeBatchRecommendation(
  batch: InventoryBatch,
  roomEvaluation: RoomEvaluation
): BatchRecommendation {
  if (batch.released) {
    return {
      status: 'released',
      badgeLabel: 'RELEASED',
      summaryText: batch.releasedAt ? `Released ${batch.releasedAt}` : 'Released',
      urgencyScore: 99,
    };
  }

  if (batch.manualHold) {
    return {
      status: 'hold',
      badgeLabel: 'HOLD',
      summaryText: 'Manual hold active',
      urgencyScore: 40 + batch.shelfLifeDays,
    };
  }

  const priceMet = batch.currentPricePhp >= batch.targetPricePhp;

  if (
    batch.shelfLifeDays <= 2 ||
    (roomEvaluation.severity === 'critical' && batch.shelfLifeDays <= 3)
  ) {
    return {
      status: 'release_now',
      badgeLabel: 'RELEASE NOW',
      summaryText: 'Release now',
      urgencyScore: batch.shelfLifeDays,
    };
  }

  if (batch.shelfLifeDays <= 5 || (priceMet && batch.shelfLifeDays <= 6)) {
    const daysUntil = Math.max(1, batch.shelfLifeDays - 2);
    return {
      status: 'release_soon',
      badgeLabel: 'RELEASE SOON',
      summaryText: `Release in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'}`,
      urgencyScore: 10 + batch.shelfLifeDays,
    };
  }

  if (!priceMet) {
    return {
      status: 'hold',
      badgeLabel: 'HOLD',
      summaryText: `Hold > ${batch.targetPricePhp} PHP/kg`,
      urgencyScore: 30 + batch.shelfLifeDays,
    };
  }

  return {
    status: 'hold',
    badgeLabel: 'HOLD',
    summaryText: 'Hold',
    urgencyScore: 35 + batch.shelfLifeDays,
  };
}

export function syncAlertsWithRooms(
  rooms: StorageRoom[],
  rules: Record<CropType, CropThresholdRule>,
  existingAlerts: AlertItem[],
  nowTime: string
): AlertItem[] {
  const nextAlerts: AlertItem[] = [];
  const existingByKey = new Map<string, AlertItem>();

  for (const alert of existingAlerts) {
    existingByKey.set(`${alert.roomId}:${alert.metric}`, alert);
  }

  for (const room of rooms) {
    const rule = rules[room.crop];
    const evaluation = evaluateRoomStatus(room, rule);

    if (evaluation.severity === 'in_range' || !evaluation.primaryMetric) {
      continue;
    }

    const key = `${room.id}:${evaluation.primaryMetric}`;
    const prev = existingByKey.get(key);

    let typeLabel = 'Threshold breach';
    let message = `${room.name} outside target range`;

    if (evaluation.primaryMetric === 'sensor') {
      typeLabel = 'Sensor offline';
      message = `${room.name} sensor offline since ${room.offlineSince ?? nowTime}`;
    } else if (evaluation.primaryMetric === 'temperature') {
      typeLabel =
        evaluation.tempState === 'above' ? 'Temperature high' : 'Temperature low';
      const direction = evaluation.tempState === 'above' ? 'above' : 'below';
      const riskNote =
        room.crop === 'Broccoli'
          ? evaluation.tempState === 'above'
            ? ', floret yellowing risk'
            : ', freezing injury risk'
          : evaluation.tempState === 'above'
            ? ', accelerated ripening risk'
            : ', chilling injury risk';
      message = `${room.name} temperature ${direction} range (${room.tempC.toFixed(1)} °C${riskNote})`;
    } else if (evaluation.primaryMetric === 'humidity') {
      typeLabel =
        evaluation.humidityState === 'below'
          ? 'Humidity near limit'
          : 'Humidity high';
      message = `${room.name} humidity outside ${rule.humidityMin}-${rule.humidityMax}%`;
    } else if (evaluation.primaryMetric === 'co2') {
      typeLabel = 'CO2 elevated';
      message = `${room.name} CO2 above ${rule.co2Max} ppm`;
    } else if (evaluation.primaryMetric === 'gas') {
      typeLabel =
        evaluation.gasState === 'above'
          ? 'Spoilage gas high'
          : 'Spoilage gas rising';
      message = `${room.name} spoilage gas index ${room.gasIndex.toFixed(1)}`;
    }

    nextAlerts.push({
      id: prev?.id ?? `alert-${room.id}-${evaluation.primaryMetric}`,
      roomId: room.id,
      roomName: room.name,
      metric: evaluation.primaryMetric,
      typeLabel,
      message,
      severity: evaluation.severity,
      timestamp: prev?.timestamp ?? nowTime,
      acknowledged: prev ? prev.acknowledged : false,
    });
  }

  nextAlerts.sort((a, b) => {
    const sevDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sevDiff !== 0) return sevDiff;
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return b.timestamp.localeCompare(a.timestamp);
  });

  return nextAlerts;
}

export function projectScenarioImpact(
  rooms: StorageRoom[],
  rules: Record<CropType, CropThresholdRule>,
  scenario: ScenarioType,
  durationHours: number,
  ambientOffsetC: number,
  compressorLoadPct: number
): ScenarioProjection {
  const durationFactor = Math.min(2.2, durationHours / 12);
  const loadStress = Math.max(0, (compressorLoadPct - 70) / 30);

  let baseTempDelta = ambientOffsetC * 0.35;
  let baseRisk = 6 + ambientOffsetC * 2.5 + loadStress * 8;

  if (scenario === 'equipment_failure') {
    baseTempDelta += 2.6 * durationFactor + loadStress * 1.1;
    baseRisk += 32 * durationFactor;
  } else if (scenario === 'harvest_glut') {
    baseTempDelta += 1.1 * durationFactor + loadStress * 0.6;
    baseRisk += 18 * durationFactor;
  } else {
    baseTempDelta = Math.max(-0.4, ambientOffsetC * 0.15);
    baseRisk = Math.max(2, 4 + Math.max(0, ambientOffsetC) * 1.4);
  }

  let breaching = 0;
  for (const room of rooms) {
    if (!room.online) continue;
    const rule = rules[room.crop];
    const projectedTemp =
      scenario === 'normal'
        ? (rule.tempMin + rule.tempMax) / 2 + baseTempDelta
        : room.tempC + baseTempDelta;
    if (projectedTemp > rule.tempMax || projectedTemp < rule.tempMin) {
      breaching += 1;
    }
  }

  const spoilageRiskPct = Math.round(Math.min(96, Math.max(2, baseRisk)));
  const shelfLifeDeltaDays =
    scenario === 'normal'
      ? 0
      : -Number(
          Math.min(6, Math.max(0.5, (spoilageRiskPct / 100) * 4.8)).toFixed(1)
        );

  return {
    spoilageRiskPct,
    shelfLifeDeltaDays,
    projectedBreachRooms: breaching,
    peakTempDeltaC: Number(baseTempDelta.toFixed(1)),
  };
}

export function applyScenarioToRooms(
  rooms: StorageRoom[],
  rules: Record<CropType, CropThresholdRule>,
  scenario: ScenarioType,
  durationHours: number,
  ambientOffsetC: number,
  compressorLoadPct: number
): StorageRoom[] {
  const durationScale = Math.min(1.8, Math.max(0.6, durationHours / 12));
  const loadBoost = Math.max(0, (compressorLoadPct - 75) / 25);

  return rooms.map((room) => {
    const rule = rules[room.crop];
    const midTemp = (rule.tempMin + rule.tempMax) / 2;
    const midHum = (rule.humidityMin + rule.humidityMax) / 2;

    if (scenario === 'normal') {
      const nextTemp = Number((midTemp + ambientOffsetC * 0.1).toFixed(1));
      const nextHum = Number(midHum.toFixed(1));
      const nextCo2 = Math.round(rule.co2Max * 0.48);
      const nextGas = Number((rule.gasIndexMax * 0.38).toFixed(1));
      return {
        ...room,
        online: true,
        offlineSince: undefined,
        tempC: nextTemp,
        humidityPct: nextHum,
        co2Ppm: nextCo2,
        gasIndex: nextGas,
        gasRising: false,
        breachDurationMin: 0,
        compressorMode: 'auto',
        history24h: room.history24h.map((pt, idx) => {
          const drift = Math.sin(idx * 0.6) * 0.2;
          return {
            ...pt,
            tempC: Number((nextTemp + drift).toFixed(1)),
            humidityPct: Number((nextHum + drift * 2).toFixed(1)),
            co2Ppm: Math.round(nextCo2 + drift * 40),
            gasIndex: Number(Math.max(0.3, nextGas + drift * 0.15).toFixed(1)),
          };
        }),
      };
    }

    if (scenario === 'equipment_failure') {
      const isPrimaryFault = room.id === 'room-a' || room.id === 'room-c';
      const deltaC =
        (isPrimaryFault ? 3.2 : 1.4) * durationScale +
        ambientOffsetC * 0.4 +
        loadBoost * 0.8;
      const nextTemp = Number((midTemp + deltaC).toFixed(1));
      const nextHum = Number(
        Math.max(72, midHum - (isPrimaryFault ? 7.5 : 3.2) * durationScale).toFixed(1)
      );
      const nextCo2 = Math.round(
        rule.co2Max * (isPrimaryFault ? 1.12 : 0.78)
      );
      const nextGas = Number(
        (rule.gasIndexMax * (isPrimaryFault ? 1.25 : 0.82)).toFixed(1)
      );
      return {
        ...room,
        online: room.id === 'room-d' ? false : true,
        tempC: nextTemp,
        humidityPct: nextHum,
        co2Ppm: nextCo2,
        gasIndex: nextGas,
        gasRising: isPrimaryFault,
        breachDurationMin: isPrimaryFault ? Math.round(durationHours * 6) : 12,
        compressorMode: isPrimaryFault ? 'boost' : 'auto',
        history24h: room.history24h.map((pt, idx, arr) => {
          const progress = idx / Math.max(1, arr.length - 1);
          return {
            ...pt,
            tempC: Number((midTemp + deltaC * progress).toFixed(1)),
            humidityPct: Number(
              (midHum - (midHum - nextHum) * progress).toFixed(1)
            ),
            co2Ppm: Math.round(rule.co2Max * 0.5 + (nextCo2 - rule.co2Max * 0.5) * progress),
            gasIndex: Number((0.8 + (nextGas - 0.8) * progress).toFixed(1)),
          };
        }),
      };
    }

    // harvest_glut: elevated respiration (CO2 & gas) and moderate thermal load
    const deltaC = 0.9 * durationScale + ambientOffsetC * 0.25 + loadBoost * 0.5;
    const nextTemp = Number((rule.tempMax - 0.1 + deltaC * 0.6).toFixed(1));
    const nextHum = Number(
      Math.min(99, rule.humidityMax + 1.8 * durationScale).toFixed(1)
    );
    const nextCo2 = Math.round(rule.co2Max * (1.14 + loadBoost * 0.08));
    const nextGas = Number((rule.gasIndexMax * 1.12).toFixed(1));

    return {
      ...room,
      online: true,
      offlineSince: undefined,
      tempC: nextTemp,
      humidityPct: nextHum,
      co2Ppm: nextCo2,
      gasIndex: nextGas,
      gasRising: true,
      breachDurationMin: Math.round(durationHours * 4),
      compressorMode: 'boost',
      history24h: room.history24h.map((pt, idx, arr) => {
        const progress = idx / Math.max(1, arr.length - 1);
        return {
          ...pt,
          tempC: Number((midTemp + (nextTemp - midTemp) * progress).toFixed(1)),
          humidityPct: Number((midHum + (nextHum - midHum) * progress).toFixed(1)),
          co2Ppm: Math.round(rule.co2Max * 0.55 + (nextCo2 - rule.co2Max * 0.55) * progress),
          gasIndex: Number((0.9 + (nextGas - 0.9) * progress).toFixed(1)),
        };
      }),
    };
  });
}

export function formatTimeHHMM(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function computeFacilityKpis(
  rooms: StorageRoom[],
  rules: Record<CropType, CropThresholdRule>,
  batches: InventoryBatch[],
  alerts: AlertItem[]
): FacilityKpis {
  const openAlerts = alerts.filter((a) => !a.acknowledged);
  const criticalAlertsCount = openAlerts.filter(
    (a) => a.severity === 'critical'
  ).length;
  const warningAlertsCount = openAlerts.filter(
    (a) => a.severity === 'warning'
  ).length;
  const noDataAlertsCount = openAlerts.filter(
    (a) => a.severity === 'no_data'
  ).length;

  const roomsInRangeCount = rooms.filter(
    (r) => evaluateRoomStatus(r, rules[r.crop]).severity === 'in_range'
  ).length;
  const offlineRoomsCount = rooms.filter((r) => !r.online).length;

  const activeBatches = batches.filter((b) => !b.released);
  const totalStorageKg = activeBatches.reduce((sum, b) => sum + b.qtyKg, 0);

  let releaseOpeningCount = 0;
  for (const batch of activeBatches) {
    const room = rooms.find((r) => r.id === batch.roomId);
    const roomEval = room
      ? evaluateRoomStatus(room, rules[room.crop])
      : {
          severity: 'in_range' as const,
          primaryMetric: null,
          statusLabel: 'IN RANGE',
          tempState: 'in_range' as const,
          humidityState: 'in_range' as const,
          co2State: 'in_range' as const,
          gasState: 'in_range' as const,
        };
    const rec = computeBatchRecommendation(batch, roomEval);
    if (rec.status === 'release_now' || rec.status === 'release_soon') {
      releaseOpeningCount += 1;
    }
  }

  return {
    openAlertsCount: openAlerts.length,
    criticalAlertsCount,
    warningAlertsCount,
    noDataAlertsCount,
    roomsInRangeCount,
    offlineRoomsCount,
    totalRoomsCount: rooms.length,
    activeBatchesCount: activeBatches.length,
    totalStorageKg,
    releaseOpeningCount,
  };
}

export interface AuthValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAuthForm(input: {
  mode: 'signin' | 'signup';
  fullName?: string;
  email: string;
  cooperativeName?: string;
  password: string;
}): AuthValidationResult {
  const emailTrim = input.email.trim();
  if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return { valid: false, error: 'Enter a valid work email address.' };
  }
  if (input.password.length < 6) {
    return {
      valid: false,
      error: 'Password must contain at least 6 characters.',
    };
  }
  if (input.mode === 'signup') {
    if (!input.fullName || input.fullName.trim().length < 2) {
      return { valid: false, error: 'Enter your full name.' };
    }
    if (!input.cooperativeName || input.cooperativeName.trim().length < 2) {
      return { valid: false, error: 'Enter a cooperative or facility name.' };
    }
  }
  return { valid: true };
}

