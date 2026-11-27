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
// TIPOS Y UTILIDADES DE SANITIZACIÓN Y PERSISTENCIA LOCAL (LEY 1581 DE 2012)
// ============================================================================
type UnitSystem = 'metric' | 'imperial';
type ThemeMode = 'dark' | 'light';
type FontScale = 'normal' | 'large' | 'xlarge';
type LegSide = 'izquierda' | 'derecha' | 'bilateral';
type PainZone = 'ninguna' | 'posteromedial_difuso' | 'focal_puntual' | 'muscular_general';

interface RunnerProfile {
  name: string;
  age: number;
  sex: 'femenino' | 'masculino';
  weightKg: number;
  heightCm: number;
  footType: 'desconocido' | 'neutra' | 'pronador' | 'supinador';
  experience: '<3m' | '3-6m' | '6-12m' | '>12m';
  weeklyKm: number;
  priorInjury: 'no' | 'si';
  cadencePpm: number;
}

interface TrainingSession {
  id?: number;
  date: string;
  distanceKm: number;
  durationMin: number;
  rpe: number;
  eva: number;
  legSide: LegSide;
  painLocation: PainZone;
  painAtRest: boolean;
}

interface UserRecord {
  email: string;
  password: string;
  consentAccepted: boolean;
  consentDate: string;
  profile: RunnerProfile | null;
  sessions: TrainingSession[];
  quizScores: { pre: number | null; post: number | null };
  warmupChecks: number[];
  recoveryTasks: Record<string, boolean>;
}

interface BiometricsSummary {
  bmi: number;
  acwr: number;
  acwrStatus: string;
  acwrColor: string;
  acuteKm: number;
  chronicKm: number;
  consecutivePainAlert: boolean;
  redFlagActive: boolean;
  lastSession: TrainingSession | undefined;
  avgRpe: number;
  riskLevel: string;
  riskColor: string;
  loadFactor: number;
  reasons: string[];
}

interface ExerciseItem {
  id: number;
  phase: 'Fortalecimiento' | 'Estiramiento' | 'Propiocepción';
  title: string;
  baseReps: number;
  sets: number;
  isTime?: boolean;
  level: string;
  img: string;
  timer: { s: number; label: string };
  steps: string[];
  tip: string;
  doseLabel?: string;
}

const cssVars = (vars: Record<string, string | number>): React.CSSProperties =>
  vars as React.CSSProperties;

const clampNum = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const PAIN_ZONE_LABELS: Record<PainZone, string> = {
  ninguna: 'Sin dolor',
  posteromedial_difuso: 'Borde interno bajo de la espinilla (difuso > 5 cm)',
  focal_puntual: 'Punto óseo exacto y punzante (< 2 cm)',
  muscular_general: 'Músculo de la pantorrilla (parte posterior)'
};

const LEG_SIDE_LABELS: Record<LegSide, string> = {
  izquierda: 'Pierna izquierda',
  derecha: 'Pierna derecha',
  bilateral: 'Ambas piernas (bilateral)'
};

const sanitizeProfile = (p: Partial<RunnerProfile> | null | undefined): RunnerProfile => ({
  name: String(p?.name || 'Corredor').trim().slice(0, 120) || 'Corredor',
  age: Math.round(clampNum(p?.age, 14, 90, 21)),
  sex: p?.sex === 'masculino' ? 'masculino' : 'femenino',
  weightKg: +clampNum(p?.weightKg, 30, 220, 65).toFixed(1),
  heightCm: Math.round(clampNum(p?.heightCm, 120, 230, 170)),
  footType: ['desconocido', 'neutra', 'pronador', 'supinador'].includes(String(p?.footType))
    ? (p!.footType as RunnerProfile['footType'])
    : 'desconocido',
  experience: ['<3m', '3-6m', '6-12m', '>12m'].includes(String(p?.experience))
    ? (p!.experience as RunnerProfile['experience'])
    : '<3m',
  weeklyKm: +clampNum(p?.weeklyKm, 1, 200, 10).toFixed(1),
  priorInjury: p?.priorInjury === 'si' ? 'si' : 'no',
  cadencePpm: Math.round(clampNum(p?.cadencePpm, 130, 220, 164))
});

const sanitizeSession = (s: Partial<TrainingSession>): TrainingSession => {
  const dateStr = typeof s?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date)
    ? s.date
    : new Date().toISOString().split('T')[0];
  const evaVal = Math.round(clampNum(s?.eva, 0, 10, 0));
  const validZones: PainZone[] = ['ninguna', 'posteromedial_difuso', 'focal_puntual', 'muscular_general'];
  const validSides: LegSide[] = ['izquierda', 'derecha', 'bilateral'];

  return {
    date: dateStr,
    distanceKm: +clampNum(s?.distanceKm, 0.1, 150, 4.0).toFixed(2),
    durationMin: Math.round(clampNum(s?.durationMin, 1, 600, 25)),
    rpe: Math.round(clampNum(s?.rpe, 0, 10, 4)),
    eva: evaVal,
    legSide: evaVal === 0
      ? 'izquierda'
      : (validSides.includes(s?.legSide as LegSide) ? (s.legSide as LegSide) : 'izquierda'),
    painLocation: evaVal === 0
      ? 'ninguna'
      : (validZones.includes(s?.painLocation as PainZone) ? (s.painLocation as PainZone) : 'posteromedial_difuso'),
    painAtRest: evaVal > 0 ? Boolean(s?.painAtRest) : false
  };
};

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
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
// GLOSARIO INTERACTIVO EN LENGUAJE CERCANO (JÓVENES 18–25 AÑOS)
// ============================================================================
const GLOSARIO_DATA: Record<string, { titulo: string; resumen: string; ejemplo: string }> = {
  SETM: {
    titulo: 'SETM (Dolor en la espinilla al correr)',
    resumen: 'Irritación por sobrecarga en el borde interno y bajo de la tibia. Pasa cuando subes kilómetros o ritmo más rápido de lo que tu hueso puede adaptarse.',
    ejemplo: 'Ejemplo: Pasar de 5 km a 12 km en una semana y sentir molestia difusa en la espinilla al empezar a trotar.'
  },
  ACWR: {
    titulo: 'ACWR (Relación de Carga Semanal)',
    resumen: 'Compara los kilómetros que corriste los últimos 7 días frente a tu promedio semanal del último mes (28 días).',
    ejemplo: 'Ejemplo: Entre 0.8 y 1.3 estás en zona verde. Subir de 1.5 significa un salto brusco con alto riesgo.'
  },
  BORG: {
    titulo: 'Escala Borg CR-10 (Esfuerzo percibido)',
    resumen: 'Califica del 0 al 10 qué tan duro sentiste el entrenamiento según tu respiración y fatiga.',
    ejemplo: 'Ejemplo: Un trote suave donde puedes hablar equivale a 3–4. Terminar sin aliento equivale a 8–9.'
  },
  EVA: {
    titulo: 'Escala EVA (Intensidad de dolor 0–10)',
    resumen: 'Mide cuánta molestia sientes en la espinilla: 0 es cero dolor y 10 es dolor insoportable.',
    ejemplo: 'Ejemplo: Marcar 4 o más en dos sesiones seguidas activa nuestra bandera roja preventiva.'
  },
  PRONACION: {
    titulo: 'Pronación y caída del arco',
    resumen: 'Es cuánto se inclina el tobillo hacia adentro y baja el arco del pie al aterrizar cada paso.',
    ejemplo: 'Ejemplo: Si el arco baja mucho, los músculos profundos de la pantorrilla jalan más fuerte la tibia.'
  },
  CADENCIA: {
    titulo: 'Cadencia (Pasos por minuto)',
    resumen: 'Cantidad de pasos que das en 60 segundos. Subirla un 5 % hace tus pasos más cortos y suaves.',
    ejemplo: 'Ejemplo: Pasar de 160 a 168 pasos/min reduce el golpe seco en la espinilla sin tener que correr más rápido.'
  },
  PERIOSTIO: {
    titulo: 'Periostio tibial (Cubierta del hueso)',
    resumen: 'Es una capa fina y sensible que envuelve la tibia como una piel protectora donde se anclan los músculos.',
    ejemplo: 'Ejemplo: Cuando los músculos tiran demasiado rápido, esta capa se inflama y duele al tocarla.'
  }
};

function GlosarioTerm({ term, children }: { term: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const info = GLOSARIO_DATA[term];
  if (!info) return <span>{children}</span>;

  return (
    <span style={{ display: 'inline' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          color: 'var(--pink)',
          fontWeight: 700,
          borderBottom: '1.5px dotted var(--pink)',
          padding: '0 1px',
          lineHeight: 1.2
        }}
        aria-expanded={open}
        title={`Ver significado de ${info.titulo}`}
      >
        <span>{children}</span>
        <span
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: '14px',
            height: '14px',
            borderRadius: '999px',
            background: 'color-mix(in srgb, var(--pink) 18%, transparent)',
            fontSize: '10px',
            fontWeight: 800
          }}
        >
          ?
        </span>
      </button>

      {open && (
        <span
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'block',
            marginTop: '8px',
            marginBottom: '8px',
            padding: '10px 12px',
            borderRadius: '11px',
            background: 'var(--surface-2)',
            border: '1px solid color-mix(in srgb, var(--pink) 35%, var(--line))',
            color: 'var(--ink)',
            fontSize: '12px',
            lineHeight: 1.45,
            fontWeight: 400,
            textAlign: 'left'
          }}
        >
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <strong style={{ color: 'var(--pink)', fontSize: '12.5px' }}>{info.titulo}</strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{ color: 'var(--ink-3)', padding: '2px' }}
              aria-label="Cerrar explicación"
            >
              <X size={14} />
            </button>
          </span>
          <span style={{ display: 'block', color: 'var(--ink-2)', marginBottom: '5px' }}>{info.resumen}</span>
          <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--ink)' }}>{info.ejemplo}</span>
        </span>
      )}
    </span>
  );
}

// ============================================================================
// CONVERSORES DE UNIDADES Y CONSTANTES CLÍNICAS / BIOMECÁNICAS
// ============================================================================
const fmtDist = (km: number, unit: UnitSystem) =>
  unit === 'metric' ? `${Number(km).toFixed(1)} km` : `${(Number(km) * 0.621371).toFixed(1)} mi`;

const distVal = (km: number, unit: UnitSystem) =>
  unit === 'metric' ? Number(km) : +(Number(km) * 0.621371).toFixed(1);

