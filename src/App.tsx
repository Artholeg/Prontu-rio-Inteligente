import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  Activity, 
  Baby, 
  Stethoscope, 
  LayoutDashboard, 
  ShieldCheck, 
  Save, 
  Moon, 
  Sun,
  ChevronDown,
  Plus,
  Trash2,
  Download,
  Upload,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileText,
  Cloud,
  User as UserIcon,
  Hash,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { 
  PatientData, 
  SoapData, 
  CodeItem, 
  AppState,
  PuericulturaData,
  HebiatriaData,
  ExpandedObsData,
  ExpandedCvData
} from './types';
import { 
  GESTATIONAL_RISK_FACTORS, 
  RiskFactor 
} from './constants/gestationalRisks';

const Badge = ({ label, color }: { label: string, color: string }) => (
  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider", color)}>
    {label}
  </span>
);
import { analyzeClinicalText, checkInteractions, runAudit, searchCodes, generateSummary } from './services/aiService';
import { calcFramingham, calcObstetricIG, calcMaternalRisk } from './services/clinicalCalculators';
import jsPDF from 'jspdf';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';

const initialSoap: SoapData = {
  s: { qp: '', hda: '', iss: '', hpp: '', hf: '', mu: '', hv: '', hgo: '' },
  o: { sv: '', ecto: '', ac: '', ap: '', abd: '', pele: '', neuro: '', ocular: '', oto: '', oro: '', ext: '', lab: '', img: '' },
  a: '',
  p: ''
};

const initialPatient: PatientData = {
  name: '', dob: '', age: '', sex: '', weight: '', height: '', bmi: '', doctor: '', date: new Date().toISOString().split('T')[0]
};

const initialPuericultura: PuericulturaData = {
  dob: '', consulta: '', igNasc: '', ageManual: '', ageUnit: 'months', ageM: '', sex: '', peso: '', alt: '', pc: '', gaWeeks: '', gaDays: '', dum: ''
};

const initialHebiatria: HebiatriaData = {
  h: '', e1: '', e2: '', a: '', d: '', s1: '', s2: '', s3: '', sigilo: '', screenTime: '', sleepHours: ''
};

const initialExpandedObs: ExpandedObsData = {
  dum: '', usgDate: '', usg1TrimDate: '', usg1TrimSem: '', usg1TrimDias: '', usgSem: '', usgDias: '', g: '', p: '', a: '', c: '', afu: '', bcf: '', movFetal: '', edema: '',
  preWeight: '', gestWeight: '', altura: '', gemelar: 'N', hb: '', ht: '', triAnemia: '', glicemia: '',
  tirTri: '', tirTSH: '', tirT4L: '', tirTPO: '', peAlto: [], peMod: [],
  socioeconomicRisk: [], previousReproductiveRisk: [], currentObstetricRisk: [], previousClinicalRisk: []
};

const initialExpandedCv: ExpandedCvData = {
  ct: '', hdl: '', ldl: '', tg: '', hba1c: '', glicemia: '', creatinina: '', tfg: '', pas: '', pad: '',
  tabagismo: '0', dm: '0', antiHAS: '0', fc: '', riskPct: '', agravantes: [],
  age: '', sex: ''
};

import { 
  lmsZ, 
  interpLMS, 
  zToPct, 
  calcCKDEPI2021, 
  calcSCORE2 
} from './lib/clinical';
import * as who from './lib/whoTables';
import { CID11_MENTAL_HEALTH } from './lib/cid11';

