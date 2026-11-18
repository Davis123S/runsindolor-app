import React, { useState, useEffect } from 'react';
import {
  Activity, Bone, BookOpen, Check, ChevronDown, ChevronRight,
  Dumbbell, Flame, Footprints, Gauge, HeartPulse, Home,
  Moon, Sun, Mountain, Pause, Play, RotateCcw,
  ShieldCheck, Stethoscope, TrendingUp, BarChart3,
  AlertTriangle, X, Zap, Watch, User, Sliders, RefreshCw,
  ArrowRight, LogOut, Lock, Mail, Download, Trash2,
  PlusCircle, ClipboardCheck, Award
} from 'lucide-react';

// --- HOOK DE PERSISTENCIA LOCAL ---
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

// --- CONVERSORES DE UNIDADES ---
const fmtWeight = (kg, unit) =>
  unit === 'metric' ? `${kg} kg` : `${Math.round(kg * 2.20462)} lb`;

const fmtDist = (km, unit) =>
  unit === 'metric' ? `${Number(km).toFixed(1)} km` : `${(Number(km) * 0.621371).toFixed(1)} mi`;

const distVal = (km, unit) =>
  unit === 'metric' ? Number(km) : +(Number(km) * 0.621371).toFixed(1);

const fmtPace = (minPerKm, unit) => {
  const val = unit === 'metric' ? minPerKm : minPerKm * 1.60934;
  const mins = Math.floor(val);
  const secs = Math.round((val - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')} ${unit === 'metric' ? '/km' : '/mi'}`;
};

// --- NAVEGACIÓN DE 6 PESTAÑAS ---
const TABS = [
  { id: 'inicio', label: 'Panel', Icon: Home },
  { id: 'watch', label: 'Reloj', Icon: Watch },
  { id: 'quees', label: 'Guía/Test', Icon: BookOpen },
  { id: 'prevencion', label: 'Prevenir', Icon: ShieldCheck },
  { id: 'ejercicios', label: 'Ejercicios', Icon: Dumbbell },
  { id: 'recuperacion', label: 'Plan 8S', Icon: HeartPulse },
];

// --- ESCALA EVA (DOLOR) ---
const PAIN_LEVELS = [
  { value: 0, label: 'Sin molestia', c: '#34c759', action: 'Carga óptima. Continúa con tu progresión preventiva.' },
  { value: 3, label: 'Molestia leve', c: '#ffd60a', action: 'Reduce 20% el volumen de impacto y prioriza fortalecimiento.' },
  { value: 5, label: 'Dolor moderado', c: '#ff9f0a', action: 'Señal temprana de sobreuso: suspende impacto y usa bici/elíptica.' },
  { value: 7, label: 'Dolor intenso', c: '#ff453a', action: 'Detén el entrenamiento de carrera y consulta a medicina deportiva.' },
  { value: 10, label: 'Dolor severo', c: '#ff2e55', action: 'Alerta clínica: valoración médica prioritaria.' },
];

const getPainInfo = (val) =>
  PAIN_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - val) < Math.abs(prev.value - val) ? curr : prev
  );

// --- ESCALA DE BORG CR-10 (RPE) ---
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

// --- CUESTIONARIO DE CONOCIMIENTO PREVENTIVO (10 ÍTEMS) ---
const QUIZ_QUESTIONS = [
  {
    q: '1. ¿Cuál es el incremento máximo recomendado en el volumen semanal de carrera para prevenir el SETM?',
    options: ['Hasta 30% semanal', 'Máximo 10% semanal', '50% cada quince días'],
    correct: 1
  },
  {
    q: '2. ¿Qué indica una Razón Carga Aguda/Crónica (ACWR) superior a 1.5?',
    options: ['Zona óptima de adaptación', 'Subcarga de entrenamiento', 'Riesgo elevado de lesión por sobreuso'],
    correct: 2
  },
  {
    q: '3. ¿Dónde se localiza típicamente el dolor del Síndrome de Estrés Tibial Medial?',
    options: ['Borde posteromedial (interno) de la tibia', 'Cara lateral externa de la rodilla', 'Planta del talón exclusivamente'],
    correct: 0
  },
  {
    q: '4. ¿Qué tipo de pisada se asocia con mayor caída navicular y tracción tibial?',
    options: ['Supinación leve', 'Hiperpronación dinámica', 'Apoyo neutro'],
    correct: 1
  },
  {
    q: '5. ¿Cada cuántos kilómetros aproximados se recomienda renovar el calzado de running?',
    options: ['Cada 600 a 800 km', 'Cada 2.000 km', 'Solo cuando se rompe la suela'],
    correct: 0
  },
  {
    q: '6. ¿Qué ajuste en la cadencia de carrera ayuda a reducir el impacto sobre la tibia?',
    options: ['Reducir la cadencia a 145 ppm', 'Aumentar ligeramente la cadencia (≥ 172 ppm)', 'Correr con zancadas muy largas'],
    correct: 1
  },
  {
    q: '7. ¿Cuál de estos factores antropométricos incrementa la carga mecánica tibial?',
    options: ['Índice de Masa Corporal (IMC) elevado (≥ 25)', 'Talla baja', 'Frecuencia cardíaca en reposo baja'],
    correct: 0
  },
  {
    q: '8. ¿Qué grupo muscular es clave fortalecer excéntricamente para absorber impacto tibial?',
    options: ['Bíceps braquial', 'Tríceps sural (sóleo/gemelos) y tibial anterior', 'Cuádriceps únicamente'],
    correct: 1
  },
  {
    q: '9. Si reportas dolor EVA ≥ 4 en dos sesiones consecutivas, ¿qué conducta preventiva debes tomar?',
    options: ['Aumentar el ritmo para calentar el hueso', 'Suspender impacto y buscar valoración profesional', 'Tomar analgésicos y correr igual'],
    correct: 1
  },
  {
    q: '10. ¿Qué población presenta mayor vulnerabilidad al SETM según la evidencia epidemiológica?',
    options: ['Corredores principiantes (< 12 meses de práctica)', 'Maratonistas con 10 años de experiencia', 'Ciclistas recreativos'],
    correct: 0
  }
];

const STATS_FACTS = [
  { num: '35%', label: 'de lesiones en corredores son SETM', c: '#34c759' },
  { num: '46.3%', label: 'ocurre en jóvenes de 23–25 años', c: '#32ade6' },
  { num: '≤ 10%', label: 'regla de progresión semanal segura', c: '#28a745' },
  { num: '40%', label: 'menos riesgo con trabajo neuromuscular', c: '#ff9f0a' },
];

const ANATOMY_CARDS = [
  { title: 'Periostio tibial', desc: 'Membrana vascularizada que recubre la tibia; se irrita por microcargas repetitivas.', c: '#ff2e55', Icon: Bone },
  { title: 'Sóleo y tibial posterior', desc: 'Músculos profundos que traccionan el borde posteromedial al controlar la pronación.', c: '#34c759', Icon: Activity },
  { title: 'Remodelación ósea', desc: 'El hueso necesita descanso progresivo para adaptarse a las fuerzas de reacción del suelo.', c: '#32ade6', Icon: Stethoscope },
];