const TABS = [
  { id: 'inicio', label: 'Resumen', Icon: Home },
  { id: 'cadencia', label: 'Cadencia', Icon: Timer },
  { id: 'quees', label: 'Guía/Test', Icon: BookOpen },
  { id: 'prevencion', label: 'Prevenir', Icon: ShieldCheck },
  { id: 'ejercicios', label: 'Ejercicios', Icon: Dumbbell },
  { id: 'recuperacion', label: 'Plan 8S', Icon: HeartPulse },
] as const;

type TabId = (typeof TABS)[number]['id'];

const PAIN_LEVELS = [
  { value: 0, label: 'Sin molestia', c: '#34c759' },
  { value: 3, label: 'Molestia leve', c: '#ffd60a' },
  { value: 5, label: 'Dolor moderado (EVA ≥ 4)', c: '#ff9f0a' },
  { value: 7, label: 'Dolor intenso', c: '#ff453a' },
  { value: 10, label: 'Dolor severo', c: '#ff2e55' },
];

const getPainInfo = (val: number) =>
  PAIN_LEVELS.reduce((prev, curr) =>
    Math.abs(curr.value - val) < Math.abs(prev.value - val) ? curr : prev
  );

const BORG_LABELS: Record<number, string> = {
  0: 'Reposo absoluto',
  1: 'Muy muy suave',
  2: 'Suave (puedes hablar sin esfuerzo)',
  3: 'Moderado cómodo',
  4: 'Algo duro',
  5: 'Duro (respiración agitada)',
  6: 'Duro +',
  7: 'Muy duro (cuesta hablar)',
  8: 'Muy duro +',
  9: 'Casi máximo',
  10: 'Esfuerzo máximo'
};

// ============================================================================
// CUESTIONARIO DE CONOCIMIENTO PREVENTIVO (10 ÍTEMS - TRAZADO A MARCO TEÓRICO)
// ============================================================================
const QUIZ_QUESTIONS = [
  {
    q: '1. ¿Cuánto es lo máximo que debes subir tus kilómetros semanales para cuidar tus espinillas?',
    options: ['Hasta 30% semanal', 'Máximo 10% semanal', '50% cada quince días'],
    correct: 1
  },
  {
    q: '2. ¿Qué significa tener una relación de carga semanal (ACWR) mayor a 1.5?',
    options: ['Zona óptima de adaptación', 'Subcarga de entrenamiento', 'Salto brusco con riesgo elevado de sobrecarga'],
    correct: 2
  },
  {
    q: '3. ¿Dónde aparece típicamente el dolor por estrés tibial medial (SETM)?',
    options: ['Borde interno y bajo de la espinilla (zona difusa ≥ 5 cm)', 'Cara externa de la rodilla', 'Planta del talón exclusivamente'],
    correct: 0
  },
  {
    q: '4. ¿Qué movimiento del pie aumenta la tracción sobre la cubierta de la tibia?',
    options: ['Arco plantar rígido sin movilidad', 'Arco que baja demasiado al pisar (pronación marcada)', 'Apoyo exclusivo en antepié'],
    correct: 1
  },
  {
    q: '5. ¿Cada cuántos kilómetros se recomienda revisar o cambiar tus tenis de correr?',
    options: ['Cada 600 a 800 km', 'Cada 2.500 km', 'Solo cuando se rompe la tela superior'],
    correct: 0
  },
  {
    q: '6. ¿Qué ajuste en tus pasos ayuda a bajar el golpe directo contra la espinilla?',
    options: ['Dar menos de 150 pasos por minuto', 'Subir un 5 % tu cadencia (pasos más cortos y rápidos)', 'Dar zancadas muy largas'],
    correct: 1
  },
  {
    q: '7. ¿Qué factor corporal aumenta la carga mecánica que recibe la tibia en cada impacto?',
    options: ['Índice de Masa Corporal (IMC) elevado (≥ 25 kg/m²)', 'Talla baja', 'Frecuencia cardíaca en reposo baja'],
    correct: 0
  },
  {
    q: '8. ¿Qué músculos son clave fortalecer para proteger la espinilla al correr?',
    options: ['Bíceps y pectoral mayor', 'Sóleo (pantorrilla profunda), tibial posterior y cadera', 'Cuádriceps únicamente'],
    correct: 1
  },
  {
    q: '9. Si sientes dolor ≥ 4/10 en dos entrenamientos seguidos o un dolor punzante en un punto exacto (< 2 cm), ¿qué debes hacer?',
    options: ['Aumentar el ritmo para calentar el hueso', 'Frenar el impacto y consultar a un profesional de salud', 'Tomar analgésicos y seguir corriendo'],
    correct: 1
  },
  {
    q: '10. ¿Quiénes tienen mayor riesgo de sufrir dolor en la espinilla (SETM)?',
    options: ['Corredores principiantes (< 12 meses de práctica)', 'Corredores con más de 10 años de experiencia', 'Ciclistas recreativos'],
    correct: 0
  }
];

const STATS_FACTS = [
  { num: '47%', label: 'de corredores recreativos llegan a presentarlo', c: '#34c759' },
  { num: '46.3%', label: 'de casos ocurren entre los 23 y 25 años', c: '#32ade6' },
  { num: '≤ 10%', label: 'subida máxima segura de kilómetros por semana', c: '#28a745' },
  { num: '0.8–1.3', label: 'zona verde de equilibrio de carga (ACWR)', c: '#ff9f0a' },
];

const ANATOMY_CARDS = [
  {
    title: 'Cubierta de la tibia (Periostio)',
    desc: 'Es la capa sensible que envuelve el hueso de la espinilla; se irrita cuando los músculos jalan repetidamente sin descanso suficiente.',
    c: '#ff2e55',
    Icon: Bone
  },
  {
    title: 'Músculos profundos de pantorrilla',
    desc: 'El sóleo y el tibial posterior frenan el impacto en cada pisada y sostienen el arco del pie; si se fatigan, sobrecargan la tibia.',
    c: '#34c759',
    Icon: Activity
  },
  {
    title: 'Adaptación del hueso',
    desc: 'Tus pulmones mejoran en semanas, pero el hueso necesita meses de progresión gradual para volverse más resistente.',
    c: '#32ade6',
    Icon: Stethoscope
  },
];

const SYMPTOMS = [
  'Molestia difusa (a lo largo de más de 5 cm) en la parte interna y baja de la espinilla.',
  'Dolor que aparece al empezar a trotar, baja un poco al entrar en calor y vuelve al terminar.',
  'Sensibilidad al presionar con los dedos el borde interno de la tibia.',
  'Bandera roja: dolor ≥ 4/10 en 2 sesiones seguidas, dolor en un punto exacto (< 2 cm) o dolor en reposo.',
];

const RISK_FACTORS = [
  {
    title: 'Subir kilómetros o intensidad de golpe (ACWR > 1.5)',
    detail: 'Aumentar tu carga muy rápido frente a lo que hiciste el último mes supera el ritmo al que el hueso se recupera (Gabbett, 2016).'
  },
  {
    title: 'Llevar menos de 1 año corriendo',
    detail: 'Los principiantes tienen más del doble de riesgo de molestias por sobreuso mientras sus tejidos se adaptan (Videbæk et al., 2015).'
  },
  {
    title: 'Arco del pie que cede y cadera débil',
    detail: 'Cuando el tobillo cae hacia adentro (pronación) o la cadera pierde estabilidad, la tibia recibe más torsión en cada paso (Becker et al., 2018).'
  },
  {
    title: 'IMC ≥ 25 kg/m² o lesión previa',
    detail: 'Mayor peso corporal o haber tenido lesiones previas en las piernas exige una progresión todavía más cuidadosa (Reinking et al., 2017).'
  },
];

const HABITS = [
  { title: 'Regla del 10 %', desc: 'No subas más de 10 % tus km de una semana a otra.', Icon: TrendingUp, c: '#32ade6' },
  { title: 'Pasos más rápidos', desc: 'Sube +5 % tu cadencia para aterrizar más suave.', Icon: Timer, c: '#34c759' },
  { title: 'Cambia de terreno', desc: 'Alterna pavimento con grama, tierra o pista.', Icon: Mountain, c: '#28a745' },
  { title: 'Fuerza preventiva', desc: 'Entrena pantorrilla profunda y cadera 3x/sem.', Icon: Zap, c: '#f59e0b' },
  { title: 'Días sin impacto', desc: 'Intercala descanso activo las primeras 8 semanas.', Icon: Moon, c: '#bf5af2' },
  { title: 'Revisa tus tenis', desc: 'Evalúa su amortiguación cada 600–800 km.', Icon: Footprints, c: '#ff9f0a' },
];

const WARMUP = [
  { time: 2, act: 'Círculos suaves de tobillo y flexión contra pared' },
  { time: 2, act: 'Caminar 30 s en talones y 30 s en puntas de pie' },
  { time: 2, act: 'Pasos laterales para activar glúteo medio (cadera)' },
  { time: 2, act: 'Trote en el puesto con pasos cortos y rápidos (> 172 ppm)' },
  { time: 2, act: 'Arranque de trote suave procurando pisar silencioso' },
];

