// LMS helper for Z-score calculation
export function lmsZ(x: number, L: number, M: number, S: number): number {
  if (!isFinite(x) || !isFinite(M) || M <= 0) return NaN;
  let z;
  if (Math.abs(L) < 1e-6) z = Math.log(x / M) / S;
  else z = (Math.pow(x / M, L) - 1) / (L * S);
  
  // WHO adjustment for extreme z
  if (z > 3) {
    const sd3p = M * Math.pow(1 + L * S * 3, 1 / L);
    const sd2p = M * Math.pow(1 + L * S * 2, 1 / L);
    return 3 + (x - sd3p) / (sd3p - sd2p);
  }
  if (z < -3) {
    const sd3n = M * Math.pow(1 + L * S * (-3), 1 / L);
    const sd2n = M * Math.pow(1 + L * S * (-2), 1 / L);
    return -3 + (x - sd3n) / (sd2n - sd3n);
  }
  return z;
}

// Linear interpolation in sorted [age, ...] table
export function interpLMS(tbl: number[][], ageM: number): number[] | null {
  if (!tbl || !tbl.length) return null;
  if (ageM <= tbl[0][0]) return tbl[0].slice(1);
  if (ageM >= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1].slice(1);
  for (let i = 0; i < tbl.length - 1; i++) {
    if (ageM >= tbl[i][0] && ageM <= tbl[i + 1][0]) {
      const t = (ageM - tbl[i][0]) / (tbl[i + 1][0] - tbl[i][0]);
      return tbl[i].slice(1).map((v, k) => v + t * (tbl[i + 1][k + 1] - v));
    }
  }
  return null;
}

// Standard normal CDF
export function zToPct(z: number): number {
  if (!isFinite(z)) return NaN;
  const az = Math.abs(z);
  const t  = 1 / (1 + 0.2316419 * az);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * az * az) * poly;
  return (z < 0 ? 1 - p : p) * 100;
}

// CKD-EPI 2021 eGFR
export function calcCKDEPI2021(creat: number, age: number, sex: string): number | null {
  if (!age || !sex || isNaN(creat) || creat <= 0 || age < 18) return null;
  const isMale = sex === 'M';
  const kappa = isMale ? 0.9 : 0.7;
  const alpha = isMale ? -0.207 : -0.248;
  const ratio = creat / kappa;
  const minRatio = Math.min(ratio, 1);
  const maxRatio = Math.max(ratio, 1);
  let egfr = 142 * Math.pow(minRatio, alpha) * Math.pow(maxRatio, -1.200) * Math.pow(0.9938, age);
  if (!isMale) egfr *= 1.012;
  return Math.round(Math.max(0, egfr));
}

// SCORE2 / SCORE2-OP (ESC 2021) - Simplified logic from snippet
export function calcSCORE2(age: number, sex: string, pas: number, nonHDL: number, isSmoker: boolean, isDM: boolean): { score: number, category: string, label: string } | null {
  if (age < 40 || age > 89 || isNaN(nonHDL)) return null;
  const isMale = sex === 'M';
  const sm = isSmoker ? 1 : 0;
  let scorePct = 0;
  let label = '';

  if (age <= 69) {
    label = 'SCORE2';
    const age_c = (age - 60) / 5;
    const sbp_c = (pas - 120) / 20;
    const nHDL_c = (nonHDL / 38.67) - 3.31;
    let lp;
    if (isMale) {
      lp = 0.3742*age_c + 0.6012*sm + 0.2777*sbp_c + 0.1458*nHDL_c - 0.0755*age_c*sm - 0.0255*age_c*sbp_c - 0.0281*age_c*nHDL_c;
      scorePct = (1 - Math.pow(0.9336, Math.exp(lp + 0.5379))) * 100;
    } else {
      lp = 0.4648*age_c + 0.7744*sm + 0.3131*sbp_c + 0.1002*nHDL_c - 0.1088*age_c*sm - 0.0277*age_c*sbp_c - 0.0226*age_c*nHDL_c;
      scorePct = (1 - Math.pow(0.9503, Math.exp(lp + 0.7613))) * 100;
    }
  } else {
    label = 'SCORE2-OP';
    const age_c = age - 73;
    const sbp_c = (pas - 160) / 20;
    const nHDL_c = (nonHDL / 38.67) - 3.83;
    const dmV = isDM ? 1 : 0;
    let lp;
    if (isMale) {
      lp = 0.0634*age_c + 0.3524*sm + 0.2908*sbp_c + 0.1320*nHDL_c + 0.3261*dmV;
      scorePct = (1 - Math.pow(0.7329, Math.exp(lp - 0.6158))) * 100;
    } else {
      lp = 0.0869*age_c + 0.4878*sm + 0.2476*sbp_c + 0.1255*nHDL_c + 0.2714*dmV;
      scorePct = (1 - Math.pow(0.8275, Math.exp(lp - 0.6615))) * 100;
    }
  }

  let category = '';
  const [lo, hi] = age < 50 ? [2.5, 7.5] : age < 70 ? [5, 10] : [7.5, 15];
  if (scorePct < lo) category = 'Baixo';
  else if (scorePct < hi) category = 'Moderado';
  else if (scorePct < hi * 2) category = 'Alto';
  else category = 'Muito Alto';

  return { score: parseFloat(scorePct.toFixed(1)), category, label };
}
