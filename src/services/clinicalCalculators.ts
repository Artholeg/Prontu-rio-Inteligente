// ═══════════════════════════════════════════════════
// CLINICAL CALCULATORS
// ═══════════════════════════════════════════════════

export function calcFramingham(data: {
  age: number;
  sex: 'M' | 'F';
  ct: number;
  hdl: number;
  pas: number;
  isSmoker: boolean;
  isDM: boolean;
  isTreated: boolean;
}) {
  const { age, sex, ct, hdl, pas, isSmoker, isDM, isTreated } = data;
  let riskPct;

  if (sex === 'M') {
    const lnAge = Math.log(age);
    const lnCT = Math.log(ct);
    const lnHDL = Math.log(hdl);
    const lnSBP = Math.log(pas);
    const smokeVal = isSmoker ? 1 : 0;
    const dmVal = isDM ? 1 : 0;

    let sumBeta = 3.06117 * lnAge + 1.12370 * lnCT - 0.93263 * lnHDL + (isTreated ? 1.99881 : 1.93303) * lnSBP + 0.65451 * smokeVal + 0.57367 * dmVal;
    riskPct = (1 - Math.pow(0.88936, Math.exp(sumBeta - 23.9802))) * 100;
  } else {
    const lnAge = Math.log(age);
    const lnCT = Math.log(ct);
    const lnHDL = Math.log(hdl);
    const lnSBP = Math.log(pas);
    const smokeVal = isSmoker ? 1 : 0;
    const dmVal = isDM ? 1 : 0;

    let sumBeta = 2.32888 * lnAge + 1.20904 * lnCT - 0.70833 * lnHDL + (isTreated ? 2.76157 : 2.82263) * lnSBP + 0.52873 * smokeVal + 0.69154 * dmVal;
    riskPct = (1 - Math.pow(0.95012, Math.exp(sumBeta - 26.1931))) * 100;
  }

  return Math.max(0, Math.min(riskPct, 100));
}

export function calcObstetricIG(data: {
  dum?: string;
  usgDate?: string;
  usgWeeks?: number;
  usgDays?: number;
  targetDate?: string;
}) {
  const target = data.targetDate ? new Date(data.targetDate + 'T00:00:00') : new Date();
  target.setHours(0, 0, 0, 0);

  let totalDays = 0;
  let source: 'DUM' | 'USG' = 'DUM';

  if (data.usgDate && data.usgWeeks !== undefined) {
    const usgDate = new Date(data.usgDate + 'T00:00:00');
    const usgTotalDays = (data.usgWeeks * 7) + (data.usgDays || 0);
    const diffFromUsg = Math.floor((target.getTime() - usgDate.getTime()) / 86400000);
    totalDays = usgTotalDays + diffFromUsg;
    source = 'USG';
  } else if (data.dum) {
    const dumDate = new Date(data.dum + 'T00:00:00');
    totalDays = Math.floor((target.getTime() - dumDate.getTime()) / 86400000);
    source = 'DUM';
  } else {
    return null;
  }

  if (totalDays < 0 || totalDays > 300) return null;

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  
  let dpp: Date;
  if (data.dum) {
    const dumDate = new Date(data.dum + 'T00:00:00');
    dpp = new Date(dumDate.getTime() + 280 * 86400000);
  } else {
    const usgDate = new Date(data.usgDate + 'T00:00:00');
    const usgTotalDays = (data.usgWeeks! * 7) + (data.usgDays || 0);
    const estimatedDum = new Date(usgDate.getTime() - usgTotalDays * 86400000);
    dpp = new Date(estimatedDum.getTime() + 280 * 86400000);
  }

  let trimester = "";
  if (weeks < 14) trimester = "1º Trimestre";
  else if (weeks < 28) trimester = "2º Trimestre";
  else trimester = "3º Trimestre";

  return { weeks, days, dpp, trimester, source };
}

export function calcMaternalRisk(data: {
  age: number;
  g: number;
  p: number;
  a: number;
  c: number;
  hb: number;
  glicemia: number;
  gemelar: boolean;
}) {
  const factors = [];
  let score = 0;

  if (data.age < 18) { factors.push("Adolescência (< 18 anos)"); score += 1; }
  if (data.age > 35) { factors.push("Idade Materna Avançada (> 35 anos)"); score += 2; }
  if (data.g > 5) { factors.push("Grande Multipariedade (G > 5)"); score += 2; }
  if (data.c > 0) { factors.push("Cesárea Prévia"); score += 1; }
  if (data.hb > 0 && data.hb < 11) { factors.push("Anemia (Hb < 11 g/dL)"); score += 2; }
  if (data.glicemia > 92) { factors.push("Risco de Diabetes Gestacional (Glicemia > 92 mg/dL)"); score += 2; }
  if (data.gemelar) { factors.push("Gravidez Gemelar"); score += 3; }

  let level: 'Baixo' | 'Intermediário' | 'Alto' = 'Baixo';
  if (score >= 4) level = 'Alto';
  else if (score >= 2) level = 'Intermediário';

  return { score, factors, level };
}

export function calcGrowthZScore(ageMonths: number, sex: 'M' | 'F', weight?: number, height?: number) {
  // Simplified WHO 2006 logic (actual implementation would need full LMS tables)
  // This is a placeholder for the logic in the original HTML
  return { weightZ: 0, heightZ: 0, bmiZ: 0 };
}