// ============================================================================
// EJERCICIOS NEUROMUSCULARES PREVENTIVOS (TRAZADOS A BECKER 2018 Y MARQUES 2025)
// ============================================================================
const EXERCISES: ExerciseItem[] = [
  {
    id: 1,
    phase: 'Fortalecimiento',
    title: 'Elevación de talón con rodilla doblada (Sóleo)',
    baseReps: 15,
    sets: 3,
    level: 'Esencial',
    img: '/assets/ex1-talones-NEeXVCxD.jpg',
    timer: { s: 45, label: 'Descanso entre series' },
    steps: [
      'Apoya la punta de los pies en un escalón con las rodillas ligeramente dobladas (25°–30°).',
      'Sube los talones en 2 segundos usando ambos pies.',
      'Baja lentamente contando 3 a 4 segundos sin perder el control.',
      'Mantén las rodillas dobladas todo el tiempo para trabajar el músculo profundo (sóleo).'
    ],
    tip: 'Fortalece el sóleo para absorber impacto y evitar que jale la cubierta de la tibia (Moen et al., 2009).'
  },
  {
    id: 2,
    phase: 'Fortalecimiento',
    title: 'Arco activo / Pie corto (Short Foot)',
    baseReps: 10,
    sets: 3,
    level: 'Esencial',
    img: '/assets/ex2-banda-CEppt7e-.jpg',
    timer: { s: 5, label: 'Sostener contracción' },
    steps: [
      'Sentado o de pie descalzo, apoya toda la planta en el suelo.',
      'Intenta acercar la base del dedo gordo hacia el talón formando un puente en el arco.',
      'Mantén los dedos largos y relajados (sin arrugarlos como garra).',
      'Sostén 5 segundos y relaja.'
    ],
    tip: 'Evita que el arco del pie se hunda demasiado al correr y protege el tendón tibial posterior (Marques et al., 2025).'
  },
  {
    id: 3,
    phase: 'Fortalecimiento',
    title: 'Elevación lateral de pierna (Glúteo medio)',
    baseReps: 12,
    sets: 3,
    level: 'Esencial',
    img: '/assets/ejercicios-atleta-Sq0ze4a5.jpg',
    timer: { s: 45, label: 'Descanso entre series' },
    steps: [
      'Acuéstate de lado con el cuerpo recto o usa una banda elástica sobre las rodillas.',
      'Sube la pierna de arriba unos 30° llevando el talón un poco hacia atrás.',
      'Baja despacio sin girar la cadera hacia atrás.',
      'Haz todas las repeticiones por cada lado.'
    ],
    tip: 'Una cadera estable evita que la rodilla y el tobillo se metan hacia adentro al aterrizar (Becker et al., 2018).'
  },
  {
    id: 4,
    phase: 'Estiramiento',
    title: 'Estiramiento profundo de pantorrilla en pared',
    baseReps: 30,
    sets: 3,
    isTime: true,
    level: 'Básico',
    img: '/assets/ex3-estiramiento-BQlpL-mO.jpg',
    timer: { s: 30, label: 'Tiempo de estiramiento' },
    steps: [
      'Ponte frente a una pared dando un paso corto hacia atrás.',
      'Dobla la rodilla de atrás sin despegar el talón del piso.',
      'Acerca esa rodilla hacia la pared hasta sentir estiramiento en la parte baja de la pantorrilla.',
      'Sostén 30 segundos sin dar rebotes.'
    ],
    tip: 'Libera la tensión acumulada en la pantorrilla después de correr.'
  },
  {
    id: 5,
    phase: 'Estiramiento',
    title: 'Masaje suave de pantorrilla con rodillo',
    baseReps: 40,
    sets: 2,
    isTime: true,
    level: 'Básico',
    img: '/assets/ex4-rodillo-CCWq0QBt.jpg',
    timer: { s: 40, label: 'Tiempo por pierna' },
    steps: [
      'Apoya la parte carnosa de la pantorrilla sobre un rodillo de espuma.',
      'Desliza despacio desde el tobillo hasta debajo de la rodilla.',
      'Importante: nunca pases el rodillo directamente sobre el hueso de la espinilla.',
      'Si sientes dolor agudo, detente.'
    ],
    tip: 'Ayuda a relajar los músculos posteriores sin lastimar el borde interno de la tibia.'
  },
  {
    id: 6,
    phase: 'Propiocepción',
    title: 'Equilibrio en un solo pie',
    baseReps: 30,
    sets: 3,
    isTime: true,
    level: 'Intermedio',
    img: '/assets/ex5-equilibrio-Dm1j_pE6.jpg',
    timer: { s: 30, label: 'Equilibrio por pie' },
    steps: [
      'Párate sobre un solo pie con la rodilla apenas flexionada (15°).',
      'Mantén la cadera nivelada y evita que la rodilla se vaya hacia adentro.',
      'Sostén el arco del pie activo sin agarrarte con los dedos.',
      'Cambia de pierna al terminar el tiempo.'
    ],
    tip: 'Entrena el control neuromuscular del tobillo y la rodilla antes de sumar más kilómetros (Marques et al., 2025).'
  }
];

const PREVENTION_PLAN = [
  {
    week: 'Sem 1–2',
    title: 'Adaptación inicial: alternar caminar y trotar',
    tasks: [
      'Alternar 3 min de trote suave + 2 min de caminata rápida (20–25 min total)',
      'Mantener esfuerzo Borg CR-10 entre 3 y 4 (puedes conversar cómodo)',
      'Hacer los ejercicios de fuerza preventiva 3 veces por semana',
      'Confirmar que terminas sin dolor en la espinilla (EVA ≤ 1/10)'
    ]
  },
  {
    week: 'Sem 3–4',
    title: 'Mejorar cadencia y controlar la carga',
    tasks: [
      'Subir los kilómetros semanales máximo un 10 % frente a Sem 2',
      'Practicar tu cadencia objetivo (+5 %) con el metrónomo de la app',
      'Verificar que tu relación de carga (ACWR) siga en zona verde (0.8–1.3)',
      'Hacer siempre el calentamiento de 10 min antes de salir'
    ]
  },
  {
    week: 'Sem 5–6',
    title: 'Trote continuo suave y recuperación',
    tasks: [
      'Pasar a trote continuo de 25–30 min en grama, tierra o asfalto plano',
      'Dejar al menos 1 día sin impacto entre días de carrera',
      'Registrar cada salida con esfuerzo Borg y escala de dolor EVA',
      'Revisar el desgaste de la suela de tus tenis'
    ]
  },
  {
    week: 'Sem 7–8',
    title: 'Consolidación y evaluación final',
    tasks: [
      'Completar 30–40 min de running continuo sin molestias (EVA 0/10)',
      'Mantener equilibrio de carga sin picos repentinos',
      'Completar el Test Final en Guía/Test (meta ≥ 30 % de mejora)',
      'Conservar la rutina de pantorrilla y cadera 2 veces por semana'
    ]
  }
];

const RED_FLAGS = [
  'Dolor en el borde interno de la espinilla ≥ 4/10 en dos entrenamientos seguidos.',
  'Dolor punzante en un punto exacto y pequeño del hueso (< 2 cm).',
  'Molestia que sigue doliendo en reposo, al caminar normal o en la noche.',
  'Hinchazón visible, enrojecimiento o calor local en la espinilla.',
];