const SYMPTOMS = [
  'Molestia difusa a lo largo de ≥ 5 cm en el tercio medio-inferior interno de la espinilla.',
  'Sensibilidad que aparece al iniciar la carrera, disminuye al entrar en calor y vuelve al terminar.',
  'Dolor palpable sobre el borde posteromedial de la tibia.',
  'Señal de alerta temprana: dolor EVA ≥ 4 durante dos entrenamientos seguidos.',
];

const RISK_FACTORS = [
  { title: 'Picos de carga (ACWR > 1.5)', detail: 'Aumentar kilómetros o intensidad por encima del 10% semanal supera la capacidad de adaptación ósea.' },
  { title: 'Poca experiencia (< 12 meses)', detail: 'Los corredores principiantes tienen más del doble de incidencia de lesiones por sobreuso (17.8 vs 7.7 / 1000h).' },
  { title: 'Hiperpronación y caída navicular', detail: 'El colapso excesivo del arco plantar genera torsión sobre el compartimento medial.' },
  { title: 'IMC elevado y superficies rígidas', detail: 'Mayor masa corporal combinada con asfalto continuo incrementa el pico de fuerza vertical.' },
];

const HABITS = [
  { title: 'Calzado adecuado', desc: 'Renueva tenis cada 650 km según tu tipo de pisada.', Icon: Footprints, c: '#34c759' },
  { title: 'Regla del 10%', desc: 'No subas tu kilometraje semanal más de 10%.', Icon: TrendingUp, c: '#32ade6' },
  { title: 'Variedad de terreno', desc: 'Alterna asfalto con tierra, grama o pista sintética.', Icon: Mountain, c: '#28a745' },
  { title: 'Core y glúteo medio', desc: 'Estabiliza la cadera para evitar colapso de rodilla/tobillo.', Icon: Zap, c: '#f59e0b' },
  { title: 'Descanso activo', desc: 'Incluye días sin impacto (natación o ciclismo).', Icon: Moon, c: '#bf5af2' },
  { title: 'Nutrición y Vit. D', desc: 'Aporte adecuado de calcio, proteína y vitamina D ósea.', Icon: Flame, c: '#ff9f0a' },
];

const WARMUP = [
  { time: 2, act: 'Movilidad articular de tobillo (círculos y dorsiflexión)' },
  { time: 2, act: 'Caminata en talones y puntas (activación tibial/tríceps sural)' },
  { time: 2, act: 'Activación de glúteo medio (pasos laterales con banda)' },
  { time: 2, act: 'Skipping bajo con cadencia alta (>175 ppm)' },
  { time: 2, act: 'Trote progresivo suave controlando el impacto' },
];

const EXERCISES = [
  {
    id: 1,
    phase: 'Fortalecimiento',
    title: 'Elevaciones de pantorrilla excéntricas',
    baseReps: 15,
    sets: 3,
    level: 'Básico',
    img: '/assets/ex1-talones-NEeXVCxD.jpg',
    timer: { s: 60, label: 'Descanso entre series' },
    steps: [
      'Párate con el antepié en el borde de un escalón.',
      'Sube en 2 segundos usando ambas piernas.',
      'Desciende lentamente (3–4 segundos) controlando la bajada.',
      'Mantén la rodilla extendida para trabajar el gastrocnemio.'
    ],
    tip: 'Fortalece el complejo aquileo-plantar para absorber mejor cada impacto.'
  },
  {
    id: 2,
    phase: 'Fortalecimiento',
    title: 'Dorsiflexión resistida con banda',
    baseReps: 20,
    sets: 3,
    level: 'Básico',
    img: '/assets/ex2-banda-CEppt7e-.jpg',
    timer: { s: 10, label: 'Isometría en máxima flexión' },
    steps: [
      'Siéntate con la pierna extendida y fija una banda elástica al antepié.',
      'Lleva la punta del pie hacia tu espinilla venciendo la resistencia.',
      'Sostén 10 segundos en el punto máximo y regresa lento.',
      'Evita compensar rotando la cadera.'
    ],
    tip: 'Un tibial anterior fuerte desacelera el golpe del pie contra el suelo.'
  },
  {
    id: 3,
    phase: 'Estiramiento',
    title: 'Estiramiento de sóleo y gemelo en pared',
    baseReps: 30,
    sets: 3,
    isTime: true,
    level: 'Esencial',
    img: '/assets/ex3-estiramiento-BQlpL-mO.jpg',
    timer: { s: 30, label: 'Tiempo de estiramiento' },
    steps: [
      'Colócate frente a una pared en posición de zancada corta.',
      'Flexiona la rodilla trasera sin levantar el talón del suelo.',
      'Adelanta la tibia hasta sentir tensión profunda en la parte baja del gemelo.',
      'Mantén 30 segundos sin rebotes.'
    ],
    tip: 'Mejora el rango de dorsiflexión, factor protector documentado frente al SETM.'
  },
  {
    id: 4,
    phase: 'Estiramiento',
    title: 'Liberación miofascial con rodillo',
    baseReps: 45,
    sets: 2,
    isTime: true,
    level: 'Básico',
    img: '/assets/ex4-rodillo-CCWq0QBt.jpg',
    timer: { s: 45, label: 'Masaje por pantorrilla' },
    steps: [
      'Siéntate con la pantorrilla apoyada sobre el rodillo de espuma.',
      'Cruza la otra pierna encima para graduar la presión.',
      'Desliza lentamente desde el tobillo hasta debajo de la rodilla.',
      'Evita presionar directamente sobre el hueso de la espinilla.'
    ],
    tip: 'Disminuye la rigidez muscular posterior tras sesiones de carrera.'
  },
  {
    id: 5,
    phase: 'Propiocepción',
    title: 'Equilibrio unipodal dinámico',
    baseReps: 30,
    sets: 3,
    isTime: true,
    level: 'Intermedio',
    img: '/assets/ex5-equilibrio-Dm1j_pE6.jpg',
    timer: { s: 30, label: 'Equilibrio por apoyo' },
    steps: [
      'Apóyate sobre un solo pie con la rodilla en semiflexión (15°).',
      'Mantén el arco plantar activo sin que el tobillo colapse hacia adentro.',
      'Cierra los ojos los últimos 15 segundos para desafiar el control neuromuscular.',
      'Mantén la pelvis nivelada.'
    ],
    tip: 'El entrenamiento neuromuscular es una de las estrategias preventivas con mayor evidencia.'
  },
  {
    id: 6,
    phase: 'Propiocepción',
    title: 'Saltos laterales controlados (Reactividad)',
    baseReps: 12,
    sets: 3,
    level: 'Avanzado',
    img: '/assets/ejercicios-atleta-Sq0ze4a5.jpg',
    timer: { s: 45, label: 'Descanso entre series' },
    steps: [
      'Realiza saltos cortos de lado a lado sobre una línea imaginaria.',
      'Aterriza suavemente con el antepié amortiguando con tobillo y rodilla.',
      'Mantén el tronco estable y aterrizajes silenciosos.',
      'Solo si tu dolor EVA es 0/10.'
    ],
    tip: 'Prepara la estructura ósea para tolerar cargas reactivas de impacto.'
  }
];