const navItems = [
  { id: 'paciente', label: 'Paciente', icon: UserIcon },
  { id: 'soap', label: 'SOAP', icon: Stethoscope },
  { id: 'codigos', label: 'Códigos', icon: Hash },
  { id: 'analises', label: 'Análises', icon: Activity },
  { id: 'gestacional', label: 'Gestacional', icon: Baby },
  { id: 'puericultura', label: 'Puericultura', icon: Baby },
  { id: 'hebiatria', label: 'Hebiatria', icon: Users },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'historico', label: 'Histórico', icon: ClipboardList },
  { id: 'auditoria', label: 'Auditoria', icon: ShieldCheck },
  { id: 'resumo', label: 'Resumo', icon: FileText },
  { id: 'exportacao', label: 'Exportação', icon: Download },
  { id: 'capacidades', label: 'Capacidades', icon: Info },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('prontuario_state');
    if (saved) return JSON.parse(saved);
    return {
      patient: initialPatient,
      soap: initialSoap,
      codes: [],
      theme: 'light',
      puericultura: initialPuericultura,
      hebiatria: initialHebiatria,
      obsData: initialExpandedObs,
      cvData: initialExpandedCv
    };
  });

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, any[]>>({});
  const [auditResult, setAuditResult] = useState<any>(null);
  const [summary, setSummary] = useState('');
  const [interactions, setInteractions] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string, type: 'info' | 'success' | 'error' } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [consultations, setConsultations] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) {
        const userDoc = doc(db, 'users', u.uid);
        getDoc(userDoc).then(docSnap => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            if (userData.theme) {
              setState(prev => ({ ...prev, theme: userData.theme }));
            }
          } else {
            setDoc(userDoc, {
              email: u.email,
              displayName: u.displayName,
              theme: state.theme
            });
          }
        });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const q = query(
        collection(db, 'consultations'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setConsultations(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'consultations');
      });
      return unsubscribe;
    }
  }, [user]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    localStorage.setItem('prontuario_state', JSON.stringify(state));
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
  }, [state]);

  useEffect(() => {
    if (state.puericultura?.dob) {
      let diffDays = -1;
      
      if (state.puericultura.dum) {
        // Idade Gestacional ao Nascer (dob - dum)
        const birth = new Date(state.puericultura.dob + 'T00:00:00');
        const dum = new Date(state.puericultura.dum + 'T00:00:00');
        diffDays = Math.floor((birth.getTime() - dum.getTime()) / (1000 * 60 * 60 * 24));
      } else if (state.patient.date) {
        // Idade Pós-natal (consulta - dob) como fallback
        const birth = new Date(state.puericultura.dob + 'T00:00:00');
        const consultation = new Date(state.patient.date + 'T00:00:00');
        diffDays = Math.floor((consultation.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      if (diffDays >= 0) {
        const weeks = Math.floor(diffDays / 7);
        const days = diffDays % 7;
        
        if (state.puericultura.gaWeeks !== weeks.toString() || state.puericultura.gaDays !== days.toString()) {
          setState(prev => ({
            ...prev,
            puericultura: {
              ...prev.puericultura!,
              gaWeeks: weeks.toString(),
              gaDays: days.toString()
            }
          }));
        }
      }
    }
  }, [state.puericultura?.dob, state.puericultura?.dum, state.patient.date]);

  const toggleTheme = () => {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    setState(prev => ({ ...prev, theme: newTheme }));
    if (user) {
      setDoc(doc(db, 'users', user.uid), { theme: newTheme }, { merge: true });
    }
  };

  const updatePatient = (field: keyof PatientData, value: string) => {
    setState(prev => {
      const newPatient = { ...prev.patient, [field]: value };
      if (field === 'dob' && value) {
        const birth = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        newPatient.age = `${age} anos`;
      }
      if ((field === 'weight' || field === 'height') && newPatient.weight && newPatient.height) {
        const w = parseFloat(newPatient.weight);
        const h = parseFloat(newPatient.height);
        newPatient.bmi = (w / ((h / 100) ** 2)).toFixed(1);
      }
      return { ...prev, patient: newPatient };
    });
  };

  const updateSoap = (section: 's' | 'o', field: string, value: string) => {
    setState(prev => ({
      ...prev,
      soap: {
        ...prev.soap,
        [section]: { ...prev.soap[section], [field]: value }
      }
    }));
  };

  const updatePuericultura = (field: keyof PuericulturaData, value: string) => {
    if (field === 'dum' && value) {
      const dumDate = new Date(value + 'T00:00:00');
      const consultDate = new Date(state.patient.date + 'T00:00:00');
      if (isNaN(dumDate.getTime())) {
        setNotification({ message: 'Data de DUM inválida.', type: 'error' });
        return;
      }
      if (dumDate > consultDate) {
        setNotification({ message: 'A DUM deve ser anterior à data da consulta.', type: 'error' });
        return;
      }
    }
    setState(prev => {
      const newState = {
        ...prev,
        puericultura: { ...prev.puericultura!, [field]: value }
      };
      if (field === 'dum' && prev.obsData) {
        newState.obsData = { ...prev.obsData, dum: value };
      }
      return newState;
    });
  };

  const updateHebiatria = (field: keyof HebiatriaData, value: string) => {
    if (field === 'screenTime' || field === 'sleepHours') {
      if (value !== '') {
        const num = parseFloat(value);
        if (isNaN(num) || num < 0 || num > 24) {
          setNotification({ message: 'Insira um valor numérico válido entre 0 e 24.', type: 'error' });
          return;
        }
      }
    } else if (value.length > 2000) {
      setNotification({ message: 'O texto inserido excede o limite de 2000 caracteres.', type: 'error' });
      return;
    }
    setState(prev => ({
      ...prev,
      hebiatria: { ...prev.hebiatria!, [field]: value }
    }));
  };

  const updateObsData = (field: keyof ExpandedObsData, value: any) => {
    setState(prev => {
      const newState = {
        ...prev,
        obsData: { ...prev.obsData!, [field]: value }
      };
      if (field === 'dum' && prev.puericultura) {
        newState.puericultura = { ...prev.puericultura, dum: value };
      }
      return newState;
    });
  };

  const updateCvData = (field: keyof ExpandedCvData, value: any) => {
    setState(prev => ({
      ...prev,
      cvData: { ...prev.cvData!, [field]: value }
    }));
  };

  const addCode = (code: CodeItem) => {
    if (state.codes.some(c => c.code === code.code)) {
      setNotification({ message: 'Código já selecionado.', type: 'info' });
      return;
    }
    setState(prev => ({ ...prev, codes: [...prev.codes, code] }));
    setNotification({ message: `Código ${code.code} adicionado.`, type: 'success' });
  };

  const removeCode = (code: string) => {
    setState(prev => ({ ...prev, codes: prev.codes.filter(c => c.code !== code) }));
  };

  const handleAnalyze = async (field: 's' | 'o' | 'a' | 'p') => {
    let text = '';
    if (field === 's') {
      // Foco explícito em Queixa Principal e HDA
      text = `QUEIXA PRINCIPAL: ${state.soap.s.qp}\nHDA: ${state.soap.s.hda}\n`;
      // Adiciona outros campos como contexto secundário
      const context = Object.entries(state.soap.s)
        .filter(([k]) => k !== 'qp' && k !== 'hda')
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
        .join('\n');
      text += `CONTEXTO ADICIONAL:\n${context}`;
    } else if (field === 'o') {
      text = Object.entries(state.soap.o)
        .map(([k, v]) => `${k.toUpperCase()}: ${v}`)
        .join('\n');
    } else {
      text = state.soap[field] as string;
    }

    if (!text.trim()) return;

    setLoading(prev => ({ ...prev, [field]: true }));
    const suggestions = await analyzeClinicalText(field, text, { patient: state.patient });
    setAiSuggestions(prev => ({ ...prev, [field]: suggestions }));
    setLoading(prev => ({ ...prev, [field]: false }));
    setNotification({ message: `Sugestões para ${field.toUpperCase()} geradas.`, type: 'success' });
  };

  const handleAudit = async () => {
    setLoading(prev => ({ ...prev, audit: true }));
    const result = await runAudit(state);
    setAuditResult(result);
    setLoading(prev => ({ ...prev, audit: false }));
    setNotification({ message: 'Auditoria concluída com sucesso!', type: 'success' });
  };

  const handleSearchCodes = async () => {
    if (!searchQuery.trim()) return;
    setLoading(prev => ({ ...prev, search: true }));
    const results = await searchCodes(searchQuery);
    setSearchResults(results);
    setLoading(prev => ({ ...prev, search: false }));
    if (results.length === 0) {
      setNotification({ message: 'Nenhum código encontrado.', type: 'info' });
    }
  };

  const handleGenerateSummary = async () => {
    setLoading(prev => ({ ...prev, summary: true }));
    const result = await generateSummary(state);
    setSummary(result);
    setLoading(prev => ({ ...prev, summary: false }));
    setNotification({ message: 'Resumo gerado com sucesso!', type: 'success' });
  };

  const handleCheckInteractions = async () => {
    if (!state.soap.p) {
      setNotification({ message: 'Preencha o Plano para verificar interações.', type: 'info' });
      return;
    }
    setLoading(prev => ({ ...prev, interactions: true }));
    const result = await checkInteractions(state.soap.p);
    setInteractions(result);
    setLoading(prev => ({ ...prev, interactions: false }));
    setNotification({ message: 'Verificação de interações concluída.', type: 'success' });
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Prontuário Médico", 20, 20);
    doc.setFontSize(12);
    doc.text(`Paciente: ${state.patient.name}`, 20, 30);
    doc.text(`Data: ${state.patient.date}`, 20, 40);
    doc.save(`prontuario_${state.patient.name}.pdf`);
    setNotification({ message: 'PDF exportado com sucesso!', type: 'success' });
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `prontuario_${state.patient.name || 'paciente'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setNotification({ message: 'JSON exportado com sucesso!', type: 'success' });
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedState = JSON.parse(event.target?.result as string);
        setState(importedState);
        setNotification({ message: 'Prontuário importado com sucesso!', type: 'success' });
      } catch (error) {
        setNotification({ message: 'Erro ao importar arquivo JSON.', type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  const saveToFirestore = async () => {
    if (!user) {
      setNotification({ message: 'Faça login para salvar na nuvem.', type: 'info' });
      return;
    }
    if (!state.patient.name) {
      setNotification({ message: 'Nome do paciente é obrigatório.', type: 'error' });
      return;
    }

    setLoading(prev => ({ ...prev, save: true }));
    try {
      await addDoc(collection(db, 'consultations'), {
        userId: user.uid,
        patient: state.patient,
        soap: state.soap,
        codes: state.codes,
        cvData: state.cvData,
        obsData: state.obsData,
        puericultura: state.puericultura,
        hebiatria: state.hebiatria,
        createdAt: new Date().toISOString()
      });
      setNotification({ message: 'Consulta salva no Firestore!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'consultations');
    } finally {
      setLoading(prev => ({ ...prev, save: false }));
    }
  };

  const loadConsultation = (c: any) => {
    setState(prev => ({
      ...prev,
      patient: c.patient,
      soap: c.soap,
      codes: c.codes,
      cvData: c.cvData || initialExpandedCv,
      obsData: c.obsData || initialExpandedObs,
      puericultura: c.puericultura || initialPuericultura,
      hebiatria: c.hebiatria || initialHebiatria
    }));
    setNotification({ message: `Consulta de ${c.patient.name} carregada.`, type: 'success' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cvRisk = state.patient.age && state.patient.sex && state.cvData?.ct && state.cvData?.hdl && state.cvData?.pas ? 
    calcFramingham({
      age: parseInt(state.patient.age),
      sex: state.patient.sex as 'M' | 'F',
      ct: parseFloat(state.cvData.ct),
      hdl: parseFloat(state.cvData.hdl),
      pas: parseFloat(state.cvData.pas),
      isSmoker: state.cvData.tabagismo === '1',
      isDM: state.cvData.dm === '1',
      isTreated: state.cvData.antiHAS === '1'
    }) : null;

  const ig = state.obsData ? calcObstetricIG({
    dum: state.obsData.dum,
    usgDate: state.obsData.usg1TrimDate,
    usgWeeks: parseInt(state.obsData.usg1TrimSem) || undefined,
    usgDays: parseInt(state.obsData.usg1TrimDias) || undefined
  }) : null;

  const igDiscrepancy = (state.obsData?.dum && state.obsData?.usg1TrimDate && state.obsData?.usg1TrimSem) ? (() => {
    const igFromDum = calcObstetricIG({ dum: state.obsData.dum, targetDate: state.obsData.usg1TrimDate });
    if (!igFromDum) return null;
    const expectedDays = (igFromDum.weeks * 7) + igFromDum.days;
    const actualDays = (parseInt(state.obsData.usg1TrimSem) * 7) + (parseInt(state.obsData.usg1TrimDias) || 0);
    const diff = Math.abs(expectedDays - actualDays);
    if (diff > 7) return `Divergência de ${diff} dias entre DUM e USG 1ºT`;
    return null;
  })() : null;

  const currentUsgDiscrepancy = (state.obsData?.usgDate && state.obsData?.usgSem && ig) ? (() => {
    const expectedAtUsgDate = calcObstetricIG({
      dum: state.obsData.dum,
      usgDate: state.obsData.usg1TrimDate,
      usgWeeks: parseInt(state.obsData.usg1TrimSem) || undefined,
      usgDays: parseInt(state.obsData.usg1TrimDias) || undefined,
      targetDate: state.obsData.usgDate
    });
    if (!expectedAtUsgDate) return null;
    const expectedDays = (expectedAtUsgDate.weeks * 7) + expectedAtUsgDate.days;
    const actualDays = (parseInt(state.obsData.usgSem) * 7) + (parseInt(state.obsData.usgDias) || 0);
    const diff = Math.abs(expectedDays - actualDays);
    if (diff > 7) return `Divergência de ${diff} dias entre IG esperada e USG Atual`;
    return null;
  })() : null;

  const gestationalRisk = (() => {
    if (!state.obsData) return { score: 0, level: 'Baixo', flow: 'APS' };
    
    const selectedIds = [
      ...(state.obsData.socioeconomicRisk || []),
      ...(state.obsData.previousReproductiveRisk || []),
      ...(state.obsData.currentObstetricRisk || []),
      ...(state.obsData.previousClinicalRisk || [])
    ];

    let score = 0;
    selectedIds.forEach(id => {
      const factor = GESTATIONAL_RISK_FACTORS.find(f => f.id === id);
      if (factor) score += factor.score;
    });

    // Special case: Obesidade Grau 3 is direct high risk
    if (state.obsData.socioeconomicRisk?.includes('obesity_g3')) score = Math.max(score, 10);

    let level: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
    let flow = 'APS';

    if (score >= 10) {
      level = 'Alto';
      flow = 'Especializado + APS';
    } else if (score >= 5) {
      level = 'Médio';
      flow = 'APS + Especializado';
    } else {
      level = 'Baixo';
      flow = 'APS';
    }

    return { score, level, flow };
  })();

  const toggleRiskFactor = (category: keyof ExpandedObsData, factorId: string) => {
    const current = (state.obsData?.[category] as string[]) || [];
    const updated = current.includes(factorId)
      ? current.filter(id => id !== factorId)
      : [...current, factorId];
    updateObsData(category, updated);
  };

  // Puericultura Derived State
  const pueriAgeM = state.puericultura?.dob && state.patient.date ? (() => {
    const d1 = new Date(state.puericultura.dob);
    const d2 = new Date(state.patient.date);
    const months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + (d2.getDate() - d1.getDate()) / 30;
    return Math.max(0, months);
  })() : (state.puericultura?.ageManual ? (state.puericultura.ageUnit === 'years' ? parseFloat(state.puericultura.ageManual) * 12 : parseFloat(state.puericultura.ageManual)) : null);

  const pueriResults = (pueriAgeM !== null && state.puericultura?.sex) ? (() => {
    const results: any[] = [];
    const ageM = pueriAgeM;
    const isMale = state.puericultura.sex === 'M';
    const peso = parseFloat(state.puericultura.peso);
    const alt = parseFloat(state.puericultura.alt);
    const pc = parseFloat(state.puericultura.pc);

    if (!isNaN(peso)) {
      const tbl = ageM <= 60 ? (isMale ? who.W6B : who.W6G) : (isMale ? who.W7B : who.W7G);
      const params = interpLMS(tbl, ageM);
      if (params) {
        const z = lmsZ(peso, params[0], params[1], params[2]);
        results.push({ label: 'Peso/Idade', val: peso, unit: 'kg', z });
      }
    }
    if (!isNaN(alt)) {
      const tbl = ageM <= 60 ? (isMale ? who.H6B : who.H6G) : (isMale ? who.H7B : who.H7G);
      const params = interpLMS(tbl, ageM);
      if (params) {
        const z = lmsZ(alt, params[0], params[1], params[2]);
        results.push({ label: 'Estatura/Idade', val: alt, unit: 'cm', z });
      }
    }
    if (!isNaN(pc) && ageM <= 60) {
      const tbl = isMale ? who.HC6B : who.HC6G;
      const params = interpLMS(tbl, ageM);
      if (params) {
        const z = lmsZ(pc, params[0], params[1], params[2]);
        results.push({ label: 'PC/Idade', val: pc, unit: 'cm', z });
      }
    }
    return results;
  })() : [];

  return (
    <div className="min-h-screen bg-bg font-sans flex">
      {/* Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col w-64 bg-surf border-r border-border sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 bg-linear-to-br from-s-clr to-o-clr rounded-lg flex items-center justify-center text-white shadow-lg shrink-0">
            <ClipboardList size={18} />
          </div>
          <span className="font-serif font-bold text-lg truncate">Prontuário</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted hover:text-s-clr hover:bg-s-bg rounded-xl transition-all group"
            >
              <item.icon size={18} className="group-hover:scale-110 transition-transform" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-4">
          {authReady && user && (
            <div className="flex items-center gap-3 p-2 bg-surf-2 rounded-xl border border-border">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-border shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold truncate">{user.displayName}</span>
                <button onClick={logout} className="text-[10px] text-rose hover:underline text-left">Sair</button>
              </div>
            </div>
          )}
          <button 
            onClick={toggleTheme} 
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-muted hover:bg-surf-2 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              {state.theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              <span>Tema</span>
            </div>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation (Mobile/Tablet) */}
        <nav className="sticky top-0 z-50 bg-surf/80 backdrop-blur-md border-b border-border px-6 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-linear-to-br from-s-clr to-o-clr rounded-lg flex items-center justify-center text-white shadow-lg">
                <ClipboardList size={18} />
              </div>
              <span className="font-serif font-bold text-lg">Prontuário</span>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={toggleTheme} className="p-2 hover:bg-surf-2 rounded-full transition-colors">
                {state.theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto px-6 py-12 space-y-12 w-full">
        {/* Hero */}
        <section className="text-center space-y-4">
          <h1 className="text-4xl font-serif font-bold tracking-tight">
            Prontuário <span className="bg-linear-to-r from-s-clr to-o-clr bg-clip-text text-transparent">Inteligente</span>
          </h1>
          <p className="text-muted max-w-xl mx-auto">
            Documentação clínica SOAP com classificação assistida por inteligência artificial. 
            Codificação integrada CIAP-2, CID-10 e CID-11.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge label="CIAP-2" color="bg-ciap/10 text-ciap" />
            <Badge label="CID-10" color="bg-cid10/10 text-cid10" />
            <Badge label="CID-11" color="bg-cid11/10 text-cid11" />
            <Badge label="IA Claude" color="bg-green-500/10 text-green-600" />
          </div>
        </section>

        {/* Section 01: Patient */}
        <section id="paciente" className="space-y-6 scroll-mt-24">
          <SectionHeader num="01" title="Identificação" subtitle="Gestão de Dados Demográficos" />
          <div className="bg-surf border border-border rounded-2xl p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Paciente</label>
              <input 
                value={state.patient.name}
                onChange={e => updatePatient('name', e.target.value)}
                placeholder="Nome completo"
                className="w-full bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-2 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Nascimento</label>
              <input 
                type="date"
                value={state.patient.dob}
                onChange={e => updatePatient('dob', e.target.value)}
                className="w-full bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-2 transition-colors"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Data da Consulta</label>
              <input 
                type="date"
                value={state.patient.date}
                onChange={e => updatePatient('date', e.target.value)}
                className="w-full bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-2 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Sexo</label>
                <select 
                  value={state.patient.sex}
                  onChange={e => updatePatient('sex', e.target.value)}
                  className="w-full bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-2 transition-colors"
                >
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Idade</label>
                <input readOnly value={state.patient.age} className="w-full bg-transparent border-b-2 border-surf-3 py-2 text-muted cursor-default" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Peso (kg)</label>
                <input 
                  type="number"
                  value={state.patient.weight}
                  onChange={e => updatePatient('weight', e.target.value)}
                  className="w-full bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-2 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Altura (cm)</label>
                <input 
                  type="number"
                  value={state.patient.height}
                  onChange={e => updatePatient('height', e.target.value)}
                  className="w-full bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-2 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-dim">IMC</label>
                <input readOnly value={state.patient.bmi} className="w-full bg-transparent border-b-2 border-surf-3 py-2 font-bold text-center" />
              </div>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Médico(a)</label>
              <div className="flex gap-4">
                <input 
                  value={state.patient.doctor}
                  onChange={e => updatePatient('doctor', e.target.value)}
                  placeholder="Nome do profissional"
                  className="flex-1 bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-2 transition-colors"
                />
                <button 
                  onClick={saveToFirestore}
                  disabled={loading.save}
                  className="flex items-center gap-2 px-6 py-2 bg-linear-to-br from-s-clr to-o-clr text-white rounded-xl text-xs font-bold hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading.save ? <RefreshCcw className="animate-spin" size={14} /> : <Save size={14} />}
                  Salvar na Nuvem
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 02: SOAP */}
        <section id="soap" className="space-y-6 scroll-mt-24">
          <SectionHeader num="02" title="Registro Clínico" subtitle="Documentação Clínica SOAP" />
          
          <div className="space-y-4">
            {/* Subjetivo */}
            <SoapCard 
              letter="S" 
              title="Subjetivo" 
              subtitle="Queixa principal, HDA, Antecedentes"
              colorClass="sc-s"
              loading={loading.s}
              onAnalyze={() => handleAnalyze('s')}
            >
              <div className="grid gap-4">
                <SoapField label="Queixa Principal" value={state.soap.s.qp} onChange={v => updateSoap('s', 'qp', v)} />
                <SoapField label="História da Doença Atual" value={state.soap.s.hda} onChange={v => updateSoap('s', 'hda', v)} rows={4} />
                <SoapField label="Interrogatório sobre os Sistemas" value={state.soap.s.iss} onChange={v => updateSoap('s', 'iss', v)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SoapField label="HPP" value={state.soap.s.hpp} onChange={v => updateSoap('s', 'hpp', v)} />
                  <SoapField label="Histórico Familiar" value={state.soap.s.hf} onChange={v => updateSoap('s', 'hf', v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SoapField label="Medicamentos em Uso" value={state.soap.s.mu} onChange={v => updateSoap('s', 'mu', v)} />
                  <SoapField label="Hábitos de Vida" value={state.soap.s.hv} onChange={v => updateSoap('s', 'hv', v)} />
                  <SoapField label="Histórico Ginecobstétrico" value={state.soap.s.hgo} onChange={v => updateSoap('s', 'hgo', v)} />
                </div>
              </div>
              <AiSuggestions suggestions={aiSuggestions.s} onAdd={addCode} />
            </SoapCard>

            {/* Objetivo */}
            <SoapCard 
              letter="O" 
              title="Objetivo" 
              subtitle="Exame físico, Sinais vitais"
              colorClass="sc-o"
              loading={loading.o}
              onAnalyze={() => handleAnalyze('o')}
            >
              <div className="grid gap-4">
                <SoapField label="Sinais Vitais" value={state.soap.o.sv} onChange={v => updateSoap('o', 'sv', v)} placeholder="PA, FC, FR, Tax, SpO2" />
                <SoapField label="Ectoscopia" value={state.soap.o.ecto} onChange={v => updateSoap('o', 'ecto', v)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SoapField label="Aparelho Cardiovascular" value={state.soap.o.ac} onChange={v => updateSoap('o', 'ac', v)} />
                  <SoapField label="Aparelho Respiratório" value={state.soap.o.ap} onChange={v => updateSoap('o', 'ap', v)} />
                  <SoapField label="Abdome" value={state.soap.o.abd} onChange={v => updateSoap('o', 'abd', v)} />
                  <SoapField label="Pele e Anexos" value={state.soap.o.pele} onChange={v => updateSoap('o', 'pele', v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SoapField label="Neurológico" value={state.soap.o.neuro} onChange={v => updateSoap('o', 'neuro', v)} />
                  <SoapField label="Ocular" value={state.soap.o.ocular} onChange={v => updateSoap('o', 'ocular', v)} />
                  <SoapField label="Otorrino" value={state.soap.o.oto} onChange={v => updateSoap('o', 'oto', v)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SoapField label="Orofaringe" value={state.soap.o.oro} onChange={v => updateSoap('o', 'oro', v)} />
                  <SoapField label="Extremidades" value={state.soap.o.ext} onChange={v => updateSoap('o', 'ext', v)} />
                  <SoapField label="Laboratoriais" value={state.soap.o.lab} onChange={v => updateSoap('o', 'lab', v)} />
                </div>
                <SoapField label="Exames de Imagem" value={state.soap.o.img} onChange={v => updateSoap('o', 'img', v)} />
              </div>
              <AiSuggestions suggestions={aiSuggestions.o} onAdd={addCode} />
            </SoapCard>

            {/* Avaliação */}
            <SoapCard 
              letter="A" 
              title="Avaliação" 
              subtitle="Hipóteses diagnósticas"
              colorClass="sc-a"
              loading={loading.a}
              onAnalyze={() => handleAnalyze('a')}
              analyzeLabel="Codificar CID"
            >
              <textarea 
                value={state.soap.a}
                onChange={e => setState(prev => ({ ...prev, soap: { ...prev.soap, a: e.target.value } }))}
                className="w-full bg-surf-2 rounded-xl p-4 min-h-[120px] outline-none focus:ring-2 ring-a-clr/20 transition-all"
                placeholder="Raciocínio clínico e hipóteses..."
              />
              <AiSuggestions suggestions={aiSuggestions.a} onAdd={addCode} />
            </SoapCard>

            {/* Plano */}
            <SoapCard 
              letter="P" 
              title="Plano" 
              subtitle="Conduta, Prescrição, Retorno"
              colorClass="sc-p"
              loading={loading.p}
              onAnalyze={() => handleAnalyze('p')}
              analyzeLabel="Codificar CID/CIAP"
              extraAction={
                <button 
                  onClick={handleCheckInteractions}
                  disabled={loading.interactions}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-lg text-[10px] font-bold hover:bg-amber-500/20 transition-all disabled:opacity-50"
                >
                  {loading.interactions ? <RefreshCcw className="animate-spin" size={12} /> : <AlertTriangle size={12} />}
                  Interações
                </button>
              }
            >
              <textarea 
                value={state.soap.p}
                onChange={e => setState(prev => ({ ...prev, soap: { ...prev.soap, p: e.target.value } }))}
                className="w-full bg-surf-2 rounded-xl p-4 min-h-[150px] outline-none focus:ring-2 ring-p-clr/20 transition-all"
                placeholder="Conduta terapêutica e orientações..."
              />
              {interactions && interactions.interactions?.length > 0 && (
                <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-2">
                    <AlertTriangle size={12} /> Interações Detectadas
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    {interactions.interactions.map((inter: any, idx: number) => (
                      <div key={idx} className="p-3 bg-surf border border-amber-500/10 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold">{inter.drug1} + {inter.drug2}</p>
                          <Badge 
                            label={inter.severity.toUpperCase()} 
                            color={
                              inter.severity === 'bloqueio' ? 'bg-rose-500 text-white' :
                              inter.severity === 'grave' ? 'bg-orange-500 text-white' :
                              inter.severity === 'moderada' ? 'bg-amber-500 text-white' :
                              'bg-blue-500 text-white'
                            } 
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          <div>
                            <span className="font-bold text-dim uppercase text-[9px]">Efeito:</span>
                            <p className="text-muted">{inter.effect}</p>
                          </div>
                          <div>
                            <span className="font-bold text-dim uppercase text-[9px]">Mecanismo:</span>
                            <p className="text-muted">{inter.mechanism}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-amber-500/10">
                          <span className="font-bold text-amber-700 uppercase text-[9px]">Recomendação:</span>
                          <p className="text-amber-800 font-medium italic">{inter.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <AiSuggestions suggestions={aiSuggestions.p} onAdd={addCode} />
            </SoapCard>
          </div>
        </section>

        {/* Section 03: Codes */}
        <section id="codigos" className="space-y-6 scroll-mt-24">
          <SectionHeader num="03" title="Classificação" subtitle="CIAP-2 / CID-10 / CID-11" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surf border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-surf-2 flex justify-between items-center">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted">Códigos Selecionados</span>
                <span className="bg-surf px-2 py-0.5 rounded-full text-[10px] font-mono">{state.codes.length}</span>
              </div>
              <div className="p-6 space-y-3">
                {state.codes.length === 0 ? (
                  <div className="text-center py-8 text-dim text-sm space-y-2">
                    <ClipboardList className="mx-auto opacity-20" size={32} />
                    <p>Nenhum código selecionado.</p>
                  </div>
                ) : (
                  state.codes.map(code => (
                    <div key={code.code} className="flex items-center justify-between bg-surf-2 p-3 rounded-xl group">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-[10px] font-mono px-2 py-0.5 rounded",
                          code.type === 'CIAP-2' ? "bg-ciap/10 text-ciap" : 
                          code.type === 'CID-10' ? "bg-cid10/10 text-cid10" : "bg-cid11/10 text-cid11"
                        )}>
                          {code.code}
                        </span>
                        <span className="text-sm font-medium">{code.name}</span>
                      </div>
                      <button onClick={() => removeCode(code.code)} className="text-dim hover:text-rose transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="bg-surf border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border bg-surf-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted">Busca Manual</span>
              </div>
              <div className="p-6 space-y-4">
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" size={16} />
                    <input 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearchCodes()}
                      placeholder="Buscar código ou descrição..."
                      className="w-full bg-surf-2 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 ring-s-clr/20 transition-all"
                    />
                  </div>
                  <button 
                    onClick={handleSearchCodes}
                    disabled={loading.search}
                    className="px-3 py-2 bg-s-clr text-white rounded-xl text-xs font-bold hover:bg-s-clr/90 transition-all disabled:opacity-50"
                  >
                    {loading.search ? <RefreshCcw className="animate-spin" size={14} /> : 'Buscar'}
                  </button>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {searchResults.length === 0 ? (
                    <div className="text-center py-8 text-dim text-xs">
                      {loading.search ? 'Pesquisando...' : 'Digite para buscar nos catálogos.'}
                    </div>
                  ) : (
                    searchResults.map((item, idx) => (
                      <button 
                        key={idx}
                        onClick={() => addCode(item)}
                        className="w-full flex items-center justify-between p-3 bg-surf-2 hover:bg-surf-3 border border-border rounded-xl transition-all group text-left"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[8px] font-mono px-1.5 py-0.5 rounded",
                              item.type === 'CIAP-2' ? "bg-ciap/10 text-ciap" : 
                              item.type === 'CID-10' ? "bg-cid10/10 text-cid10" : "bg-cid11/10 text-cid11"
                            )}>
                              {item.code}
                            </span>
                            <span className="text-xs font-bold truncate max-w-[150px]">{item.name}</span>
                          </div>
                          <span className="text-[9px] text-dim">{item.type}</span>
                        </div>
                        <Plus size={14} className="text-dim group-hover:text-s-clr transition-colors" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 04: Analysis */}
        <section id="analises" className="space-y-6 scroll-mt-24">
          <SectionHeader num="04" title="Análise Avançada" subtitle="Calculadoras de Risco" />
          <div className="bg-surf border border-border rounded-2xl p-8 shadow-sm space-y-8">
            <div className="space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-500">
                <Activity size={18} /> Risco Cardiovascular (Framingham + SCORE2)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Idade (Anos)</label>
                  <input 
                    type="number"
                    value={state.cvData?.age || state.patient.age.replace(/\D/g, '')}
                    onChange={e => updateCvData('age', e.target.value)}
                    className="w-full bg-transparent border-b-2 border-surf-3 focus:border-rose-500 outline-none py-1 text-sm transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Sexo</label>
                  <select 
                    value={state.cvData?.sex || state.patient.sex}
                    onChange={e => updateCvData('sex', e.target.value)}
                    className="w-full bg-transparent border-b-2 border-surf-3 focus:border-rose-500 outline-none py-1 text-sm transition-colors"
                  >
                    <option value="">—</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <Input label="Colesterol Total" value={state.cvData?.ct || ''} onChange={v => updateCvData('ct', v)} />
                <Input label="HDL" value={state.cvData?.hdl || ''} onChange={v => updateCvData('hdl', v)} />
                <Input label="LDL" value={state.cvData?.ldl || ''} onChange={v => updateCvData('ldl', v)} />
                <Input label="Triglicerídeos" value={state.cvData?.tg || ''} onChange={v => updateCvData('tg', v)} />
                <Input label="PAS" value={state.cvData?.pas || ''} onChange={v => updateCvData('pas', v)} />
                <Input label="PAD" value={state.cvData?.pad || ''} onChange={v => updateCvData('pad', v)} />
                <Input label="Creatinina" value={state.cvData?.creatinina || ''} onChange={v => updateCvData('creatinina', v)} />
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Tabagismo</label>
                  <select value={state.cvData?.tabagismo} onChange={e => updateCvData('tabagismo', e.target.value)} className="w-full bg-transparent border-b-2 border-surf-3 py-1 text-sm">
                    <option value="0">Não</option>
                    <option value="1">Sim</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Diabetes</label>
                  <select value={state.cvData?.dm} onChange={e => updateCvData('dm', e.target.value)} className="w-full bg-transparent border-b-2 border-surf-3 py-1 text-sm">
                    <option value="0">Não</option>
                    <option value="1">Sim</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Anti-HAS</label>
                  <select value={state.cvData?.antiHAS} onChange={e => updateCvData('antiHAS', e.target.value)} className="w-full bg-transparent border-b-2 border-surf-3 py-1 text-sm">
                    <option value="0">Não</option>
                    <option value="1">Sim</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const age = parseInt(state.cvData?.age || state.patient.age.replace(/\D/g, ''));
                  const sex = state.cvData?.sex || state.patient.sex;
                  const risk = age && sex && state.cvData?.ct && state.cvData?.hdl && state.cvData?.pas ? 
                    calcFramingham({
                      age,
                      sex: sex as 'M' | 'F',
                      ct: parseFloat(state.cvData.ct),
                      hdl: parseFloat(state.cvData.hdl),
                      pas: parseFloat(state.cvData.pas),
                      isSmoker: state.cvData.tabagismo === '1',
                      isDM: state.cvData.dm === '1',
                      isTreated: state.cvData.antiHAS === '1'
                    }) : null;
                  
                  return risk !== null && (
                    <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono uppercase text-dim">Framingham (2008)</span>
                        <span className="text-sm font-medium">Risco DCV em 10 anos:</span>
                      </div>
                      <span className="text-2xl font-serif font-bold text-rose-500">{risk.toFixed(1)}%</span>
                    </div>
                  );
                })()}
                {(() => {
                  const age = parseInt(state.cvData?.age || state.patient.age.replace(/\D/g, ''));
                  const sex = state.cvData?.sex || state.patient.sex;
                  const s2 = calcSCORE2(
                    age,
                    sex,
                    parseFloat(state.cvData?.pas || '0'),
                    parseFloat(state.cvData?.ct || '0'),
                    state.cvData?.tabagismo === '1',
                    state.cvData?.dm === '1'
                  );
                  return s2 && (
                    <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-mono uppercase text-dim">{s2.label} (ESC 2021)</span>
                        <span className="text-sm font-medium">Risco de Morte CV:</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-serif font-bold text-purple-500">{s2.score}%</div>
                        <div className="text-[10px] font-bold text-purple-400 uppercase">{s2.category}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {(() => {
                const age = parseInt(state.cvData?.age || state.patient.age.replace(/\D/g, ''));
                const sex = state.cvData?.sex || state.patient.sex;
                const creat = parseFloat(state.cvData?.creatinina || '0');
                const tfg = (creat && age && sex) ? calcCKDEPI2021(creat, age, sex) : null;
                
                return tfg !== null && (
                  <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono uppercase text-dim">CKD-EPI 2021</span>
                      <span className="text-sm font-medium">TFG Estimada:</span>
                    </div>
                    <span className="text-2xl font-serif font-bold text-blue-500">
                      {tfg} mL/min
                    </span>
                        {/* Section 05: Gestational */}
        <section id="gestacional" className="space-y-6 scroll-mt-24">
          <SectionHeader num="05" title="Risco Gestacional" subtitle="Estratificação SES/SC 2022" />
          <div className="bg-surf border border-border rounded-2xl p-8 shadow-sm space-y-10">
            
            {/* Sub-seção: Gestação */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-500 border-b border-rose-100 pb-2">
                <Baby size={18} /> Gestação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="DUM" type="date" value={state.obsData?.dum || ''} onChange={v => updateObsData('dum', v)} />
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <Input label="USG 1ºT (Data)" type="date" value={state.obsData?.usg1TrimDate || ''} onChange={v => updateObsData('usg1TrimDate', v)} />
                  </div>
                  <Input label="Sem" type="number" value={state.obsData?.usg1TrimSem || ''} onChange={v => updateObsData('usg1TrimSem', v)} />
                  <Input label="Dias" type="number" value={state.obsData?.usg1TrimDias || ''} onChange={v => updateObsData('usg1TrimDias', v)} />
                </div>
              </div>
              {igDiscrepancy && (
                <div className="flex items-center gap-2 text-rose-500 bg-rose-500/5 border border-rose-500/20 p-2 rounded-lg">
                  <AlertTriangle size={14} />
                  <span className="text-[10px] font-bold">{igDiscrepancy}</span>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Input label="USG Atual (Data)" type="date" value={state.obsData?.usgDate || ''} onChange={v => updateObsData('usgDate', v)} />
                <Input label="USG Atual (Sem)" type="number" value={state.obsData?.usgSem || ''} onChange={v => updateObsData('usgSem', v)} />
                <Input label="USG Atual (Dias)" type="number" value={state.obsData?.usgDias || ''} onChange={v => updateObsData('usgDias', v)} />
              </div>
              {currentUsgDiscrepancy && (
                <div className="flex items-center gap-2 text-rose-500 bg-rose-500/5 border border-rose-500/20 p-2 rounded-lg">
                  <AlertTriangle size={14} />
                  <span className="text-[10px] font-bold">{currentUsgDiscrepancy}</span>
                </div>
              )}
              <div className="grid grid-cols-4 gap-4">
                <Input label="G" value={state.obsData?.g || ''} onChange={v => updateObsData('g', v)} />
                <Input label="P" value={state.obsData?.p || ''} onChange={v => updateObsData('p', v)} />
                <Input label="A" value={state.obsData?.a || ''} onChange={v => updateObsData('a', v)} />
                <Input label="C" value={state.obsData?.c || ''} onChange={v => updateObsData('c', v)} />
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Gemelar?</label>
                  <select value={state.obsData?.gemelar} onChange={e => updateObsData('gemelar', e.target.value)} className="w-full bg-transparent border-b-2 border-surf-3 py-1 text-sm">
                    <option value="N">Não</option>
                    <option value="S">Sim</option>
                  </select>
                </div>
              </div>
              
              {ig && (
                <div className="p-4 bg-o-bg border border-o-clr/20 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-dim">IG pela {ig.source}</span>
                    <span className="text-lg font-bold text-o-clr">{ig.weeks} semanas e {ig.days} dias</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-dim">DPP</span>
                    <span className="text-lg font-bold text-o-clr">{ig.dpp.toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono uppercase text-dim">Trimestre</span>
                    <span className={cn(
                      "text-xs font-bold px-2 py-1 rounded-full w-fit mt-1",
                      ig.weeks < 14 ? "bg-green-500/10 text-green-600" : 
                      ig.weeks < 28 ? "bg-amber-500/10 text-amber-600" : "bg-rose-500/10 text-rose-600"
                    )}>
                      {ig.weeks < 14 ? '1º Trimestre' : ig.weeks < 28 ? '2º Trimestre' : '3º Trimestre'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Sub-seção: Anemia */}
            <div className="space-y-6 pt-6 border-t border-surf-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-500 border-b border-rose-100 pb-2">
                🩸 Anemia
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input label="Hb (g/dL)" value={state.obsData?.hb || ''} onChange={v => updateObsData('hb', v)} />
                <Input label="Ht (%)" value={state.obsData?.ht || ''} onChange={v => updateObsData('ht', v)} />
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Triagem Anemia</label>
                  <textarea 
                    value={state.obsData?.triAnemia || ''} 
                    onChange={e => updateObsData('triAnemia', e.target.value)}
                    className="w-full bg-transparent border-b-2 border-surf-3 focus:border-rose-500 outline-none py-1 text-sm transition-colors min-h-[40px]"
                    placeholder="Observações sobre anemia..."
                  />
                </div>
              </div>
            </div>

            {/* Sub-seção: Doença Tireoidiana */}
            <div className="space-y-6 pt-6 border-t border-surf-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-500 border-b border-rose-100 pb-2">
                🦋 Doença Tireoidiana
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Input label="TSH (mUI/L)" value={state.obsData?.tirTSH || ''} onChange={v => updateObsData('tirTSH', v)} />
                <Input label="T4 Livre" value={state.obsData?.tirT4L || ''} onChange={v => updateObsData('tirT4L', v)} />
                <Input label="Anti-TPO" value={state.obsData?.tirTPO || ''} onChange={v => updateObsData('tirTPO', v)} />
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Triagem Tireoide</label>
                  <select value={state.obsData?.tirTri} onChange={e => updateObsData('tirTri', e.target.value)} className="w-full bg-transparent border-b-2 border-surf-3 py-1 text-sm">
                    <option value="">Selecione</option>
                    <option value="Normal">Normal</option>
                    <option value="Hipotireoidismo">Hipotireoidismo</option>
                    <option value="Hipertireoidismo">Hipertireoidismo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sub-seção: Risco de Pré-eclâmpsia */}
            <div className="space-y-6 pt-6 border-t border-surf-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-500 border-b border-rose-100 pb-2">
                ⚡ Risco de Pré-eclâmpsia
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <h5 className="text-[9px] font-bold uppercase text-rose-500">Alto Risco (1+ fator)</h5>
                  <div className="space-y-2">
                    {[
                      'Doença hipertensiva em gestação anterior',
                      'Doença renal crônica',
                      'Doença autoimune (LES ou SAF)',
                      'Diabetes mellitus tipo 1 ou 2',
                      'Hipertensão crônica'
                    ].map(f => (
                      <label key={f} className="flex items-center gap-2 text-xs cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={state.obsData?.peAlto.includes(f)}
                          onChange={() => {
                            const current = state.obsData?.peAlto || [];
                            const updated = current.includes(f) ? current.filter(x => x !== f) : [...current, f];
                            updateObsData('peAlto', updated);
                          }}
                          className="rounded border-surf-3 text-rose-500 focus:ring-rose-500"
                        />
                        <span className="group-hover:text-rose-600 transition-colors">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <h5 className="text-[9px] font-bold uppercase text-amber-500">Risco Moderado (2+ fatores)</h5>
                  <div className="space-y-2">
                    {[
                      'Primigravidez',
                      'Idade ≥ 35 anos',
                      'Intervalo interpartal > 10 anos',
                      'IMC ≥ 30 kg/m² na primeira consulta',
                      'História familiar de pré-eclâmpsia',
                      'Gestação múltipla'
                    ].map(f => (
                      <label key={f} className="flex items-center gap-2 text-xs cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={state.obsData?.peMod.includes(f)}
                          onChange={() => {
                            const current = state.obsData?.peMod || [];
                            const updated = current.includes(f) ? current.filter(x => x !== f) : [...current, f];
                            updateObsData('peMod', updated);
                          }}
                          className="rounded border-surf-3 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="group-hover:text-amber-600 transition-colors">{f}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {((state.obsData?.peAlto.length || 0) >= 1 || (state.obsData?.peMod.length || 0) >= 2) && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-700 text-xs font-medium">
                  Indicação de AAS (100-150mg/dia) e Cálcio (1,5-2g/dia) antes de 16 semanas.
                </div>
              )}
            </div>

            {/* Estratificação de Risco Gestacional (Baseado nas Imagens) */}
            <div className="space-y-6 pt-6 border-t border-surf-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-rose-500 border-b border-rose-100 pb-2">
                📊 Estratificação de Risco Gestacional
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna 1: Socioeconômico e Reprodutivo */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h5 className="text-[9px] font-bold uppercase text-dim">Características Individuais / Socioeconômicas</h5>
                    <div className="space-y-1.5">
                      {GESTATIONAL_RISK_FACTORS.filter(f => f.category === 'socioeconomic').map(f => (
                        <label key={f.id} className="flex items-center justify-between p-2 hover:bg-surf rounded transition-colors cursor-pointer text-xs">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={state.obsData?.socioeconomicRisk.includes(f.id)}
                              onChange={() => toggleRiskFactor('socioeconomicRisk', f.id)}
                              className="rounded border-surf-3 text-rose-500"
                            />
                            <span>{f.label}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-dim">+{f.score}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-[9px] font-bold uppercase text-dim">História Reprodutiva Anterior</h5>
                    <div className="space-y-1.5">
                      {GESTATIONAL_RISK_FACTORS.filter(f => f.category === 'previousReproductive').map(f => (
                        <label key={f.id} className="flex items-center justify-between p-2 hover:bg-surf rounded transition-colors cursor-pointer text-xs">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={state.obsData?.previousReproductiveRisk.includes(f.id)}
                              onChange={() => toggleRiskFactor('previousReproductiveRisk', f.id)}
                              className="rounded border-surf-3 text-rose-500"
                            />
                            <span>{f.label}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-dim">+{f.score}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Intercorrências Atuais e Clínicas Prévias */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h5 className="text-[9px] font-bold uppercase text-dim">Intercorrências na Gestação Atual</h5>
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-1.5 scrollbar-thin">
                      {GESTATIONAL_RISK_FACTORS.filter(f => f.category === 'currentObstetric').map(f => (
                        <label key={f.id} className="flex items-center justify-between p-2 hover:bg-surf rounded transition-colors cursor-pointer text-xs">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={state.obsData?.currentObstetricRisk.includes(f.id)}
                              onChange={() => toggleRiskFactor('currentObstetricRisk', f.id)}
                              className="rounded border-surf-3 text-rose-500"
                            />
                            <span>{f.label}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-dim">+{f.score}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h5 className="text-[9px] font-bold uppercase text-dim">Condições Clínicas Prévias</h5>
                    <div className="space-y-1.5">
                      {GESTATIONAL_RISK_FACTORS.filter(f => f.category === 'previousClinical').map(f => (
                        <label key={f.id} className="flex items-center justify-between p-2 hover:bg-surf rounded transition-colors cursor-pointer text-xs">
                          <div className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={state.obsData?.previousClinicalRisk.includes(f.id)}
                              onChange={() => toggleRiskFactor('previousClinicalRisk', f.id)}
                              className="rounded border-surf-3 text-rose-500"
                            />
                            <span>{f.label}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-dim">+{f.score}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultado da Estratificação */}
              <div className={`mt-8 p-6 rounded-2xl border-2 transition-all ${
                gestationalRisk.level === 'Alto' ? 'bg-rose-500/5 border-rose-500/30' :
                gestationalRisk.level === 'Médio' ? 'bg-amber-500/5 border-amber-500/30' :
                'bg-emerald-500/5 border-emerald-500/30'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-dim">Classificação de Risco</span>
                    <h3 className={`text-2xl font-serif font-bold ${
                      gestationalRisk.level === 'Alto' ? 'text-rose-600' :
                      gestationalRisk.level === 'Médio' ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      Risco Gestacional {gestationalRisk.level}
                    </h3>
                    <p className="text-xs text-dim italic">Pontuação Total: {gestationalRisk.score} pontos</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-dim">Fluxo de Atendimento</span>
                    <div className={`px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wider ${
                      gestationalRisk.level === 'Alto' ? 'bg-rose-600 text-white' :
                      gestationalRisk.level === 'Médio' ? 'bg-amber-600 text-white' :
                      'bg-emerald-600 text-white'
                    }`}>
                      {gestationalRisk.flow}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 06: Puericultura */}
        <section id="puericultura" className="space-y-6 scroll-mt-24">
          <SectionHeader num="06" title="Puericultura" subtitle="Curvas de Crescimento OMS" />
          <div className="bg-surf border border-border rounded-2xl p-8 shadow-sm space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Input label="DUM (Mãe)" type="date" value={state.puericultura?.dum || ''} onChange={v => updatePuericultura('dum', v)} />
              <Input label="Nascimento" type="date" value={state.puericultura?.dob || ''} onChange={v => updatePuericultura('dob', v)} />
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-dim">Sexo</label>
                <select value={state.puericultura?.sex} onChange={e => updatePuericultura('sex', e.target.value)} className="w-full bg-transparent border-b-2 border-surf-3 py-1 text-sm">
                  <option value="">Selecione</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <Input label="Peso (kg)" value={state.puericultura?.peso || ''} onChange={v => updatePuericultura('peso', v)} />
              <Input label="Estatura (cm)" value={state.puericultura?.alt || ''} onChange={v => updatePuericultura('alt', v)} />
              <Input label="PC (cm)" value={state.puericultura?.pc || ''} onChange={v => updatePuericultura('pc', v)} />
              <Input label="IG (Semanas)" type="number" value={state.puericultura?.gaWeeks || ''} onChange={v => updatePuericultura('gaWeeks', v)} />
              <Input label="IG (Dias)" type="number" value={state.puericultura?.gaDays || ''} onChange={v => updatePuericultura('gaDays', v)} />
            </div>

            {state.puericultura?.dum && state.puericultura?.dob && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl flex flex-wrap gap-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase text-dim">IG ao Nascer (Calculada)</span>
                  <span className="text-sm font-bold text-blue-600">
                    {state.puericultura.gaWeeks} semanas e {state.puericultura.gaDays} dias
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase text-dim">Data Provável do Parto (DPP)</span>
                  <span className="text-sm font-bold text-blue-600">
                    {new Date(new Date(state.puericultura.dum + 'T00:00:00').getTime() + 280 * 86400000).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            )}

            {pueriResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {pueriResults.map((r, idx) => {
                  const z = r.z;
                  const color = z < -2 || z > 2 ? 'text-rose-500' : z < -1 || z > 1 ? 'text-amber-500' : 'text-green-500';
                  return (
                    <div key={idx} className="p-4 bg-surf-2 border border-border rounded-xl text-center space-y-1">
                      <p className="text-[10px] font-mono uppercase text-dim">{r.label}</p>
                      <p className="text-xl font-serif font-bold">{r.val} <span className="text-xs font-normal text-dim">{r.unit}</span></p>
                      <p className={cn("text-xs font-bold", color)}>z = {z.toFixed(2)}</p>
                      <p className="text-[10px] text-dim">Percentil: {zToPct(z).toFixed(1)}%</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Section 07: Hebiatria */}
        <section id="hebiatria" className="space-y-6 scroll-mt-24">
          <SectionHeader num="07" title="Hebiatria" subtitle="Protocolo HEEADSSS" />
          <div className="bg-surf border border-border rounded-2xl p-8 shadow-sm space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dim flex justify-between">
                  <span>🏠 Home & Education</span>
                  <span className={cn("text-[10px]", (state.hebiatria?.h.length || 0) > 1800 ? "text-rose-500" : "text-dim")}>
                    {state.hebiatria?.h.length || 0}/2000
                  </span>
                </h4>
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="H (Home): Onde mora, com quem, clima familiar..."
                  value={state.hebiatria?.h}
                  onChange={e => updateHebiatria('h', e.target.value)}
                />
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="E (Education): Escola, rendimento, bullying, trabalho..."
                  value={state.hebiatria?.e1}
                  onChange={e => updateHebiatria('e1', e.target.value)}
                />
              </div>
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dim flex justify-between">
                  <span>🍔 Eating & Activities</span>
                  <span className={cn("text-[10px]", (state.hebiatria?.e2.length || 0) > 1800 ? "text-rose-500" : "text-dim")}>
                    {state.hebiatria?.e2.length || 0}/2000
                  </span>
                </h4>
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="E (Eating): Dieta, imagem corporal, transtornos..."
                  value={state.hebiatria?.e2}
                  onChange={e => updateHebiatria('e2', e.target.value)}
                />
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="A (Activities): Esportes, lazer, telas, amigos..."
                  value={state.hebiatria?.a}
                  onChange={e => updateHebiatria('a', e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dim flex justify-between">
                  <span>💊 Drugs & Sexuality</span>
                  <span className={cn("text-[10px]", (state.hebiatria?.d.length || 0) > 1800 ? "text-rose-500" : "text-dim")}>
                    {state.hebiatria?.d.length || 0}/2000
                  </span>
                </h4>
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="D (Drugs): Álcool, tabaco, outras substâncias..."
                  value={state.hebiatria?.d}
                  onChange={e => updateHebiatria('d', e.target.value)}
                />
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="S (Sexuality): Início, proteção, orientação..."
                  value={state.hebiatria?.s1}
                  onChange={e => updateHebiatria('s1', e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dim flex justify-between">
                  <span>🧠 Suicide & Safety</span>
                  <span className={cn("text-[10px]", (state.hebiatria?.s2.length || 0) > 1800 ? "text-rose-500" : "text-dim")}>
                    {state.hebiatria?.s2.length || 0}/2000
                  </span>
                </h4>
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="S (Suicide/Depression): Humor, sono, ideações..."
                  value={state.hebiatria?.s2}
                  onChange={e => updateHebiatria('s2', e.target.value)}
                />
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="S (Safety): Violência, riscos, direção..."
                  value={state.hebiatria?.s3}
                  onChange={e => updateHebiatria('s3', e.target.value)}
                />
              </div>

              <div className="space-y-4 md:col-span-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dim">🔒 Sigilo & Confidencialidade</h4>
                <textarea 
                  className="w-full bg-surf-2 border border-border rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-s-clr/20 transition-all"
                  placeholder="Notas sobre o sigilo médico e o que foi acordado com o adolescente..."
                  value={state.hebiatria?.sigilo}
                  onChange={e => updateHebiatria('sigilo', e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-dim">📊 Métricas de Hábito</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Telas (h/dia)" 
                    type="number" 
                    value={state.hebiatria?.screenTime || ''} 
                    onChange={v => updateHebiatria('screenTime', v)} 
                  />
                  <Input 
                    label="Sono (h/dia)" 
                    type="number" 
                    value={state.hebiatria?.sleepHours || ''} 
                    onChange={v => updateHebiatria('sleepHours', v)} 
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 08: Dashboard */}
        <section id="dashboard" className="space-y-6 scroll-mt-24">
          <SectionHeader num="08" title="Dashboard" subtitle="Métricas e Indicadores" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="IMC" value={state.patient.bmi || '—'} unit="kg/m²" />
            <StatCard label="Risco CV" value={cvRisk ? `${cvRisk.toFixed(1)}%` : '—'} color="text-rose-500" />
            <StatCard label="IG" value={ig ? `${ig.weeks}s` : '—'} color="text-o-clr" />
            <StatCard label="Códigos" value={state.codes.length.toString()} color="text-s-clr" />
          </div>
        </section>

        {/* Section 09: History */}
        <section id="historico" className="space-y-6 scroll-mt-24">
          <SectionHeader num="09" title="Histórico de Consultas" subtitle="Sincronização em Nuvem" />
          <div className="bg-surf border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border bg-surf-2 flex justify-between items-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted">Registros na Nuvem</span>
              <span className="bg-surf px-2 py-0.5 rounded-full text-[10px] font-mono">{consultations.length}</span>
            </div>
            <div className="p-6">
              {!user ? (
                <div className="text-center py-12 text-dim space-y-4">
                  <ShieldCheck className="mx-auto opacity-20" size={48} />
                  <p className="text-sm">Faça login para visualizar seu histórico de consultas.</p>
                  <button onClick={signInWithGoogle} className="px-6 py-2 bg-surf border border-border rounded-xl text-xs font-bold hover:bg-surf-2 transition-all">
                    Entrar com Google
                  </button>
                </div>
              ) : consultations.length === 0 ? (
                <div className="text-center py-12 text-dim space-y-2">
                  <ClipboardList className="mx-auto opacity-20" size={48} />
                  <p className="text-sm">Nenhuma consulta salva ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {consultations.map((c) => (
                    <button 
                      key={c.id} 
                      onClick={() => loadConsultation(c)}
                      className="flex flex-col items-start p-4 bg-surf-2 hover:bg-surf-3 border border-border rounded-xl text-left transition-all group"
                    >
                      <div className="w-full flex justify-between items-start mb-2">
                        <span className="text-sm font-bold truncate">{c.patient.name}</span>
                        <span className="text-[9px] font-mono text-dim">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {c.codes.slice(0, 3).map((code: any) => (
                          <span key={code.code} className="text-[8px] font-mono bg-surf px-1 py-0.5 rounded text-muted">
                            {code.code}
                          </span>
                        ))}
                        {c.codes.length > 3 && <span className="text-[8px] font-mono text-dim">+{c.codes.length - 3}</span>}
                      </div>
                      <div className="w-full flex justify-between items-center mt-auto pt-2 border-t border-border/50">
                        <span className="text-[9px] text-muted uppercase tracking-wider">Ver Detalhes</span>
                        <ChevronDown size={12} className="-rotate-90 text-dim group-hover:text-s-clr transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 10: Audit */}
        <section id="auditoria" className="space-y-6 scroll-mt-24">
          <SectionHeader num="10" title="Auditoria" subtitle="Segurança e Coerência Clínica" />
          <div className="text-center">
            <button 
              onClick={handleAudit}
              disabled={loading.audit}
              className="inline-flex items-center gap-2 bg-linear-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform disabled:opacity-50"
            >
              {loading.audit ? <RefreshCcw className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
              Auditar Conduta Médica
            </button>
          </div>

          <AnimatePresence>
            {auditResult && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="md:col-span-1 bg-surf border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="58" fill="none" stroke="currentColor" strokeWidth="8" className="text-surf-3" />
                      <circle 
                        cx="64" 
                        cy="64" 
                        r="58" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        strokeDasharray={364}
                        strokeDashoffset={364 - (364 * auditResult.score / 100)}
                        className={cn(
                          "transition-all duration-1000",
                          auditResult.score >= 80 ? "text-green-500" : auditResult.score >= 60 ? "text-amber-500" : "text-rose-500"
                        )}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-serif font-bold">{auditResult.score}</span>
                      <span className="text-[10px] font-mono text-dim uppercase">Score</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{auditResult.score_label}</h3>
                    <p className="text-xs text-muted">Qualidade Assistencial</p>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <AuditPanel icon={<CheckCircle2 className="text-green-500" />} title="Coerência Diagnóstica" content={auditResult.diagnostico} />
                  <AuditPanel icon={<Info className="text-blue-500" />} title="Evidência Científica" content={auditResult.evidencia} />
                  <AuditPanel icon={<AlertTriangle className="text-amber-500" />} title="Segurança" content={auditResult.seguranca} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Section 11: Summary */}
        <section id="resumo" className="space-y-6 scroll-mt-24">
          <SectionHeader num="11" title="Resumo da Consulta" subtitle="Síntese Clínica Automática" />
          <div className="bg-surf border border-border rounded-2xl p-8 shadow-sm space-y-6">
            <div className="flex justify-center">
              <button 
                onClick={handleGenerateSummary}
                disabled={loading.summary}
                className="flex items-center gap-2 px-8 py-4 bg-linear-to-r from-s-clr to-p-clr text-white rounded-2xl font-bold shadow-xl hover:scale-105 transition-transform disabled:opacity-50"
              >
                {loading.summary ? <RefreshCcw className="animate-spin" size={20} /> : <Stethoscope size={20} />}
                Gerar Resumo Clínico com IA
              </button>
            </div>
            {summary && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surf-2 border border-border rounded-xl p-6 prose prose-sm max-w-none dark:prose-invert"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold m-0">Resumo Gerado</h3>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(summary);
                      setNotification({ message: 'Copiado para a área de transferência!', type: 'success' });
                    }}
                    className="text-[10px] uppercase font-bold text-s-clr hover:underline"
                  >
                    Copiar
                  </button>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {summary}
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* Section 12: Export */}
        <section id="exportacao" className="space-y-6 scroll-mt-24">
          <SectionHeader num="12" title="Exportação e Importação" subtitle="Portabilidade de Dados" />
          <div className="bg-surf border border-border rounded-2xl p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button onClick={exportPDF} className="flex items-center justify-center gap-3 p-4 bg-surf-2 hover:bg-surf-3 border border-border rounded-xl font-bold transition-all">
                <FileText className="text-rose-500" /> Exportar PDF
              </button>
              <button onClick={exportJSON} className="flex items-center justify-center gap-3 p-4 bg-surf-2 hover:bg-surf-3 border border-border rounded-xl font-bold transition-all">
                <Download className="text-s-clr" /> Exportar JSON
              </button>
              <label className="flex items-center justify-center gap-3 p-4 bg-surf-2 hover:bg-surf-3 border border-border rounded-xl font-bold transition-all cursor-pointer">
                <Upload className="text-o-clr" /> Importar JSON
                <input type="file" accept=".json" onChange={importJSON} className="hidden" />
              </label>
            </div>
          </div>
        </section>
        {/* Section 13: Capabilities */}
        <section id="capacidades" className="space-y-6 scroll-mt-24 pb-20">
          <SectionHeader num="13" title="Capacidades" subtitle="Visão Geral de Recursos" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CapabilityCard 
              icon={<LayoutDashboard className="text-s-clr" />}
              title="Gestão de Identificação"
              desc="Coleta de dados demográficos, cálculo automático de IMC e idade, e integração com médico responsável."
            />
            <CapabilityCard 
              icon={<ClipboardList className="text-o-clr" />}
              title="Documentação SOAP"
              desc="Estrutura completa para registro Subjetivo, Objetivo, Avaliação e Plano com campos especializados."
            />
            <CapabilityCard 
              icon={<Search className="text-ciap" />}
              title="Codificação Inteligente"
              desc="Sugestões automáticas e busca manual em catálogos CIAP-2, CID-10 e CID-11 via Inteligência Artificial."
            />
            <CapabilityCard 
              icon={<Activity className="text-rose-500" />}
              title="Calculadoras Clínicas"
              desc="Cálculo de Risco Cardiovascular (Framingham) e Idade Gestacional integrados ao fluxo de trabalho."
            />
            <CapabilityCard 
              icon={<ShieldCheck className="text-purple-500" />}
              title="Auditoria Clínica"
              desc="Análise profunda de coerência e segurança do paciente utilizando modelos de IA de alto raciocínio."
            />
            <CapabilityCard 
              icon={<Stethoscope className="text-p-clr" />}
              title="Resumo Clínico"
              desc="Geração automática de resumos concisos e profissionais para transferência de cuidado ou registro."
            />
            <CapabilityCard 
              icon={<AlertTriangle className="text-amber-500" />}
              title="Segurança Farmacológica"
              desc="Detecção de interações medicamentosas e alertas de severidade baseados em evidências atualizadas."
            />
            <CapabilityCard 
              icon={<Cloud className="text-blue-500" />}
              title="Sincronização em Nuvem"
              desc="Armazenamento seguro no Firestore com histórico de consultas e persistência de preferências do usuário."
            />
            <CapabilityCard 
              icon={<FileText className="text-rose-500" />}
              title="Exportação Multiformato"
              desc="Geração de PDFs profissionais e arquivos JSON para portabilidade total dos dados do paciente."
            />
          </div>
        </section>
        </main>

        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl bg-surf border border-border shadow-2xl flex items-center gap-3"
            >
              {notification.type === 'info' && <Info className="text-blue-500" size={18} />}
              {notification.type === 'success' && <CheckCircle2 className="text-green-500" size={18} />}
              {notification.type === 'error' && <AlertTriangle className="text-rose-500" size={18} />}
              <span className="text-sm font-medium">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="max-w-4xl mx-auto px-6 py-12 text-center border-t border-border mt-12">
          <p className="text-xs text-dim leading-relaxed">
            <strong>Prontuário Inteligente</strong> — Documentação clínica SOAP com IA<br />
            CIAP-2 · CID-11 · Powered by Gemini API<br />
            Ferramenta de apoio à decisão clínica. Não substitui avaliação médica profissional.
          </p>
        </footer>
      </div>
    </div>
  );
}

function SectionHeader({ num, title, subtitle }: { num: string, title: string, subtitle?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-dim font-mono text-[10px] uppercase tracking-[0.2em] font-bold">
        <span>{num} — Seção</span>
        <div className="h-px flex-1 bg-border/50" />
      </div>
      <div className="flex items-baseline gap-3">
        <h2 className="text-3xl font-serif font-bold tracking-tight bg-linear-to-r from-s-clr to-o-clr bg-clip-text text-transparent">
          {title}
        </h2>
        {subtitle && <span className="text-[10px] text-muted font-mono uppercase tracking-widest">{subtitle}</span>}
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string, color: string }) {
  return (
    <span className={cn("text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider", color)}>
      {label}
    </span>
  );
}

function Input({ label, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-mono uppercase tracking-wider text-dim">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border-b-2 border-surf-3 focus:border-s-clr outline-none py-1 text-sm transition-colors"
      />
    </div>
  );
}

function StatCard({ label, value, unit, color = "text-text" }: any) {
  return (
    <div className="bg-surf border border-border rounded-2xl p-5 shadow-sm space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-wider text-dim">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-serif font-bold", color)}>{value}</span>
        {unit && <span className="text-[10px] text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function CapabilityCard({ icon, title, desc }: any) {
  return (
    <div className="bg-surf border border-border rounded-2xl p-6 shadow-sm space-y-3 hover:shadow-md transition-all">
      <div className="w-10 h-10 bg-surf-2 rounded-xl flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <h3 className="font-bold text-sm">{title}</h3>
      <p className="text-xs text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function SoapCard({ letter, title, subtitle, colorClass, children, onAnalyze, loading, extraAction, analyzeLabel = "Classificar" }: any) {
  return (
    <div className={cn("bg-surf border border-border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md", colorClass)}>
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surf-2/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-serif font-bold text-xl bg-surf shadow-sm">
            {letter}
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">{title}</h3>
            <p className="text-[10px] text-muted uppercase tracking-wider">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {extraAction}
          <button 
            onClick={onAnalyze}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-surf border border-border rounded-lg text-xs font-bold hover:bg-surf-2 transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="animate-spin" size={14} /> : <Plus size={14} />}
            {analyzeLabel}
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}

function SoapField({ label, value, onChange, rows = 2, placeholder }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-mono uppercase tracking-wider text-muted px-1">{label}</label>
      <textarea 
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-surf-2 rounded-xl p-3 text-sm outline-none focus:ring-2 ring-s-clr/10 transition-all resize-none"
      />
    </div>
  );
}

function AiSuggestions({ suggestions, onAdd }: any) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-dim">
        <Activity size={12} /> Sugestões da IA
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s, i) => (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            key={s.code}
            onClick={() => onAdd({ ...s, type: s.type || 'CIAP-2', field: 'IA' })}
            className="flex flex-col items-start gap-1 p-3 bg-surf-2 hover:bg-surf-3 border border-border rounded-xl text-left max-w-[240px] transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-surf px-1.5 py-0.5 rounded text-muted group-hover:text-s-clr transition-colors">
                {s.code}
              </span>
              <span className="text-xs font-bold truncate">{s.name}</span>
            </div>
            <p className="text-[10px] text-muted leading-tight line-clamp-2">{s.reasoning}</p>
            <div className="w-full h-0.5 bg-surf rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-s-clr transition-all duration-1000" style={{ width: `${s.confidence}%` }} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function AuditPanel({ icon, title, content }: any) {
  return (
    <div className="bg-surf border border-border rounded-2xl p-6 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted">{title}</h4>
      </div>
      <div className="text-sm leading-relaxed text-text-2 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