// ============================================================================
// GENERADOR DE 4 ESCENARIOS SIMULADOS PARA JUICIO DE EXPERTOS (CAPÍTULO IV)
// ============================================================================
const buildDemoScenarios = (): Record<string, UserRecord> => {
  const daysAgo = (n: number) => {
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

function AppIconMark({ size = 28 }: { size?: number }) {
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
  const [usersDb, setUsersDb] = useLocalStorage<Record<string, UserRecord>>('tesis_users_db', {});
  const [currentEmail, setCurrentEmail] = useLocalStorage<string | null>('tesis_current_user', null);
  const [unit, setUnit] = useLocalStorage<UnitSystem>('tesis_unit_system', 'metric');
  const [fontSize, setFontSize] = useLocalStorage<FontScale>('tesis_font_size', 'normal');
  const [theme, setTheme] = useLocalStorage<ThemeMode>('tesis_theme', 'dark');

  const [tab, setTab] = useState<TabId>('inicio');
  const [showA11y, setShowA11y] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showClinicalReport, setShowClinicalReport] = useState(false);
  const [activeEx, setActiveEx] = useState<ExerciseItem | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const currentUser = currentEmail ? usersDb[currentEmail] : null;

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const updateCurrentUser = (updater: Partial<UserRecord> | ((u: UserRecord) => UserRecord)) => {
    if (!currentEmail) return;
    setUsersDb((prev) => {
      const existing = prev[currentEmail];
      if (!existing) return prev;
      const updated = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
      return { ...prev, [currentEmail]: updated };
    });
  };

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
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
          notify(`Cargado: ${chosen.profile?.name}`);
        }}
      />
    );
  }

  // --- MOTOR BIOMÉDICO DE ESTRATIFICACIÓN Y SEGURIDAD CLÍNICA ---
  const calculateBiometrics = (user: UserRecord): BiometricsSummary | null => {
    const p = user.profile;
    if (!p) return null;

    const heightM = p.heightCm / 100;
    const bmi = +(p.weightKg / (heightM * heightM)).toFixed(1);

    const sortedSessions = [...(user.sessions || [])].sort((a, b) => a.date.localeCompare(b.date));

    // Cálculo temporal real de ACWR (7 días agudos vs promedio semanal 28 días)
    let acuteKm = 0;
    let chronicKm = Math.max(1, p.weeklyKm);

    if (sortedSessions.length > 0) {
      const refDate = new Date(`${sortedSessions[sortedSessions.length - 1].date}T12:00:00`).getTime();
      const msDay = 86400000;

      const last7 = sortedSessions.filter((s) => {
        const d = new Date(`${s.date}T12:00:00`).getTime();
        const diffDays = (refDate - d) / msDay;
        return diffDays >= 0 && diffDays < 7;
      });

      const last28 = sortedSessions.filter((s) => {
        const d = new Date(`${s.date}T12:00:00`).getTime();
        const diffDays = (refDate - d) / msDay;
        return diffDays >= 0 && diffDays < 28;
      });

      acuteKm = +last7.reduce((acc, s) => acc + Number(s.distanceKm || 0), 0).toFixed(1);

      const earliestDate = new Date(`${sortedSessions[0].date}T12:00:00`).getTime();
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
    const severeSinglePain = Boolean(lastSession && lastSession.eva >= 6);
    const focalBonePain = Boolean(lastSession && lastSession.eva > 0 && lastSession.painLocation === 'focal_puntual');
    const restPainAlert = Boolean(lastSession && lastSession.eva > 0 && lastSession.painAtRest);

    const redFlagActive = Boolean(
      consecutivePainAlert || severeSinglePain || focalBonePain || restPainAlert
    );

    const recentRpeList = sortedSessions.slice(-4);
    const avgRpe = recentRpeList.length
      ? +(recentRpeList.reduce((a, s) => a + s.rpe, 0) / recentRpeList.length).toFixed(1)
      : 0;

    // Estratificación heurística explicable
    const reasons: string[] = [];
    let riskScore = 0;

    if (bmi >= 25) {
      riskScore += 1.5;
      reasons.push(`IMC elevado (${bmi} kg/m² ≥ 25) aumenta el impacto mecánico sobre la espinilla.`);
    }
    if (p.sex === 'femenino') {
      riskScore += 1;
      reasons.push('Sexo femenino registrado como factor predisponente intrínseco en literatura deportiva.');
    }
    if (p.footType === 'pronador') {
      riskScore += 1.5;
      reasons.push('Tendencia pronadora (arco que cede al pisar) aumenta la tracción sobre los músculos de la tibia.');
    }
    if (p.experience === '<3m' || p.experience === '3-6m') {
      riskScore += 1;
      reasons.push('Experiencia menor a 6 meses requiere adaptación progresiva del hueso.');
    }
    if (p.priorInjury === 'si') {
      riskScore += 2;
      reasons.push('Antecedente de lesión previa en miembro inferior.');
    }
    if (sortedSessions.length > 0 && acwr > 1.5) {
      riskScore += 3;
      reasons.push(`Pico de carga semanal elevado (ACWR = ${acwr} > 1.5): subiste los km demasiado rápido.`);
    } else if (sortedSessions.length > 0 && acwr > 1.3) {
      riskScore += 1.5;
      reasons.push(`Zona de precaución de carga (ACWR = ${acwr} entre 1.3 y 1.5): evita añadir más volumen.`);
    }
    if (avgRpe > 7) {
      riskScore += 1.5;
      reasons.push(`Esfuerzo percibido promedio alto (Borg ${avgRpe}/10 > 7): baja un poco el ritmo.`);
    }
    if ((p.cadencePpm || 164) < 170) {
      riskScore += 0.5;
      reasons.push(`Cadencia habitual baja (${p.cadencePpm || 164} ppm < 170 ppm): pasos largos generan mayor impacto.`);
    }
    if (!redFlagActive && lastSession && lastSession.eva > 0 && lastSession.painLocation === 'posteromedial_difuso') {
      riskScore += 1;
      reasons.push('Signo temprano: molestia difusa (> 5 cm) en el borde interno bajo de la espinilla.');
    }

    let riskLevel = 'Bajo';
    let riskColor = '#34c759';
    let loadFactor = 1.0;

    if (redFlagActive) {
      riskLevel = 'Alto';
      riskColor = '#ff453a';
      loadFactor = 0;
      if (focalBonePain) {
        reasons.unshift('BANDERA ROJA: Dolor puntual en un sitio exacto (< 2 cm) del hueso. Suspende impacto y consulta.');
      } else if (restPainAlert) {
        reasons.unshift('BANDERA ROJA: Dolor en la espinilla que persiste en reposo o al caminar. Requiere valoración profesional.');
      } else if (consecutivePainAlert) {
        reasons.unshift('BANDERA ROJA: Dolor en la espinilla EVA ≥ 4 en dos entrenamientos seguidos.');
      } else if (severeSinglePain && lastSession) {
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
      reasons.push('Tus datos corporales y tu carga semanal están dentro de rangos preventivos seguros.');
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

  const bio = calculateBiometrics(currentUser);

  if (!currentUser.profile || editingProfile || !bio) {
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
        onCancel={currentUser.profile ? () => setEditingProfile(false) : undefined}
      />
    );
  }

  const handleExportCSV = () => {
    const p = currentUser.profile!;
    const headers = [
      'Correo', 'Nombre', 'Edad', 'Sexo', 'Peso_kg', 'Talla_cm', 'IMC',
      'Pisada', 'Experiencia_Running', 'Cadencia_ppm', 'Lesion_Previa',
      'ACWR', 'Nivel_Alerta', 'Bandera_Roja', 'RPE_Promedio',
      'Total_Sesiones', 'Quiz_Pre', 'Quiz_Post', 'Mejora_Quiz_%'
    ];
    const pre = currentUser.quizScores?.pre ?? '';
    const post = currentUser.quizScores?.post ?? '';
    const delta = (pre !== '' && post !== '' && Number(pre) > 0)
      ? Math.round(((Number(post) - Number(pre)) / Number(pre)) * 100)
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
    if (!currentEmail) return;
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
                <div className="seg" style={cssVars({ '--n': 2 })}>
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
                <div className="seg" style={cssVars({ '--n': 2 })}>
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
                <div className="seg" style={cssVars({ '--n': 3 })}>
                  <div
                    className="seg-pill"
                    style={{
                      transform: `translateX(${fontSize === 'normal' ? 0 : fontSize === 'large' ? 100 : 200}%)`
                    }}
                  />
                  {([
                    { id: 'normal', label: 'Normal' },
                    { id: 'large', label: 'Grande' },
                    { id: 'xlarge', label: 'Extra' }
                  ] as const).map((opt) => (
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
                profile: u.profile ? { ...u.profile, cadencePpm: newPpm } : null
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
            const p = currentUser.profile!;
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
              <div className="icon-tile" style={cssVars({ '--c': '#ff453a' })}>
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
function AuthView({
  theme,
  onToggleTheme,
  onLogin,
  onRegister,
  onDemoScenario
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onLogin: (email: string, password: string) => string | null;
  onRegister: (email: string, password: string, consentAccepted: boolean) => string | null;
  onDemoScenario: (key: string) => void;
}) {
  const [isRegister, setIsRegister] = useState(false);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
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
        <button
          type="button"
          onClick={onToggleTheme}
          className="btn-soft tap"
          style={{ minHeight: '36px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
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
          referrerPolicy="no-referrer"
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
        
          <h1 className="display" style={{ fontSize: '30px', marginTop: '2px' }}>
            Corre seguro, <span className="grad-text">protege tus tibias</span>
          </h1>
        </div>
      </div>

      <div className="seg" style={cssVars({ '--n': 2, marginBottom: '14px' })}>
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
          <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#ff453a22', color: '#ff453a', fontSize: '13px', fontWeight: 600 }}>
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
function PatientOnboarding({
  initialData,
  requireConsent,
  unit,
  setUnit,
  theme,
  onToggleTheme,
  onSave,
  onCancel
}: {
  initialData: RunnerProfile | null;
  requireConsent: boolean;
  unit: UnitSystem;
  setUnit: (u: UnitSystem) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSave: (data: RunnerProfile) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initialData?.name || '');
  const [age, setAge] = useState<number | string>(initialData?.age || 21);
  const [sex, setSex] = useState<RunnerProfile['sex']>(initialData?.sex || 'femenino');
  const [weightKg, setWeightKg] = useState<number>(initialData?.weightKg || 65);
  const [heightCm, setHeightCm] = useState<number>(initialData?.heightCm || 170);
  const [footType, setFootType] = useState<RunnerProfile['footType']>(initialData?.footType || 'desconocido');
  const [experience, setExperience] = useState<RunnerProfile['experience']>(initialData?.experience || '<3m');
  const [weeklyKm, setWeeklyKm] = useState<number>(initialData?.weeklyKm || 10);
  const [priorInjury, setPriorInjury] = useState<RunnerProfile['priorInjury']>(initialData?.priorInjury || 'no');
  const [cadencePpm, setCadencePpm] = useState<number>(initialData?.cadencePpm || 164);
  const [consentChecked, setConsentChecked] = useState(!requireConsent);

  const liveBmi = heightCm > 0 ? +(weightKg / ((heightCm / 100) ** 2)).toFixed(1) : 0;
  const ageNum = Number(age);

  const handleSubmit = (e: React.FormEvent) => {
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
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? <Sun size={15} color="#ffd60a" /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            className="btn-soft tap tnum"
            style={{ minHeight: '34px', padding: '0 12px', fontSize: '12px' }}
            onClick={() => setUnit(unit === 'metric' ? 'imperial' : 'metric')}
          >
            {unit === 'metric' ? 'kg / km' : 'lb / mi'}
          </button>
        </div>
      </div>

      <h1 className="display">Calibra tu <span className="grad-text">perfil corredor</span></h1>
      <p className="small muted" style={{ marginTop: '4px', marginBottom: '16px' }}>
        Usamos estos datos para calcular tu carga segura y prevenir el <GlosarioTerm term="SETM">dolor en la espinilla</GlosarioTerm>.
      </p>

      <form onSubmit={handleSubmit} className="stack">
        <div className="card stack">
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="eyebrow">Nombre o alias</label>
            <input
              type="text"
              required
              placeholder="Ej. Camila Gómez"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid-2">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">Edad (18–25 objetivo)</label>
              <input
                type="number"
                min="14"
                max="90"
                required
                className="input-field tnum"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">Sexo biológico</label>
              <select className="input-field" value={sex} onChange={(e) => setSex(e.target.value as RunnerProfile['sex'])}>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
              </select>
            </div>
          </div>

          {(ageNum < 18 || ageNum > 25) && (
            <div style={{ padding: '8px 10px', borderRadius: '10px', background: '#f59e0b1f', color: '#f59e0b', fontSize: '12px' }}>
              Nota del estudio UMB: la población objetivo principal son jóvenes principiantes entre 18 y 25 años, pero puedes usar la guía igualmente.
            </div>
          )}

          <div className="grid-2">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">
                {unit === 'metric' ? 'Peso (kg)' : 'Peso (lb)'}
              </label>
              <input
                type="number"
                step="0.5"
                min="30"
                max="450"
                required
                className="input-field tnum"
                value={unit === 'metric' ? weightKg : +(weightKg * 2.20462).toFixed(1)}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWeightKg(unit === 'metric' ? val : +(val / 2.20462).toFixed(1));
                }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">Estatura (cm)</label>
              <input
                type="number"
                min="120"
                max="230"
                required
                className="input-field tnum"
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '10px', background: 'var(--surface-2)' }}>
            <span className="small muted">IMC calculado automáticamente:</span>
            <span className="badge tnum" style={{ color: liveBmi >= 25 ? '#f59e0b' : 'var(--pink)' }}>
              {liveBmi} kg/m² {liveBmi >= 25 ? '(Sobrepeso)' : '(Normal)'}
            </span>
          </div>
        </div>

        <div className="card stack">
          <div className="grid-2">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">Tiempo corriendo</label>
              <select className="input-field" value={experience} onChange={(e) => setExperience(e.target.value as RunnerProfile['experience'])}>
                <option value="<3m">Menos de 3 meses</option>
                <option value="3-6m">3 a 6 meses</option>
                <option value="6-12m">6 a 12 meses</option>
                <option value=">12m">Más de 12 meses</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">
                {unit === 'metric' ? 'Km base/semana' : 'Millas base/sem'}
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="200"
                required
                className="input-field tnum"
                value={unit === 'metric' ? weeklyKm : distVal(weeklyKm, 'imperial')}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setWeeklyKm(unit === 'metric' ? v : +(v / 0.621371).toFixed(1));
                }}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">Tipo de pisada</label>
              <select className="input-field" value={footType} onChange={(e) => setFootType(e.target.value as RunnerProfile['footType'])}>
                <option value="desconocido">No lo sé</option>
                <option value="neutra">Neutra</option>
                <option value="pronador">Pronadora (arco baja)</option>
                <option value="supinador">Supinadora</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">¿Lesión previa?</label>
              <select className="input-field" value={priorInjury} onChange={(e) => setPriorInjury(e.target.value as RunnerProfile['priorInjury'])}>
                <option value="no">No</option>
                <option value="si">Sí, en piernas/pies</option>
              </select>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="eyebrow">Cadencia habitual (pasos/min)</label>
            <input
              type="number"
              min="130"
              max="220"
              className="input-field tnum"
              value={cadencePpm}
              onChange={(e) => setCadencePpm(Number(e.target.value))}
            />
          </div>
        </div>

        {requireConsent && (
          <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px', borderRadius: '12px', background: 'var(--surface)' }}>
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              style={{ marginTop: '3px', accentColor: '#34c759' }}
            />
            <span className="small muted">Acepto el tratamiento confidencial de mis datos bajo Ley 1581 de 2012.</span>
          </label>
        )}

        <div className={onCancel ? 'grid-2' : ''}>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn btn-soft tap">
              Cancelar
            </button>
          )}
          <button type="submit" className="btn btn-primary tap">
            <Check size={18} />
            <span>Guardar perfil</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 2. PANEL PRINCIPAL (ANILLOS ACWR + DIVULGACIÓN PROGRESIVA + GRÁFICAS SVG)
// ============================================================================
function DashboardView({
  user,
  bio,
  unit,
  onOpenSession,
  onOpenClinicalReport,
  onGoTab
}: {
  user: UserRecord;
  bio: BiometricsSummary;
  unit: UnitSystem;
  onOpenSession: () => void;
  onOpenClinicalReport: () => void;
  onGoTab: (tab: TabId) => void;
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

  const p = user.profile!;

  return (
    <div className="stack">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', padding: '2px 2px 4px' }}>
        <div>
          <div className="eyebrow" style={{ textTransform: 'capitalize' }}>
            {todayLabel} · {p.name.split(' ')[0]}
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

      <div className="desktop-split">
        <div className="stack">
          {/* TARJETA PRINCIPAL CON ANILLOS ACWR Y GLOSARIO */}
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
                <div className="eyebrow">Carga aguda (7 días) · <GlosarioTerm term="ACWR">ACWR</GlosarioTerm></div>
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

            <p className="small muted" style={{ marginTop: '8px', fontSize: '11.5px' }}>
              Monitoreo continuo para evitar el <GlosarioTerm term="SETM">dolor en la espinilla</GlosarioTerm>.
            </p>

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
                  <button
                    type="button"
                    onClick={onOpenClinicalReport}
                    style={{ alignSelf: 'flex-start', color: 'var(--pink)', fontSize: '12px', fontWeight: 700, marginTop: '4px' }}
                  >
                    Ver ficha clínica completa →
                  </button>
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
              <div className="h2 tnum">{p.cadencePpm || 164} <span className="small muted" style={{ fontWeight: 500 }}>ppm</span></div>
              <div className="small muted tnum">Meta +5%: {Math.round((p.cadencePpm || 164) * 1.05)} ppm</div>
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

          <div className="ios-group">
            <button type="button" className="ios-row" onClick={() => onGoTab('quees')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="icon-tile" style={cssVars({ '--c': '#ff9f0a' })}>
                  <ClipboardCheck size={17} />
                </div>
                <div>
                  <div className="h3">Guía visual y Test Pre/Post</div>
                  <div className="small muted">
                    {user.quizScores?.pre !== null
                      ? `Pre: ${user.quizScores.pre}/10 · Post: ${user.quizScores.post ?? 'Pendiente'}`
                      : 'Evalúa cuánto sabes sobre prevención'}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
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
              [...user.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((s, idx) => (
                <div key={s.id || `${s.date}-${idx}`} className="ios-row">
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
        </div>

        {/* GRÁFICAS LONGITUDINALES SVG */}
        <div className="stack">
          <TrendChartsCard
            sessions={[...user.sessions].sort((a, b) => a.date.localeCompare(b.date))}
            chronicKm={bio.chronicKm}
            acwr={bio.acwr}
            acwrColor={bio.acwrColor}
            acwrStatus={bio.acwrStatus}
            unit={unit}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE DE GRÁFICAS SVG: CARGA + ACWR Y TENDENCIA EVA / BORG
// ============================================================================
function TrendChartsCard({
  sessions,
  chronicKm,
  acwr,
  acwrColor,
  acwrStatus,
  unit
}: {
  sessions: TrainingSession[];
  chronicKm: number;
  acwr: number;
  acwrColor: string;
  acwrStatus: string;
  unit: UnitSystem;
}) {
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
        <span className="eyebrow">Regla máx. +10 %</span>
      </div>

      <div className="seg" style={cssVars({ '--n': 2 })}>
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
              <span className="badge tnum" style={{ color: acwrColor, background: `color-mix(in srgb, ${acwrColor} 18%, transparent)`, padding: '2px 7px', borderRadius: '6px' }}>
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

                const getX = (i: number) =>
                  recent.length === 1
                    ? padL + plotW / 2
                    : padL + (i / (recent.length - 1)) * plotW;

                const getY = (val: number) => padTop + plotH * (1 - val / 10);

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
function AnatomicalLegMap({
  legSide,
  setLegSide,
  painLocation,
  setPainLocation,
  painAtRest,
  setPainAtRest
}: {
  legSide: LegSide;
  setLegSide: (s: LegSide) => void;
  painLocation: PainZone;
  setPainLocation: (z: PainZone) => void;
  painAtRest: boolean;
  setPainAtRest: (v: boolean) => void;
}) {
  const zones: Array<{
    id: PainZone;
    shortTitle: string;
    clinicalTag: string;
    desc: string;
    color: string;
  }> = [
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
        @media (prefers-reduced-motion: reduce) {
          .rsd-pulse-ring, .rsd-zone-active, .rsd-diag-card {
            animation: none;
          }
        }
      `}</style>

      {/* 1. Selector de lateralidad */}
      <div>
        <label className="eyebrow" style={{ display: 'block', marginBottom: '6px' }}>
          1. Extremidad afectada
        </label>
        <div className="seg" style={cssVars({ '--n': 3 })}>
          <div
            className="seg-pill"
            style={{
              transform: `translateX(${legSide === 'izquierda' ? 0 : legSide === 'derecha' ? 100 : 200}%)`
            }}
          />
          {([
            { id: 'izquierda', label: 'Izquierda' },
            { id: 'derecha', label: 'Derecha' },
            { id: 'bilateral', label: 'Ambas' }
          ] as const).map((opt) => (
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
                  fontSize: '10px',
                  padding: '2px 7px',
                  borderRadius: '6px'
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
// 8. MODAL DE REGISTRO DE SESIÓN (FECHA + EVA SEMICIRCULAR + MAPA ANATÓMICO)
// ============================================================================
function LogSessionModal({
  unit,
  onClose,
  onSaveSession
}: {
  unit: UnitSystem;
  onClose: () => void;
  onSaveSession: (session: TrainingSession) => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [distanceInput, setDistanceInput] = useState<string | number>(4.0);
  const [durationMin, setDurationMin] = useState<string | number>(25);
  const [rpe, setRpe] = useState(4);
  const [eva, setEva] = useState(0);
  const [legSide, setLegSide] = useState<LegSide>('izquierda');
  const [painLocation, setPainLocation] = useState<PainZone>('posteromedial_difuso');
  const [painAtRest, setPainAtRest] = useState(false);

  const painInfo = getPainInfo(eva);
  const needleAngle = -90 + (eva / 10) * 180;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const distanceKm = unit === 'metric'
      ? Number(distanceInput)
      : +(Number(distanceInput) / 0.621371).toFixed(2);
    onSaveSession({
      date,
      distanceKm,
      durationMin: Number(durationMin),
      rpe: Number(rpe),
      eva: Number(eva),
      legSide,
      painLocation: eva === 0 ? 'ninguna' : painLocation,
      painAtRest: eva > 0 ? painAtRest : false
    });
  };

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel stack" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="badge">Control Post-Entrenamiento</span>
            <h2 className="h2">Registrar carrera</h2>
          </div>
          <button type="button" className="icon-circle-btn tap" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="stack">
          <div className="card stack">
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">Fecha</label>
              <input
                type="date"
                required
                className="input-field tnum"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="grid-2">
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="eyebrow">{unit === 'metric' ? 'Distancia (km)' : 'Distancia (mi)'}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="150"
                  required
                  className="input-field tnum"
                  value={distanceInput}
                  onChange={(e) => setDistanceInput(e.target.value)}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="eyebrow">Duración (min)</label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  required
                  className="input-field tnum"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ESCALA BORG CR-10 */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow">
                <GlosarioTerm term="BORG">Esfuerzo (Borg CR-10)</GlosarioTerm>
              </span>
              <span className="badge tnum">{rpe} / 10</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={rpe}
              onChange={(e) => setRpe(Number(e.target.value))}
              style={{ width: '100%', marginTop: '8px', accentColor: 'var(--pink)' }}
            />
            <div className="small muted" style={{ marginTop: '4px' }}>{BORG_LABELS[rpe]}</div>
          </div>

          {/* MEDIDOR SEMICIRCULAR DE DOLOR EVA */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span className="eyebrow">
                <GlosarioTerm term="EVA">Dolor en espinilla (EVA)</GlosarioTerm>
              </span>
              <span className="badge tnum" style={{ color: painInfo.c }}>{painInfo.label}</span>
            </div>

            <div className="gauge-wrap">
              <svg viewBox="0 0 300 165" className="gauge" aria-hidden="true">
                <defs>
                  <linearGradient id="eva-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#34c759" />
                    <stop offset="40%" stopColor="#ffd60a" />
                    <stop offset="70%" stopColor="#ff9f0a" />
                    <stop offset="100%" stopColor="#ff453a" />
                  </linearGradient>
                </defs>
                <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="var(--surface-2)" strokeWidth="18" strokeLinecap="round" />
                <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="url(#eva-arc-grad)" strokeWidth="18" strokeLinecap="round" />
                <g className="gauge-needle" style={{ transform: `rotate(${needleAngle}deg)` }}>
                  <line x1="150" y1="150" x2="150" y2="46" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="150" cy="150" r="9" fill="var(--ink)" />
                </g>
              </svg>
              <div className="gauge-value tnum" style={{ color: painInfo.c }}>{eva}</div>
            </div>

            <div className="pain-dots">
              {Array.from({ length: 11 }, (_, n) => {
                const info = getPainInfo(n);
                return (
                  <button
                    key={n}
                    type="button"
                    className={`pain-dot tnum ${eva === n ? 'on' : ''}`}
                    style={cssVars({ '--c': info.c })}
                    onClick={() => setEva(n)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {eva >= 4 && (
              <div className="pain-advice" style={cssVars({ '--c': '#ff453a', color: '#ff453a', fontSize: '12px' })}>
                <AlertTriangle size={16} />
                <span>Dolor ≥ 4: si se repite en 2 sesiones seguidas, activará bandera roja.</span>
              </div>
            )}
          </div>

          {eva > 0 && (
            <div className="card">
              <AnatomicalLegMap
                legSide={legSide}
                setLegSide={setLegSide}
                painLocation={painLocation}
                setPainLocation={setPainLocation}
                painAtRest={painAtRest}
                setPainAtRest={setPainAtRest}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary tap">
            <Check size={18} />
            <span>Guardar entrenamiento</span>
          </button>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// 9. MODAL DE REPORTE CLÍNICO-DEPORTIVO (INTEROPERABILIDAD / CONSULTA)
// ============================================================================
function ClinicalReportModal({
  user,
  bio,
  unit,
  onClose,
  onCopyText
}: {
  user: UserRecord;
  bio: BiometricsSummary;
  unit: UnitSystem;
  onClose: () => void;
  onCopyText: () => void;
}) {
  const p = user.profile!;
  const ls = bio.lastSession;

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel stack" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="badge">Ficha para Fisioterapia / Medicina</span>
            <h2 className="h2">Resumen Clínico-Deportivo</h2>
          </div>
          <button type="button" className="icon-circle-btn tap" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="card stack" style={{ gap: '6px' }}>
          <div className="h3">{p.name} · {p.age} años ({p.sex})</div>
          <div className="small muted">
            Peso: {p.weightKg} kg · Talla: {p.heightCm} cm · <strong>IMC: {bio.bmi} kg/m²</strong>
          </div>
          <div className="small muted">
            Experiencia: {p.experience} · Pisada: {p.footType} · Lesión previa: {p.priorInjury.toUpperCase()} · Cadencia: {p.cadencePpm} ppm
          </div>
        </div>

        <div className="card stack" style={{ gap: '6px' }}>
          <div className="eyebrow">Carga y Estratificación SETM</div>
          <div className="small">
            Carga aguda (7d): <strong>{fmtDist(bio.acuteKm, unit)}</strong> · Carga crónica (28d): <strong>{fmtDist(bio.chronicKm, unit)}</strong>
          </div>
          <div className="small">
            ACWR: <strong style={{ color: bio.acwrColor }}>{bio.acwr} ({bio.acwrStatus})</strong> · Alerta global:{' '}
            <strong style={{ color: bio.riskColor }}>{bio.riskLevel.toUpperCase()}</strong>
          </div>
          <div className="small">
            Bandera roja activa: <strong>{bio.redFlagActive ? 'SÍ (Priorizar valoración clínica)' : 'NO'}</strong>
          </div>
        </div>

        <div className="card stack" style={{ gap: '6px' }}>
          <div className="eyebrow">Último reporte de síntomas</div>
          <div className="small">
            {ls
              ? `${ls.date}: ${fmtDist(ls.distanceKm, unit)}, Borg ${ls.rpe}/10, Dolor EVA ${ls.eva}/10${ls.eva > 0 ? ` (${LEG_SIDE_LABELS[ls.legSide || 'izquierda']} · ${PAIN_ZONE_LABELS[ls.painLocation || 'ninguna']}${ls.painAtRest ? ' · Dolor en reposo' : ''})` : ''}`
              : 'Sin sesiones registradas'}
          </div>
        </div>

        <div className="card stack" style={{ gap: '6px' }}>
          <div className="eyebrow">Criterios detectados</div>
          {bio.reasons.map((r, i) => (
            <div key={i} className="small muted">• {r}</div>
          ))}
        </div>

        <button type="button" onClick={onCopyText} className="btn btn-primary tap">
          <FileText size={17} />
          <span>Copiar resumen para consulta</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 3. METRÓNOMO BIOMECÁNICO DE CADENCIA + TEST RÁPIDO 15S (TAB: CADENCIA)
// ============================================================================
function CadenceView({
  cadencePpm,
  onSaveCadence
}: {
  cadencePpm: number;
  onSaveCadence: (ppm: number) => void;
}) {
  const [ppm, setPpm] = useState(cadencePpm || 164);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [beat, setBeat] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testSeconds, setTestSeconds] = useState(15);
  const [stepCount15s, setStepCount15s] = useState('');
  const audioCtxRef = useRef<AudioContext | null>(null);

  const recommendedTarget = Math.min(195, Math.round((cadencePpm || 164) * 1.05));
  const lowCadence = (cadencePpm || 164) < 170;

  const playClick = () => {
    if (muted) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.065);
    } catch {
      // Silencio seguro si el navegador bloquea audio sin gesto previo
    }
  };

  useEffect(() => {
    if (!playing) {
      setBeat(false);
      return;
    }
    const intervalMs = Math.round(60000 / ppm);
    playClick();
    setBeat(true);
    const tOff = setTimeout(() => setBeat(false), 90);

    const id = setInterval(() => {
      playClick();
      setBeat(true);
      setTimeout(() => setBeat(false), 90);
    }, intervalMs);

    return () => {
      clearInterval(id);
      clearTimeout(tOff);
    };
  }, [playing, ppm, muted]);

  useEffect(() => {
    if (!testRunning) return;
    const id = setInterval(() => {
      setTestSeconds((s) => {
        if (s <= 1) {
          setTestRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [testRunning]);

  return (
    <div className="stack">
      <div className="card stack">
        <div>
          <span className="badge">Biofeedback Auditivo</span>
          <h1 className="display" style={{ marginTop: '4px' }}>
            Control de <span className="grad-text">Cadencia</span>
          </h1>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Subir tu <GlosarioTerm term="CADENCIA">cadencia</GlosarioTerm> apenas un 5 % hace que des pasos más cortos, caigas debajo de tu cuerpo y bajes el golpe sobre la espinilla.
          </p>
        </div>

        <div className="grid-2">
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

      <div className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
        <div
          style={{
            width: '76px',
            height: '76px',
            margin: '0 auto 10px',
            borderRadius: '999px',
            background: beat ? 'var(--pink)' : 'color-mix(in srgb, var(--pink) 16%, var(--surface-2))',
            color: beat ? 'var(--pink-ink)' : 'var(--pink)',
            display: 'grid',
            placeItems: 'center',
            transform: beat ? 'scale(1.08)' : 'scale(1)',
            transition: 'transform .09s ease, background .09s ease'
          }}
        >
          <Footprints size={32} />
        </div>

        <div className="eyebrow">Ritmo seleccionado</div>
        <div className="display tnum" style={{ fontSize: '42px', marginTop: '2px' }}>
          {ppm} <span className="small muted" style={{ fontSize: '15px' }}>ppm</span>
        </div>

        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setPpm(recommendedTarget)}
            className="btn-soft tap tnum"
            style={{ color: 'var(--pink)' }}
          >
            <Zap size={14} /> Aplicar objetivo +5 % ({recommendedTarget} ppm)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
          <button
            type="button"
            className="btn-soft tap tnum"
            onClick={() => setPpm((v) => Math.max(140, v - 2))}
          >
            -2
          </button>
          <input
            type="range"
            min="140"
            max="200"
            value={ppm}
            onChange={(e) => setPpm(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--pink)' }}
            aria-label="Ajustar pasos por minuto"
          />
          <button
            type="button"
            className="btn-soft tap tnum"
            onClick={() => setPpm((v) => Math.min(200, v + 2))}
          >
            +2
          </button>
        </div>

        <div className="grid-2" style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="btn btn-primary tap"
          >
            {playing ? <><Pause size={18} /> Pausar</> : <><Play size={18} /> Iniciar ritmo</>}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="btn btn-soft tap"
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false);
                setPpm(cadencePpm || 164);
              }}
              className="btn btn-soft tap"
              aria-label="Restablecer"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSaveCadence(ppm)}
          className="btn btn-soft tap"
          style={{ marginTop: '10px', width: '100%' }}
        >
          <Check size={16} color="var(--pink)" /> Guardar {ppm} ppm en mi perfil
        </button>
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
              setPpm(Math.min(195, Math.max(155, Math.round(calculated * 1.05))));
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
// 4. MÓDULO EDUCATIVO DIFERENCIADO POR SEXO + GUÍA RÁPIDA / TEST PRE-POST
// ============================================================================
function WhatIsView({
  sex,
  quizScores,
  onSaveQuiz
}: {
  sex: RunnerProfile['sex'];
  quizScores: { pre: number | null; post: number | null };
  onSaveQuiz: (type: 'pre' | 'post', score: number) => void;
}) {
  const [subTab, setSubTab] = useState<'guia' | 'test'>('guia');
  const [guideTab, setGuideTab] = useState<0 | 1 | 2>(0);
  const [openRisk, setOpenRisk] = useState<number | null>(0);
  const [quizType, setQuizType] = useState<'pre' | 'post'>('pre');
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

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
          text: 'Fortalecer el glúteo medio reduce el colapso medial de rodilla y la tracción sobre el compartimento tibial.'
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
          text: 'Evita aumentar más del 10 % semanal o correr a esfuerzos máximos (Borg > 7) durante la fase de adaptación.'
        },
        {
          label: 'Descenso excéntrico del sóleo',
          text: 'El fortalecimiento controlado de pantorrilla con rodilla flexionada mejora la absorción de fuerzas de reacción del suelo.'
        }
      ]
    };

  const score = QUIZ_QUESTIONS.reduce(
    (acc, q, idx) => (answers[idx] === q.correct ? acc + 1 : acc),
    0
  );

  const deltaPct =
    quizScores.pre !== null && quizScores.post !== null && quizScores.pre > 0
      ? Math.round(((quizScores.post - quizScores.pre) / quizScores.pre) * 100)
      : quizScores.pre === 0 && quizScores.post !== null
      ? quizScores.post * 10
      : null;

  return (
    <div className="stack">
      <div className="hero-card">
        <img
          src="/assets/que-es-fisio-DTwnd5so.jpg"
          alt="Educación preventiva SETM"
          className="hero-bg"
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '6px' }}>Educación Preventiva</span>
          <h1 className="display" style={{ fontSize: '21px' }}>
            Comprende el <GlosarioTerm term="SETM">dolor en la espinilla</GlosarioTerm>
          </h1>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Guía clara basada en evidencia científica para corredores jóvenes (18–25 años).
          </p>
        </div>
      </div>

      {/* SEPARACIÓN CONSERVADA: GUÍA RÁPIDA VS TEST PRE/POST */}
      <div className="seg" style={cssVars({ '--n': 2 })}>
        <div className="seg-pill" style={{ transform: `translateX(${subTab === 'guia' ? 0 : 100}%)` }} />
        <button type="button" className={`seg-btn ${subTab === 'guia' ? 'on' : ''}`} onClick={() => setSubTab('guia')}>
          <BookOpen size={14} /> Guía Rápida
        </button>
        <button type="button" className={`seg-btn ${subTab === 'test' ? 'on' : ''}`} onClick={() => setSubTab('test')}>
          <ClipboardCheck size={14} /> Test Pre / Post
        </button>
      </div>

      {subTab === 'guia' ? (
        <div className="stack">
          <div className="card">
            <p className="small muted">
              Es la lesión por sobreuso más común cuando empiezas a correr. Ocurre porque la <GlosarioTerm term="PERIOSTIO">cubierta de la tibia</GlosarioTerm> se irrita al recibir más impacto del que puede reparar entre entrenamientos.
            </p>
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
                  color: sexGuidance.accent,
                  padding: '2px 7px',
                  borderRadius: '6px'
                }}
              >
                {sexGuidance.badge}
              </span>
              <h3 className="h2" style={{ marginTop: '8px', fontSize: '16px' }}>
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
                    borderRadius: '12px'
                  }}
                >
                  <div className="h3" style={{ fontSize: '13px', color: sexGuidance.accent }}>
                    {pt.label}
                  </div>
                  <div className="small muted" style={{ marginTop: '2px', fontSize: '12px' }}>
                    {pt.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-2">
            {STATS_FACTS.map((st, i) => (
              <div key={i} className="card">
                <div className="display tnum" style={{ color: st.c, fontSize: '24px' }}>{st.num}</div>
                <div className="small muted" style={{ marginTop: '3px' }}>{st.label}</div>
              </div>
            ))}
          </div>

          <div className="seg" style={cssVars({ '--n': 3 })}>
            <div className="seg-pill" style={{ transform: `translateX(${guideTab * 100}%)` }} />
            {(['Anatomía', 'Síntomas', 'Riesgos'] as const).map((lbl, idx) => (
              <button
                key={lbl}
                type="button"
                className={`seg-btn ${guideTab === idx ? 'on' : ''}`}
                onClick={() => setGuideTab(idx as 0 | 1 | 2)}
              >
                {lbl}
              </button>
            ))}
          </div>

          {guideTab === 0 && (
            <div className="stack">
              {ANATOMY_CARDS.map(({ title, desc, c, Icon }, i) => (
                <div key={i} className="card" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div className="icon-tile" style={cssVars({ '--c': c })}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="h3">{title}</h3>
                    <p className="small muted" style={{ marginTop: '4px' }}>
                      {desc} {i === 0 && <GlosarioTerm term="PERIOSTIO">Ver periostio</GlosarioTerm>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {guideTab === 1 && (
            <div className="card stack">
              <div className="h3">Reconocimiento de señales tempranas</div>
              {SYMPTOMS.map((sym, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span className="badge tnum">{i + 1}</span>
                  <span className="small muted">
                    {sym} {i === 3 && <GlosarioTerm term="EVA">Ver EVA</GlosarioTerm>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {guideTab === 2 && (
            <div className="stack">
              {RISK_FACTORS.map((rf, i) => {
                const isOpen = openRisk === i;
                return (
                  <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setOpenRisk(isOpen ? null : i)}
                      style={{ width: '100%', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', gap: '8px' }}
                    >
                      <span className="h3">{rf.title}</span>
                      <ChevronDown size={18} color="var(--ink-3)" style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </button>
                    {isOpen && (
                      <div className="small muted" style={{ padding: '10px 16px 14px', borderTop: '0.5px solid var(--line)' }}>
                        {rf.detail}{' '}
                        {i === 0 && <GlosarioTerm term="ACWR">Ver ACWR</GlosarioTerm>}
                        {i === 2 && <GlosarioTerm term="PRONACION">Ver pronación</GlosarioTerm>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="stack">
          <div className="card">
            <span className="badge">Evaluación de Aprendizaje</span>
            <h2 className="h2" style={{ marginTop: '4px' }}>Cuestionario Preventivo (10 preguntas)</h2>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Compara lo que sabías antes (Test Inicial) y después de usar la guía (Test Final). Meta del estudio: mejora ≥ 30 %.
            </p>

            <div className="seg" style={cssVars({ '--n': 2, marginTop: '12px' })}>
              <div className="seg-pill" style={{ transform: `translateX(${quizType === 'pre' ? 0 : 100}%)` }} />
              <button
                type="button"
                className={`seg-btn ${quizType === 'pre' ? 'on' : ''}`}
                onClick={() => {
                  setQuizType('pre');
                  setAnswers({});
                  setSubmitted(false);
                }}
              >
                1. Test Inicial ({quizScores.pre !== null ? `${quizScores.pre}/10` : 'Pendiente'})
              </button>
              <button
                type="button"
                className={`seg-btn ${quizType === 'post' ? 'on' : ''}`}
                onClick={() => {
                  setQuizType('post');
                  setAnswers({});
                  setSubmitted(false);
                }}
              >
                2. Test Final ({quizScores.post !== null ? `${quizScores.post}/10` : 'Pendiente'})
              </button>
            </div>

            {deltaPct !== null && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: deltaPct >= 30 ? '#34c75922' : '#f59e0b22',
                  color: deltaPct >= 30 ? '#34c759' : '#f59e0b',
                  fontSize: '12.5px',
                  fontWeight: 700
                }}
              >
                Variación Pre → Post: {deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`}{' '}
                {deltaPct >= 30 ? '· Meta preventiva cumplida (≥ 30 %)' : ''}
              </div>
            )}
          </div>

          {QUIZ_QUESTIONS.map((item, qIdx) => (
            <div key={qIdx} className="card stack" style={{ gap: '8px' }}>
              <div className="h3">{item.q}</div>
              {item.options.map((opt, oIdx) => {
                const selected = answers[qIdx] === oIdx;
                const isCorrect = oIdx === item.correct;
                let borderCol = 'transparent';
                if (submitted && isCorrect) borderCol = '#34c759';
                else if (submitted && selected && !isCorrect) borderCol = '#ff453a';
                else if (selected) borderCol = 'var(--pink)';

                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => !submitted && setAnswers({ ...answers, [qIdx]: oIdx })}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'var(--surface-2)',
                      border: `1.5px solid ${borderCol}`,
                      fontSize: '12.5px',
                      fontWeight: selected ? 600 : 400
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ))}

          <button
            type="button"
            disabled={Object.keys(answers).length < QUIZ_QUESTIONS.length}
            onClick={() => {
              setSubmitted(true);
              onSaveQuiz(quizType, score);
            }}
            className="btn btn-primary tap"
          >
            <Check size={18} />
            <span>Calificar y guardar ({score}/10 pts)</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. HÁBITOS Y CALENTAMIENTO DINÁMICO (TAB: PREVENIR)
// ============================================================================
function PreventionView({
  checked,
  setChecked,
  notify
}: {
  checked: number[];
  setChecked: (arr: number[]) => void;
  notify: (msg: string) => void;
}) {
  const toggleItem = (idx: number) => {
    const exists = checked.includes(idx);
    const next = exists ? checked.filter((i) => i !== idx) : [...checked, idx];
    setChecked(next);
    if (next.length === WARMUP.length) {
      notify('¡Calentamiento de 10 min completado!');
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
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="badge" style={{ marginBottom: '6px' }}>6 Pilares Protectores</span>
          <h1 className="display" style={{ fontSize: '21px' }}>
            Hábitos que <span className="grad-text">evitan lesiones</span>
          </h1>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Pequeños ajustes semanales reducen hasta a la mitad el riesgo de sobrecarga en principiantes.
          </p>
        </div>
      </div>

      <div className="grid-2">
        {HABITS.map(({ title, desc, Icon, c }, i) => (
          <div key={i} className="card">
            <div className="icon-tile" style={cssVars({ '--c': c, marginBottom: '8px' })}>
              <Icon size={17} />
            </div>
            <h3 className="h3">{title}</h3>
            <p className="small muted" style={{ marginTop: '3px' }}>
              {desc} {i === 1 && <GlosarioTerm term="CADENCIA">Ver cadencia</GlosarioTerm>}
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="h2">Activación Pre-Carrera (10 min)</h3>
          <span className="badge tnum">{doneMin}/{totalMin} min</span>
        </div>

        <div style={{ background: 'var(--surface-2)', height: '7px', borderRadius: '999px', marginTop: '10px', overflow: 'hidden' }}>
          <div style={{ background: 'var(--pink)', width: `${(doneMin / totalMin) * 100}%`, height: '100%', transition: 'width .35s ease' }} />
        </div>

        <div className="ios-group" style={{ marginTop: '12px' }}>
          {WARMUP.map((w, idx) => {
            const done = checked.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                className="ios-row"
                onClick={() => toggleItem(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '999px',
                      border: done ? 'none' : '1.5px solid var(--line-strong)',
                      background: done ? 'var(--pink)' : 'transparent',
                      color: 'var(--pink-ink)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0
                    }}
                  >
                    {done && <Check size={14} strokeWidth={3} />}
                  </div>
                  <span
                    className="small"
                    style={{
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? 'var(--ink-3)' : 'var(--ink)'
                    }}
                  >
                    {w.act}
                  </span>
                </div>
                <span className="badge tnum">{w.time} min</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. RUTINA NEUROMUSCULAR CALIBRADA (BLOQUEO PREVENTIVO + MINIATURAS)
// ============================================================================
function ExercisesView({
  bio,
  onOpenExercise,
  onOpenClinicalReport
}: {
  bio: BiometricsSummary;
  onOpenExercise: (ex: ExerciseItem) => void;
  onOpenClinicalReport: () => void;
}) {
  const [phaseFilter, setPhaseFilter] = useState<string>('Todos');
  const phases = ['Todos', 'Fortalecimiento', 'Estiramiento', 'Propiocepción'];

  if (bio.redFlagActive) {
    return (
      <div className="stack">
        <div className="card stack" style={{ borderColor: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 12%, var(--surface))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="icon-tile" style={cssVars({ '--c': '#ff453a' })}>
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

  const filtered = phaseFilter === 'Todos'
    ? EXERCISES
    : EXERCISES.filter((e) => e.phase === phaseFilter);

  return (
    <div className="stack">
      <div className="card">
        <span className="badge">Entrenamiento Neuromuscular</span>
        <h1 className="display" style={{ marginTop: '4px' }}>
          Fuerza para <span className="grad-text">proteger tu tibia</span>
        </h1>
        <p className="small muted" style={{ marginTop: '4px' }}>
          Dosis calibrada al <strong>{Math.round(bio.loadFactor * 100)} %</strong> según tu nivel de alerta ({bio.riskLevel}). Enfocado en sóleo, arco plantar (<GlosarioTerm term="PRONACION">pronación</GlosarioTerm>) y cadera.
        </p>

        <div className="seg" style={cssVars({ '--n': 4, marginTop: '12px' })}>
          <div
            className="seg-pill"
            style={{ transform: `translateX(${phases.indexOf(phaseFilter) * 100}%)` }}
          />
          {phases.map((ph) => (
            <button
              key={ph}
              type="button"
              className={`seg-btn ${phaseFilter === ph ? 'on' : ''}`}
              onClick={() => setPhaseFilter(ph)}
              style={{ fontSize: '11px' }}
            >
              {ph === 'Fortalecimiento' ? 'Fuerza' : ph === 'Propiocepción' ? 'Equilibrio' : ph}
            </button>
          ))}
        </div>
      </div>

      <div className="desktop-grid-2">
        {filtered.map((ex) => {
          const adjustedVal = Math.max(5, Math.round(ex.baseReps * bio.loadFactor));
          const doseLabel = ex.isTime
            ? `${ex.sets} × ${adjustedVal} seg`
            : `${ex.sets} × ${adjustedVal} reps`;

          return (
            <button
              key={ex.id}
              type="button"
              className="card tap"
              onClick={() => onOpenExercise({ ...ex, doseLabel })}
              style={{ textAlign: 'left', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <img
                src={ex.img}
                alt={ex.title}
                referrerPolicy="no-referrer"
                style={{ width: '60px', height: '60px', borderRadius: '11px', objectFit: 'cover', flexShrink: 0, background: 'var(--surface-2)' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="badge" style={{ marginBottom: '2px' }}>{ex.phase}</span>
                <div className="h3" style={{ fontSize: '14px' }}>{ex.title}</div>
                <div className="small tnum" style={{ color: 'var(--pink)', fontWeight: 700, marginTop: '3px' }}>
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
    </div>
  );
}

// ============================================================================
// 10. MODAL DE EJERCICIO CON FOTO SUPERIOR Y TEMPORIZADOR CIRCULAR SVG
// ============================================================================
function ExerciseModal({ ex, onClose }: { ex: ExerciseItem; onClose: () => void }) {
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
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel stack" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', height: '165px', background: 'var(--surface-2)' }}>
          <img
            src={ex.img}
            alt={ex.title}
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#000000aa',
              display: 'grid',
              placeItems: 'center'
            }}
          >
            <X size={18} color="#fff" />
          </button>
        </div>

        <div>
          <span className="badge">{ex.phase} · {ex.doseLabel || `${ex.sets} × ${ex.baseReps}`}</span>
          <h2 className="h2" style={{ marginTop: '4px' }}>{ex.title}</h2>
        </div>

        <div className="card stack" style={{ gap: '8px' }}>
          <div className="eyebrow">Ejecución paso a paso</div>
          {ex.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span className="badge tnum">{i + 1}</span>
              <span className="small muted">{step}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '10px 12px', borderRadius: '12px', background: '#34c75914', border: '1px solid #34c75933' }}>
          <span className="small" style={{ color: 'var(--pink)', fontWeight: 600 }}>Sustento biomecánico: </span>
          <span className="small muted">{ex.tip}</span>
        </div>

        <div
          style={{
            background: 'var(--surface-2)',
            borderRadius: '16px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div style={{ position: 'relative', width: '92px', height: '92px', flexShrink: 0 }}>
            <svg width="92" height="92" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
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
            <div className="tnum" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '20px', fontWeight: 800 }}>
              {seconds}s
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div className="h3">{ex.timer.label}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button
                type="button"
                className="btn btn-primary tap"
                style={{ minHeight: '40px', padding: '0 14px', width: 'auto' }}
                onClick={() => {
                  if (seconds === 0) setSeconds(ex.timer.s);
                  setRunning(!running);
                }}
              >
                {running ? <Pause size={16} /> : <Play size={16} />}
                <span>{running ? 'Pausar' : 'Iniciar'}</span>
              </button>
              <button
                type="button"
                className="btn btn-soft tap"
                style={{ minHeight: '40px', width: '40px', padding: 0 }}
                onClick={() => {
                  setRunning(false);
                  setSeconds(ex.timer.s);
                }}
                aria-label="Reiniciar temporizador"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. PLAN PROGRESIVO DE 8 SEMANAS (PORTADA + 3 SUBPESTAÑAS + ACORDEÓN)
// ============================================================================
function RecoveryView({
  doneTasks,
  setDoneTasks,
  notify
}: {
  doneTasks: Record<string, boolean>;
  setDoneTasks: (obj: Record<string, boolean>) => void;
  notify: (msg: string) => void;
}) {
  const [subTab, setSubTab] = useState(0);
  const [openStage, setOpenStage] = useState<number | null>(0);

  const totalTasks = PREVENTION_PLAN.reduce((acc, w) => acc + w.tasks.length, 0);
  const completedCount = Object.values(doneTasks).filter(Boolean).length;
  const pct = Math.round((completedCount / totalTasks) * 100);

  const toggleTask = (sIdx: number, tIdx: number) => {
    const key = `${sIdx}-${tIdx}`;
    const next = { ...doneTasks, [key]: !doneTasks[key] };
    setDoneTasks(next);
    const stageDone = PREVENTION_PLAN[sIdx].tasks.every((_, i) => next[`${sIdx}-${i}`]);
    if (stageDone) {
      notify(`¡Completaste ${PREVENTION_PLAN[sIdx].week}!`);
    } else if (!doneTasks[key]) {
      notify('Meta semanal completada');
    }
  };

  return (
    <div className="stack">
      <div className="hero-card">
        <img
          src="/assets/recuperacion-hielo-fJVnTR5m.jpg"
          alt="Progresión segura de running"
          className="hero-bg"
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span className="badge">Progresión Segura</span>
            <span className="badge tnum">{completedCount}/{totalTasks} ({pct} %)</span>
          </div>
          <h1 className="display" style={{ fontSize: '21px' }}>
            Plan de <span className="grad-text">8 Semanas</span>
          </h1>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Ruta gradual para pasar de principiante a correr 30–40 min continuos sin dolor tibial.
          </p>
          <div style={{ height: '6px', borderRadius: '999px', background: 'rgba(255,255,255,0.18)', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#34c759', transition: 'width .25s var(--ease)' }} />
          </div>
        </div>
      </div>

      <div className="seg" style={cssVars({ '--n': 3 })}>
        <div className="seg-pill" style={{ transform: `translateX(${subTab * 100}%)` }} />
        {['Plan 8 sem', 'Banderas Rojas', 'Pautas'].map((lbl, idx) => (
          <button key={lbl} type="button" className={`seg-btn ${subTab === idx ? 'on' : ''}`} onClick={() => setSubTab(idx)}>
            {lbl}
          </button>
        ))}
      </div>

      {subTab === 0 && (
        <div className="stack">
          {PREVENTION_PLAN.map((stage, sIdx) => {
            const isOpen = openStage === sIdx;
            const stageCompleted = stage.tasks.filter((_, tIdx) => doneTasks[`${sIdx}-${tIdx}`]).length;
            return (
              <div key={sIdx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setOpenStage(isOpen ? null : sIdx)}
                  style={{ width: '100%', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
                >
                  <div>
                    <div className="eyebrow" style={{ color: 'var(--pink)' }}>
                      {stage.week} · {stageCompleted}/{stage.tasks.length} metas
                    </div>
                    <div className="h3" style={{ marginTop: '2px' }}>{stage.title}</div>
                  </div>
                  <ChevronDown size={18} color="var(--ink-3)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .25s ease' }} />
                </button>

                {isOpen && (
                  <div className="stack" style={{ padding: '10px 16px 16px', borderTop: '0.5px solid var(--line)', gap: '8px' }}>
                    {stage.tasks.map((task, tIdx) => {
                      const checked = Boolean(doneTasks[`${sIdx}-${tIdx}`]);
                      return (
                        <button
                          key={tIdx}
                          type="button"
                          onClick={() => toggleTask(sIdx, tIdx)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            background: 'var(--surface-2)'
                          }}
                        >
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '6px',
                              border: checked ? 'none' : '1.5px solid var(--line-strong)',
                              background: checked ? 'var(--pink)' : 'transparent',
                              color: 'var(--pink-ink)',
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              marginTop: '1px'
                            }}
                          >
                            {checked && <Check size={13} strokeWidth={3} />}
                          </div>
                          <span
                            className="small"
                            style={{
                              textDecoration: checked ? 'line-through' : 'none',
                              color: checked ? 'var(--ink-3)' : 'var(--ink)'
                            }}
                          >
                            {task}
                          </span>
                        </button>
                      );
                    })}
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
            <AlertTriangle size={20} color="#ff453a" />
            <h3 className="h2" style={{ color: '#ff453a' }}>Señales para detener el plan</h3>
          </div>
          {RED_FLAGS.map((flag, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span className="badge" style={{ background: '#ff453a22', color: '#ff453a', padding: '1px 7px', borderRadius: '6px' }}>!</span>
              <span className="small muted">{flag}</span>
            </div>
          ))}
        </div>
      )}

      {subTab === 2 && (
        <div className="stack">
          <div className="card">
            <h3 className="h3">Control de Carga Aguda:Crónica</h3>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Mantén tu indicador ACWR entre 0.8 y 1.3 registrando cada entrenamiento con distancia, esfuerzo Borg y dolor EVA.
            </p>
          </div>
          <div className="card">
            <h3 className="h3">Autogestión del Descanso</h3>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Evita correr días consecutivos durante tus primeras 6 semanas para favorecer la remodelación ósea.
            </p>
          </div>
          <div className="card">
            <h3 className="h3">Consulta Oportuna</h3>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Este prototipo es preventivo: ante dolor persistente, acude a fisioterapia o medicina del deporte.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
