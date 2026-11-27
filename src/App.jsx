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
  posteromedial_difuso: 'Borde interno bajo de la espinilla (difuso > 5 cm)',
  focal_puntual: 'Punto óseo exacto y punzante (< 2 cm)',
  muscular_general: 'Músculo de la pantorrilla (parte posterior)'
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
// GLOSARIO INTERACTIVO EN LENGUAJE CERCANO (JÓVENES 18–25 AÑOS)
// ============================================================================
const GLOSARIO_DATA = {
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

function GlosarioTerm({ term, children }) {
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
const EXERCISES = [
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
              <select className="input-field" value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
              </select>
            </div>
          </div>

          {(age < 18 || age > 25) && (
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
              <select className="input-field" value={experience} onChange={(e) => setExperience(e.target.value)}>
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
              <select className="input-field" value={footType} onChange={(e) => setFootType(e.target.value)}>
                <option value="desconocido">No lo sé</option>
                <option value="neutra">Neutra</option>
                <option value="pronador">Pronadora (arco baja)</option>
                <option value="supinador">Supinadora</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="eyebrow">¿Lesión previa?</label>
              <select className="input-field" value={priorInjury} onChange={(e) => setPriorInjury(e.target.value)}>
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
// 2. RESUMEN BIOMÉTRICO Y PANEL PRINCIPAL (TAB: INICIO)
// ============================================================================
function DashboardView({ user, bio, unit, onOpenSession, onOpenClinicalReport, onGoTab }) {
  const recentSessions = [...(user.sessions || [])].slice(-6);
  const maxDist = Math.max(5, ...recentSessions.map((s) => Number(s.distanceKm || 0)));

  return (
    <div className="stack">
      {/* ALERTA DE BANDERA ROJA SI ESTÁ ACTIVA */}
      {bio.redFlagActive && (
        <div
          className="card"
          style={{
            borderColor: '#ff453a',
            background: 'color-mix(in srgb, #ff453a 14%, var(--surface))'
          }}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div className="icon-tile" style={{ '--c': '#ff453a' }}>
              <AlertTriangle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="eyebrow" style={{ color: '#ff453a' }}>Bandera Roja Preventiva</div>
              <h2 className="h2" style={{ color: '#ff453a', marginTop: '2px' }}>
                Pausa el impacto y consulta a un profesional
              </h2>
              <p className="small" style={{ marginTop: '4px' }}>
                {bio.reasons[0]} Por seguridad, hemos pausado la carga de ejercicios de alto impacto.
              </p>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" onClick={onOpenClinicalReport} className="btn-pill-sm tap" style={{ background: '#ff453a', color: '#fff' }}>
                  <FileText size={14} /> Ver reporte para consulta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TARJETA HERO CON MÉTRICAS STRAVA */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div>
            <div className="eyebrow">Semáforo Preventivo · {user.profile.name}</div>
            <h1 className="display" style={{ marginTop: '2px', color: bio.riskColor }}>
              Riesgo {bio.riskLevel}
            </h1>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Monitoreo continuo para evitar el <GlosarioTerm term="SETM">dolor en la espinilla</GlosarioTerm>.
            </p>
          </div>
          <button type="button" onClick={onOpenSession} className="btn-pill-sm tap">
            <PlusCircle size={15} /> Registrar salida
          </button>
        </div>

        <div className="strava-stat-strip">
          <div className="strava-stat-cell">
            <span className="eyebrow">Carga 7 días</span>
            <strong className="h2 tnum">{fmtDist(bio.acuteKm, unit)}</strong>
            <span className="small muted" style={{ fontSize: '11px' }}>Base: {fmtDist(bio.chronicKm, unit)}/sem</span>
          </div>

          <div className="strava-stat-cell">
            <span className="eyebrow">
              <GlosarioTerm term="ACWR">ACWR</GlosarioTerm>
            </span>
            <strong className="h2 tnum" style={{ color: bio.acwrColor }}>{bio.acwr}</strong>
            <span className="small" style={{ fontSize: '11px', color: bio.acwrColor, fontWeight: 600 }}>
              {bio.acwrStatus}
            </span>
          </div>

          <div className="strava-stat-cell">
            <span className="eyebrow">IMC / Dolor</span>
            <strong className="h2 tnum">{bio.bmi}</strong>
            <span className="small muted" style={{ fontSize: '11px' }}>
              EVA últ: {bio.lastSession ? `${bio.lastSession.eva}/10` : '0/10'}
            </span>
          </div>
        </div>
      </div>

      {/* GRID DESKTOP: EXPLICACIÓN + HISTORIAL GRÁFICO */}
      <div className="desktop-split">
        <div className="stack">
          <div className="section-heading">
            <span>¿Qué detectó tu análisis?</span>
            <button
              type="button"
              onClick={onOpenClinicalReport}
              style={{ color: 'var(--pink)', fontSize: '12px', fontWeight: 700 }}
            >
              Ver ficha completa
            </button>
          </div>

          <div className="card stack" style={{ gap: '8px' }}>
            {bio.reasons.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '9px',
                  alignItems: 'flex-start',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'var(--surface-2)'
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '999px',
                    background: bio.riskColor,
                    marginTop: '6px',
                    flexShrink: 0
                  }}
                />
                <span className="small">{r}</span>
              </div>
            ))}
          </div>

          {/* ACCESOS RÁPIDOS */}
          <div className="ios-group">
            <button type="button" className="ios-row" onClick={() => onGoTab('ejercicios')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="icon-tile" style={{ '--c': '#34c759' }}>
                  <Dumbbell size={17} />
                </div>
                <div>
                  <div className="h3">Rutina neuromuscular preventiva</div>
                  <div className="small muted">
                    {bio.redFlagActive
                      ? 'Pausada por alerta de dolor'
                      : `Dosis calibrada al ${Math.round(bio.loadFactor * 100)} % según tu perfil`}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
            </button>

            <button type="button" className="ios-row" onClick={() => onGoTab('cadencia')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="icon-tile" style={{ '--c': '#32ade6' }}>
                  <Timer size={17} />
                </div>
                <div>
                  <div className="h3">Metrónomo de cadencia (+5 %)</div>
                  <div className="small muted">
                    Tu objetivo protector: {Math.round((user.profile.cadencePpm || 164) * 1.05)} pasos/min
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
            </button>

            <button type="button" className="ios-row" onClick={() => onGoTab('quees')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="icon-tile" style={{ '--c': '#ff9f0a' }}>
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
        </div>

        {/* GRÁFICO DE ÚLTIMAS SESIONES */}
        <div className="stack">
          <div className="section-heading">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <BarChart3 size={16} color="var(--pink)" /> Últimas sesiones ({user.sessions.length})
            </span>
            <span className="eyebrow">Regla máx. +10 %</span>
          </div>

          <div className="card">
            {recentSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 8px' }}>
                <p className="small muted">Aún no has registrado carreras.</p>
                <button
                  type="button"
                  onClick={onOpenSession}
                  className="btn btn-primary tap"
                  style={{ marginTop: '10px' }}
                >
                  <PlusCircle size={17} /> Registrar mi primera sesión
                </button>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${recentSessions.length}, minmax(0, 1fr))`,
                    gap: '8px',
                    alignItems: 'end',
                    height: '120px',
                    paddingTop: '12px'
                  }}
                >
                  {recentSessions.map((s) => {
                    const pct = Math.max(16, Math.round((Number(s.distanceKm) / maxDist) * 100));
                    const barColor = s.eva >= 4 ? '#ff453a' : s.eva > 0 ? '#f59e0b' : 'var(--pink)';
                    return (
                      <div
                        key={s.id || s.date}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}
                      >
                        <span className="tnum" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ink-2)' }}>
                          {distVal(s.distanceKm, unit)}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '32px',
                            height: `${pct}%`,
                            borderRadius: '7px',
                            background: barColor,
                            transition: 'height .25s var(--ease)'
                          }}
                        />
                        <span className="tnum" style={{ fontSize: '9.5px', color: 'var(--ink-3)' }}>
                          {s.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recentSessions.slice(-3).reverse().map((s) => (
                    <div
                      key={s.id || s.date}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: 'var(--surface-2)',
                        fontSize: '12px'
                      }}
                    >
                      <div>
                        <strong className="tnum">{s.date}</strong>
                        <span className="muted"> · {fmtDist(s.distanceKm, unit)} ({s.durationMin} min)</span>
                      </div>
                      <div className="tnum" style={{ display: 'flex', gap: '6px', fontWeight: 700 }}>
                        <span style={{ color: 'var(--ink-2)' }}>Borg {s.rpe}</span>
                        <span style={{ color: s.eva >= 4 ? '#ff453a' : s.eva > 0 ? '#f59e0b' : '#34c759' }}>
                          EVA {s.eva}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. METRÓNOMO BIOMECÁNICO DE CADENCIA (TAB: CADENCIA)
// ============================================================================
function CadenceView({ cadencePpm, onSaveCadence }) {
  const [ppm, setPpm] = useState(cadencePpm || 164);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [beat, setBeat] = useState(false);
  const audioCtxRef = useRef(null);

  const recommendedTarget = Math.min(195, Math.round((cadencePpm || 164) * 1.05));

  const playClick = () => {
    if (muted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
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

  return (
    <div className="stack">
      <div className="card">
        <span className="badge">Biofeedback Auditivo</span>
        <h1 className="display" style={{ marginTop: '4px' }}>
          Control de <span className="grad-text">Cadencia</span>
        </h1>
        <p className="small muted" style={{ marginTop: '4px' }}>
          Subir tu <GlosarioTerm term="CADENCIA">cadencia</GlosarioTerm> apenas un 5 % hace que des pasos más cortos, caigas debajo de tu cuerpo y bajes el golpe sobre la espinilla.
        </p>
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
    </div>
  );
}

// ============================================================================
// 4. GUÍA EDUCATIVA EN LENGUAJE CLARO Y TEST PRE/POST (TAB: GUÍA/TEST)
// ============================================================================
function WhatIsView({ sex, quizScores, onSaveQuiz }) {
  const [subTab, setSubTab] = useState('guia');
  const [quizType, setQuizType] = useState('pre');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

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
      <div className="seg" style={{ '--n': 2 }}>
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
            <span className="badge">Educación Preventiva</span>
            <h1 className="display" style={{ marginTop: '4px' }}>
              ¿Qué es el <GlosarioTerm term="SETM">dolor en la espinilla</GlosarioTerm>?
            </h1>
            <p className="small muted" style={{ marginTop: '6px' }}>
              Es la lesión por sobreuso más común cuando empiezas a correr. Ocurre porque la <GlosarioTerm term="PERIOSTIO">cubierta de la tibia</GlosarioTerm> se irrita al recibir más impacto del que puede reparar entre entrenamientos.
            </p>
            {sex === 'femenino' && (
              <p className="small" style={{ marginTop: '8px', color: 'var(--pink)' }}>
                Nota personalizada: en mujeres corredoras la evidencia reporta mayor susceptibilidad, por lo que respetar los días de recuperación y fuerza es clave.
              </p>
            )}
          </div>

          <div className="grid-2">
            {STATS_FACTS.map((st, i) => (
              <div key={i} className="card">
                <div className="display tnum" style={{ color: st.c, fontSize: '24px' }}>{st.num}</div>
                <div className="small muted" style={{ marginTop: '3px' }}>{st.label}</div>
              </div>
            ))}
          </div>

          <div className="section-heading"><span>¿Qué pasa dentro de tu pierna?</span></div>
          <div className="desktop-grid-3">
            {ANATOMY_CARDS.map(({ title, desc, c, Icon }, i) => (
              <div key={i} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
                  <div className="icon-tile" style={{ '--c': c }}>
                    <Icon size={17} />
                  </div>
                  <h3 className="h3">{title}</h3>
                </div>
                <p className="small muted">{desc}</p>
              </div>
            ))}
          </div>

          <div className="section-heading"><span>Señales tempranas para frenar a tiempo</span></div>
          <div className="card stack" style={{ gap: '8px' }}>
            {SYMPTOMS.map((sym, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Check size={16} color="var(--pink)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span className="small">{sym}</span>
              </div>
            ))}
          </div>

          <div className="section-heading"><span>Principales factores de riesgo</span></div>
          <div className="desktop-grid-2">
            {RISK_FACTORS.map((rf, i) => (
              <div key={i} className="card">
                <h3 className="h3">{rf.title}</h3>
                <p className="small muted" style={{ marginTop: '4px' }}>{rf.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="card">
            <span className="badge">Evaluación de Aprendizaje</span>
            <h2 className="h2" style={{ marginTop: '4px' }}>Cuestionario Preventivo (10 preguntas)</h2>
            <p className="small muted" style={{ marginTop: '4px' }}>
              Compara lo que sabías antes (Test Inicial) y después de usar la guía (Test Final). Meta del estudio: mejora ≥ 30 %.
            </p>

            <div className="seg" style={{ '--n': 2, marginTop: '12px' }}>
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
function PreventionView({ checked, setChecked, notify }) {
  const toggleItem = (idx) => {
    const exists = checked.includes(idx);
    const next = exists ? checked.filter((i) => i !== idx) : [...checked, idx];
    setChecked(next);
    if (next.length === WARMUP.length) {
      notify('¡Calentamiento de 10 min completado!');
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <span className="badge">6 Pilares Protectores</span>
        <h1 className="display" style={{ marginTop: '4px' }}>
          Hábitos que <span className="grad-text">evitan lesiones</span>
        </h1>
        <p className="small muted" style={{ marginTop: '4px' }}>
          Pequeños ajustes semanales reducen hasta a la mitad el riesgo de sobrecarga en principiantes.
        </p>
      </div>

      <div className="grid-2">
        {HABITS.map(({ title, desc, Icon, c }, i) => (
          <div key={i} className="card">
            <div className="icon-tile" style={{ '--c': c, marginBottom: '8px' }}>
              <Icon size={17} />
            </div>
            <h3 className="h3">{title}</h3>
            <p className="small muted" style={{ marginTop: '3px' }}>{desc}</p>
          </div>
        ))}
      </div>

      <div className="section-heading">
        <span>Calentamiento dinámico (10 min)</span>
        <span className="badge tnum">{checked.length}/{WARMUP.length}</span>
      </div>

      <div className="ios-group">
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
  );
}

// ============================================================================
// 6. RUTINA NEUROMUSCULAR CALIBRADA (TAB: EJERCICIOS)
// ============================================================================
function ExercisesView({ bio, onOpenExercise, onOpenClinicalReport }) {
  const [phaseFilter, setPhaseFilter] = useState('Todos');
  const phases = ['Todos', 'Fortalecimiento', 'Estiramiento', 'Propiocepción'];

  const filtered = phaseFilter === 'Todos'
    ? EXERCISES
    : EXERCISES.filter((e) => e.phase === phaseFilter);

  const factor = bio?.loadFactor ?? 1.0;

  return (
    <div className="stack">
      <div className="card">
        <span className="badge">Entrenamiento Neuromuscular</span>
        <h1 className="display" style={{ marginTop: '4px' }}>
          Fuerza para <span className="grad-text">proteger tu tibia</span>
        </h1>
        <p className="small muted" style={{ marginTop: '4px' }}>
          Rutina enfocada en pantorrilla profunda (sóleo), arco plantar (<GlosarioTerm term="PRONACION">pronación</GlosarioTerm>) y estabilidad de cadera.
        </p>
      </div>

      {bio?.redFlagActive && (
        <div
          className="card"
          style={{
            borderColor: '#ff453a',
            background: 'color-mix(in srgb, #ff453a 14%, var(--surface))'
          }}
        >
          <div className="h3" style={{ color: '#ff453a' }}>
            Rutina pausada por bandera roja de dolor
          </div>
          <p className="small muted" style={{ marginTop: '4px' }}>
            Mientras tengas dolor activo en la espinilla, prioriza reposo relativo y valoración profesional.
          </p>
          <button
            type="button"
            onClick={onOpenClinicalReport}
            className="btn-pill-sm tap"
            style={{ marginTop: '10px', background: '#ff453a', color: '#fff' }}
          >
            Ver resumen para fisioterapia
          </button>
        </div>
      )}

      <div className="seg" style={{ '--n': 4 }}>
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

      <div className="desktop-grid-2">
        {filtered.map((ex) => {
          const adjustedReps = bio?.redFlagActive
            ? 0
            : Math.max(5, Math.round(ex.baseReps * factor));
          return (
            <div key={ex.id} className="card stack" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className="badge">{ex.phase}</span>
                  <span className="badge tnum">
                    {bio?.redFlagActive
                      ? 'En pausa'
                      : `${ex.sets} × ${adjustedReps}${ex.isTime ? ' s' : ' reps'}`}
                  </span>
                </div>
                <h3 className="h3">{ex.title}</h3>
                <p className="small muted" style={{ marginTop: '4px' }}>{ex.tip}</p>
              </div>

              <button
                type="button"
                disabled={bio?.redFlagActive}
                onClick={() => onOpenExercise({ ...ex, adjustedReps })}
                className="btn btn-soft tap"
                style={{ marginTop: '6px' }}
              >
                <Play size={15} color="var(--pink)" />
                <span>Ver técnica y temporizador</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 7. PLAN PROGRESIVO DE 8 SEMANAS (TAB: PLAN 8S)
// ============================================================================
function RecoveryView({ doneTasks, setDoneTasks, notify }) {
  const totalTasks = PREVENTION_PLAN.reduce((acc, w) => acc + w.tasks.length, 0);
  const completedCount = Object.values(doneTasks).filter(Boolean).length;
  const pct = Math.round((completedCount / totalTasks) * 100);

  const toggleTask = (wIdx, tIdx) => {
    const key = `${wIdx}-${tIdx}`;
    const next = { ...doneTasks, [key]: !doneTasks[key] };
    setDoneTasks(next);
    if (!doneTasks[key]) notify('Meta semanal completada');
  };

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge">Progresión Segura</span>
          <span className="badge tnum">{completedCount}/{totalTasks} ({pct} %)</span>
        </div>
        <h1 className="display" style={{ marginTop: '4px' }}>
          Plan de <span className="grad-text">8 Semanas</span>
        </h1>
        <p className="small muted" style={{ marginTop: '4px' }}>
          Ruta gradual para pasar de principiante a correr 30–40 min continuos sin dolor tibial.
        </p>
        <div style={{ height: '7px', borderRadius: '999px', background: 'var(--surface-2)', marginTop: '12px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--pink)', transition: 'width .25s var(--ease)' }} />
        </div>
      </div>

      {PREVENTION_PLAN.map((block, wIdx) => (
        <div key={wIdx} className="card stack" style={{ gap: '8px' }}>
          <div>
            <span className="badge">{block.week}</span>
            <h3 className="h3" style={{ marginTop: '2px' }}>{block.title}</h3>
          </div>
          {block.tasks.map((task, tIdx) => {
            const checked = Boolean(doneTasks[`${wIdx}-${tIdx}`]);
            return (
              <button
                key={tIdx}
                type="button"
                onClick={() => toggleTask(wIdx, tIdx)}
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
      ))}

      <div className="card" style={{ borderColor: '#ff453a55' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <AlertTriangle size={18} color="#ff453a" />
          <h3 className="h3" style={{ color: '#ff453a' }}>Señales para detener el plan</h3>
        </div>
        <div className="stack" style={{ gap: '6px' }}>
          {RED_FLAGS.map((rf, i) => (
            <div key={i} className="small muted">• {rf}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 8. MODAL DE REGISTRO DE SESIÓN CON MEDIDOR SEMICIRCULAR EVA
// ============================================================================
function LogSessionModal({ unit, onClose, onSaveSession }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [distanceInput, setDistanceInput] = useState(4.0);
  const [durationMin, setDurationMin] = useState(25);
  const [rpe, setRpe] = useState(4);
  const [eva, setEva] = useState(0);
  const [legSide, setLegSide] = useState('izquierda');
  const [painLocation, setPainLocation] = useState('posteromedial_difuso');
  const [painAtRest, setPainAtRest] = useState(false);

  const painInfo = getPainInfo(eva);
  const needleAngle = -90 + (eva / 10) * 180;

  const handleSave = (e) => {
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
                <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="var(--surface-2)" strokeWidth="20" strokeLinecap="round" />
                <path d="M 30 150 A 120 120 0 0 1 115 36" fill="none" stroke="#34c759" strokeWidth="20" strokeLinecap="round" />
                <path d="M 115 36 A 120 120 0 0 1 205 44" fill="none" stroke="#ffd60a" strokeWidth="20" />
                <path d="M 205 44 A 120 120 0 0 1 270 150" fill="none" stroke="#ff453a" strokeWidth="20" strokeLinecap="round" />
                <g className="gauge-needle" style={{ transform: `rotate(${needleAngle}deg)` }}>
                  <line x1="150" y1="150" x2="150" y2="48" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
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
                    style={{ '--c': info.c }}
                    onClick={() => setEva(n)}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {eva >= 4 && (
              <div className="pain-advice" style={{ '--c': '#ff453a', color: '#ff453a', fontSize: '12px' }}>
                <AlertTriangle size={16} />
                <span>Dolor ≥ 4: si se repite en 2 sesiones seguidas, activará bandera roja.</span>
              </div>
            )}
          </div>

          {eva > 0 && (
            <div className="card stack">
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="eyebrow">¿En qué pierna sentiste la molestia?</label>
                <select className="input-field" value={legSide} onChange={(e) => setLegSide(e.target.value)}>
                  <option value="izquierda">Pierna izquierda</option>
                  <option value="derecha">Pierna derecha</option>
                  <option value="bilateral">Ambas piernas</option>
                </select>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="eyebrow">¿Cómo se siente el dolor?</label>
                <select className="input-field" value={painLocation} onChange={(e) => setPainLocation(e.target.value)}>
                  <option value="posteromedial_difuso">Zona amplia en borde interno de espinilla (&gt; 5 cm)</option>
                  <option value="focal_puntual">Un punto exacto y punzante en el hueso (&lt; 2 cm)</option>
                  <option value="muscular_general">Cansancio o tensión en la pantorrilla</option>
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={painAtRest}
                  onChange={(e) => setPainAtRest(e.target.checked)}
                  style={{ accentColor: '#ff453a' }}
                />
                <span className="small">Sigue doliendo en reposo o al caminar normal</span>
              </label>
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
function ClinicalReportModal({ user, bio, unit, onClose, onCopyText }) {
  const p = user.profile;
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
// 10. MODAL DE EJERCICIO CON TEMPORIZADOR INTEGRADO
// ============================================================================
function ExerciseModal({ ex, onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(ex.timer?.s || 30);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) {
      setRunning(false);
      return;
    }
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running, secondsLeft]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel stack" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="badge">{ex.phase} · {ex.sets} × {ex.adjustedReps}{ex.isTime ? ' s' : ' reps'}</span>
            <h2 className="h2">{ex.title}</h2>
          </div>
          <button type="button" className="icon-circle-btn tap" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="card stack" style={{ gap: '8px' }}>
          <div className="eyebrow">Ejecución paso a paso</div>
          {ex.steps.map((st, i) => (
            <div key={i} className="small">
              <strong>{i + 1}.</strong> {st}
            </div>
          ))}
        </div>

        {ex.timer && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="eyebrow">{ex.timer.label}</div>
            <div className="display tnum" style={{ fontSize: '36px', margin: '4px 0 10px', color: 'var(--pink)' }}>
              {secondsLeft} s
            </div>
            <div className="grid-2">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="btn btn-primary tap"
              >
                {running ? <><Pause size={16} /> Pausar</> : <><Play size={16} /> Iniciar</>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(ex.timer.s);
                }}
                className="btn btn-soft tap"
              >
                <RotateCcw size={16} /> Reiniciar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}