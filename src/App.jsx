import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Bone, BookOpen, Check, ChevronDown, ChevronRight,
  Dumbbell, Footprints, HeartPulse, Home,
  Moon, Sun, Mountain, Pause, Play, RotateCcw,
  ShieldCheck, Stethoscope, TrendingUp, BarChart3,
  AlertTriangle, X, Zap, Timer, User, Volume2, VolumeX,
  ArrowRight, LogOut, Lock, Mail, Download, Trash2,
  PlusCircle, ClipboardCheck, Award, FileText
} from 'lucide-react';

// ============================================================================
// UTILIDADES DE SANITIZACIÓN Y PERSISTENCIA LOCAL (LEY 1581 DE 2012)
// ============================================================================
const clampNum = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const PAIN_ZONE_LABELS = {
  ninguna: 'Sin dolor',
  posteromedial_difuso: 'Borde posteromedial distal (difuso > 5 cm)',
  focal_puntual: 'Punto óseo focalizado (< 2 cm)',
  muscular_general: 'Compartimento muscular posterior (pantorrilla)'
};

const LEG_SIDE_LABELS = {
  izquierda: 'Pierna izquierda',
  derecha: 'Pierna derecha',
  bilateral: 'Ambas piernas (bilateral)'
};

const sanitizeProfile = (p) => ({
  name: String(p?.name || 'Corredor').trim().slice(0, 120) || 'Corredor',
  age: Math.round(clampNum(p?.age, 14, 90, 21)),
  sex: p?.sex === 'masculino' ? 'masculino' : 'femenino',
  weightKg: +clampNum(p?.weightKg, 30, 220, 65).toFixed(1),
  heightCm: Math.round(clampNum(p?.heightCm, 120, 230, 170)),
  footType: ['desconocido', 'neutra', 'pronador', 'supinador'].includes(p?.footType)
    ? p.footType
    : 'desconocido',
  experience: ['<3m', '3-6m', '6-12m', '>12m'].includes(p?.experience) ? p.experience : '<3m',
  weeklyKm: +clampNum(p?.weeklyKm, 1, 200, 10).toFixed(1),
  priorInjury: p?.priorInjury === 'si' ? 'si' : 'no',
  cadencePpm: Math.round(clampNum(p?.cadencePpm, 130, 220, 164))
});

const sanitizeSession = (s) => {
  const dateStr = typeof s?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)
    ? s.date
    : new Date().toISOString().split('T')[0];
  const evaVal = Math.round(clampNum(s?.eva, 0, 10, 0));
  const validZones = ['ninguna', 'posteromedial_difuso', 'focal_puntual', 'muscular_general'];
  const validSides = ['izquierda', 'derecha', 'bilateral'];

  return {
    date: dateStr,
    distanceKm: +clampNum(s?.distanceKm, 0.1, 150, 4.0).toFixed(2),
    durationMin: Math.round(clampNum(s?.durationMin, 1, 600, 25)),
    rpe: Math.round(clampNum(s?.rpe, 0, 10, 4)),
    eva: evaVal,
    legSide: evaVal === 0
      ? 'izquierda'
      : (validSides.includes(s?.legSide) ? s.legSide : 'izquierda'),
    painLocation: evaVal === 0
      ? 'ninguna'
      : (validZones.includes(s?.painLocation) ? s.painLocation : 'posteromedial_difuso'),
    painAtRest: evaVal > 0 ? Boolean(s?.painAtRest) : false
  };
};

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(e);
    }
  }, [key, value]);

  return [value, setValue];
}

// ============================================================================
// CONVERSORES DE UNIDADES Y CONSTANTES CLÍNICAS / BIOMECÁNICAS
// ============================================================================
const fmtDist = (km, unit) =>
  unit === 'metric' ? `${Number(km).toFixed(1)} km` : `${(Number(km) * 0.621371).toFixed(1)} mi`;

const distVal = (km, unit) =>
  unit === 'metric' ? Number(km) : +(Number(km) * 0.621371).toFixed(1);

const TABS = [
  { id: 'inicio', label: 'Resumen', Icon: Home },
  { id: 'cadencia', label: 'Cadencia', Icon: Timer },
  { id: 'quees', label: 'Guía/Test', Icon: BookOpen },
  { id: 'prevencion', label: 'Prevenir', Icon: ShieldCheck },
  { id: 'ejercicios', label: 'Ejercicios', Icon: Dumbbell },
  { id: 'recuperacion', label: 'Plan 8S', Icon: HeartPulse },
];

const PAIN_LEVELS = [
  { value: 0, label: 'Sin molestia', c: '#34c759' },
  { value: 3, label: 'Molestia leve', c: '#ffd60a' },
  { value: 5, label: 'Dolor moderado (EVA ≥ 4)', c: '#ff9f0a' },
  { value: 7, label: 'Dolor intenso', c: '#ff453a' },
  { value: 10, label: 'Dolor severo', c: '#ff2e55' },
];

const getPainInfo = (val) =>
  PAIN_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - val) < Math.abs(prev.value - val) ? curr : prev
  );

const BORG_LABELS = {
  0: 'Reposo absoluto',
  1: 'Muy muy suave',
  2: 'Suave (aeróbico ligero)',
  3: 'Moderado cómodo',
  4: 'Algo duro',
  5: 'Duro (respiración agitada)',
  6: 'Duro +',
  7: 'Muy duro (umbral)',
  8: 'Muy duro +',
  9: 'Casi máximo',
  10: 'Esfuerzo máximo'
};

// ============================================================================
// CUESTIONARIO DE CONOCIMIENTO PREVENTIVO (10 ÍTEMS - TRAZADO A MARCO TEÓRICO)
// ============================================================================
const QUIZ_QUESTIONS = [
  {
    q: '1. ¿Cuál es el incremento máximo recomendado en el volumen semanal de carrera para prevenir el SETM?',
    options: ['Hasta 30% semanal', 'Máximo 10% semanal', '50% cada quince días'],
    correct: 1
  },
  {
    q: '2. ¿Qué indica una Razón Carga Aguda:Crónica (ACWR) superior a 1.5?',
    options: ['Zona óptima de adaptación', 'Subcarga de entrenamiento', 'Sobrecarga con riesgo elevado de lesión'],
    correct: 2
  },
  {
    q: '3. ¿Dónde se localiza típicamente el dolor del Síndrome de Estrés Tibial Medial?',
    options: ['Borde posteromedial distal de la tibia (≥ 5 cm)', 'Cara lateral externa de la rodilla', 'Planta del talón exclusivamente'],
    correct: 0
  },
  {
    q: '4. ¿Qué alteración biomecánica del pie se asocia con mayor tracción sobre el periostio tibial?',
    options: ['Arco plantar rígido sin movilidad', 'Caída navicular aumentada y eversión prolongada', 'Apoyo exclusivo en antepié'],
    correct: 1
  },
  {
    q: '5. ¿Cada cuántos kilómetros aproximados se recomienda evaluar el reemplazo del calzado de running?',
    options: ['Cada 600 a 800 km', 'Cada 2.500 km', 'Solo cuando se rompe la tela superior'],
    correct: 0
  },
  {
    q: '6. ¿Qué ajuste en la cadencia de carrera ayuda a reducir el pico de impacto sobre la tibia?',
    options: ['Reducir la cadencia por debajo de 150 ppm', 'Aumentar ligeramente la cadencia (+5% respecto a la habitual)', 'Correr con zancadas muy largas'],
    correct: 1
  },
  {
    q: '7. ¿Cuál de estos factores antropométricos incrementa la carga mecánica sobre la tibia?',
    options: ['Índice de Masa Corporal (IMC) elevado (≥ 25 kg/m²)', 'Talla baja', 'Frecuencia cardíaca en reposo baja'],
    correct: 0
  },
  {
    q: '8. ¿Qué grupos musculares son prioritarios en el entrenamiento neuromuscular preventivo del SETM?',
    options: ['Bíceps y pectoral mayor', 'Sóleo, tibial posterior y abductores de cadera', 'Cuádriceps únicamente'],
    correct: 1
  },
  {
    q: '9. Si reportas dolor posteromedial EVA ≥ 4 en dos sesiones consecutivas o dolor puntual < 2 cm, ¿qué conducta debes tomar?',
    options: ['Aumentar el ritmo para calentar el hueso', 'Suspender el impacto y buscar valoración profesional', 'Tomar analgésicos y continuar el plan'],
    correct: 1
  },
  {
    q: '10. ¿Qué grupo de corredores presenta mayor vulnerabilidad al SETM según la evidencia epidemiológica?',
    options: ['Corredores principiantes (< 12 meses de práctica)', 'Corredores con más de 10 años de experiencia', 'Ciclistas recreativos'],
    correct: 0
  }
];

const STATS_FACTS = [
  { num: '47%', label: 'prevalencia reportada en corredores de calle', c: '#34c759' },
  { num: '46.3%', label: 'de los casos ocurren entre 23 y 25 años', c: '#32ade6' },
  { num: '≤ 10%', label: 'regla de progresión semanal segura', c: '#28a745' },
  { num: '0.8–1.3', label: 'rango seguro de Razón Carga Aguda:Crónica', c: '#ff9f0a' },
];

const ANATOMY_CARDS = [
  { title: 'Periostio tibial posteromedial', desc: 'Membrana vascularizada que recubre la tibia; se irrita por tracción fascial repetitiva y flexión ósea.', c: '#ff2e55', Icon: Bone },
  { title: 'Sóleo y tibial posterior', desc: 'Músculos profundos cuya contracción excéntrica tracciona el borde medial al controlar el descenso del arco.', c: '#34c759', Icon: Activity },
  { title: 'Remodelación ósea', desc: 'La diáfisis tibial requiere descanso progresivo para que la formación ósea compense el microdaño cíclico.', c: '#32ade6', Icon: Stethoscope },
];

const SYMPTOMS = [
  'Molestia difusa a lo largo de > 5 cm en el tercio medio-distal interno de la tibia.',
  'Dolor que aparece al iniciar el trote, suele disminuir al entrar en calor y reaparece tras finalizar.',
  'Sensibilidad palpable a lo largo del borde posteromedial tibial.',
  'Bandera roja temprana: dolor EVA ≥ 4 durante dos entrenamientos consecutivos, dolor puntual < 2 cm o dolor en reposo.',
];

const RISK_FACTORS = [
  { title: 'Picos de carga semanal (ACWR > 1.5)', detail: 'Incrementar kilómetros o esfuerzo por encima de la tolerancia tisular supera la capacidad de adaptación ósea (Gabbett, 2016).' },
  { title: 'Baja experiencia en running (< 12 meses)', detail: 'Los corredores novatos presentan más del doble de incidencia de lesiones por sobreuso frente a experimentados (Videbæk et al., 2015).' },
  { title: 'Caída navicular y debilidad de cadera', detail: 'El descenso aumentado del arco medial y la debilidad de abductores de cadera incrementan el estrés torsional tibial (Becker et al., 2018).' },
  { title: 'IMC ≥ 25 kg/m² y lesión previa', detail: 'Mayor masa corporal y antecedentes de lesión en miembro inferior elevan significativamente la probabilidad de SETM (Reinking et al., 2017).' },
];

const HABITS = [
  { title: 'Progresión ≤ 10%', desc: 'Evita aumentos abruptos de volumen semanal.', Icon: TrendingUp, c: '#32ade6' },
  { title: 'Cadencia protectora', desc: 'Eleva +5% tus pasos/min para acortar la zancada.', Icon: Timer, c: '#34c759' },
  { title: 'Variedad de superficie', desc: 'Alterna asfalto con tierra, grama o pista sintética.', Icon: Mountain, c: '#28a745' },
  { title: 'Fuerza de cadera y sóleo', desc: 'Estabiliza la pelvis y absorbe carga excéntrica.', Icon: Zap, c: '#f59e0b' },
  { title: 'Días sin impacto', desc: 'Intercala descanso activo en las primeras 8 semanas.', Icon: Moon, c: '#bf5af2' },
  { title: 'Calzado en buen estado', desc: 'Revisa desgaste y amortiguación cada 600–800 km.', Icon: Footprints, c: '#ff9f0a' },
];

const WARMUP = [
  { time: 2, act: 'Movilidad articular de tobillo (círculos y dorsiflexión en carga)' },
  { time: 2, act: 'Caminata en talones y puntas (activación tibial posterior y sóleo)' },
  { time: 2, act: 'Activación de abductores de cadera (pasos laterales controlados)' },
  { time: 2, act: 'Skipping bajo con cadencia alta (> 172 ppm)' },
  { time: 2, act: 'Trote progresivo suave con aterrizaje silencioso' },
];

// ============================================================================
// EJERCICIOS NEUROMUSCULARES PREVENTIVOS (TRAZADOS A BECKER 2018 Y MARQUES 2025)
// ============================================================================
const EXERCISES = [
  {
    id: 1,
    phase: 'Fortalecimiento',
    title: 'Elevación de talón con rodilla flexionada (Sóleo)',
    baseReps: 15,
    sets: 3,
    level: 'Esencial',
    img: '/assets/ex1-talones-NEeXVCxD.jpg',
    timer: { s: 45, label: 'Descanso entre series' },
    steps: [
      'Coloca el antepié sobre un escalón con las rodillas ligeramente flexionadas (25°–30°).',
      'Eleva los talones en 2 segundos usando ambos pies.',
      'Desciende lentamente durante 3 a 4 segundos controlando el movimiento.',
      'Mantén la flexión de rodilla para enfocar la carga en el músculo sóleo.'
    ],
    tip: 'Fortalece el sóleo excéntricamente para reducir la tracción sobre la fascia crural y el periostio tibial (Moen et al., 2009).'
  },
  {
    id: 2,
    phase: 'Fortalecimiento',
    title: 'Pie corto (Short Foot) y control de tibial posterior',
    baseReps: 10,
    sets: 3,
    level: 'Esencial',
    img: '/assets/ex2-banda-CEppt7e-.jpg',
    timer: { s: 5, label: 'Contracción isométrica' },
    steps: [
      'Sentado o de pie descalzo, apoya toda la planta en el suelo.',
      'Intenta acercar la base del dedo gordo hacia el talón elevando el arco plantar.',
      'Mantén los dedos largos y relajados (sin encogerlos en garra).',
      'Sostén 5 segundos por repetición.'
    ],
    tip: 'Contrarresta la caída navicular aumentada y fortalece el soporte dinámico del arco medial (Hamstra-Wright et al., 2015; Marques et al., 2025).'
  },
  {
    id: 3,
    phase: 'Fortalecimiento',
    title: 'Abducción de cadera para glúteo medio',
    baseReps: 12,
    sets: 3,
    level: 'Esencial',
    img: '/assets/ejercicios-atleta-Sq0ze4a5.jpg',
    timer: { s: 45, label: 'Descanso entre series' },
    steps: [
      'Recuéstate de lado con el tronco alineado o usa banda elástica sobre las rodillas.',
      'Eleva la pierna superior unos 30° llevando el talón ligeramente hacia atrás.',
      'Desciende de forma controlada sin rotar la pelvis.',
      'Realiza las repeticiones en ambos lados.'
    ],
    tip: 'La debilidad de abductores de cadera es un predictor clave del SETM documentado prospectivamente (Becker et al., 2018).'
  },
  {
    id: 4,
    phase: 'Estiramiento',
    title: 'Estiramiento de sóleo y tríceps sural en pared',
    baseReps: 30,
    sets: 3,
    isTime: true,
    level: 'Básico',
    img: '/assets/ex3-estiramiento-BQlpL-mO.jpg',
    timer: { s: 30, label: 'Tiempo de mantenimiento' },
    steps: [
      'Colócate frente a una pared en posición de paso corto.',
      'Flexiona la rodilla trasera manteniendo el talón completamente apoyado.',
      'Adelanta la rodilla hacia la pared hasta percibir tensión profunda en la pantorrilla baja.',
      'Sostén 30 segundos sin rebotes.'
    ],
    tip: 'Disminuye la rigidez pasiva del tríceps sural tras sesiones de carrera.'
  },
  {
    id: 5,
    phase: 'Estiramiento',
    title: 'Descarga miofascial controlada de pantorrilla',
    baseReps: 40,
    sets: 2,
    isTime: true,
    level: 'Básico',
    img: '/assets/ex4-rodillo-CCWq0QBt.jpg',
    timer: { s: 40, label: 'Tiempo por pierna' },
    steps: [
      'Apoya la parte posterior de la pantorrilla sobre un rodillo de espuma.',
      'Desliza suavemente desde el tendón de Aquiles hasta debajo de la rodilla.',
      'Nunca presiones directamente sobre el borde interno óseo de la tibia.',
      'Detente si aparece dolor agudo.'
    ],
    tip: 'Favorece la recuperación muscular posterior sin irritar el periostio tibial.'
  },
  {
    id: 6,
    phase: 'Propiocepción',
    title: 'Equilibrio monopodal controlado',
    baseReps: 30,
    sets: 3,
    isTime: true,
    level: 'Intermedio',
    img: '/assets/ex5-equilibrio-Dm1j_pE6.jpg',
    timer: { s: 30, label: 'Equilibrio por apoyo' },
    steps: [
      'Apóyate sobre un solo pie con la rodilla en semiflexión (15°).',
      'Mantén la pelvis horizontal y evita que la rodilla caiga hacia adentro.',
      'Conserva activo el arco longitudinal del pie durante toda la serie.',
      'Alterna ambas extremidades.'
    ],
    tip: 'El entrenamiento neuromuscular del miembro inferior es una de las intervenciones preventivas con mayor evidencia (Marques et al., 2025).'
  }
];