const PREVENTION_PLAN = [
  {
    week: 'Sem 1–2',
    title: 'Adaptación tisular y técnica base',
    tasks: [
      'Alternar bloques de caminata rápida y trote suave (ej. 3 min trote / 2 min caminata)',
      'Mantener esfuerzo percibido Borg CR-10 entre 3 y 4 (suave-moderado)',
      'Completar rutina neuromuscular preventiva 3 veces por semana',
      'Verificar que el dolor EVA post-sesión sea ≤ 2/10'
    ]
  },
  {
    week: 'Sem 3–4',
    title: 'Consolidación de cadencia y fortalecimiento',
    tasks: [
      'Incrementar volumen semanal máximo un 10% respecto a Sem 2',
      'Monitorear cadencia en reloj buscando ≥ 170 pasos/min',
      'Mantener Razón Carga Aguda/Crónica (ACWR) en zona segura (0.8–1.3)',
      'Realizar calentamiento dinámico de 10 min antes de cada salida'
    ]
  },
  {
    week: 'Sem 5–6',
    title: 'Progresión aeróbica continua segura',
    tasks: [
      'Transición a trote continuo de 25–30 min en superficie blanda/mixta',
      'Incluir al menos 1 día de descanso activo sin impacto entre sesiones',
      'Registrar cada entrenamiento con escala Borg CR-10 y EVA',
      'Evaluar desgaste de suela y estabilidad del calzado'
    ]
  },
  {
    week: 'Sem 7–8',
    title: 'Autonomía preventiva y control de carga',
    tasks: [
      'Completar 30–40 min de running recreativo asintomático (EVA 0/10)',
      'Mantener equilibrio de carga aguda/crónica sin picos abruptos',
      'Completar Test Post de conocimiento preventivo (meta ≥ 30% mejora)',
      'Sostener rutina semanal de fortalecimiento excéntrico y propiocepción'
    ]
  }
];

const RED_FLAGS = [
  'Dolor EVA ≥ 4 en dos sesiones consecutivas de entrenamiento.',
  'Dolor punzante focalizado en un punto específico menor a 2 cm sobre el hueso.',
  'Molestia que persiste en reposo, al caminar o durante la noche.',
  'Inflamación visible, enrojecimiento o calor local en la espinilla.',
];

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




