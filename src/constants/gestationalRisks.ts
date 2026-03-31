export interface RiskFactor {
  id: string;
  label: string;
  score: number;
  category: 'socioeconomic' | 'previousReproductive' | 'currentObstetric' | 'previousClinical';
}

export const GESTATIONAL_RISK_FACTORS: RiskFactor[] = [
  // Socioeconomic / Individual
  { id: 'age_lt_15', label: 'Idade < 15 anos', score: 2, category: 'socioeconomic' },
  { id: 'age_gt_40', label: 'Idade > 40 anos', score: 2, category: 'socioeconomic' },
  { id: 'black_race', label: 'Mulher de raça negra', score: 1, category: 'socioeconomic' },
  { id: 'low_education', label: 'Baixa escolaridade (< 5 anos)', score: 1, category: 'socioeconomic' },
  { id: 'smoker', label: 'Tabagista ativo', score: 2, category: 'socioeconomic' },
  { id: 'violence', label: 'Indícios de violência', score: 2, category: 'socioeconomic' },
  { id: 'homeless_indigenous', label: 'Situação de rua / Comunidades tradicionais', score: 2, category: 'socioeconomic' },
  { id: 'low_bmi', label: 'Baixo peso (IMC < 18)', score: 2, category: 'socioeconomic' },
  { id: 'overweight', label: 'Sobrepeso (IMC 25-29.9)', score: 1, category: 'socioeconomic' },
  { id: 'obesity', label: 'Obesidade (IMC 30-39.9)', score: 4, category: 'socioeconomic' },
  { id: 'obesity_g3', label: 'Obesidade grau 3 (IMC ≥ 40)', score: 10, category: 'socioeconomic' },

  // Previous Reproductive History
  { id: 'abortions', label: '2 abortos consecutivos ou 3 não consecutivos', score: 2, category: 'previousReproductive' },
  { id: 'prematurity_prev', label: 'Prematuridade anterior', score: 2, category: 'previousReproductive' },
  { id: 'prematurity_gt1', label: '> 1 parto prematuro (< 36 sem)', score: 10, category: 'previousReproductive' },
  { id: 'rciu_prev', label: 'RCIU anterior', score: 2, category: 'previousReproductive' },
  { id: 'stillbirth', label: 'Natimorto sem causa determinada', score: 10, category: 'previousReproductive' },
  { id: 'cervical_incompetence', label: 'Incompetência Istmo Cervical', score: 10, category: 'previousReproductive' },
  { id: 'rh_isoimmunization_prev', label: 'Isoimunização Rh', score: 5, category: 'previousReproductive' },
  { id: 'preeclampsia_bad_outcome', label: 'Pré-eclâmpsia com resultado obstétrico ruim', score: 10, category: 'previousReproductive' },
  { id: 'postpartum_psychosis', label: 'Psicose puerperal anterior', score: 10, category: 'previousReproductive' },
  { id: 'transplant', label: 'Transplante', score: 5, category: 'previousReproductive' },
  { id: 'bariatric_lt_6m', label: 'Cirurgia bariátrica < 6 meses', score: 10, category: 'previousReproductive' },
  { id: 'placenta_accreta_prev', label: 'Acretismo placentário', score: 2, category: 'previousReproductive' },

  // Current Obstetric Complications
  { id: 'hypertensive_disease', label: 'Doença Hipertensiva / Pré-eclâmpsia', score: 10, category: 'currentObstetric' },
  { id: 'gestational_diabetes_uncontrolled', label: 'Diabetes Gestacional não compensada', score: 10, category: 'currentObstetric' },
  { id: 'recurrent_uti', label: 'ITU de repetição (3x+) ou alta', score: 10, category: 'currentObstetric' },
  { id: 'renal_calculi_obstructive', label: 'Cálculo renal com obstrução', score: 10, category: 'currentObstetric' },
  { id: 'rciu_current', label: 'RCIU', score: 10, category: 'currentObstetric' },
  { id: 'macrosomia_current', label: 'Feto > p90 ou macrossomia', score: 10, category: 'currentObstetric' },
  { id: 'poly_oligo_hydramnios', label: 'Poli/Oligoidrâmnio', score: 10, category: 'currentObstetric' },
  { id: 'short_cervix', label: 'Colo curto (20-24 sem)', score: 10, category: 'currentObstetric' },
  { id: 'placenta_accreta_suspect', label: 'Suspeita de acretismo', score: 10, category: 'currentObstetric' },
  { id: 'placenta_previa', label: 'Placenta prévia (> 28 sem)', score: 10, category: 'currentObstetric' },
  { id: 'hepatopathies_current', label: 'Hepatopatias', score: 10, category: 'currentObstetric' },
  { id: 'severe_anemia_current', label: 'Anemia grave ou refratária', score: 10, category: 'currentObstetric' },
  { id: 'rh_isoimmunization_current', label: 'Isoimunização Rh', score: 10, category: 'currentObstetric' },
  { id: 'maternal_cancer', label: 'Câncer materno', score: 10, category: 'currentObstetric' },
  { id: 'gynecological_neoplasms', label: 'Neoplasias ginecológicas', score: 10, category: 'currentObstetric' },
  { id: 'breast_cancer_suspect', label: 'Suspeita de câncer de mama', score: 10, category: 'currentObstetric' },
  { id: 'cervical_lesion_high_grade', label: 'Lesão de alto grau colo (NIC II-III)', score: 10, category: 'currentObstetric' },
  { id: 'fetal_malformation_suspect', label: 'Suspeita malformação fetal/arritmia', score: 10, category: 'currentObstetric' },
  { id: 'gemelaridade_current', label: 'Gemelaridade', score: 10, category: 'currentObstetric' },
  { id: 'syphilis_complex', label: 'Sífilis (terciária/resistente/congênita)', score: 10, category: 'currentObstetric' },
  { id: 'condyloma_extensive', label: 'Condiloma acuminado extenso', score: 10, category: 'currentObstetric' },
  { id: 'acute_hepatitis', label: 'Hepatites agudas', score: 10, category: 'currentObstetric' },
  { id: 'leprosy', label: 'Hanseníase', score: 10, category: 'currentObstetric' },
  { id: 'aids_hiv', label: 'AIDS/HIV', score: 10, category: 'currentObstetric' },
  { id: 'tuberculosis', label: 'Tuberculose', score: 10, category: 'currentObstetric' },
  { id: 'toxo_rubella_cmv', label: 'Toxoplasmose/Rubéola/CMV', score: 10, category: 'currentObstetric' },
  { id: 'drug_dependence', label: 'Dependência drogas', score: 10, category: 'currentObstetric' },
  { id: 'decompensated_endocrinopathies', label: 'Endocrinopatias descompensadas', score: 10, category: 'currentObstetric' },
  { id: 'dengue_zika_chik', label: 'Dengue/Zika/Chikungunya', score: 5, category: 'currentObstetric' },
  { id: 'covid19', label: 'COVID-19', score: 5, category: 'currentObstetric' },

  // Previous Clinical Conditions
  { id: 'hypertension_uncontrolled', label: 'HAS descompensada', score: 10, category: 'previousClinical' },
  { id: 'diabetes_type1_2', label: 'DM 1 ou 2', score: 10, category: 'previousClinical' },
  { id: 'thyroid_disease', label: 'Tireoidopatias', score: 10, category: 'previousClinical' },
  { id: 'severe_psychiatric_disease', label: 'Doença Psiquiátrica Grave', score: 10, category: 'previousClinical' },
  { id: 'hematological_diseases', label: 'Doenças hematológicas', score: 10, category: 'previousClinical' },
  { id: 'cardiopathies', label: 'Cardiopatias', score: 10, category: 'previousClinical' },
  { id: 'severe_pneumopathies', label: 'Pneumopatias Graves', score: 10, category: 'previousClinical' },
  { id: 'autoimmune_diseases', label: 'Doenças Auto-imunes', score: 10, category: 'previousClinical' },
  { id: 'teratogenic_drugs', label: 'Medicamentos teratogênicos', score: 10, category: 'previousClinical' },
  { id: 'severe_renal_disease', label: 'Doença Renal Grave', score: 10, category: 'previousClinical' },
  { id: 'severe_anemia_prev', label: 'Hemopatias e Anemia grave (< 8g/dl)', score: 10, category: 'previousClinical' },
  { id: 'chronic_hepatopathies', label: 'Hepatopatias crônicas', score: 10, category: 'previousClinical' },
];
