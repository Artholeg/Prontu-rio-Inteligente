export interface PatientData {
  name: string;
  dob: string;
  age: string;
  sex: string;
  weight: string;
  height: string;
  bmi: string;
  doctor: string;
  date: string;
}

export interface SoapData {
  s: {
    qp: string;
    hda: string;
    iss: string;
    hpp: string;
    hf: string;
    mu: string;
    hv: string;
    hgo: string;
  };
  o: {
    sv: string;
    ecto: string;
    ac: string;
    ap: string;
    abd: string;
    pele: string;
    neuro: string;
    ocular: string;
    oto: string;
    oro: string;
    ext: string;
    lab: string;
    img: string;
  };
  a: string;
  p: string;
}

export interface CodeItem {
  code: string;
  name: string;
  type: string;
  field: string;
  confidence?: number;
  reasoning?: string;
}

export interface AppState {
  patient: PatientData;
  soap: SoapData;
  codes: CodeItem[];
  theme: 'light' | 'dark';
  puericultura?: PuericulturaData;
  hebiatria?: HebiatriaData;
  obsData?: ExpandedObsData;
  cvData?: ExpandedCvData;
}

export interface PuericulturaData {
  dob: string;
  consulta: string;
  igNasc: string;
  ageManual: string;
  ageUnit: 'months' | 'years';
  ageM: string;
  sex: string;
  peso: string;
  alt: string;
  pc: string;
  gaWeeks?: string;
  gaDays?: string;
  dum?: string;
}

export interface HebiatriaData {
  h: string;
  e1: string;
  e2: string;
  a: string;
  d: string;
  s1: string;
  s2: string;
  s3: string;
  sigilo: string;
  screenTime: string;
  sleepHours: string;
}

export interface ExpandedObsData {
  dum: string;
  usgDate: string;
  usg1TrimDate: string;
  usg1TrimSem: string;
  usg1TrimDias: string;
  usgSem: string;
  usgDias: string;
  g: string;
  p: string;
  a: string;
  c: string;
  afu: string;
  bcf: string;
  movFetal: string;
  edema: string;
  preWeight: string;
  gestWeight: string;
  altura: string;
  gemelar: 'N' | 'S';
  hb: string;
  ht: string;
  triAnemia: string;
  glicemia: string;
  tirTri: string;
  tirTSH: string;
  tirT4L: string;
  tirTPO: string;
  peAlto: string[];
  peMod: string[];
  // Risk Stratification
  socioeconomicRisk: string[];
  previousReproductiveRisk: string[];
  currentObstetricRisk: string[];
  previousClinicalRisk: string[];
}

export interface ExpandedCvData {
  ct: string;
  hdl: string;
  ldl: string;
  tg: string;
  hba1c: string;
  glicemia: string;
  creatinina: string;
  tfg: string;
  pas: string;
  pad: string;
  tabagismo: string;
  dm: string;
  antiHAS: string;
  fc: string;
  riskPct: string;
  agravantes: string[];
  age?: string;
  sex?: string;
}