// --- COMPONENTE PRINCIPAL ---
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
  const [activeEx, setActiveEx] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState(null);

  const currentUser = currentEmail ? usersDb[currentEmail] : null;

  const updateCurrentUser = (updater) => {
    if (!currentEmail) return;
    setUsersDb((prev) => {
      const existing = prev[currentEmail];
      if (!existing) return prev;
      const updated = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
      return { ...prev, [currentEmail]: updated };
    });
  };

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
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
              recoveryTasks: {},
              watchData: {
                device: 'Apple Watch Series 9',
                lastSync: 'Hoy, 07:45 AM',
                distanceKm: 5.0,
                paceMinKm: 5.30,
                cadence: 165,
                groundContactMs: 264,
                verticalOscCm: 9.5,
                avgHr: 154
              }
            }
          });
          setCurrentEmail(cleanEmail);
          notify('Cuenta creada bajo Ley 1581 de 2012');
          return null;
        }}
        onLogin={(email, password) => {
          const cleanEmail = email.toLowerCase().trim();
          const found = usersDb[cleanEmail];
          if (!found || found.password !== password) {
            return 'Correo o contraseña incorrectos.';
          }
          setCurrentEmail(cleanEmail);
          notify('Sesión iniciada');
          return null;
        }}
        onDemoLogin={() => {
          const demoEmail = 'corredor.demo@umb.edu.co';
          if (!usersDb[demoEmail]) {
            setUsersDb((prev) => ({
              ...prev,
              [demoEmail]: {
                email: demoEmail,
                password: 'demo',
                consentAccepted: true,
                consentDate: '2026-11-17',
                profile: {
                  name: 'Camila Rodríguez',
                  age: 21,
                  sex: 'femenino',
                  weightKg: 62,
                  heightCm: 165,
                  footType: 'pronador',
                  experience: '3-6m',
                  weeklyKm: 14,
                  priorInjury: 'no'
                },
                sessions: [
                  { id: 1, date: '2026-11-05', distanceKm: 3.2, durationMin: 20, rpe: 3, eva: 1 },
                  { id: 2, date: '2026-11-08', distanceKm: 3.8, durationMin: 23, rpe: 4, eva: 1 },
                  { id: 3, date: '2026-11-11', distanceKm: 4.5, durationMin: 26, rpe: 5, eva: 2 },
                  { id: 4, date: '2026-11-14', distanceKm: 5.0, durationMin: 29, rpe: 5, eva: 2 },
                  { id: 5, date: '2026-11-17', distanceKm: 5.5, durationMin: 31, rpe: 6, eva: 1 }
                ],
                quizScores: { pre: 5, post: null },
                warmupChecks: [0, 1],
                recoveryTasks: { '0-0': true, '0-1': true },
                watchData: {
                  device: 'Apple Watch Series 9',
                  lastSync: 'Hoy, 08:10 AM',
                  distanceKm: 5.5,
                  paceMinKm: 5.38,
                  cadence: 166,
                  groundContactMs: 262,
                  verticalOscCm: 9.4,
                  avgHr: 158
                }
              }
            }));
          }
          setCurrentEmail(demoEmail);
          notify('Perfil de demostración cargado');
        }}
      />
    );
  }

  // --- CÁLCULO BIOMÉDICO + ACWR ---
  const calculateBiometrics = (user) => {
    const p = user.profile;
    if (!p) return null;

    const heightM = p.heightCm / 100;
    const bmi = +(p.weightKg / (heightM * heightM)).toFixed(1);

    // Carga aguda: suma de las últimas 3 sesiones (o semana reciente) vs carga crónica semanal
    const recentSessions = user.sessions.slice(-3);
    const loggedKm = recentSessions.reduce((acc, s) => acc + Number(s.distanceKm || 0), 0);
    const acuteKm = loggedKm > 0 ? loggedKm : p.weeklyKm;
    const chronicKm = Math.max(1, p.weeklyKm);
    const acwr = +(acuteKm / chronicKm).toFixed(2);

    let acwrStatus = 'Zona segura';
    let acwrColor = '#34c759';
    if (acwr < 0.8) {
      acwrStatus = 'Subcarga';
      acwrColor = '#32ade6';
    } else if (acwr > 1.5) {
      acwrStatus = 'Riesgo elevado';
      acwrColor = '#ff453a';
    } else if (acwr > 1.3) {
      acwrStatus = 'Precaución';
      acwrColor = '#f59e0b';
    }

    const lastTwo = user.sessions.slice(-2);
    const consecutivePainAlert = lastTwo.length === 2 && lastTwo.every((s) => s.eva >= 4);

    const avgRpe = user.sessions.length
      ? +(user.sessions.reduce((a, s) => a + s.rpe, 0) / user.sessions.length).toFixed(1)
      : 0;

    let riskScore = 0;
    if (bmi >= 25) riskScore += 2;
    if (p.sex === 'femenino') riskScore += 1;
    if (p.footType === 'pronador') riskScore += 2;
    if (p.experience === '<3m' || p.experience === '3-6m') riskScore += 1;
    if (p.priorInjury === 'si') riskScore += 2;
    if (acwr > 1.3) riskScore += 2;
    if (user.watchData.cadence < 170) riskScore += 1;
    if (consecutivePainAlert) riskScore += 3;

    let riskLevel = 'Bajo';
    let riskColor = '#34c759';
    let loadFactor = 1.0;

    if (riskScore >= 6) {
      riskLevel = 'Alto';
      riskColor = '#ff453a';
      loadFactor = 0.75;
    } else if (riskScore >= 3) {
      riskLevel = 'Moderado';
      riskColor = '#f59e0b';
      loadFactor = 0.9;
    }

    return {
      bmi,
      acwr,
      acwrStatus,
      acwrColor,
      acuteKm,
      chronicKm,
      consecutivePainAlert,
      avgRpe,
      riskLevel,
      riskColor,
      loadFactor
    };
  };

  const bio = calculateBiometrics(currentUser);

  if (!currentUser.profile || editingProfile) {
    return (
      <PatientOnboarding
        initialData={currentUser.profile}
        unit={unit}
        setUnit={setUnit}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSave={(newProfile) => {
          updateCurrentUser({ profile: newProfile });
          setEditingProfile(false);
          notify('Algoritmo calibrado con tu perfil');
        }}
        onCancel={currentUser.profile ? () => setEditingProfile(false) : null}
      />
    );
  }

  const handleExportCSV = () => {
    const p = currentUser.profile;
    const headers = [
      'Correo', 'Nombre', 'Edad', 'Sexo', 'Peso_kg', 'Talla_cm', 'IMC',
      'Pisada', 'Experiencia_Running', 'Lesion_Previa', 'ACWR', 'Nivel_Riesgo',
      'RPE_Promedio', 'Total_Sesiones', 'Quiz_Pre', 'Quiz_Post', 'Mejora_Quiz_%'
    ];
    const pre = currentUser.quizScores?.pre ?? '';
    const post = currentUser.quizScores?.post ?? '';
    const delta = (pre !== '' && post !== '' && pre > 0)
      ? Math.round(((post - pre) / pre) * 100)
      : '';

    const row = [
      currentUser.email, `"${p.name}"`, p.age, p.sex, p.weightKg, p.heightCm, bio.bmi,
      p.footType, p.experience, p.priorInjury, bio.acwr, bio.riskLevel,
      bio.avgRpe, currentUser.sessions.length, pre, post, delta
    ];

    const sessionHeaders = ['\n\nFecha_Sesion', 'Distancia_km', 'Duracion_min', 'Borg_RPE', 'Dolor_EVA'];
    const sessionRows = currentUser.sessions.map((s) =>
      [s.date, s.distanceKm, s.durationMin, s.rpe, s.eva].join(',')
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
    link.setAttribute('download', `SETM_Datos_${p.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify('Archivo CSV exportado para análisis estadístico');
  };

  const handleDeleteAccount = () => {
    if (!window.confirm('¿Deseas eliminar permanentemente tu cuenta y todos tus datos de salud (Ley 1581 de 2012)?')) return;
    setUsersDb((prev) => {
      const copy = { ...prev };
      delete copy[currentEmail];
      return copy;
    });
    setCurrentEmail(null);
    notify('Datos eliminados definitivamente');
  };

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {/* BARRA SUPERIOR */}
      <header className={`topbar ${scrolled ? 'scrolled' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div className="brand-mark">
            <AppIconMark size={28} />
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: '9.5px' }}>Corredor Activo</div>
            <div className="h3" style={{ fontSize: '14px' }}>{currentUser.profile.name}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            className="btn-soft tap"
            style={{ minHeight: '34px', width: '34px', padding: 0, display: 'grid', placeItems: 'center' }}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          >
            {theme === 'dark' ? <Sun size={16} color="#ffd60a" /> : <Moon size={16} />}
          </button>

          <button
            className="btn-soft tap tnum"
            style={{ minHeight: '34px', padding: '0 8px', fontSize: '11px', fontWeight: '700' }}
            onClick={() => {
              const next = unit === 'metric' ? 'imperial' : 'metric';
              setUnit(next);
              notify(`Sistema: ${next === 'metric' ? 'Métrico (kg/km)' : 'Imperial (lb/mi)'}`);
            }}
          >
            {unit === 'metric' ? 'KG/KM' : 'LB/MI'}
          </button>

          <button
            className="btn-soft tap"
            style={{
              minHeight: '34px',
              padding: '0 8px',
              fontSize: '12px',
              fontWeight: '800',
              border: showA11y ? '1px solid var(--pink)' : '1px solid transparent'
            }}
            onClick={() => setShowA11y(!showA11y)}
          >
            Aa
          </button>

          <button
            className="btn-soft tap"
            style={{ minHeight: '34px', width: '34px', padding: 0, display: 'grid', placeItems: 'center' }}
            onClick={() => setEditingProfile(true)}
            title="Editar perfil biométrico"
          >
            <User size={16} />
          </button>

          <button
            className="btn-soft tap"
            style={{ minHeight: '34px', width: '34px', padding: 0, display: 'grid', placeItems: 'center' }}
            onClick={() => setCurrentEmail(null)}
            title="Cerrar sesión"
          >
            <LogOut size={16} color="#ff453a" />
          </button>
        </div>
      </header>

      {/* PANEL DE ACCESIBILIDAD Y APARIENCIA */}
      {showA11y && (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '8px 18px 0' }}>
          <div className="card" style={{ borderColor: 'var(--pink)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={15} color="var(--pink)" />
                <span className="h3" style={{ fontSize: '14px' }}>Accesibilidad y Apariencia</span>
              </div>
              <button onClick={() => setShowA11y(false)}><X size={18} color="var(--ink-2)" /></button>
            </div>

            <div className="eyebrow" style={{ marginBottom: '6px' }}>Tema de interfaz</div>
            <div className="seg" style={{ '--n': 2, marginBottom: '14px' }}>
              <div
                className="seg-pill"
                style={{ transform: `translateX(${theme === 'dark' ? 0 : 100}%)` }}
              />
              <button
                className={`seg-btn ${theme === 'dark' ? 'on' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={14} /> Oscuro
              </button>
              <button
                className={`seg-btn ${theme === 'light' ? 'on' : ''}`}
                onClick={() => setTheme('light')}
              >
                <Sun size={14} /> Claro
              </button>
            </div>

            <div className="eyebrow" style={{ marginBottom: '6px' }}>Tamaño de tipografía</div>
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
      )}

      <main className="screen stagger">
        {tab === 'inicio' && (
          <DashboardView
            user={currentUser}
            bio={bio}
            unit={unit}
            onEditProfile={() => setEditingProfile(true)}
            onOpenSession={() => setShowSessionModal(true)}
            onGoTab={setTab}
            onExportCSV={handleExportCSV}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
        {tab === 'watch' && (
          <WatchMetricsView
            watchData={currentUser.watchData}
            setWatchData={(wd) => updateCurrentUser({ watchData: wd })}
            unit={unit}
            setUnit={setUnit}
            notify={notify}
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
          <ExercisesView bio={bio} onOpenExercise={(ex) => setActiveEx(ex)} />
        )}
        {tab === 'recuperacion' && (
          <RecoveryView
            doneTasks={currentUser.recoveryTasks || {}}
            setDoneTasks={(obj) => updateCurrentUser({ recoveryTasks: obj })}
            notify={notify}
          />
        )}

        <div className="footer-note">
          Prototipo interactivo para prevención primaria del SETM (UMB · Ingeniería Biomédica). Protegido bajo Ley 1581 de 2012. No sustituye valoración médica.
        </div>
      </main>

      {showSessionModal && (
        <LogSessionModal
          unit={unit}
          onClose={() => setShowSessionModal(false)}
          onSaveSession={(session) => {
            updateCurrentUser((u) => ({
              ...u,
              sessions: [...u.sessions, { ...session, id: Date.now() }]
            }));
            setShowSessionModal(false);
            notify('Entrenamiento registrado y gráficas actualizadas');
          }}
        />
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
// 0. PANTALLA DE AUTENTICACIÓN
// ============================================================================
function AuthView({ theme, onToggleTheme, onLogin, onRegister, onDemoLogin }) {
  const [isRegister, setIsRegister] = useState(false);
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
      className="screen stagger"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 40px)'
      }}
    >

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button type="button" onClick={onToggleTheme} className="btn-soft tap" style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          {theme === 'dark' ? <><Sun size={14} color="#ffd60a" /> Tema Claro</> : <><Moon size={14} /> Tema Oscuro</>}
        </button>
      </div>

      <div className="hero-card" style={{ minHeight: '400px', marginBottom: '20px', justifyContent: 'flex-end' }}>
        <img src="/assets/Inicio.jpg" alt="Running preventivo" className="hero-bg" />
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
          <span
            style={{
              margin: 0,
              padding: 0,
              fontSize: '30px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#34c759'
            }}
          >
            RunEase
          </span>
          <h1 className="display" style={{ fontSize: '40px', marginTop: '4px' }}>
            Corre seguro, <span className="grad-text">Protege tus tibias</span>
          </h1>
        </div>
      </div>




      <div className="seg" style={{ '--n': 2, marginBottom: '16px' }}>
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
              placeholder="persona@ejemplo.com"
              className="input-field"
              style={{ paddingLeft: '38px' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Mail size={16} color="var(--ink-3)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
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
            <Lock size={16} color="var(--ink-3)" style={{ position: 'absolute', left: '12px', top: '14px' }} />
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

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <button type="button" onClick={onDemoLogin} className="btn btn-soft tap">
          <Award size={17} color="var(--pink)" />
          <span>Perfil Evaluador

          </span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 1. FORMULARIO BIOMÉTRICO DEL CORREDOR
// ============================================================================
function PatientOnboarding({ initialData, unit, setUnit, theme, onToggleTheme, onSave, onCancel }) {
  const [name, setName] = useState(initialData?.name || '');
  const [age, setAge] = useState(initialData?.age || 21);
  const [sex, setSex] = useState(initialData?.sex || 'femenino');
  const [weightKg, setWeightKg] = useState(initialData?.weightKg || 65);
  const [heightCm, setHeightCm] = useState(initialData?.heightCm || 170);
  const [footType, setFootType] = useState(initialData?.footType || 'neutra');
  const [experience, setExperience] = useState(initialData?.experience || '<3m');
  const [weeklyKm, setWeeklyKm] = useState(initialData?.weeklyKm || 12);
  const [priorInjury, setPriorInjury] = useState(initialData?.priorInjury || 'no');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      age: Number(age),
      sex,
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      footType,
      experience,
      weeklyKm: Number(weeklyKm),
      priorInjury
    });
  };

  return (
    <div className="screen stagger" style={{ paddingTop: '24px', paddingBottom: '40px' }}>
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
        Parametrización antropométrica, sociodemográfica y biomecánica para el algoritmo preventivo.
      </p>

      <form onSubmit={handleSubmit} className="stack">
        <div className="card">
          <div className="input-group">
            <label className="eyebrow">Nombre completo</label>
            <input type="text" required placeholder="Ej. Laura Gómez" className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid-2">
            <div className="input-group">
              <label className="eyebrow">Edad (Población 18–25)</label>
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
              <label className="eyebrow">Carga crónica ({unit === 'metric' ? 'km/sem' : 'mi/sem'})</label>
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
            <label className="eyebrow">Tipo de pisada biomecánica</label>
            <select className="input-field" value={footType} onChange={(e) => setFootType(e.target.value)}>
              <option value="neutra">Pisada Neutra</option>
              <option value="pronador">Pronador (caída navicular / arco interno)</option>
              <option value="supinador">Supinador (apoyo borde externo)</option>
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

        <button type="submit" className="btn btn-primary tap">
          <span>Guardar</span>
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
// 2. PANEL PRINCIPAL (CON GRÁFICAS INTERACTIVAS DE CARGA, ACWR Y DOLOR EVA)
// ============================================================================
function DashboardView({ user, bio, unit, onEditProfile, onOpenSession, onGoTab, onExportCSV, onDeleteAccount }) {
  const [pain, setPain] = useState(0);
  const advice = getPainInfo(pain);
  const needleAngle = -90 + pain * 18;

  return (
    <div className="stack">
      {bio.consecutivePainAlert && (
        <div className="card" style={{ borderColor: '#ff453a', background: '#ff453a22' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertTriangle size={22} color="#ff453a" style={{ flexShrink: 0 }} />
            <div>
              <div className="h3" style={{ color: '#ff453a' }}>Señal de Alerta Temprana Activada</div>
              <p className="small muted" style={{ marginTop: '4px' }}>
                Reportaste dolor <strong>EVA ≥ 4 en 2 sesiones consecutivas</strong>. Suspende la carrera de impacto y solicita valoración profesional.
              </p>
            </div>
          </div>
        </div>
      )}

      <button onClick={onOpenSession} className="btn btn-primary tap">
        <PlusCircle size={20} />
        <span>Registrar Entrenamiento</span>
      </button>

      {/* DIAGNÓSTICO ALGORÍTMICO */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>

            <h2 className="h2" style={{ marginTop: '4px' }}>
              Riesgo Estimado: <span style={{ color: bio.riskColor }}>{bio.riskLevel}</span>
            </h2>
          </div>
          <button onClick={onEditProfile} className="btn-soft tap" style={{ minHeight: '32px', fontSize: '12px' }}>
            Perfil
          </button>
        </div>

        <div className="grid-2" style={{ marginTop: '14px' }}>
          <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '14px' }}>
            <div className="eyebrow" style={{ fontSize: '10px' }}>Razón Carga (ACWR)</div>
            <div className="h3 tnum" style={{ marginTop: '4px', color: bio.acwrColor }}>
              {bio.acwr} <span className="small muted">({bio.acwrStatus})</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '14px' }}>
            <div className="eyebrow" style={{ fontSize: '10px' }}>IMC / Dosificación</div>
            <div className="h3 tnum" style={{ marginTop: '4px' }}>
              {bio.bmi} <span className="small" style={{ color: 'var(--pink)' }}>· {Math.round(bio.loadFactor * 100)}%</span>
            </div>
          </div>
        </div>

        {user.sessions.length > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>
              Últimas sesiones ({user.sessions.length}) · RPE Promedio: {bio.avgRpe}/10
            </div>
            <div className="stack" style={{ gap: '6px' }}>
              {user.sessions.slice(-3).reverse().map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', background: 'var(--surface-2)', padding: '8px 12px', borderRadius: '10px' }}>
                  <span className="muted tnum">{s.date} · {fmtDist(s.distanceKm, unit)}</span>
                  <span className="tnum" style={{ fontWeight: '700' }}>
                    Borg {s.rpe} · <span style={{ color: s.eva >= 4 ? '#ff453a' : 'var(--pink)' }}>EVA {s.eva}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GRÁFICAS INTERACTIVAS DE TENDENCIA (ACWR, VOLUMEN Y DOLOR EVA / BORG) */}
      <TrendChartsCard
        sessions={user.sessions}
        chronicKm={bio.chronicKm}
        acwr={bio.acwr}
        acwrColor={bio.acwrColor}
        acwrStatus={bio.acwrStatus}
        unit={unit}
      />

      {/*WEARABLE */}
      <div
        className="card tap"
        onClick={() => onGoTab('watch')}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="icon-tile" style={{ '--c': '#32ade6' }}>
            <Watch size={21} />
          </div>
          <div>
            <div className="eyebrow" style={{ fontSize: '10px' }}>{user.watchData.device}</div>
            <div className="h3 tnum">
              {fmtDist(user.watchData.distanceKm, unit)} · {user.watchData.cadence} ppm
            </div>
            <div className="small muted">Ver telemetría wearable</div>
          </div>
        </div>
        <ChevronRight size={20} color="var(--ink-3)" />
      </div>

      {/* MEDIDOR DE DOLOR EVA */}
      <div className="card">
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Gauge size={14} color="var(--pink)" /> Chequeo Rápido EVA (0–10)
        </div>
        <h2 className="h2" style={{ marginTop: '4px' }}>Sensación tibial hoy</h2>

        <div className="gauge-wrap" style={{ marginTop: '12px' }}>
          <svg className="gauge" viewBox="0 0 300 165">
            <defs>
              <linearGradient id="g-pain" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#34c759" />
                <stop offset=".4" stopColor="#ffd60a" />
                <stop offset=".7" stopColor="#ff9f0a" />
                <stop offset="1" stopColor="#ff2e55" />
              </linearGradient>
            </defs>
            <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="var(--surface-2)" strokeWidth="22" strokeLinecap="round" />
            <path
              d="M 30 150 A 120 120 0 0 1 270 150"
              fill="none"
              stroke="url(#g-pain)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray="377"
              strokeDashoffset={377 - (377 * pain) / 10}
              style={{ transition: 'stroke-dashoffset .6s ease' }}
            />
            <g className="gauge-needle" style={{ transform: `rotate(${needleAngle}deg)` }}>
              <path d="M150 150 L145 150 L150 58 L155 150 Z" fill="var(--ink)" />
            </g>
            <circle cx="150" cy="150" r="10" fill="var(--ink)" />
          </svg>

          <div className="gauge-value tnum" style={{ color: advice.c }}>
            {pain}<span style={{ fontSize: '18px', color: 'var(--ink-3)' }}>/10</span>
          </div>
          <div style={{ fontWeight: '700', color: advice.c }}>{advice.label}</div>

          <div className="pain-dots">
            {Array.from({ length: 11 }, (_, idx) => (
              <button
                key={idx}
                className={`pain-dot tnum ${pain === idx ? 'on' : ''}`}
                style={{ '--c': getPainInfo(idx).c }}
                onClick={() => setPain(idx)}
              >
                {idx}
              </button>
            ))}
          </div>

          <div className="pain-advice" style={{ '--c': advice.c }}>
            <AlertTriangle size={20} color={advice.c} style={{ flexShrink: 0 }} />
            <span className="small">{advice.action}</span>
          </div>
        </div>
      </div>

      {/* EXPORTACIÓN CSV Y HABEAS DATA */}
      <div className="card">
        <div className="eyebrow">Investigación y Privacidad (Ley 1581)</div>
        <div className="h3" style={{ marginTop: '4px', marginBottom: '12px' }}>Gestión de datos del corredor</div>
        <div className="grid-2">
          <button onClick={onExportCSV} className="btn btn-soft tap">
            <Download size={16} color="var(--pink)" />
            <span>Exportar CSV</span>
          </button>
          <button onClick={onDeleteAccount} className="btn btn-soft tap" style={{ color: '#ff453a' }}>
            <Trash2 size={16} />
            <span>Borrar Datos</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE DE GRÁFICAS SVG: CARGA + ACWR Y TENDENCIA EVA / BORG
// ============================================================================
function TrendChartsCard({ sessions, chronicKm, acwr, acwrColor, acwrStatus, unit }) {
  const [chartTab, setChartTab] = useState(0); // 0: Carga & ACWR | 1: Dolor EVA & Borg
  const recent = sessions.slice(-7);
  const unitLabel = unit === 'metric' ? 'km' : 'mi';

  // Posición del indicador ACWR en escala de 0.0 a 2.0
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

      {/* SELECTOR DE GRÁFICA */}
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
          {/* BARRA DE ZONAS DE RIESGO ACWR (0.0 – 2.0) */}
          <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="eyebrow" style={{ fontSize: '10px' }}>Índice Carga Aguda/Crónica</span>
              <span className="badge tnum" style={{ color: acwrColor, background: `color-mix(in srgb, ${acwrColor} 18%, transparent)` }}>
                ACWR {acwr} · {acwrStatus}
              </span>
            </div>

            <div style={{ position: 'relative', height: '12px', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: '40%', background: '#32ade6' }} title="Subcarga (< 0.8)" />
              <div style={{ width: '25%', background: '#34c759' }} title="Zona segura (0.8 - 1.3)" />
              <div style={{ width: '10%', background: '#ffd60a' }} title="Precaución (1.3 - 1.5)" />
              <div style={{ width: '25%', background: '#ff453a' }} title="Riesgo elevado (> 1.5)" />
            </div>

            {/* MARCADOR DE POSICIÓN ACTUAL */}
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

          {/* GRÁFICO DE BARRAS DE DISTANCIA POR SESIÓN */}
          {recent.length === 0 ? (
            <div className="small muted" style={{ textAlign: 'center', padding: '16px 0' }}>
              Registra tu primer entrenamiento arriba para visualizar la evolución de carga.
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span className="eyebrow" style={{ fontSize: '10px' }}>Distancia por sesión ({unitLabel})</span>
                <span className="small muted tnum" style={{ fontSize: '11px' }}>
                  Meta crónica: {fmtDist(chronicKm, unit)}/sem
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
                    {/* Líneas guía horizontales */}
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
                      const shortDate = s.date.slice(5); // MM-DD
                      const barColor = s.eva >= 4 ? '#ff453a' : 'var(--pink)';

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
                const alertY = getY(4); // Línea crítica EVA = 4

                return (
                  <>
                    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                      {/* Eje Y (0, 5, 10) */}
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

                      {/* Umbral de alerta temprana EVA = 4 */}
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
                        Alerta EVA ≥ 4
                      </text>

                      {/* Línea de Esfuerzo Borg CR-10 */}
                      {recent.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#32ade6"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                          points={rpePoints}
                        />
                      )}

                      {/* Línea de Dolor EVA */}
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

                      {/* Puntos de datos */}
                      {recent.map((s, i) => {
                        const cx = getX(i);
                        const cyEva = getY(s.eva);
                        const cyRpe = getY(s.rpe);
                        const dotColor = s.eva >= 4 ? '#ff453a' : 'var(--pink)';
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

                    {/* Leyenda */}
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
// MODAL: REGISTRO DE SESIÓN
// ============================================================================
function LogSessionModal({ unit, onClose, onSaveSession }) {
  const [distanceKm, setDistanceKm] = useState(4.0);
  const [durationMin, setDurationMin] = useState(25);
  const [rpe, setRpe] = useState(4);
  const [eva, setEva] = useState(1);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSession({
      date: new Date().toISOString().split('T')[0],
      distanceKm: Number(distanceKm),
      durationMin: Number(durationMin),
      rpe: Number(rpe),
      eva: Number(eva)
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
          padding: '22px 20px 36px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span className="badge">Autoregistro de Sesión</span>
            <h2 className="h2" style={{ marginTop: '6px' }}>Carga y Síntomas</h2>
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
          <label className="eyebrow">Dolor Tibial Posteromedial · EVA: <span style={{ color: getPainInfo(eva).c }}>{eva}/10</span></label>
          <input
            type="range"
            min="0"
            max="10"
            value={eva}
            onChange={(e) => setEva(Number(e.target.value))}
            style={{ width: '100%', accentColor: getPainInfo(eva).c, marginTop: '6px' }}
          />
        </div>

        <button type="submit" className="btn btn-primary tap">
          <span>Guardar Sesión y Actualizar Gráficas</span>
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// 3. TELEMETRÍA WEARABLE
// ============================================================================
function WatchMetricsView({ watchData, setWatchData, unit, setUnit, notify }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = (platform) => {
    setSyncing(true);
    setTimeout(() => {
      const isGoodForm = Math.random() > 0.45;
      const devName = platform === 'apple' ? 'Apple Watch Series / Ultra' : 'Android Wear OS / Health Connect';
      setWatchData({
        device: devName,
        lastSync: 'Sincronizado ahora',
        distanceKm: +(4 + Math.random() * 5).toFixed(1),
        paceMinKm: +(4.7 + Math.random() * 1.3).toFixed(2),
        cadence: isGoodForm ? 176 : 161,
        groundContactMs: isGoodForm ? 232 : 278,
        verticalOscCm: isGoodForm ? 7.9 : 10.4,
        avgHr: Math.round(145 + Math.random() * 25)
      });
      setSyncing(false);
      notify(`Telemetría recibida desde ${platform === 'apple' ? 'Apple Health' : 'Health Connect'}`);
    }, 800);
  };

  const oscDisplay = unit === 'metric'
    ? `${watchData.verticalOscCm} cm`
    : `${(watchData.verticalOscCm / 2.54).toFixed(1)} in`;

  const highImpactAlert = watchData.cadence < 170 || watchData.groundContactMs > 255;

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge">SmartWatch</span>
          <button
            className="btn-soft tap tnum"
            style={{ minHeight: '32px', fontSize: '12px', padding: '0 10px' }}
            onClick={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}
          >
            {unit === 'metric' ? 'Ver en Imperial' : 'Ver en Métrico'}
          </button>
        </div>

        <h2 className="display" style={{ marginTop: '10px', fontSize: '26px' }}>
          Métricas de Carrera
        </h2>
        <p className="small muted" style={{ marginTop: '4px' }}>
          Dispositivo: <strong>{watchData.device}</strong> ({watchData.lastSync})
        </p>

        <div className="grid-2" style={{ marginTop: '16px' }}>
          <button className="btn btn-soft tap" onClick={() => handleSync('apple')} disabled={syncing}>
            <RefreshCw size={16} />
            <span>Sync Apple Watch</span>
          </button>
          <button className="btn btn-soft tap" onClick={() => handleSync('android')} disabled={syncing}>
            <RefreshCw size={16} />
            <span>Sync Android Watch</span>
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          borderColor: highImpactAlert ? '#ff453a' : 'var(--pink)',
          background: highImpactAlert ? '#ff453a18' : '#34c75914'
        }}
      >
        <div className="eyebrow" style={{ color: highImpactAlert ? '#ff453a' : 'var(--pink)' }}>
          Feedback Biomecánico en Tiempo Real
        </div>
        <div className="h3" style={{ marginTop: '4px' }}>
          {highImpactAlert
            ? 'Sobrecarga de impacto detectada'
            : 'Técnica protectora para la tibia'}
        </div>
        <p className="small muted" style={{ marginTop: '6px' }}>
          {highImpactAlert
            ? `Cadencia baja (${watchData.cadence} ppm) y contacto prolongado (${watchData.groundContactMs} ms). Incrementar un 5% la cadencia disminuye la fuerza de frenado tibial.`
            : `Cadencia óptima (${watchData.cadence} ppm) y tiempo de contacto reducido (${watchData.groundContactMs} ms).`}
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="eyebrow">Distancia</div>
          <div className="h2 tnum" style={{ marginTop: '6px', color: 'var(--pink)' }}>{fmtDist(watchData.distanceKm, unit)}</div>
        </div>
        <div className="card">
          <div className="eyebrow">Ritmo Medio</div>
          <div className="h2 tnum" style={{ marginTop: '6px', color: '#32ade6' }}>{fmtPace(watchData.paceMinKm, unit)}</div>
        </div>
        <div className="card">
          <div className="eyebrow">Cadencia</div>
          <div className="h2 tnum" style={{ marginTop: '6px', color: watchData.cadence < 170 ? '#f59e0b' : 'var(--pink)' }}>
            {watchData.cadence} <span className="small muted">ppm</span>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Contacto Suelo</div>
          <div className="h2 tnum" style={{ marginTop: '6px', color: watchData.groundContactMs > 255 ? '#ff453a' : 'var(--pink)' }}>
            {watchData.groundContactMs} <span className="small muted">ms</span>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Oscilación Vert.</div>
          <div className="h2 tnum" style={{ marginTop: '6px' }}>{oscDisplay}</div>
        </div>
        <div className="card">
          <div className="eyebrow">Frec. Cardíaca</div>
          <div className="h2 tnum" style={{ marginTop: '6px', color: '#ff2e55' }}>
            {watchData.avgHr} <span className="small muted">lpm</span>
          </div>
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
      title: 'Biomecánica pélvica y salud ósea en corredoras',
      summary:
        'La evidencia epidemiológica identifica el sexo femenino como factor de riesgo intrínseco para SETM, asociado a diferencias en alineación pélvica, control neuromuscular de cadera y metabolismo óseo.',
      points: [
        {
          label: 'Estabilidad de cadera y glúteo medio',
          text: 'La mayor anchura pélvica relativa puede favorecer el valgo dinámico de rodilla y la hiperpronación tibial; prioriza ejercicios de glúteo medio y equilibrio unipodal.'
        },
        {
          label: 'Disponibilidad energética y remodelación ósea',
          text: 'Un déficit calórico relativo (RED-S) o baja ingesta de calcio y vitamina D reduce la capacidad de reparación ósea de la tibia frente a microcargas repetitivas.'
        },
        {
          label: 'Adaptación gradual inicial',
          text: 'Durante las primeras 8 semanas evita sesiones de impacto en días consecutivos para permitir la adaptación del periostio.'
        }
      ]
    }
    : {
      badge: 'Enfoque Diferenciado · Sexo Masculino',
      accent: '#32ade6',
      title: 'Control de picos de carga y rigidez muscular',
      summary:
        'En corredores principiantes de sexo masculino, el SETM suele asociarse a incrementos abruptos de ritmo o volumen y menor movilidad en dorsiflexión de tobillo.',
      points: [
        {
          label: 'Prevención de picos de intensidad (RPE > 7)',
          text: 'Evita iniciar con ritmos altos o zancadas largas; mantén tu carga aguda/crónica (ACWR) entre 0.8 y 1.3.'
        },
        {
          label: 'Movilidad de sóleo y gastrocnemio',
          text: 'La rigidez del tríceps sural aumenta la tracción sobre el borde posteromedial de la tibia; prioriza el estiramiento en pared y el descenso excéntrico.'
        },
        {
          label: 'Cadencia y absorción de impacto',
          text: 'Si tu IMC es ≥ 25, elevar la cadencia por encima de 172 ppm reduce significativamente el pico de fuerza vertical en cada aterrizaje.'
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
        <img src="/assets/que-es-fisio-DTwnd5so.jpg" alt="Educación preventiva SETM" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '8px' }}>Módulo Educativo</span>
          <h2 className="display" style={{ fontSize: '26px' }}>Comprende el SETM</h2>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Conocimiento preventivo basado en evidencia científica para corredores principiantes.
          </p>
        </div>
      </div>

      {/* TARJETA EDUCATIVA DIFERENCIADA POR SEXO BIOLÓGICO */}
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
          <h3 className="h2" style={{ marginTop: '8px', fontSize: '18px' }}>
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
            <div className="h2 tnum" style={{ color: st.c, fontSize: '23px' }}>{st.num}</div>
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
                Instrumento de 10 ítems (0–10 pts) para medir el impacto del módulo educativo en el reconocimiento de factores de riesgo.
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
                    {improvement >= 30 ? ' (Meta ≥30% cumplida)' : ''}
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
// 5. PREVENCIÓN
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
        <img src="/assets/prevencion-calentamiento-CCHPQMaC.jpg" alt="Calentamiento deportivo" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '8px' }}>Prevención Primaria</span>
          <h2 className="display" style={{ fontSize: '26px' }}>Hábitos y Calentamiento</h2>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Estrategias modificables para reducir la exposición al estrés tibial.
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
// 6. LOS 6 EJERCICIOS NEUROMUSCULARES PREVENTIVOS
// ============================================================================
function ExercisesView({ bio, onOpenExercise }) {
  const [filter, setFilter] = useState('Todos');
  const phases = ['Todos', 'Fortalecimiento', 'Estiramiento', 'Propiocepción'];

  const filtered = filter === 'Todos'
    ? EXERCISES
    : EXERCISES.filter((e) => e.phase === filter);

  return (
    <div className="stack">
      <div className="card">
        <span className="badge">Entrenamiento Neuromuscular</span>
        <h2 className="display" style={{ marginTop: '8px', fontSize: '26px' }}>
          6 Ejercicios Preventivos
        </h2>
        <p className="small muted" style={{ marginTop: '6px' }}>
          Dosificación ajustada al <strong>{Math.round(bio.loadFactor * 100)}%</strong> según tu perfil de riesgo ({bio.riskLevel}).
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
            <img src={ex.img} alt={ex.title} style={{ width: '76px', height: '76px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span className="badge" style={{ marginBottom: '4px' }}>{ex.phase}</span>
              <div className="h3" style={{ fontSize: '15px' }}>{ex.title}</div>
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
        <div style={{ position: 'relative', borderRadius: '18px', overflow: 'hidden', height: '180px', marginBottom: '16px' }}>
          <img src={ex.img} alt={ex.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          <span className="small" style={{ color: 'var(--pink)', fontWeight: '600' }}>Evidencia preventiva: </span>
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
        <img src="/assets/recuperacion-hielo-fJVnTR5m.jpg" alt="Progresión segura de running" className="hero-bg" />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '8px' }}>Progresión de Carga</span>
          <h2 className="display" style={{ fontSize: '26px' }}>Plan 8 Semanas</h2>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Adaptación gradual del tejido óseo para corredores principiantes (18–25 años).
          </p>
        </div>
      </div>

      <div className="seg" style={{ '--n': 3 }}>
        <div className="seg-pill" style={{ transform: `translateX(${subTab * 100}%)` }} />
        {['Plan 8 sem', 'Alertas', 'Consejos'].map((lbl, idx) => (
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
            <div className="h3">Control de Carga Aguda/Crónica</div>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Mantén tu indicador ACWR entre 0.8 y 1.3 registrando cada entrenamiento con distancia y escala de Borg.
            </p>
          </div>
          <div className="card">
            <div className="h3">Autogestión del Descanso</div>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Evita correr días consecutivos durante tus primeras 6 semanas para permitir la remodelación ósea.
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