const PREVENTION_PLAN = [
  {
    week: 'Sem 1–2',
    title: 'Adaptación tisular y método Caminar–Trotar',
    tasks: [
      'Alternar bloques de 3 min de trote suave y 2 min de caminata rápida (20–25 min total)',
      'Mantener esfuerzo percibido Borg CR-10 entre 3 y 4 (suave-moderado)',
      'Completar rutina neuromuscular preventiva 3 veces por semana',
      'Verificar ausencia de dolor posteromedial tibial (EVA ≤ 1/10)'
    ]
  },
  {
    week: 'Sem 3–4',
    title: 'Consolidación de cadencia y control de carga',
    tasks: [
      'Incrementar volumen semanal máximo un 10% respecto a Sem 2',
      'Practicar cadencia objetivo (+5%) con el metrónomo integrado',
      'Verificar Razón Carga Aguda:Crónica (ACWR) en zona segura (0.8–1.3)',
      'Realizar calentamiento dinámico de 10 min antes de cada salida'
    ]
  },
  {
    week: 'Sem 5–6',
    title: 'Progresión aeróbica continua segura',
    tasks: [
      'Transición a trote continuo de 25–30 min en superficie mixta o blanda',
      'Incluir al menos 1 día sin impacto entre sesiones de carrera',
      'Registrar cada entrenamiento con escala Borg CR-10 y EVA',
      'Evaluar estabilidad y desgaste del calzado deportivo'
    ]
  },
  {
    week: 'Sem 7–8',
    title: 'Autonomía preventiva y evaluación final',
    tasks: [
      'Completar 30–40 min de running recreativo asintomático (EVA 0/10)',
      'Mantener equilibrio de carga aguda:crónica sin picos abruptos',
      'Completar Test Post de conocimiento preventivo (meta ≥ 30% mejora)',
      'Sostener rutina semanal de sóleo, tibial posterior y cadera'
    ]
  }
];

const RED_FLAGS = [
  'Dolor posteromedial tibial EVA ≥ 4 en dos sesiones consecutivas.',
  'Dolor punzante focalizado en un punto específico menor a 2 cm sobre el hueso.',
  'Molestia que persiste en reposo, al caminar o durante la noche.',
  'Inflamación visible, enrojecimiento o calor local en la espinilla.',
];

// ============================================================================
// GENERADOR DE 4 ESCENARIOS SIMULADOS PARA JUICIO DE EXPERTOS (CAPÍTULO IV)
// ============================================================================
const buildDemoScenarios = () => {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };

  return {
    seguro: {
      email: 'eval.seguro@umb.edu.co',
      password: 'demo',
      consentAccepted: true,
      consentDate: daysAgo(28),
      profile: {
        name: 'Escenario 1 · Progresión Segura',
        age: 21,
        sex: 'femenino',
        weightKg: 58,
        heightCm: 164,
        footType: 'neutra',
        experience: '3-6m',
        weeklyKm: 12,
        priorInjury: 'no',
        cadencePpm: 174
      },
      sessions: [
        { id: 101, date: daysAgo(25), distanceKm: 3.5, durationMin: 22, rpe: 4, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 102, date: daysAgo(22), distanceKm: 4.0, durationMin: 25, rpe: 4, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 103, date: daysAgo(18), distanceKm: 4.0, durationMin: 24, rpe: 4, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 104, date: daysAgo(15), distanceKm: 4.2, durationMin: 26, rpe: 5, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 105, date: daysAgo(11), distanceKm: 4.2, durationMin: 25, rpe: 4, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 106, date: daysAgo(8), distanceKm: 4.5, durationMin: 27, rpe: 5, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 107, date: daysAgo(4), distanceKm: 4.5, durationMin: 27, rpe: 4, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 108, date: daysAgo(1), distanceKm: 4.8, durationMin: 28, rpe: 5, eva: 0, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
      ],
      quizScores: { pre: 5, post: 9 },
      warmupChecks: [0, 1, 2, 3, 4],
      recoveryTasks: { '0-0': true, '0-1': true, '0-2': true, '0-3': true }
    },
    sobrecarga: {
      email: 'eval.sobrecarga@umb.edu.co',
      password: 'demo',
      consentAccepted: true,
      consentDate: daysAgo(28),
      profile: {
        name: 'Escenario 2 · Pico de Carga (ACWR)',
        age: 23,
        sex: 'masculino',
        weightKg: 82,
        heightCm: 175,
        footType: 'pronador',
        experience: '<3m',
        weeklyKm: 10,
        priorInjury: 'si',
        cadencePpm: 160
      },
      sessions: [
        { id: 201, date: daysAgo(24), distanceKm: 3.0, durationMin: 20, rpe: 4, eva: 0, legSide: 'derecha', painLocation: 'ninguna', painAtRest: false },
        { id: 202, date: daysAgo(18), distanceKm: 3.5, durationMin: 23, rpe: 5, eva: 1, legSide: 'derecha', painLocation: 'muscular_general', painAtRest: false },
        { id: 203, date: daysAgo(12), distanceKm: 4.0, durationMin: 25, rpe: 5, eva: 1, legSide: 'derecha', painLocation: 'muscular_general', painAtRest: false },
        { id: 204, date: daysAgo(5), distanceKm: 5.5, durationMin: 32, rpe: 8, eva: 2, legSide: 'derecha', painLocation: 'posteromedial_difuso', painAtRest: false },
        { id: 205, date: daysAgo(3), distanceKm: 6.0, durationMin: 35, rpe: 8, eva: 2, legSide: 'derecha', painLocation: 'posteromedial_difuso', painAtRest: false },
        { id: 206, date: daysAgo(1), distanceKm: 6.5, durationMin: 38, rpe: 9, eva: 3, legSide: 'derecha', painLocation: 'posteromedial_difuso', painAtRest: false },
      ],
      quizScores: { pre: 4, post: null },
      warmupChecks: [0, 1],
      recoveryTasks: { '0-0': true }
    },
    banderaRoja: {
      email: 'eval.banderaroja@umb.edu.co',
      password: 'demo',
      consentAccepted: true,
      consentDate: daysAgo(21),
      profile: {
        name: 'Escenario 3 · Bandera Roja (EVA ≥ 4)',
        age: 20,
        sex: 'femenino',
        weightKg: 60,
        heightCm: 165,
        footType: 'desconocido',
        experience: '<3m',
        weeklyKm: 12,
        priorInjury: 'no',
        cadencePpm: 166
      },
      sessions: [
        { id: 301, date: daysAgo(14), distanceKm: 4.0, durationMin: 25, rpe: 5, eva: 1, legSide: 'izquierda', painLocation: 'ninguna', painAtRest: false },
        { id: 302, date: daysAgo(10), distanceKm: 4.2, durationMin: 26, rpe: 5, eva: 2, legSide: 'izquierda', painLocation: 'posteromedial_difuso', painAtRest: false },
        { id: 303, date: daysAgo(4), distanceKm: 4.0, durationMin: 25, rpe: 6, eva: 5, legSide: 'izquierda', painLocation: 'posteromedial_difuso', painAtRest: false },
        { id: 304, date: daysAgo(1), distanceKm: 4.0, durationMin: 26, rpe: 6, eva: 5, legSide: 'izquierda', painLocation: 'posteromedial_difuso', painAtRest: false },
      ],
      quizScores: { pre: 6, post: null },
      warmupChecks: [0],
      recoveryTasks: {}
    },
    focalOseo: {
      email: 'eval.focal@umb.edu.co',
      password: 'demo',
      consentAccepted: true,
      consentDate: daysAgo(14),
      profile: {
        name: 'Escenario 4 · Dolor Focal (< 2 cm)',
        age: 22,
        sex: 'masculino',
        weightKg: 70,
        heightCm: 174,
        footType: 'neutra',
        experience: '<3m',
        weeklyKm: 10,
        priorInjury: 'no',
        cadencePpm: 168
      },
      sessions: [
        { id: 401, date: daysAgo(10), distanceKm: 3.5, durationMin: 22, rpe: 4, eva: 0, legSide: 'derecha', painLocation: 'ninguna', painAtRest: false },
        { id: 402, date: daysAgo(5), distanceKm: 3.8, durationMin: 24, rpe: 5, eva: 2, legSide: 'derecha', painLocation: 'posteromedial_difuso', painAtRest: false },
        { id: 403, date: daysAgo(1), distanceKm: 3.5, durationMin: 23, rpe: 5, eva: 3, legSide: 'derecha', painLocation: 'focal_puntual', painAtRest: true },
      ],
      quizScores: { pre: 5, post: null },
      warmupChecks: [0],
      recoveryTasks: {}
    }
  };
};

function AppIconMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="rsd-app-runner" x1="33" y1="22" x2="95" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#98e020" />
          <stop offset="100%" stopColor="#28a745" />
        </linearGradient>
        <linearGradient id="rsd-app-sun" x1="17" y1="17" x2="45" y2="45" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffd60a" />
          <stop offset="100%" stopColor="#ff9f0a" />
        </linearGradient>
      </defs>
      <g>
        <circle cx="31" cy="31" r="7" fill="url(#rsd-app-sun)" />
        <path
          d="M31 16V20M31 42V46M16 31H20M42 31H46M20.4 20.4L23.2 23.2M41.6 20.4L38.8 23.2M20.4 41.6L23.2 38.8M41.6 41.6L38.8 38.8"
          stroke="url(#rsd-app-sun)"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      </g>
      <circle cx="80" cy="30" r="8.5" fill="url(#rsd-app-runner)" />
      <path d="M72 44L61 67" stroke="url(#rsd-app-runner)" strokeWidth="11" strokeLinecap="round" />
      <path d="M47 60L54 49L72 46L84 56L95 48" stroke="url(#rsd-app-runner)" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33 86L48 83L61 67L82 69L78 94" stroke="url(#rsd-app-runner)" strokeWidth="9.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 102Q66 112 96 96" stroke="url(#rsd-app-runner)" strokeOpacity="0.35" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function App() {
  const [usersDb, setUsersDb] = useLocalStorage('tesis_users_db', {});
  const [currentEmail, setCurrentEmail] = useLocalStorage('tesis_current_user', null);
  const [unit, setUnit] = useLocalStorage('tesis_unit_system', 'metric');
  const [fontSize, setFontSize] = useLocalStorage('tesis_font_size', 'normal');
  const [theme, setTheme] = useLocalStorage('tesis_theme', 'dark');

  const [tab, setTab] = useState('inicio');
  const [showA11y, setShowA11y] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClinicalReport, setShowClinicalReport] = useState(false);
  const [activeEx, setActiveEx] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState(null);

  const currentUser = currentEmail ? usersDb[currentEmail] : null;

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const updateCurrentUser = (updater) => {
    if (!currentEmail) return;
    setUsersDb((prev) => {
      const existing = prev[currentEmail];
      if (!existing) return prev;
      const updated = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
      return { ...prev, [currentEmail]: updated };
    });
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    notify(`Tema ${next === 'dark' ? 'Oscuro' : 'Claro'} activado`);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-font', fontSize);
  }, [fontSize]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // --- LOGIN / REGISTRO ---
  if (!currentUser) {
    return (
      <AuthView
        theme={theme}
        onToggleTheme={toggleTheme}
        onRegister={(email, password, consentAccepted) => {
          const cleanEmail = email.toLowerCase().trim();
          if (usersDb[cleanEmail]) {
            return 'Este correo ya está registrado. Inicia sesión.';
          }
          setUsersDb({
            ...usersDb,
            [cleanEmail]: {
              email: cleanEmail,
              password,
              consentAccepted,
              consentDate: new Date().toISOString().split('T')[0],
              profile: null,
              sessions: [],
              quizScores: { pre: null, post: null },
              warmupChecks: [],
              recoveryTasks: {}
            }
          });
          setCurrentEmail(cleanEmail);
          notify('Cuenta local creada bajo Ley 1581 de 2012');
          return null;
        }}
        onLogin={(email, password) => {
          const cleanEmail = email.toLowerCase().trim();
          const found = usersDb[cleanEmail];
          if (!found || found.password !== password) {
            return 'Correo o contraseña incorrectos.';
          }
          setCurrentEmail(cleanEmail);
          notify('Sesión local iniciada');
          return null;
        }}
        onDemoScenario={(scenarioKey) => {
          const scenarios = buildDemoScenarios();
          const chosen = scenarios[scenarioKey] || scenarios.seguro;
          setUsersDb((prev) => ({
            ...prev,
            [chosen.email]: chosen
          }));
          setCurrentEmail(chosen.email);
          setTab('inicio');
          notify(`Cargado: ${chosen.profile.name}`);
        }}
      />
    );
  }

  // --- MOTOR BIOMÉDICO DE ESTRATIFICACIÓN Y SEGURIDAD CLÍNICA ---
  const calculateBiometrics = (user) => {
    const p = user.profile;
    if (!p) return null;

    const heightM = p.heightCm / 100;
    const bmi = +(p.weightKg / (heightM * heightM)).toFixed(1);

    const sortedSessions = [...(user.sessions || [])].sort((a, b) => a.date.localeCompare(b.date));

    // Cálculo temporal real de ACWR (7 días agudos vs promedio semanal 28 días)
    let acuteKm = 0;
    let chronicKm = Math.max(1, p.weeklyKm);

    if (sortedSessions.length > 0) {
      const refDate = new Date(`${sortedSessions[sortedSessions.length - 1].date}T12:00:00`);
      const msDay = 86400000;

      const last7 = sortedSessions.filter((s) => {
        const d = new Date(`${s.date}T12:00:00`);
        const diffDays = (refDate - d) / msDay;
        return diffDays >= 0 && diffDays < 7;
      });

      const last28 = sortedSessions.filter((s) => {
        const d = new Date(`${s.date}T12:00:00`);
        const diffDays = (refDate - d) / msDay;
        return diffDays >= 0 && diffDays < 28;
      });

      acuteKm = +last7.reduce((acc, s) => acc + Number(s.distanceKm || 0), 0).toFixed(1);

      const earliestDate = new Date(`${sortedSessions[0].date}T12:00:00`);
      const spanDays = Math.max(1, (refDate - earliestDate) / msDay + 1);

      if (spanDays >= 21) {
        const sum28 = last28.reduce((acc, s) => acc + Number(s.distanceKm || 0), 0);
        chronicKm = +Math.max(1, sum28 / 4).toFixed(1);
      } else {
        const weeksLogged = Math.max(1, Math.ceil(spanDays / 7));
        const sumLogged = last28.reduce((acc, s) => acc + Number(s.distanceKm || 0), 0);
        chronicKm = +Math.max(1, ((p.weeklyKm * (4 - weeksLogged)) + sumLogged) / 4).toFixed(1);
      }
    }

    const acwr = +(acuteKm / chronicKm).toFixed(2);

    let acwrStatus = 'Zona segura';
    let acwrColor = '#34c759';
    if (sortedSessions.length === 0) {
      acwrStatus = 'Sin registros';
      acwrColor = '#32ade6';
    } else if (acwr < 0.8) {
      acwrStatus = 'Subcarga';
      acwrColor = '#32ade6';
    } else if (acwr > 1.5) {
      acwrStatus = 'Sobrecarga (> 1.5)';
      acwrColor = '#ff453a';
    } else if (acwr > 1.3) {
      acwrStatus = 'Precaución (1.3–1.5)';
      acwrColor = '#f59e0b';
    }

    // Reglas de Bandera Roja (Prioridad Clínica Absoluta)
    const lastTwo = sortedSessions.slice(-2);
    const lastSession = sortedSessions[sortedSessions.length - 1];
    const consecutivePainAlert = lastTwo.length === 2 && lastTwo.every((s) => s.eva >= 4);
    const severeSinglePain = lastSession && lastSession.eva >= 6;
    const focalBonePain = lastSession && lastSession.eva > 0 && lastSession.painLocation === 'focal_puntual';
    const restPainAlert = lastSession && lastSession.eva > 0 && Boolean(lastSession.painAtRest);

    const redFlagActive = Boolean(
      consecutivePainAlert || severeSinglePain || focalBonePain || restPainAlert
    );

    const recentRpeList = sortedSessions.slice(-4);
    const avgRpe = recentRpeList.length
      ? +(recentRpeList.reduce((a, s) => a + s.rpe, 0) / recentRpeList.length).toFixed(1)
      : 0;

    // Estratificación heurística explicable
    const reasons = [];
    let riskScore = 0;

    if (bmi >= 25) {
      riskScore += 1.5;
      reasons.push(`IMC elevado (${bmi} kg/m² ≥ 25) incrementa carga mecánica tibial.`);
    }
    if (p.sex === 'femenino') {
      riskScore += 1;
      reasons.push('Sexo femenino registrado como factor predisponente intrínseco.');
    }
    if (p.footType === 'pronador') {
      riskScore += 1.5;
      reasons.push('Tendencia pronadora / caída navicular aumenta tracción sobre tibial posterior y sóleo.');
    }
    if (p.experience === '<3m' || p.experience === '3-6m') {
      riskScore += 1;
      reasons.push('Experiencia menor a 6 meses requiere progresión tisular gradual.');
    }
    if (p.priorInjury === 'si') {
      riskScore += 2;
      reasons.push('Antecedente de lesión previa en miembro inferior.');
    }
    if (sortedSessions.length > 0 && acwr > 1.5) {
      riskScore += 3;
      reasons.push(`Pico de carga semanal elevado (ACWR = ${acwr} > 1.5).`);
    } else if (sortedSessions.length > 0 && acwr > 1.3) {
      riskScore += 1.5;
      reasons.push(`Zona de precaución de carga (ACWR = ${acwr} entre 1.3 y 1.5).`);
    }
    if (avgRpe > 7) {
      riskScore += 1.5;
      reasons.push(`Esfuerzo percibido promedio alto (Borg ${avgRpe}/10 > 7).`);
    }
    if ((p.cadencePpm || 164) < 170) {
      riskScore += 0.5;
      reasons.push(`Cadencia habitual baja (${p.cadencePpm || 164} ppm < 170 ppm).`);
    }
    if (!redFlagActive && lastSession && lastSession.eva > 0 && lastSession.painLocation === 'posteromedial_difuso') {
      riskScore += 1;
      reasons.push('Signo temprano: molestia difusa (> 5 cm) en borde posteromedial distal.');
    }

    let riskLevel = 'Bajo';
    let riskColor = '#34c759';
    let loadFactor = 1.0;

    if (redFlagActive) {
      riskLevel = 'Alto';
      riskColor = '#ff453a';
      loadFactor = 0;
      if (focalBonePain) {
        reasons.unshift('BANDERA ROJA: Dolor puntual focalizado (< 2 cm) sobre cortical tibial. Sospecha de estrés óseo focal.');
      } else if (restPainAlert) {
        reasons.unshift('BANDERA ROJA: Dolor tibial persistente en reposo o al caminar. Requiere valoración médica prioritaria.');
      } else if (consecutivePainAlert) {
        reasons.unshift('BANDERA ROJA: Dolor posteromedial EVA ≥ 4 en dos sesiones consecutivas.');
      } else if (severeSinglePain) {
        reasons.unshift(`BANDERA ROJA: Dolor intenso reportado (EVA ${lastSession.eva}/10).`);
      }
    } else if (riskScore >= 5.5) {
      riskLevel = 'Alto';
      riskColor = '#ff453a';
      loadFactor = 0.75;
    } else if (riskScore >= 3) {
      riskLevel = 'Moderado';
      riskColor = '#f59e0b';
      loadFactor = 0.9;
    }

    if (reasons.length === 0) {
      reasons.push('Parámetros antropométricos y de carga dentro de rangos preventivos seguros.');
    }

    return {
      bmi,
      acwr,
      acwrStatus,
      acwrColor,
      acuteKm,
      chronicKm,
      consecutivePainAlert,
      redFlagActive,
      lastSession,
      avgRpe,
      riskLevel,
      riskColor,
      loadFactor,
      reasons
    };
  };

  const bio = currentUser ? calculateBiometrics(currentUser) : null;

  if (!currentUser.profile || editingProfile) {
    return (
      <PatientOnboarding
        initialData={currentUser.profile}
        requireConsent={false}
        unit={unit}
        setUnit={setUnit}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSave={(newProfile) => {
          const cleanProfile = sanitizeProfile(newProfile);
          updateCurrentUser({ profile: cleanProfile });
          setEditingProfile(false);
          notify('Perfil biométrico calibrado');
        }}
        onCancel={currentUser.profile ? () => setEditingProfile(false) : null}
      />
    );
  }

  const handleExportCSV = () => {
    const p = currentUser.profile;
    const headers = [
      'Correo', 'Nombre', 'Edad', 'Sexo', 'Peso_kg', 'Talla_cm', 'IMC',
      'Pisada', 'Experiencia_Running', 'Cadencia_ppm', 'Lesion_Previa',
      'ACWR', 'Nivel_Alerta', 'Bandera_Roja', 'RPE_Promedio',
      'Total_Sesiones', 'Quiz_Pre', 'Quiz_Post', 'Mejora_Quiz_%'
    ];
    const pre = currentUser.quizScores?.pre ?? '';
    const post = currentUser.quizScores?.post ?? '';
    const delta = (pre !== '' && post !== '' && pre > 0)
      ? Math.round(((post - pre) / pre) * 100)
      : '';

    const row = [
      currentUser.email, `"${p.name}"`, p.age, p.sex, p.weightKg, p.heightCm, bio.bmi,
      p.footType, p.experience, p.cadencePpm || 164, p.priorInjury,
      bio.acwr, bio.riskLevel, bio.redFlagActive ? 'SI' : 'NO', bio.avgRpe,
      currentUser.sessions.length, pre, post, delta
    ];

    const sessionHeaders = ['\n\nFecha_Sesion', 'Distancia_km', 'Duracion_min', 'Borg_RPE', 'Dolor_EVA', 'Extremidad', 'Localizacion_Dolor', 'Dolor_En_Reposo'];
    const sessionRows = currentUser.sessions.map((s) =>
      [
        s.date,
        s.distanceKm,
        s.durationMin,
        s.rpe,
        s.eva,
        s.eva > 0 ? (s.legSide || 'izquierda') : 'N/A',
        s.painLocation || 'ninguna',
        s.painAtRest ? 'SI' : 'NO'
      ].join(',')
    );

    const csvContent = '\uFEFF' + [
      headers.join(','),
      row.join(','),
      sessionHeaders.join(','),
      ...sessionRows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RunSinDolor_Datos_${p.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Archivo CSV exportado');
  };

  const confirmDeleteAccount = () => {
    setUsersDb((prev) => {
      const copy = { ...prev };
      delete copy[currentEmail];
      return copy;
    });
    setCurrentEmail(null);
    setShowDeleteModal(false);
    notify('Datos eliminados definitivamente');
  };

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {/* BARRA SUPERIOR */}
      <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div className="brand-mark">
              <AppIconMark size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="h3" style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                RunSinDolor
              </div>
              <div className="eyebrow" style={{ fontSize: '10px', lineHeight: 1.1 }}>
                {TABS.find((t) => t.id === tab)?.label || 'Resumen'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="icon-circle-btn tap"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun size={16} color="#ffd60a" /> : <Moon size={16} />}
            </button>

            <button
              type="button"
              className="avatar-btn tap"
              onClick={() => setShowA11y(true)}
              title="Perfil y preferencias"
              aria-label="Abrir perfil y preferencias"
            >
              {(currentUser.profile.name || 'R')
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join('')}
            </button>
          </div>
        </div>
      </header>

      {/* HOJA DE PERFIL, PREFERENCIAS Y PRIVACIDAD */}
      {showA11y && (
        <div className="sheet-overlay" onClick={() => setShowA11y(false)}>
          <div className="sheet-panel stack" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="h2">{currentUser.profile.name}</h2>
                <div className="small muted">{currentUser.email}</div>
              </div>
              <button
                type="button"
                className="icon-circle-btn tap"
                onClick={() => setShowA11y(false)}
                aria-label="Cerrar preferencias"
              >
                <X size={16} />
              </button>
            </div>

            <div className="card stack" style={{ gap: '12px' }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: '6px' }}>Apariencia</div>
                <div className="seg" style={{ '--n': 2 }}>
                  <div
                    className="seg-pill"
                    style={{ transform: `translateX(${theme === 'dark' ? 0 : 100}%)` }}
                  />
                  <button
                    type="button"
                    className={`seg-btn ${theme === 'dark' ? 'on' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={14} /> Oscuro
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${theme === 'light' ? 'on' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={14} /> Claro
                  </button>
                </div>
              </div>

              <div>
                <div className="eyebrow" style={{ marginBottom: '6px' }}>Unidades de medida</div>
                <div className="seg" style={{ '--n': 2 }}>
                  <div
                    className="seg-pill"
                    style={{ transform: `translateX(${unit === 'metric' ? 0 : 100}%)` }}
                  />
                  <button
                    type="button"
                    className={`seg-btn ${unit === 'metric' ? 'on' : ''}`}
                    onClick={() => {
                      setUnit('metric');
                      notify('Sistema Métrico (kg/km)');
                    }}
                  >
                    Métrico (kg / km)
                  </button>
                  <button
                    type="button"
                    className={`seg-btn ${unit === 'imperial' ? 'on' : ''}`}
                    onClick={() => {
                      setUnit('imperial');
                      notify('Sistema Imperial (lb/mi)');
                    }}
                  >
                    Imperial (lb / mi)
                  </button>
                </div>
              </div>

              <div>
                <div className="eyebrow" style={{ marginBottom: '6px' }}>Tamaño de texto</div>
                <div className="seg" style={{ '--n': 3 }}>
                  <div
                    className="seg-pill"
                    style={{
                      transform: `translateX(${fontSize === 'normal' ? 0 : fontSize === 'large' ? 100 : 200}%)`
                    }}
                  />
                  {[
                    { id: 'normal', label: 'Normal' },
                    { id: 'large', label: 'Grande' },
                    { id: 'xlarge', label: 'Extra' }
                  ].map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      className={`seg-btn ${fontSize === opt.id ? 'on' : ''}`}
                      onClick={() => setFontSize(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="ios-group">
              <button
                type="button"
                className="ios-row"
                onClick={() => {
                  setShowA11y(false);
                  setEditingProfile(true);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                  <User size={18} color="var(--pink)" />
                  Editar perfil biométrico
                </span>
                <ChevronRight size={18} color="var(--ink-3)" />
              </button>

              <button
                type="button"
                className="ios-row"
                onClick={() => {
                  setShowA11y(false);
                  setShowClinicalReport(true);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                  <FileText size={18} color="#ff9f0a" />
                  Resumen clínico-deportivo
                </span>
                <ChevronRight size={18} color="var(--ink-3)" />
              </button>

              <button
                type="button"
                className="ios-row"
                onClick={() => {
                  setShowA11y(false);
                  handleExportCSV();
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                  <Download size={18} color="var(--accent)" />
                  Exportar historial CSV
                </span>
                <ChevronRight size={18} color="var(--ink-3)" />
              </button>

              <button
                type="button"
                className="ios-row"
                onClick={() => {
                  setShowA11y(false);
                  setCurrentEmail(null);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                  <LogOut size={18} color="var(--ink-2)" />
                  Cerrar sesión / Cambiar escenario
                </span>
                <ChevronRight size={18} color="var(--ink-3)" />
              </button>

              <button
                type="button"
                className="ios-row"
                onClick={() => {
                  setShowA11y(false);
                  setShowDeleteModal(true);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, color: 'var(--danger)' }}>
                  <Trash2 size={18} />
                  Eliminar cuenta y datos (Ley 1581)
                </span>
                <ChevronRight size={18} color="var(--ink-3)" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="screen stagger">
        {tab === 'inicio' && (
          <DashboardView
            user={currentUser}
            bio={bio}
            unit={unit}
            onOpenSession={() => setShowSessionModal(true)}
            onOpenClinicalReport={() => setShowClinicalReport(true)}
            onGoTab={setTab}
          />
        )}
        {tab === 'cadencia' && (
          <CadenceView
            cadencePpm={currentUser.profile.cadencePpm || 164}
            onSaveCadence={(newPpm) => {
              updateCurrentUser((u) => ({
                ...u,
                profile: { ...u.profile, cadencePpm: newPpm }
              }));
              notify(`Cadencia actualizada: ${newPpm} ppm`);
            }}
          />
        )}
        {tab === 'quees' && (
          <WhatIsView
            sex={currentUser.profile.sex}
            quizScores={currentUser.quizScores || { pre: null, post: null }}
            onSaveQuiz={(type, score) => {
              updateCurrentUser((u) => ({
                ...u,
                quizScores: { ...u.quizScores, [type]: score }
              }));
              notify(`Test ${type === 'pre' ? 'Inicial' : 'Final'} guardado: ${score}/10 pts`);
            }}
          />
        )}
        {tab === 'prevencion' && (
          <PreventionView
            checked={currentUser.warmupChecks || []}
            setChecked={(arr) => updateCurrentUser({ warmupChecks: arr })}
            notify={notify}
          />
        )}
        {tab === 'ejercicios' && (
          <ExercisesView
            bio={bio}
            onOpenExercise={(ex) => setActiveEx(ex)}
            onOpenClinicalReport={() => setShowClinicalReport(true)}
          />
        )}
        {tab === 'recuperacion' && (
          <RecoveryView
            doneTasks={currentUser.recoveryTasks || {}}
            setDoneTasks={(obj) => updateCurrentUser({ recoveryTasks: obj })}
            notify={notify}
          />
        )}

        <div className="footer-note">
          RunSinDolor · Prototipo interactivo para prevención primaria del SETM (UMB · Ingeniería Biomédica). Protegido bajo Ley 1581 de 2012. Herramienta educativa y preventiva; no sustituye valoración médica.
        </div>
      </main>

      {showSessionModal && (
        <LogSessionModal
          unit={unit}
          onClose={() => setShowSessionModal(false)}
          onSaveSession={(session) => {
            const clean = sanitizeSession(session);
            updateCurrentUser((u) => ({
              ...u,
              sessions: [...u.sessions, { ...clean, id: Date.now() }]
            }));
            setShowSessionModal(false);
            notify('Entrenamiento registrado');
          }}
        />
      )}

      {showClinicalReport && (
        <ClinicalReportModal
          user={currentUser}
          bio={bio}
          unit={unit}
          onClose={() => setShowClinicalReport(false)}
          onCopyText={() => {
            const p = currentUser.profile;
            const ls = bio.lastSession;
            const summary = [
              `RESUMEN PREVENTIVO RUNSINDOLOR (UMB - ING. BIOMÉDICA)`,
              `Usuario: ${p.name} | Edad: ${p.age} años | Sexo: ${p.sex} | IMC: ${bio.bmi} kg/m²`,
              `Experiencia: ${p.experience} | Lesión previa: ${p.priorInjury.toUpperCase()} | Cadencia: ${p.cadencePpm} ppm`,
              `Carga aguda (7d): ${bio.acuteKm} km | Carga crónica (28d): ${bio.chronicKm} km | ACWR: ${bio.acwr} (${bio.acwrStatus})`,
              `Nivel de alerta: ${bio.riskLevel.toUpperCase()} | Bandera roja activa: ${bio.redFlagActive ? 'SÍ' : 'NO'}`,
              `Última sesión: ${ls ? `${ls.date} (${ls.distanceKm} km, Borg ${ls.rpe}/10, EVA ${ls.eva}/10${ls.eva > 0 ? `, ${LEG_SIDE_LABELS[ls.legSide || 'izquierda']}, ${PAIN_ZONE_LABELS[ls.painLocation || 'ninguna']}, Reposo: ${ls.painAtRest ? 'SÍ' : 'NO'}` : ''})` : 'Sin sesiones'}`
            ].join('\n');
            navigator.clipboard?.writeText(summary);
            notify('Resumen copiado al portapapeles');
          }}
        />
      )}

      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: '#000000cc',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: '18px'
          }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="card stack"
            style={{ maxWidth: '420px', width: '100%', borderColor: '#ff453a66' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="icon-tile" style={{ '--c': '#ff453a' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <div className="eyebrow" style={{ color: '#ff453a' }}>Ley 1581 de 2012</div>
                <h2 className="h2">Eliminar cuenta y datos</h2>
              </div>
            </div>
            <p className="small muted">
              ¿Deseas eliminar permanentemente tu cuenta, perfil biométrico y todas las sesiones registradas? Esta acción no se puede deshacer.
            </p>
            <div className="grid-2">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="btn btn-soft tap">
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                className="btn tap"
                style={{ background: '#ff453a', color: '#ffffff' }}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeEx && (
        <ExerciseModal ex={activeEx} onClose={() => setActiveEx(null)} />
      )}

      <nav className="tabbar" aria-label="Navegación principal">
        <div className="tabbar-inner">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                className={`tab ${active ? 'on' : ''}`}
                onClick={() => {
                  setTab(id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ============================================================================
// 0. PANTALLA DE AUTENTICACIÓN + SELECTOR DE 4 ESCENARIOS PARA EVALUADORES
// ============================================================================
function AuthView({ theme, onToggleTheme, onLogin, onRegister, onDemoScenario }) {
  const [isRegister, setIsRegister] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('Completa tu correo y contraseña.');
      return;
    }
    if (isRegister) {
      if (!consent) {
        setError('Debes aceptar el consentimiento informado (Ley 1581 de 2012).');
        return;
      }
      const err = onRegister(email, password, consent);
      if (err) setError(err);
    } else {
      const err = onLogin(email, password);
      if (err) setError(err);
    }
  };

  return (
    <div
      className="screen auth-screen stagger"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button type="button" onClick={onToggleTheme} className="btn-soft tap" style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {theme === 'dark' ? <><Sun size={15} color="#ffd60a" /> Tema Claro</> : <><Moon size={15} /> Tema Oscuro</>}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <span
          style={{
            display: 'inline-block',
            margin: 0,
            padding: 0,
            fontSize: '30px',
            fontWeight: 800,
            letterSpacing: '-0.01em',
            color: '#34c759'
          }}
        >
          RunSinDolor
        </span>
      </div>

      <div className="hero-card" style={{ minHeight: '210px', marginBottom: '18px', justifyContent: 'flex-end' }}>
        <img
          src="/assets/Inicio.jpg"
          alt="Running preventivo"
          className="hero-bg"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="hero-overlay" />
        <div
          className="hero-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            width: '100%'
          }}
        >
          <span className="badge" style={{ marginBottom: '6px' }}>UMB · Ingeniería Biomédica</span>
          <h1 className="display" style={{ fontSize: '30px', marginTop: '2px' }}>
            Corre seguro, <span className="grad-text">protege tus tibias</span>
          </h1>
        </div>
      </div>

      <div className="seg" style={{ '--n': 2, marginBottom: '14px' }}>
        <div className="seg-pill" style={{ transform: `translateX(${isRegister ? 100 : 0}%)` }} />
        <button type="button" className={`seg-btn ${!isRegister ? 'on' : ''}`} onClick={() => { setIsRegister(false); setError(null); }}>
          Iniciar Sesión
        </button>
        <button type="button" className={`seg-btn ${isRegister ? 'on' : ''}`} onClick={() => { setIsRegister(true); setError(null); }}>
          Crear Cuenta
        </button>
      </div>

      <form onSubmit={handleSubmit} className="card stack">
        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="eyebrow">Correo electrónico</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              required
              placeholder="corredor@ejemplo.com"
              className="input-field"
              style={{ paddingLeft: '38px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Mail size={16} color="var(--ink-3)" style={{ position: 'absolute', left: '12px', top: '15px' }} />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 0 }}>
          <label className="eyebrow">Contraseña</label>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="input-field"
              style={{ paddingLeft: '38px' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Lock size={16} color="var(--ink-3)" style={{ position: 'absolute', left: '12px', top: '15px' }} />
          </div>
        </div>

        {isRegister && (
          <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', padding: '8px', borderRadius: '12px', background: 'var(--surface-2)' }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: '3px', accentColor: '#34c759', width: '16px', height: '16px' }}
            />
            <span className="small muted" style={{ fontSize: '12px' }}>
              Acepto el tratamiento confidencial de mis datos antropométricos y deportivos para fines preventivos y académicos conforme a la <strong>Ley 1581 de 2012</strong> (Habeas Data).
            </span>
          </label>
        )}

        {error && (
          <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#ff453a22', color: '#ff453a', fontSize: '13px', fontWeight: '600' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary tap">
          <span>{isRegister ? 'Registrarme y Continuar' : 'Entrar'}</span>
          <ArrowRight size={18} />
        </button>
      </form>

      {/* MODO DEMOSTRACIÓN PARA JUICIO DE EXPERTOS */}
      <div style={{ marginTop: '16px' }}>
        <button
          type="button"
          onClick={() => setShowDemoMenu(!showDemoMenu)}
          className="btn btn-soft tap"
        >
          <Award size={17} color="var(--pink)" />
          <span>Modo Evaluación (4 Escenarios Clínicos)</span>
          <ChevronDown size={16} style={{ transform: showDemoMenu ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>

        {showDemoMenu && (
          <div className="card stack" style={{ marginTop: '10px', gap: '8px' }}>
            <div className="eyebrow">Selecciona un caso simulado para auditar el algoritmo:</div>
            <button
              type="button"
              onClick={() => onDemoScenario('seguro')}
              className="ios-row"
              style={{ background: 'var(--surface-2)', borderRadius: '12px' }}
            >
              <div>
                <div className="h3" style={{ color: '#34c759' }}>Caso 1: Progresión Segura</div>
                <div className="small muted">ACWR 1.07 · EVA 0/10 · Dosis preventiva 100%</div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
            </button>

            <button
              type="button"
              onClick={() => onDemoScenario('sobrecarga')}
              className="ios-row"
              style={{ background: 'var(--surface-2)', borderRadius: '12px' }}
            >
              <div>
                <div className="h3" style={{ color: '#f59e0b' }}>Caso 2: Sobrecarga de Entrenamiento</div>
                <div className="small muted">ACWR 1.64 (&gt; 1.5) · Borg 8/10 · Alerta preventiva</div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
            </button>

            <button
              type="button"
              onClick={() => onDemoScenario('banderaRoja')}
              className="ios-row"
              style={{ background: 'var(--surface-2)', borderRadius: '12px' }}
            >
              <div>
                <div className="h3" style={{ color: '#ff453a' }}>Caso 3: Bandera Roja (EVA ≥ 4)</div>
                <div className="small muted">Dolor difuso &gt; 5 cm en 2 sesiones seguidas</div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
            </button>

            <button
              type="button"
              onClick={() => onDemoScenario('focalOseo')}
              className="ios-row"
              style={{ background: 'var(--surface-2)', borderRadius: '12px' }}
            >
              <div>
                <div className="h3" style={{ color: '#ff2e55' }}>Caso 4: Tamizaje Focal (&lt; 2 cm)</div>
                <div className="small muted">Dolor puntual en hueso y en reposo · Bloqueo</div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 1. FORMULARIO BIOMÉTRICO DEL CORREDOR
// ============================================================================
function PatientOnboarding({ initialData, requireConsent, unit, setUnit, theme, onToggleTheme, onSave, onCancel }) {
  const [name, setName] = useState(initialData?.name || '');
  const [age, setAge] = useState(initialData?.age || 21);
  const [sex, setSex] = useState(initialData?.sex || 'femenino');
  const [weightKg, setWeightKg] = useState(initialData?.weightKg || 65);
  const [heightCm, setHeightCm] = useState(initialData?.heightCm || 170);
  const [footType, setFootType] = useState(initialData?.footType || 'desconocido');
  const [experience, setExperience] = useState(initialData?.experience || '<3m');
  const [weeklyKm, setWeeklyKm] = useState(initialData?.weeklyKm || 10);
  const [priorInjury, setPriorInjury] = useState(initialData?.priorInjury || 'no');
  const [cadencePpm, setCadencePpm] = useState(initialData?.cadencePpm || 164);
  const [consentChecked, setConsentChecked] = useState(!requireConsent);

  const liveBmi = heightCm > 0 ? +(weightKg / ((heightCm / 100) ** 2)).toFixed(1) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (requireConsent && !consentChecked) return;
    onSave({
      name: name.trim(),
      age: Number(age),
      sex,
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      footType,
      experience,
      weeklyKm: Number(weeklyKm),
      priorInjury,
      cadencePpm: Number(cadencePpm)
    });
  };

  return (
    <div
      className="screen stagger"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '8px' }}>
        <span className="badge">Variables de Ingreso</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn-soft tap"
            style={{ minHeight: '34px', width: '34px', padding: 0, display: 'grid', placeItems: 'center' }}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun size={15} color="#ffd60a" /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            className="btn-soft tap tnum"
            style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }}
            onClick={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}
          >
            {unit === 'metric' ? 'Métrico (kg/cm)' : 'Imperial (lb/in)'}
          </button>
        </div>
      </div>

      <h1 className="display">
        Perfil del <span className="grad-text">corredor</span>
      </h1>
      <p className="muted small" style={{ marginTop: '6px', marginBottom: '18px' }}>
        Parametrización antropométrica, sociodemográfica y de carga base (población objetivo 18–25 años).
      </p>

      <form onSubmit={handleSubmit} className="stack">
        <div className="card">
          <div className="input-group">
            <label className="eyebrow">Nombre completo</label>
            <input type="text" required placeholder="Ej. Laura Gómez" className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid-2">
            <div className="input-group">
              <label className="eyebrow">Edad (años)</label>
              <input type="number" min="15" max="85" required className="input-field tnum" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>

            <div className="input-group">
              <label className="eyebrow">Sexo biológico</label>
              <select className="input-field" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="input-group">
              <label className="eyebrow">Peso ({unit === 'metric' ? 'kg' : 'lb'})</label>
              <input
                type="number"
                step="0.1"
                required
                className="input-field tnum"
                value={unit === 'metric' ? weightKg : Math.round(weightKg * 2.20462)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWeightKg(unit === 'metric' ? val : +(val / 2.20462).toFixed(1));
                }}
              />
            </div>

            <div className="input-group">
              <label className="eyebrow">Talla ({unit === 'metric' ? 'cm' : 'in'})</label>
              <input
                type="number"
                required
                className="input-field tnum"
                value={unit === 'metric' ? heightCm : Math.round(heightCm / 2.54)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHeightCm(unit === 'metric' ? val : Math.round(val * 2.54));
                }}
              />
            </div>
          </div>

          <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'var(--surface-2)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="small muted">IMC calculado automáticamente:</span>
            <span className="h3 tnum" style={{ color: liveBmi >= 25 ? '#f59e0b' : 'var(--pink)' }}>
              {liveBmi} kg/m² {liveBmi >= 25 ? '(≥ 25)' : '(Normopeso)'}
            </span>
          </div>

          <div className="grid-2">
            <div className="input-group">
              <label className="eyebrow">Experiencia en running</label>
              <select className="input-field" value={experience} onChange={(e) => setExperience(e.target.value)}>
                <option value="<3m">Menos de 3 meses (Novato)</option>
                <option value="3-6m">3 a 6 meses</option>
                <option value="6-12m">6 a 12 meses</option>
                <option value=">12m">Más de 12 meses</option>
              </select>
            </div>

            <div className="input-group">
              <label className="eyebrow">Volumen base ({unit === 'metric' ? 'km/sem' : 'mi/sem'})</label>
              <input
                type="number"
                min="1"
                max="150"
                required
                className="input-field tnum"
                value={unit === 'metric' ? weeklyKm : +(weeklyKm * 0.621371).toFixed(1)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWeeklyKm(unit === 'metric' ? val : +(val / 0.621371).toFixed(1));
                }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="eyebrow">Apoyo plantar / arco medial (orientativo)</label>
            <select className="input-field" value={footType} onChange={(e) => setFootType(e.target.value)}>
              <option value="desconocido">No lo sé / Sin valoración biomecánica</option>
              <option value="neutra">Apoyo neutro</option>
              <option value="pronador">Tendencia pronadora (caída marcada del arco interno)</option>
              <option value="supinador">Tendencia supinadora (arco elevado / apoyo externo)</option>
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="eyebrow">Antecedente de lesión previa en miembro inferior</label>
            <select className="input-field" value={priorInjury} onChange={(e) => setPriorInjury(e.target.value)}>
              <option value="no">No</option>
              <option value="si">Sí</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={requireConsent && !consentChecked} className="btn btn-primary tap">
          <span>Guardar y Calibrar Sistema</span>
          <ArrowRight size={19} />
        </button>

        {onCancel && (
          <button type="button" className="btn btn-soft tap" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </form>
    </div>
  );
}

// ============================================================================
// 2. PANEL PRINCIPAL DESPEJADO (DIVULGACIÓN PROGRESIVA)
// ============================================================================
function DashboardView({
  user, bio, unit, onOpenSession, onOpenClinicalReport, onGoTab
}) {
  const [showReasons, setShowReasons] = useState(false);

  const volumeRatio = Math.min(1, Math.max(0.08, bio.acuteKm / Math.max(1, bio.chronicKm)));
  const outerRadius = 46;
  const outerCirc = 2 * Math.PI * outerRadius;
  const outerOffset = outerCirc * (1 - volumeRatio);

  const acwrRatio = Math.min(1, Math.max(0.1, bio.acwr / 1.6));
  const innerRadius = 33;
  const innerCirc = 2 * Math.PI * innerRadius;
  const innerOffset = innerCirc * (1 - acwrRatio);

  const todayLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', padding: '2px 2px 4px' }}>
        <div>
          <div className="eyebrow" style={{ textTransform: 'capitalize' }}>
            {todayLabel} · {user.profile.name.split(' ')[0]}
          </div>
          <h1 className="display" style={{ marginTop: '2px' }}>Resumen</h1>
        </div>
        <button type="button" onClick={onOpenSession} className="btn-pill-sm tap">
          <PlusCircle size={16} />
          <span>Registrar</span>
        </button>
      </div>

      {/* ALERTA CLÍNICA DE BANDERA ROJA */}
      {bio.redFlagActive && (
        <div className="card" style={{ borderColor: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 14%, var(--surface))' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertTriangle size={22} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div className="h3" style={{ color: 'var(--danger)' }}>Bandera Roja · Suspensión de Impacto</div>
              <p className="small muted" style={{ marginTop: '4px' }}>
                {bio.reasons[0]} Se ha pausado la rutina de carga física. Solicita valoración por medicina deportiva o fisioterapia.
              </p>
              <button
                type="button"
                onClick={onOpenClinicalReport}
                className="btn-soft tap"
                style={{ marginTop: '10px', background: '#ff453a28', color: '#ff453a', width: '100%' }}
              >
                <FileText size={15} />
                <span>Ver Resumen Clínico-Deportivo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TARJETA PRINCIPAL DE ANILLOS ACWR */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ position: 'relative', width: '92px', height: '92px', flexShrink: 0 }}>
            <svg viewBox="0 0 112 112" style={{ width: '92px', height: '92px', transform: 'rotate(-90deg)' }}>
              <circle cx="56" cy="56" r={outerRadius} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
              <circle
                cx="56"
                cy="56"
                r={outerRadius}
                fill="none"
                stroke="var(--pink)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={outerCirc}
                strokeDashoffset={outerOffset}
                style={{ transition: 'stroke-dashoffset 0.6s var(--ease)' }}
              />
              <circle cx="56" cy="56" r={innerRadius} fill="none" stroke="var(--surface-2)" strokeWidth="9" />
              <circle
                cx="56"
                cy="56"
                r={innerRadius}
                fill="none"
                stroke={bio.acwrColor}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={innerCirc}
                strokeDashoffset={innerOffset}
                style={{ transition: 'stroke-dashoffset 0.6s var(--ease)' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}
            >
              <span className="tnum" style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1, color: bio.acwrColor }}>
                {bio.acwr}
              </span>
              <span className="eyebrow" style={{ fontSize: '9px', marginTop: '2px' }}>ACWR</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow">Carga aguda (7 días)</div>
            <div className="display tnum" style={{ fontSize: '24px', marginTop: '2px' }}>
              {fmtDist(bio.acuteKm, unit)}
            </div>
            <div className="small muted tnum" style={{ marginTop: '2px' }}>
              Crónica (28d): {fmtDist(bio.chronicKm, unit)}/sem
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: bio.riskColor }}>
                Alerta {bio.riskLevel}
              </span>
              <span className="muted" aria-hidden="true">·</span>
              <span className="small muted">{bio.acwrStatus}</span>
            </div>
          </div>
        </div>

        <div className="strava-stat-strip">
          <div className="strava-stat-cell">
            <span className="eyebrow">IMC</span>
            <span className="h3 tnum">{bio.bmi}</span>
          </div>
          <div className="strava-stat-cell">
            <span className="eyebrow">Dosis Ej.</span>
            <span className="h3 tnum" style={{ color: bio.redFlagActive ? 'var(--danger)' : 'var(--pink)' }}>
              {bio.redFlagActive ? 'Pausada' : `${Math.round(bio.loadFactor * 100)}%`}
            </span>
          </div>
          <div className="strava-stat-cell">
            <span className="eyebrow">Borg Prom.</span>
            <span className="h3 tnum">{bio.avgRpe}/10</span>
          </div>
        </div>

        {/* DIVULGACIÓN PROGRESIVA: EXPLICACIÓN DEL ALGORITMO DESPLEGABLE */}
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '0.5px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => setShowReasons(!showReasons)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0'
            }}
          >
            <span className="eyebrow" style={{ color: 'var(--ink-2)' }}>
              ¿Por qué tengo este nivel de alerta? ({bio.reasons.length})
            </span>
            <ChevronDown
              size={16}
              color="var(--ink-3)"
              style={{ transform: showReasons ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
            />
          </button>

          {showReasons && (
            <div className="stack" style={{ gap: '5px', marginTop: '8px' }}>
              {bio.reasons.map((r, idx) => (
                <div key={idx} className="small muted" style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <span style={{ color: bio.riskColor, fontWeight: 800 }}>•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ACCESOS RÁPIDOS DE ACCIÓN */}
      <div className="grid-2">
        <button
          type="button"
          className="card tap"
          onClick={() => onGoTab('cadencia')}
          style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--accent)' }}>
              <Timer size={15} /> Cadencia
            </span>
            <ChevronRight size={16} color="var(--ink-3)" />
          </div>
          <div className="h2 tnum">{user.profile.cadencePpm || 164} <span className="small muted" style={{ fontWeight: 500 }}>ppm</span></div>
          <div className="small muted tnum">Meta +5%: {Math.round((user.profile.cadencePpm || 164) * 1.05)} ppm</div>
        </button>

        <button
          type="button"
          className="card tap"
          onClick={() => onGoTab('ejercicios')}
          style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: bio.redFlagActive ? 'var(--danger)' : 'var(--pink)' }}>
              <Dumbbell size={15} /> Fuerza
            </span>
            <ChevronRight size={16} color="var(--ink-3)" />
          </div>
          <div className="h2 tnum" style={{ color: bio.redFlagActive ? 'var(--danger)' : 'inherit' }}>
            {bio.redFlagActive ? 'Pausada' : `${Math.round(bio.loadFactor * 100)}%`}
          </div>
          <div className="small muted">{bio.redFlagActive ? 'Reposo relativo' : 'Rutina preventiva'}</div>
        </button>
      </div>

      {/* ACTIVIDAD RECIENTE */}
      <div className="section-heading">
        <span>Actividad reciente</span>
        <span className="small muted tnum" style={{ fontWeight: 500 }}>
          {user.sessions.length} {user.sessions.length === 1 ? 'sesión' : 'sesiones'}
        </span>
      </div>

      <div className="ios-group">
        {user.sessions.length === 0 ? (
          <button type="button" onClick={onOpenSession} className="ios-row">
            <div>
              <div className="h3">Aún no hay entrenamientos</div>
              <div className="small muted">Toca aquí para registrar tu primera carrera</div>
            </div>
            <PlusCircle size={20} color="var(--pink)" />
          </button>
        ) : (
          [...user.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((s) => (
            <div key={s.id} className="ios-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '4px',
                    height: '34px',
                    borderRadius: '99px',
                    background: s.eva >= 4 || s.painLocation === 'focal_puntual' || s.painAtRest ? 'var(--danger)' : 'var(--pink)',
                    flexShrink: 0
                  }}
                />
                <div>
                  <div className="h3 tnum">{fmtDist(s.distanceKm, unit)}</div>
                  <div className="small muted tnum">
                    {s.date} · {s.durationMin} min {s.eva > 0 ? `· ${PAIN_ZONE_LABELS[s.painLocation || 'posteromedial_difuso']}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tnum" style={{ fontSize: '13.5px', fontWeight: 700, color: s.eva >= 4 || s.painLocation === 'focal_puntual' || s.painAtRest ? 'var(--danger)' : 'var(--pink)' }}>
                  EVA {s.eva}/10
                </div>
                <div className="small muted tnum">Borg {s.rpe}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* GRÁFICAS LONGITUDINALES */}
      <TrendChartsCard
        sessions={[...user.sessions].sort((a, b) => a.date.localeCompare(b.date))}
        chronicKm={bio.chronicKm}
        acwr={bio.acwr}
        acwrColor={bio.acwrColor}
        acwrStatus={bio.acwrStatus}
        unit={unit}
      />
    </div>
  );
}

// ============================================================================
// COMPONENTE DE GRÁFICAS SVG: CARGA + ACWR Y TENDENCIA EVA / BORG
// ============================================================================
function TrendChartsCard({ sessions, chronicKm, acwr, acwrColor, acwrStatus, unit }) {
  const [chartTab, setChartTab] = useState(0);
  const recent = sessions.slice(-7);
  const unitLabel = unit === 'metric' ? 'km' : 'mi';
  const markerPct = Math.min(97, Math.max(3, (acwr / 2.0) * 100));

  return (
    <div className="card stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 size={14} color="var(--pink)" /> Monitoreo Longitudinal
          </div>
          <h2 className="h2" style={{ marginTop: '4px' }}>Gráficas de Seguimiento</h2>
        </div>
      </div>

      <div className="seg" style={{ '--n': 2 }}>
        <div className="seg-pill" style={{ transform: `translateX(${chartTab * 100}%)` }} />
        <button type="button" className={`seg-btn ${chartTab === 0 ? 'on' : ''}`} onClick={() => setChartTab(0)}>
          Carga y ACWR
        </button>
        <button type="button" className={`seg-btn ${chartTab === 1 ? 'on' : ''}`} onClick={() => setChartTab(1)}>
          Dolor EVA y Borg
        </button>
      </div>

      {chartTab === 0 && (
        <div className="stack" style={{ gap: '14px' }}>
          <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="eyebrow" style={{ fontSize: '10px' }}>Índice Carga Aguda:Crónica</span>
              <span className="badge tnum" style={{ color: acwrColor, background: `color-mix(in srgb, ${acwrColor} 18%, transparent)` }}>
                ACWR {acwr} · {acwrStatus}
              </span>
            </div>

            <div style={{ position: 'relative', height: '12px', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '40%', background: '#32ade6' }} title="Subcarga (< 0.8)" />
              <div style={{ width: '25%', background: '#34c759' }} title="Zona segura (0.8 - 1.3)" />
              <div style={{ width: '10%', background: '#ffd60a' }} title="Precaución (1.3 - 1.5)" />
              <div style={{ width: '25%', background: '#ff453a' }} title="Sobrecarga (> 1.5)" />
            </div>

            <div style={{ position: 'relative', height: '14px', marginTop: '2px' }}>
              <div
                style={{
                  position: 'absolute',
                  left: `${markerPct}%`,
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderBottom: `8px solid ${acwrColor}`,
                  transition: 'left .4s ease'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)' }} className="tnum">
              <span>0.0</span>
              <span>0.8 (Segura)</span>
              <span>1.3</span>
              <span>1.5+</span>
            </div>
          </div>

          {recent.length === 0 ? (
            <div className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>
              Registra tu primer entrenamiento arriba para visualizar la evolución de carga.
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>Distancia por sesión ({unitLabel})</span>
                <span className="small muted tnum" style={{ fontSize: '11px' }}>
                  Crónica: {fmtDist(chronicKm, unit)}/sem
                </span>
              </div>

              {(() => {
                const values = recent.map((s) => distVal(s.distanceKm, unit));
                const maxVal = Math.max(...values, distVal(chronicKm / 3, unit) * 1.3, 1);
                const svgW = 320;
                const svgH = 135;
                const padTop = 22;
                const padBot = 24;
                const plotH = svgH - padTop - padBot;
                const slotW = svgW / recent.length;
                const barW = Math.min(28, slotW * 0.55);

                return (
                  <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                    {[0, 0.5, 1].map((t, i) => {
                      const y = padTop + plotH * (1 - t);
                      return (
                        <line
                          key={i}
                          x1="0"
                          y1={y}
                          x2={svgW}
                          y2={y}
                          stroke="var(--line)"
                          strokeDasharray={t === 0 ? 'none' : '3 3'}
                          strokeWidth="1"
                        />
                      );
                    })}

                    {recent.map((s, idx) => {
                      const v = distVal(s.distanceKm, unit);
                      const h = Math.max(4, (v / maxVal) * plotH);
                      const x = idx * slotW + (slotW - barW) / 2;
                      const y = padTop + plotH - h;
                      const shortDate = s.date.slice(5);
                      const barColor = s.eva >= 4 || s.painLocation === 'focal_puntual' || s.painAtRest ? '#ff453a' : 'var(--pink)';

                      return (
                        <g key={s.id || idx}>
                          <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={h}
                            rx="6"
                            fill={barColor}
                            style={{ transition: 'height .4s ease, y .4s ease' }}
                          />
                          <text
                            x={x + barW / 2}
                            y={y - 6}
                            textAnchor="middle"
                            fill="var(--ink)"
                            fontSize="10"
                            fontWeight="700"
                          >
                            {v}
                          </text>
                          <text
                            x={x + barW / 2}
                            y={svgH - 6}
                            textAnchor="middle"
                            fill="var(--ink-3)"
                            fontSize="9.5"
                          >
                            {shortDate}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {chartTab === 1 && (
        <div>
          {recent.length === 0 ? (
            <div className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>
              Aún no hay sesiones registradas para graficar dolor EVA y esfuerzo Borg.
            </div>
          ) : (
            <div>
              {(() => {
                const svgW = 320;
                const svgH = 150;
                const padL = 22;
                const padR = 14;
                const padTop = 18;
                const padBot = 26;
                const plotW = svgW - padL - padR;
                const plotH = svgH - padTop - padBot;

                const getX = (i) =>
                  recent.length === 1
                    ? padL + plotW / 2
                    : padL + (i / (recent.length - 1)) * plotW;

                const getY = (val) => padTop + plotH * (1 - val / 10);

                const evaPoints = recent.map((s, i) => `${getX(i)},${getY(s.eva)}`).join(' ');
                const rpePoints = recent.map((s, i) => `${getX(i)},${getY(s.rpe)}`).join(' ');
                const alertY = getY(4);

                return (
                  <>
                    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                      {[0, 5, 10].map((tick) => {
                        const y = getY(tick);
                        return (
                          <g key={tick}>
                            <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="var(--line)" strokeWidth="1" />
                            <text x={padL - 6} y={y + 3} textAnchor="end" fill="var(--ink-3)" fontSize="9.5">
                              {tick}
                            </text>
                          </g>
                        );
                      })}

                      <line
                        x1={padL}
                        y1={alertY}
                        x2={svgW - padR}
                        y2={alertY}
                        stroke="#ff453a"
                        strokeDasharray="4 3"
                        strokeWidth="1.2"
                      />
                      <text x={svgW - padR} y={alertY - 4} textAnchor="end" fill="#ff453a" fontSize="8.5" fontWeight="700">
                        Umbral EVA ≥ 4
                      </text>

                      {recent.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#32ade6"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                          points={rpePoints}
                        />
                      )}

                      {recent.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="var(--pink)"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={evaPoints}
                        />
                      )}

                      {recent.map((s, i) => {
                        const cx = getX(i);
                        const cyEva = getY(s.eva);
                        const cyRpe = getY(s.rpe);
                        const dotColor = s.eva >= 4 || s.painLocation === 'focal_puntual' ? '#ff453a' : 'var(--pink)';
                        return (
                          <g key={s.id || i}>
                            <circle cx={cx} cy={cyRpe} r="3.2" fill="#32ade6" />
                            <circle cx={cx} cy={cyEva} r="4.8" fill={dotColor} stroke="var(--surface)" strokeWidth="1.5" />
                            <text x={cx} y={cyEva - 8} textAnchor="middle" fill={dotColor} fontSize="9.5" fontWeight="800">
                              {s.eva}
                            </text>
                            <text x={cx} y={svgH - 6} textAnchor="middle" fill="var(--ink-3)" fontSize="9.5">
                              {s.date.slice(5)}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '6px', fontSize: '11.5px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--pink)', display: 'inline-block' }} />
                        <span className="muted">Dolor EVA (0–10)</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#32ade6', display: 'inline-block' }} />
                        <span className="muted">Borg CR-10</span>
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAPA ANATÓMICO INTERACTIVO Y ANIMADO DE TAMIZAJE SEMIOLÓGICO DIFERENCIAL
// ============================================================================
function AnatomicalLegMap({ legSide, setLegSide, painLocation, setPainLocation, painAtRest, setPainAtRest }) {
  const zones = [
    {
      id: 'posteromedial_difuso',
      shortTitle: 'Borde interno difuso (> 5 cm)',
      clinicalTag: 'Signo temprano SETM',
      desc: 'Molestia alargada en el tercio medio-distal interno de la tibia.',
      color: '#f59e0b'
    },
    {
      id: 'focal_puntual',
      shortTitle: 'Punto específico en hueso (< 2 cm)',
      clinicalTag: 'Bandera Roja · Estrés focal',
      desc: 'Dolor punzante localizable con la yema de un solo dedo.',
      color: '#ff453a'
    },
    {
      id: 'muscular_general',
      shortTitle: 'Masa muscular posterior',
      clinicalTag: 'Sobrecarga sóleo / gemelos',
      desc: 'Tensión en la pantorrilla sin dolor directo sobre el borde óseo.',
      color: '#32ade6'
    }
  ];

  const activeZone = zones.find((z) => z.id === painLocation) || zones[0];

  return (
    <div className="stack" style={{ gap: '12px', marginTop: '6px' }}>
      <style>{`
        @keyframes rsdPulseWave {
          0% { transform: scale(0.92); opacity: 0.85; }
          70% { transform: scale(1.38); opacity: 0; }
          100% { transform: scale(1.38); opacity: 0; }
        }
        @keyframes rsdSoftGlow {
          0%, 100% { opacity: 0.78; }
          50% { opacity: 1; }
        }
        @keyframes rsdCardSlide {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .rsd-pulse-ring {
          transform-box: fill-box;
          transform-origin: center;
          animation: rsdPulseWave 1.9s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .rsd-zone-active {
          animation: rsdSoftGlow 2s ease-in-out infinite;
          transition: all 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .rsd-zone-idle {
          transition: all 0.25s ease;
        }
        .rsd-zone-idle:hover {
          opacity: 0.9;
        }
        .rsd-diag-card {
          animation: rsdCardSlide 0.25s ease-out;
        }
      `}</style>

      {/* 1. Selector de lateralidad */}
      <div>
        <label className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>
          1. Extremidad afectada
        </label>
        <div className="seg" style={{ '--n': 3 }}>
          <div
            className="seg-pill"
            style={{
              transform: `translateX(${legSide === 'izquierda' ? 0 : legSide === 'derecha' ? 100 : 200}%)`
            }}
          />
          {[
            { id: 'izquierda', label: 'Izquierda' },
            { id: 'derecha', label: 'Derecha' },
            { id: 'bilateral', label: 'Ambas' }
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`seg-btn ${legSide === opt.id ? 'on' : ''}`}
              onClick={() => setLegSide(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Esquema anatómico SVG interactivo y animado */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label className="eyebrow">2. Toca la zona dolorosa en el esquema</label>
          <span className="small muted" style={{ fontSize: '11px' }}>Interactivo</span>
        </div>

        <div
          style={{
            background: 'var(--surface-2)',
            borderRadius: '18px',
            padding: '12px 10px 10px',
            border: '1px solid var(--line)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)'
          }}
        >
          <svg
            viewBox="0 0 320 242"
            role="img"
            aria-label="Mapa anatómico interactivo de la pierna"
            style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'manipulation' }}
          >
            <defs>
              <linearGradient id="rsd-leg-fill" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--surface)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--surface-2)" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="rsd-bone-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ink-3)" stopOpacity="0.16" />
                <stop offset="50%" stopColor="var(--ink-3)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--ink-3)" stopOpacity="0.14" />
              </linearGradient>
              <linearGradient id="rsd-amber-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <radialGradient id="rsd-red-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ff6b63" />
                <stop offset="100%" stopColor="#dc2626" />
              </radialGradient>
              <linearGradient id="rsd-cyan-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>

            {/* Encabezados de vista anatómica */}
            <text x="84" y="15" textAnchor="middle" fill="var(--ink-3)" fontSize="9.5" fontWeight="700" letterSpacing="0.04em">
              VISTA MEDIAL (TIBIA)
            </text>
            <text x="236" y="15" textAnchor="middle" fill="var(--ink-3)" fontSize="9.5" fontWeight="700" letterSpacing="0.04em">
              VISTA POSTERIOR
            </text>

            <line x1="160" y1="24" x2="160" y2="222" stroke="var(--line)" strokeDasharray="3 3" strokeWidth="1" />

            {/* ================= VISTA MEDIAL (IZQUIERDA) ================= */}
            <g>
              <path
                d="M 60 28 C 56 62, 57 105, 62 152 C 64 170, 63 184, 58 196 C 55 204, 62 214, 76 215 L 118 215 C 126 215, 129 208, 123 203 C 109 194, 96 186, 93 170 C 91 144, 96 102, 99 65 C 101 48, 98 35, 94 28 Z"
                fill="url(#rsd-leg-fill)"
                stroke="var(--ink-3)"
                strokeWidth="1.5"
              />
              <path
                d="M 73 36 C 72 82, 73 135, 75 186 L 83 186 C 84 135, 84 82, 83 36 Z"
                fill="url(#rsd-bone-grad)"
              />
              <circle cx="79" cy="189" r="5.5" fill="none" stroke="var(--ink-3)" strokeOpacity="0.45" strokeWidth="1.3" />

              {/* ZONA A: Borde posteromedial distal difuso (> 5 cm) */}
              <g
                onClick={() => setPainLocation('posteromedial_difuso')}
                style={{ cursor: 'pointer' }}
                className={painLocation === 'posteromedial_difuso' ? 'rsd-zone-active' : 'rsd-zone-idle'}
              >
                {painLocation === 'posteromedial_difuso' && (
                  <rect
                    x="57"
                    y="94"
                    width="22"
                    height="76"
                    rx="11"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.6"
                    className="rsd-pulse-ring"
                  />
                )}
                <rect
                  x="60"
                  y="98"
                  width="16"
                  height="68"
                  rx="8"
                  fill={painLocation === 'posteromedial_difuso' ? 'url(#rsd-amber-grad)' : '#f59e0b2e'}
                  stroke="#f59e0b"
                  strokeWidth={painLocation === 'posteromedial_difuso' ? '2' : '1.2'}
                />
                <line x1="46" y1="100" x2="46" y2="164" stroke="#f59e0b" strokeWidth="1.3" />
                <line x1="42" y1="100" x2="50" y2="100" stroke="#f59e0b" strokeWidth="1.3" />
                <line x1="42" y1="164" x2="50" y2="164" stroke="#f59e0b" strokeWidth="1.3" />
                <text x="39" y="135" textAnchor="end" fill="#f59e0b" fontSize="9" fontWeight="800">
                  &gt; 5 cm
                </text>
              </g>

              {/* ZONA B: Punto focalizado sobre cortical tibial (< 2 cm) */}
              <g
                onClick={() => setPainLocation('focal_puntual')}
                style={{ cursor: 'pointer' }}
                className={painLocation === 'focal_puntual' ? 'rsd-zone-active' : 'rsd-zone-idle'}
              >
                {painLocation === 'focal_puntual' && (
                  <>
                    <circle
                      cx="85"
                      cy="128"
                      r="14"
                      fill="none"
                      stroke="#ff453a"
                      strokeWidth="1.8"
                      className="rsd-pulse-ring"
                    />
                    <circle
                      cx="85"
                      cy="128"
                      r="19"
                      fill="none"
                      stroke="#ff453a"
                      strokeOpacity="0.45"
                      strokeDasharray="2 2"
                      strokeWidth="1.1"
                    />
                  </>
                )}
                <circle
                  cx="85"
                  cy="128"
                  r="9.5"
                  fill={painLocation === 'focal_puntual' ? 'url(#rsd-red-grad)' : '#ff453a33'}
                  stroke="#ff453a"
                  strokeWidth={painLocation === 'focal_puntual' ? '2' : '1.3'}
                />
                <circle cx="85" cy="128" r="2.6" fill={painLocation === 'focal_puntual' ? '#ffffff' : '#ff453a'} />
                <line x1="95" y1="123" x2="113" y2="112" stroke="#ff453a" strokeWidth="1.2" />
                <text x="116" y="112" textAnchor="start" fill="#ff453a" fontSize="9" fontWeight="800">
                  &lt; 2 cm
                </text>
              </g>
            </g>

            {/* ================= VISTA POSTERIOR (DERECHA) ================= */}
            <g>
              <path
                d="M 216 28 C 208 56, 206 88, 215 118 C 222 140, 226 164, 225 188 C 223 198, 220 208, 226 215 L 246 215 C 252 208, 249 198, 247 188 C 246 164, 250 140, 257 118 C 266 88, 264 56, 256 28 Z"
                fill="url(#rsd-leg-fill)"
                stroke="var(--ink-3)"
                strokeWidth="1.5"
              />
              <line x1="236" y1="138" x2="236" y2="200" stroke="var(--ink-3)" strokeOpacity="0.38" strokeWidth="4.5" strokeLinecap="round" />

              {/* ZONA C: Compartimento muscular posterior (sóleo / gastrocnemio) */}
              <g
                onClick={() => setPainLocation('muscular_general')}
                style={{ cursor: 'pointer' }}
                className={painLocation === 'muscular_general' ? 'rsd-zone-active' : 'rsd-zone-idle'}
              >
                {painLocation === 'muscular_general' && (
                  <ellipse
                    cx="236"
                    cy="86"
                    rx="22"
                    ry="42"
                    fill="none"
                    stroke="#32ade6"
                    strokeWidth="1.6"
                    className="rsd-pulse-ring"
                  />
                )}
                <ellipse
                  cx="236"
                  cy="86"
                  rx="18"
                  ry="38"
                  fill={painLocation === 'muscular_general' ? 'url(#rsd-cyan-grad)' : '#32ade62e'}
                  stroke="#32ade6"
                  strokeWidth={painLocation === 'muscular_general' ? '2' : '1.3'}
                />
                <line
                  x1="236"
                  y1="54"
                  x2="236"
                  y2="104"
                  stroke={painLocation === 'muscular_general' ? '#ffffff' : '#32ade6'}
                  strokeOpacity="0.45"
                  strokeWidth="1.2"
                />
                <text x="236" y="84" textAnchor="middle" fill={painLocation === 'muscular_general' ? '#04121c' : '#32ade6'} fontSize="8.5" fontWeight="800">
                  Sóleo /
                </text>
                <text x="236" y="94" textAnchor="middle" fill={painLocation === 'muscular_general' ? '#04121c' : '#32ade6'} fontSize="8.5" fontWeight="800">
                  Gemelos
                </text>
              </g>
            </g>
          </svg>

          {/* Tarjeta semiológica animada sincronizada */}
          <div
            key={activeZone.id}
            className="rsd-diag-card"
            style={{
              marginTop: '8px',
              padding: '10px 12px',
              borderRadius: '13px',
              background: `color-mix(in srgb, ${activeZone.color} 14%, var(--surface))`,
              border: `1px solid ${activeZone.color}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="h3" style={{ fontSize: '13px', color: activeZone.color }}>
                {activeZone.shortTitle}
              </span>
              <span
                className="badge"
                style={{
                  background: `color-mix(in srgb, ${activeZone.color} 22%, transparent)`,
                  color: activeZone.color,
                  fontSize: '10px'
                }}
              >
                {activeZone.clinicalTag}
              </span>
            </div>
            <div className="small muted" style={{ fontSize: '11.5px', marginTop: '3px' }}>
              {activeZone.desc}
            </div>
          </div>

          {/* Botones rápidos de selección directa */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {zones.map((z) => {
              const isSel = painLocation === z.id;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setPainLocation(z.id)}
                  className="tap"
                  style={{
                    flex: 1,
                    padding: '7px 6px',
                    borderRadius: '9px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: isSel ? z.color : 'var(--surface)',
                    color: isSel ? (z.id === 'focal_puntual' ? '#fff' : '#000') : 'var(--ink-2)',
                    border: `1px solid ${isSel ? z.color : 'var(--line)'}`,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {z.id === 'posteromedial_difuso' ? 'Difuso > 5 cm' : z.id === 'focal_puntual' ? 'Puntual < 2 cm' : 'Muscular'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Criterio de dolor en reposo */}
      <label
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          cursor: 'pointer',
          padding: '10px 12px',
          borderRadius: '12px',
          background: painAtRest ? '#ff453a1f' : 'var(--surface-2)',
          border: `1px solid ${painAtRest ? '#ff453a' : 'transparent'}`,
          transition: 'all 0.2s ease'
        }}
      >
        <input
          type="checkbox"
          checked={painAtRest}
          onChange={(e) => setPainAtRest(e.target.checked)}
          style={{ marginTop: '2px', accentColor: '#ff453a', width: '16px', height: '16px' }}
        />
        <div>
          <div className="h3" style={{ fontSize: '12.5px', color: painAtRest ? '#ff453a' : 'var(--ink)' }}>
            El dolor persiste en reposo, al caminar o en la noche
          </div>
          <div className="small muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Activa Bandera Roja inmediata y suspende el impacto hasta valoración médica.
          </div>
        </div>
      </label>
    </div>
  );
}

// ============================================================================
// MODAL: REGISTRO DE SESIÓN CON MAPA ANATÓMICO INTERACTIVO
// ============================================================================
function LogSessionModal({ unit, onClose, onSaveSession }) {
  const [distanceKm, setDistanceKm] = useState(4.0);
  const [durationMin, setDurationMin] = useState(25);
  const [rpe, setRpe] = useState(4);
  const [eva, setEva] = useState(0);
  const [legSide, setLegSide] = useState('izquierda');
  const [painLocation, setPainLocation] = useState('posteromedial_difuso');
  const [painAtRest, setPainAtRest] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSession({
      date: new Date().toISOString().split('T')[0],
      distanceKm: Number(distanceKm),
      durationMin: Number(durationMin),
      rpe: Number(rpe),
      eva: Number(eva),
      legSide: eva > 0 ? legSide : 'izquierda',
      painLocation: eva > 0 ? painLocation : 'ninguna',
      painAtRest: eva > 0 ? painAtRest : false
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#000000cc',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{
          width: '100%',
          maxWidth: '640px',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          maxHeight: '92dvh',
          overflowY: 'auto',
          padding: '22px 20px 36px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="badge">Autorregistro Post-Entrenamiento</span>
            <h2 className="h2" style={{ marginTop: '6px' }}>Carga y Tamizaje Semiológico</h2>
          </div>
          <button type="button" onClick={onClose} className="btn-soft" style={{ width: '36px', minHeight: '36px', padding: 0, display: 'grid', placeItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div className="grid-2">
          <div className="input-group">
            <label className="eyebrow">Distancia ({unit === 'metric' ? 'km' : 'mi'})</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              required
              className="input-field tnum"
              value={unit === 'metric' ? distanceKm : +(distanceKm * 0.621371).toFixed(1)}
              onChange={(e) => {
                const val = Number(e.target.value);
                setDistanceKm(unit === 'metric' ? val : +(val / 0.621371).toFixed(2));
              }}
            />
          </div>

          <div className="input-group">
            <label className="eyebrow">Tiempo (minutos)</label>
            <input type="number" min="1" required className="input-field tnum" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </div>
        </div>

        <div className="input-group">
          <label className="eyebrow">Esfuerzo Percibido · Borg CR-10: <span style={{ color: 'var(--pink)' }}>{rpe}/10 ({BORG_LABELS[rpe]})</span></label>
          <input
            type="range"
            min="0"
            max="10"
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#34c759', marginTop: '6px' }}
          />
        </div>

        <div className="input-group">
          <label className="eyebrow">Intensidad de dolor · EVA: <span style={{ color: getPainInfo(eva).c }}>{eva}/10</span></label>
          <input
            type="range"
            min="0"
            max="10"
            value={eva}
            onChange={(e) => {
              const nextEva = Number(e.target.value);
              setEva(nextEva);
              if (nextEva === 0) setPainAtRest(false);
            }}
            style={{ width: '100%', accentColor: getPainInfo(eva).c, marginTop: '6px' }}
          />
        </div>

        {eva > 0 && (
          <AnatomicalLegMap
            legSide={legSide}
            setLegSide={setLegSide}
            painLocation={painLocation}
            setPainLocation={setPainLocation}
            painAtRest={painAtRest}
            setPainAtRest={setPainAtRest}
          />
        )}

        <button type="submit" className="btn btn-primary tap" style={{ marginTop: '14px' }}>
          <span>Guardar Sesión y Evaluar Riesgo</span>
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// MODAL: RESUMEN CLÍNICO-DEPORTIVO (INTEROPERABILIDAD BÁSICA)
// ============================================================================
function ClinicalReportModal({ user, bio, unit, onClose, onCopyText }) {
  const p = user.profile;
  const ls = bio.lastSession;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 110,
        background: '#000000cc',
        backdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="card stack"
        style={{ maxWidth: '460px', width: '100%', maxHeight: '88dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="badge">Síntesis para Consulta Profesional</span>
            <h2 className="h2" style={{ marginTop: '4px' }}>Resumen Clínico-Deportivo</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-circle-btn tap">
            <X size={16} />
          </button>
        </div>

        <p className="small muted">
          Ficha estructurada con el historial de carga y tamizaje semiológico para facilitar la valoración por medicina deportiva o fisioterapia.
        </p>

        <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '12px' }} className="stack">
          <div className="grid-2">
            <div>
              <div className="eyebrow">Corredor</div>
              <div className="h3">{p.name} ({p.age} años)</div>
            </div>
            <div>
              <div className="eyebrow">IMC / Sexo</div>
              <div className="h3 tnum">{bio.bmi} kg/m² · {p.sex}</div>
            </div>
          </div>
          <div className="grid-2">
            <div>
              <div className="eyebrow">ACWR (7d / 28d)</div>
              <div className="h3 tnum" style={{ color: bio.acwrColor }}>{bio.acwr} ({bio.acwrStatus})</div>
            </div>
            <div>
              <div className="eyebrow">Nivel de Alerta</div>
              <div className="h3" style={{ color: bio.riskColor }}>{bio.riskLevel}</div>
            </div>
          </div>
          <div>
            <div className="eyebrow">Último reporte de síntomas</div>
            <div className="small" style={{ marginTop: '2px' }}>
              {ls
                ? `${ls.date}: ${fmtDist(ls.distanceKm, unit)}, Borg ${ls.rpe}/10, Dolor EVA ${ls.eva}/10${ls.eva > 0 ? ` (${LEG_SIDE_LABELS[ls.legSide || 'izquierda']} · ${PAIN_ZONE_LABELS[ls.painLocation || 'ninguna']}${ls.painAtRest ? ' · Dolor en reposo' : ''})` : ''}`
                : 'Sin sesiones registradas'}
            </div>
          </div>
        </div>

        <button type="button" onClick={onCopyText} className="btn btn-primary tap">
          <span>Copiar Resumen para Compartir</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MÓDULO FUNCIONAL DE CADENCIA BIOMECÁNICA (METRÓNOMO WEB AUDIO + TEST 15S)
// ============================================================================
function CadenceView({ cadencePpm, onSaveCadence }) {
  const recommendedTarget = Math.min(188, Math.max(170, Math.round(cadencePpm * 1.05)));
  const [bpm, setBpm] = useState(recommendedTarget);
  const [playing, setPlaying] = useState(false);
  const [beatPulse, setBeatPulse] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const [testRunning, setTestRunning] = useState(false);
  const [testSeconds, setTestSeconds] = useState(15);
  const [stepCount15s, setStepCount15s] = useState('');

  const audioCtxRef = useRef(null);

  const playClick = () => {
    if (!soundOn) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Silencio seguro si el dispositivo bloquea audio
    }
  };

  useEffect(() => {
    if (!playing) {
      setBeatPulse(false);
      return;
    }
    const intervalMs = Math.round(60000 / bpm);
    playClick();
    setBeatPulse(true);
    const offTimer = setTimeout(() => setBeatPulse(false), 110);

    const timer = setInterval(() => {
      playClick();
      setBeatPulse(true);
      setTimeout(() => setBeatPulse(false), 110);
    }, intervalMs);

    return () => {
      clearInterval(timer);
      clearTimeout(offTimer);
    };
  }, [playing, bpm, soundOn]);

  useEffect(() => {
    if (!testRunning) return;
    const interval = setInterval(() => {
      setTestSeconds((prev) => {
        if (prev <= 1) {
          setTestRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [testRunning]);

  const lowCadence = cadencePpm < 170;

  return (
    <div className="stack">
      <div className="card">
        <span className="badge">Biomecánica de Carrera</span>
        <h2 className="display" style={{ marginTop: '8px', fontSize: '21px' }}>
          Control de Cadencia
        </h2>
        <p className="small muted" style={{ marginTop: '4px' }}>
          Aumentar ligeramente la frecuencia de pasos (+5%) acorta la zancada y atenúa los picos de impacto vertical sobre la tibia.
        </p>

        <div className="grid-2" style={{ marginTop: '12px' }}>
          <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: '12px' }}>
            <div className="eyebrow">Tu cadencia habitual</div>
            <div className="h2 tnum" style={{ marginTop: '2px', color: lowCadence ? '#f59e0b' : 'var(--pink)' }}>
              {cadencePpm} <span className="small muted">ppm</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: '12px' }}>
            <div className="eyebrow">Meta protectora (+5%)</div>
            <div className="h2 tnum" style={{ marginTop: '2px', color: 'var(--pink)' }}>
              {recommendedTarget} <span className="small muted">ppm</span>
            </div>
          </div>
        </div>
      </div>

      {/* METRÓNOMO ACÚSTICO Y VISUAL */}
      <div className="card stack">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="eyebrow">Metrónomo Guía Offline</div>
            <div className="h2 tnum" style={{ marginTop: '2px' }}>{bpm} pasos/min</div>
          </div>
          <button
            type="button"
            className="icon-circle-btn tap"
            onClick={() => setSoundOn(!soundOn)}
            aria-label="Activar o silenciar sonido"
          >
            {soundOn ? <Volume2 size={16} color="var(--pink)" /> : <VolumeX size={16} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: beatPulse ? 'var(--pink)' : 'var(--surface-2)',
              border: '2px solid var(--pink)',
              display: 'grid',
              placeItems: 'center',
              transform: beatPulse ? 'scale(1.08)' : 'scale(1)',
              transition: 'transform 0.09s ease, background 0.09s ease'
            }}
          >
            <Footprints size={28} color={beatPulse ? 'var(--pink-ink)' : 'var(--pink)'} />
          </div>
        </div>

        <div>
          <input
            type="range"
            min="155"
            max="190"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#34c759' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--ink-3)' }} className="tnum">
            <span>155 ppm</span>
            <span>Meta: {recommendedTarget} ppm</span>
            <span>190 ppm</span>
          </div>
        </div>

        <div className="grid-2">
          <button
            type="button"
            className="btn btn-primary tap"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={17} /> : <Play size={17} />}
            <span>{playing ? 'Detener' : 'Iniciar Metrónomo'}</span>
          </button>
          <button
            type="button"
            className="btn btn-soft tap"
            onClick={() => setBpm(recommendedTarget)}
          >
            <span>Fijar Meta ({recommendedTarget})</span>
          </button>
        </div>
      </div>

      {/* TEST RÁPIDO DE CADENCIA (15 SEGUNDOS) */}
      <div className="card stack">
        <div>
          <div className="eyebrow">Autoevaluación de Campo</div>
          <h3 className="h2" style={{ marginTop: '2px' }}>Test Rápido de 15 Segundos</h3>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Durante un trote suave, inicia el temporizador y cuenta cada vez que ambos pies tocan el suelo durante 15 segundos.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)', padding: '12px', borderRadius: '12px' }}>
          <div className="h2 tnum" style={{ fontSize: '24px' }}>{testSeconds}s</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-pill-sm tap"
              onClick={() => {
                if (testSeconds === 0) setTestSeconds(15);
                setTestRunning(!testRunning);
              }}
            >
              {testRunning ? 'Pausar' : 'Contar 15s'}
            </button>
            <button
              type="button"
              className="btn-soft tap"
              onClick={() => {
                setTestRunning(false);
                setTestSeconds(15);
              }}
            >
              Reiniciar
            </button>
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: 'end' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="eyebrow">Pasos contados en 15s</label>
            <input
              type="number"
              min="30"
              max="60"
              placeholder="Ej. 41"
              className="input-field tnum"
              value={stepCount15s}
              onChange={(e) => setStepCount15s(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-soft tap"
            disabled={!stepCount15s || Number(stepCount15s) < 25}
            onClick={() => {
              const calculated = Math.round(Number(stepCount15s) * 4);
              onSaveCadence(calculated);
              setBpm(Math.min(188, Math.max(170, Math.round(calculated * 1.05))));
              setStepCount15s('');
            }}
          >
            Guardar ({stepCount15s ? `${Number(stepCount15s) * 4} ppm` : '--'})
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. MÓDULO EDUCATIVO DIFERENCIADO POR SEXO + TEST PRE/POST
// ============================================================================
function WhatIsView({ sex, quizScores, onSaveQuiz }) {
  const [subTab, setSubTab] = useState(0);
  const [openRisk, setOpenRisk] = useState(0);
  const [quizMode, setQuizMode] = useState(null);
  const [answers, setAnswers] = useState({});

  const isFemale = sex === 'femenino';

  const sexGuidance = isFemale
    ? {
      badge: 'Enfoque Diferenciado · Sexo Femenino',
      accent: '#ff2e55',
      title: 'Control neuromuscular de cadera y adaptación ósea',
      summary:
        'La evidencia epidemiológica identifica el sexo femenino como factor de riesgo intrínseco para SETM (Reinking et al., 2017), por lo que la progresión gradual y el fortalecimiento de cadera son prioritarios.',
      points: [
        {
          label: 'Estabilidad pélvica y abductores de cadera',
          text: 'Fortalecer el glúteo medio reduce el colapso medial de rodilla y la tracción excéntrica sobre el compartimento tibial.'
        },
        {
          label: 'Remodelación ósea y recuperación',
          text: 'Durante las primeras 8 semanas alterna días sin impacto para permitir la adaptación del periostio y la cortical tibial.'
        }
      ]
    }
    : {
      badge: 'Enfoque Diferenciado · Sexo Masculino',
      accent: '#32ade6',
      title: 'Control de picos de volumen y fuerza de sóleo',
      summary:
        'En corredores principiantes de sexo masculino, el SETM suele desencadenarse por incrementos abruptos de ritmo o distancia y sobrecarga del tríceps sural.',
      points: [
        {
          label: 'Prevención de picos de carga (ACWR > 1.5)',
          text: 'Evita aumentar más del 10% semanal o correr a esfuerzos máximos (Borg > 7) durante la fase de adaptación.'
        },
        {
          label: 'Descenso excéntrico del sóleo',
          text: 'El fortalecimiento controlado de pantorrilla con rodilla flexionada mejora la absorción de fuerzas de reacción del suelo.'
        }
      ]
    };

  const improvement =
    quizScores.pre !== null && quizScores.post !== null && quizScores.pre > 0
      ? Math.round(((quizScores.post - quizScores.pre) / quizScores.pre) * 100)
      : null;

  const submitQuiz = () => {
    let score = 0;
    QUIZ_QUESTIONS.forEach((item, i) => {
      if (answers[i] === item.correct) score += 1;
    });
    onSaveQuiz(quizMode, score);
    setQuizMode(null);
    setAnswers({});
  };

  return (
    <div className="stack">
      <div className="hero-card">
        <img
          src="/assets/que-es-fisio-DTwnd5so.jpg"
          alt="Educación preventiva SETM"
          className="hero-bg"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '8px' }}>Módulo Educativo</span>
          <h2 className="display" style={{ fontSize: '21px' }}>Comprende el SETM</h2>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Alfabetización preventiva basada en evidencia científica para corredores novatos.
          </p>
        </div>
      </div>

      <div
        className="card stack"
        style={{
          borderColor: `color-mix(in srgb, ${sexGuidance.accent} 45%, var(--line))`,
          background: `color-mix(in srgb, ${sexGuidance.accent} 7%, var(--surface))`
        }}
      >
        <div>
          <span
            className="badge"
            style={{
              background: `color-mix(in srgb, ${sexGuidance.accent} 18%, transparent)`,
              color: sexGuidance.accent
            }}
          >
            {sexGuidance.badge}
          </span>
          <h3 className="h2" style={{ marginTop: '8px', fontSize: '17px' }}>
            {sexGuidance.title}
          </h3>
          <p className="small muted" style={{ marginTop: '4px' }}>
            {sexGuidance.summary}
          </p>
        </div>

        <div className="stack" style={{ gap: '8px' }}>
          {sexGuidance.points.map((pt, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--surface-2)',
                padding: '10px 12px',
                borderRadius: '14px'
              }}
            >
              <div className="h3" style={{ fontSize: '13.5px', color: sexGuidance.accent }}>
                {pt.label}
              </div>
              <div className="small muted" style={{ marginTop: '2px', fontSize: '12.5px' }}>
                {pt.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2">
        {STATS_FACTS.map((st, i) => (
          <div key={i} className="card">
            <div className="h2 tnum" style={{ color: st.c, fontSize: '22px' }}>{st.num}</div>
            <div className="small muted" style={{ marginTop: '4px' }}>{st.label}</div>
          </div>
        ))}
      </div>

      <div className="seg" style={{ '--n': 4 }}>
        <div className="seg-pill" style={{ transform: `translateX(${subTab * 100}%)` }} />
        {['Anatomía', 'Síntomas', 'Riesgos', 'Test 10p'].map((lbl, idx) => (
          <button key={lbl} className={`seg-btn ${subTab === idx ? 'on' : ''}`} onClick={() => setSubTab(idx)}>
            {lbl}
          </button>
        ))}
      </div>

      {subTab === 0 && (
        <div className="stack">
          {ANATOMY_CARDS.map(({ title, desc, c, Icon }, i) => (
            <div key={i} className="card" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div className="icon-tile" style={{ '--c': c }}><Icon size={20} /></div>
              <div>
                <div className="h3">{title}</div>
                <p className="small muted" style={{ marginTop: '4px' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === 1 && (
        <div className="card stack">
          <div className="h3">Reconocimiento de señales tempranas</div>
          {SYMPTOMS.map((sym, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span className="badge tnum">{i + 1}</span>
              <span className="small muted">{sym}</span>
            </div>
          ))}
        </div>
      )}

      {subTab === 2 && (
        <div className="stack">
          {RISK_FACTORS.map((rf, i) => {
            const isOpen = openRisk === i;
            return (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenRisk(isOpen ? null : i)}
                  style={{ width: '100%', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                >
                  <span className="h3">{rf.title}</span>
                  <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                </button>
                {isOpen && (
                  <div className="small muted" style={{ padding: '0 18px 16px', borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
                    {rf.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {subTab === 3 && (
        <div className="stack">
          {!quizMode ? (
            <div className="card stack">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ClipboardCheck size={22} color="var(--pink)" />
                <div className="h2">Evaluación Pre / Post</div>
              </div>
              <p className="small muted">
                Instrumento de 10 ítems (0–10 pts) para verificar la apropiación de conceptos preventivos del SETM.
              </p>

              <div className="grid-2">
                <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '14px' }}>
                  <div className="eyebrow" style={{ fontSize: '10px' }}>Puntaje Pre-Test</div>
                  <div className="h2 tnum" style={{ marginTop: '4px' }}>
                    {quizScores.pre !== null ? `${quizScores.pre}/10` : 'Pendiente'}
                  </div>
                </div>
                <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '14px' }}>
                  <div className="eyebrow" style={{ fontSize: '10px' }}>Puntaje Post-Test</div>
                  <div className="h2 tnum" style={{ marginTop: '4px', color: 'var(--pink)' }}>
                    {quizScores.post !== null ? `${quizScores.post}/10` : 'Pendiente'}
                  </div>
                </div>
              </div>

              {improvement !== null && (
                <div style={{ padding: '12px', borderRadius: '14px', background: improvement >= 30 ? '#34c7591a' : '#ffd60a1a', border: '1px solid var(--pink)' }}>
                  <span className="small" style={{ fontWeight: '700' }}>
                    Variación del conocimiento: {improvement >= 0 ? `+${improvement}%` : `${improvement}%`}
                    {improvement >= 30 ? ' (Meta ≥ 30% cumplida)' : ''}
                  </span>
                </div>
              )}

              <div className="grid-2">
                <button className="btn btn-soft tap" onClick={() => { setAnswers({}); setQuizMode('pre'); }}>
                  Iniciar Test Pre
                </button>
                <button className="btn btn-primary tap" onClick={() => { setAnswers({}); setQuizMode('post'); }}>
                  Iniciar Test Post
                </button>
              </div>
            </div>
          ) : (
            <div className="card stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge">Test {quizMode === 'pre' ? 'Inicial (Pre)' : 'Final (Post)'}</span>
                <button onClick={() => setQuizMode(null)}><X size={18} /></button>
              </div>

              {QUIZ_QUESTIONS.map((item, qIdx) => (
                <div key={qIdx} style={{ paddingBottom: '12px', borderBottom: '1px solid var(--line)' }}>
                  <div className="h3" style={{ fontSize: '14px', marginBottom: '8px' }}>{item.q}</div>
                  <div className="stack" style={{ gap: '6px' }}>
                    {item.options.map((opt, oIdx) => {
                      const selected = answers[qIdx] === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => setAnswers({ ...answers, [qIdx]: oIdx })}
                          style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            background: selected ? '#34c75922' : 'var(--surface-2)',
                            border: `1px solid ${selected ? 'var(--pink)' : 'transparent'}`,
                            color: selected ? 'var(--ink)' : 'var(--ink-2)',
                            fontWeight: selected ? '600' : '400'
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                className="btn btn-primary tap"
                disabled={Object.keys(answers).length < QUIZ_QUESTIONS.length}
                onClick={submitQuiz}
              >
                Finalizar y Guardar Puntaje ({Object.keys(answers).length}/10)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. PREVENCIÓN PRIMARIA
// ============================================================================
function PreventionView({ checked, setChecked, notify }) {
  const toggleItem = (idx) => {
    const next = checked.includes(idx) ? checked.filter((i) => i !== idx) : [...checked, idx];
    setChecked(next);
    if (next.length === WARMUP.length) {
      notify('¡Calentamiento preventivo completado!');
    }
  };

  const totalMin = WARMUP.reduce((acc, w) => acc + w.time, 0);
  const doneMin = WARMUP.reduce((acc, w, i) => acc + (checked.includes(i) ? w.time : 0), 0);

  return (
    <div className="stack">
      <div className="hero-card">
        <img
          src="/assets/prevencion-calentamiento-CCHPQMaC.jpg"
          alt="Calentamiento deportivo"
          className="hero-bg"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '8px' }}>Prevención Primaria</span>
          <h2 className="display" style={{ fontSize: '21px' }}>Hábitos y Calentamiento</h2>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Control de factores modificables para evitar sobrecarga tibial.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {HABITS.map(({ title, desc, Icon, c }, i) => (
          <div key={i} className="card">
            <div className="icon-tile" style={{ '--c': c, marginBottom: '10px' }}><Icon size={20} /></div>
            <div className="h3" style={{ fontSize: '14.5px' }}>{title}</div>
            <div className="small muted" style={{ marginTop: '4px', fontSize: '12.5px' }}>{desc}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="h2">Activación Pre-Carrera</h3>
          <span className="badge tnum">{doneMin}/{totalMin} min</span>
        </div>

        <div style={{ background: 'var(--surface-2)', height: '8px', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
          <div style={{ background: 'var(--grad)', width: `${(doneMin / totalMin) * 100}%`, height: '100%', transition: 'width .4s ease' }} />
        </div>

        <div className="stack" style={{ marginTop: '16px' }}>
          {WARMUP.map((item, idx) => {
            const isDone = checked.includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleItem(idx)}
                className="tap"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textAlign: 'left',
                  padding: '12px',
                  borderRadius: '14px',
                  background: isDone ? '#34c7591a' : 'var(--surface-2)',
                  border: `1px solid ${isDone ? 'var(--pink)' : 'transparent'}`
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    background: isDone ? 'var(--pink)' : 'transparent',
                    border: `2px solid ${isDone ? 'var(--pink)' : 'var(--ink-3)'}`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}
                >
                  {isDone && <Check size={14} color="#000" strokeWidth={3} />}
                </div>
                <span className="small" style={{ flex: 1, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'var(--ink-3)' : 'var(--ink)' }}>
                  {item.act}
                </span>
                <span className="badge tnum">{item.time}m</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. ACONDICIONAMIENTO NEUROMUSCULAR PREVENTIVO (CON BLOQUEO POR BANDERA ROJA)
// ============================================================================
function ExercisesView({ bio, onOpenExercise, onOpenClinicalReport }) {
  const [filter, setFilter] = useState('Todos');
  const phases = ['Todos', 'Fortalecimiento', 'Estiramiento', 'Propiocepción'];

  if (bio.redFlagActive) {
    return (
      <div className="stack">
        <div className="card stack" style={{ borderColor: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 12%, var(--surface))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-tile" style={{ '--c': '#ff453a' }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="eyebrow" style={{ color: '#ff453a' }}>Seguridad Clínica · Prevención Primaria</div>
              <h2 className="h2">Rutina Bloqueada por Dolor Activo</h2>
            </div>
          </div>
          <p className="small muted">
            Este software está diseñado exclusivamente para <strong>prevención primaria en corredores sin lesión instaurada</strong>. Debido a que reportaste signos de alarma ({bio.reasons[0]}), las rutinas de carga física permanecen suspendidas.
          </p>
          <p className="small muted">
            <strong>Conducta recomendada:</strong> Suspende el impacto de carrera y acude a valoración por medicina del deporte o fisioterapia.
          </p>
          <button type="button" onClick={onOpenClinicalReport} className="btn btn-primary tap" style={{ background: '#ff453a', color: '#fff' }}>
            <FileText size={17} />
            <span>Generar Resumen para Consulta</span>
          </button>
        </div>
      </div>
    );
  }

  const filtered = filter === 'Todos'
    ? EXERCISES
    : EXERCISES.filter((e) => e.phase === filter);

  return (
    <div className="stack">
      <div className="card">
        <span className="badge">Acondicionamiento Preventivo</span>
        <h2 className="display" style={{ marginTop: '8px', fontSize: '21px' }}>
          Entrenamiento Neuromuscular
        </h2>
        <p className="small muted" style={{ marginTop: '6px' }}>
          Dosificación ajustada al <strong>{Math.round(bio.loadFactor * 100)}%</strong> según tu nivel de alerta ({bio.riskLevel}).
        </p>

        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginTop: '14px', paddingBottom: '4px' }}>
          {phases.map((ph) => (
            <button
              key={ph}
              onClick={() => setFilter(ph)}
              className="tap"
              style={{
                padding: '7px 13px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
                background: filter === ph ? 'var(--pink)' : 'var(--surface-2)',
                color: filter === ph ? '#000' : 'var(--ink-2)'
              }}
            >
              {ph}
            </button>
          ))}
        </div>
      </div>

      {filtered.map((ex) => {
        const adjustedVal = Math.max(5, Math.round(ex.baseReps * bio.loadFactor));
        const doseLabel = ex.isTime
          ? `${ex.sets} × ${adjustedVal} seg`
          : `${ex.sets} × ${adjustedVal} reps`;

        return (
          <button
            key={ex.id}
            className="card tap"
            onClick={() => onOpenExercise({ ...ex, doseLabel })}
            style={{ textAlign: 'left', padding: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}
          >
            <img
              src={ex.img}
              alt={ex.title}
              style={{ width: '60px', height: '60px', borderRadius: '11px', objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div style={{ flex: 1 }}>
              <span className="badge" style={{ marginBottom: '3px' }}>{ex.phase}</span>
              <div className="h3" style={{ fontSize: '14px' }}>{ex.title}</div>
              <div className="small tnum" style={{ color: 'var(--pink)', fontWeight: '700', marginTop: '3px' }}>
                {doseLabel} · {ex.level}
              </div>
            </div>
            <div className="icon-tile">
              <Play size={16} fill="currentColor" />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ExerciseModal({ ex, onClose }) {
  const [seconds, setSeconds] = useState(ex.timer.s);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - seconds / ex.timer.s);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#000000cc',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '640px',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '20px 20px 36px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', height: '170px', marginBottom: '16px', background: 'var(--surface-2)' }}>
          <img
            src={ex.img}
            alt={ex.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#000000aa',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <X size={20} color="#fff" />
          </button>
        </div>

        <span className="badge">{ex.phase} · {ex.doseLabel}</span>
        <h2 className="h2" style={{ marginTop: '8px' }}>{ex.title}</h2>

        <div className="eyebrow" style={{ marginTop: '16px', marginBottom: '10px' }}>Ejecución paso a paso</div>
        <div className="stack">
          {ex.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span className="badge tnum">{i + 1}</span>
              <span className="small muted">{step}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '14px', padding: '12px', borderRadius: '14px', background: '#34c75914', border: '1px solid #34c75933' }}>
          <span className="small" style={{ color: 'var(--pink)', fontWeight: '600' }}>Sustento biomecánico: </span>
          <span className="small muted">{ex.tip}</span>
        </div>

        <div
          style={{
            marginTop: '18px',
            background: 'var(--surface-2)',
            borderRadius: '20px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '18px'
          }}
        >
          <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
            <svg width="96" height="96" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#34c759"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset .9s linear' }}
              />
            </svg>
            <div className="tnum" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '22px', fontWeight: '800' }}>
              {seconds}s
            </div>
          </div>

          <div>
            <div className="h3">{ex.timer.label}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                className="btn btn-primary tap"
                style={{ minHeight: '42px', padding: '0 16px', width: 'auto' }}
                onClick={() => {
                  if (seconds === 0) setSeconds(ex.timer.s);
                  setRunning(!running);
                }}
              >
                {running ? <Pause size={18} /> : <Play size={18} />}
                <span>{running ? 'Pausar' : 'Iniciar'}</span>
              </button>
              <button
                className="btn btn-soft tap"
                style={{ minHeight: '42px', width: '42px', padding: 0 }}
                onClick={() => {
                  setRunning(false);
                  setSeconds(ex.timer.s);
                }}
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. PLAN DE PROGRESIÓN SEGURA (8 SEMANAS)
// ============================================================================
function RecoveryView({ doneTasks, setDoneTasks, notify }) {
  const [subTab, setSubTab] = useState(0);
  const [openStage, setOpenStage] = useState(0);

  const toggleTask = (sIdx, tIdx) => {
    const key = `${sIdx}-${tIdx}`;
    const next = { ...doneTasks, [key]: !doneTasks[key] };
    setDoneTasks(next);
    const stageDone = PREVENTION_PLAN[sIdx].tasks.every((_, i) => next[`${sIdx}-${i}`]);
    if (stageDone) {
      notify(`¡Completaste ${PREVENTION_PLAN[sIdx].week}!`);
    }
  };

  return (
    <div className="stack">
      <div className="hero-card">
        <img
          src="/assets/recuperacion-hielo-fJVnTR5m.jpg"
          alt="Progresión segura de running"
          className="hero-bg"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '8px' }}>Progresión de Carga</span>
          <h2 className="display" style={{ fontSize: '21px' }}>Plan 8 Semanas</h2>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Adaptación gradual del tejido óseo para jóvenes principiantes (18–25 años).
          </p>
        </div>
      </div>

      <div className="seg" style={{ '--n': 3 }}>
        <div className="seg-pill" style={{ transform: `translateX(${subTab * 100}%)` }} />
        {['Plan 8 sem', 'Banderas Rojas', 'Pautas'].map((lbl, idx) => (
          <button key={lbl} className={`seg-btn ${subTab === idx ? 'on' : ''}`} onClick={() => setSubTab(idx)}>
            {lbl}
          </button>
        ))}
      </div>

      {subTab === 0 && (
        <div className="stack">
          {PREVENTION_PLAN.map((stage, sIdx) => {
            const isOpen = openStage === sIdx;
            const completedCount = stage.tasks.filter((_, tIdx) => doneTasks[`${sIdx}-${tIdx}`]).length;
            return (
              <div key={sIdx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenStage(isOpen ? null : sIdx)}
                  style={{ width: '100%', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                >
                  <div>
                    <div className="eyebrow" style={{ color: 'var(--pink)' }}>
                      {stage.week} · {completedCount}/{stage.tasks.length} metas
                    </div>
                    <div className="h3" style={{ marginTop: '2px' }}>{stage.title}</div>
                  </div>
                  <ChevronDown size={20} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }} />
                </button>

                {isOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--line)' }}>
                    <div className="stack" style={{ marginTop: '12px' }}>
                      {stage.tasks.map((task, tIdx) => {
                        const checked = !!doneTasks[`${sIdx}-${tIdx}`];
                        return (
                          <button
                            key={tIdx}
                            onClick={() => toggleTask(sIdx, tIdx)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}
                          >
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '6px',
                                background: checked ? 'var(--pink)' : 'transparent',
                                border: `2px solid ${checked ? 'var(--pink)' : 'var(--ink-3)'}`,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0
                              }}
                            >
                              {checked && <Check size={13} color="#000" strokeWidth={3} />}
                            </div>
                            <span className="small" style={{ color: checked ? 'var(--ink-3)' : 'var(--ink-2)', textDecoration: checked ? 'line-through' : 'none' }}>
                              {task}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {subTab === 1 && (
        <div className="card stack" style={{ borderColor: '#ff453a66' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={22} color="#ff453a" />
            <div className="h2" style={{ color: '#ff453a' }}>Criterios de Suspensión</div>
          </div>
          {RED_FLAGS.map((flag, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span className="badge" style={{ background: '#ff453a22', color: '#ff453a' }}>!</span>
              <span className="small muted">{flag}</span>
            </div>
          ))}
        </div>
      )}

      {subTab === 2 && (
        <div className="stack">
          <div className="card">
            <div className="h3">Control de Carga Aguda:Crónica</div>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Mantén tu indicador ACWR entre 0.8 y 1.3 registrando cada entrenamiento con distancia, esfuerzo Borg y dolor EVA.
            </p>
          </div>
          <div className="card">
            <div className="h3">Autogestión del Descanso</div>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Evita correr días consecutivos durante tus primeras 6 semanas para favorecer la remodelación ósea.
            </p>
          </div>
          <div className="card">
            <div className="h3">Consulta Oportuna</div>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Este prototipo es preventivo: ante dolor persistente, acude a fisioterapia o medicina del deporte.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}