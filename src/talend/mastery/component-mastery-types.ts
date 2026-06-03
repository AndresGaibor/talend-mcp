export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type MasteryLevelInfo = {
  level: MasteryLevel;
  name: string;
  description: string;
  canGenerate: boolean;
  canRead: boolean;
  canExecute: boolean;
};

export type ComponentMastery = {
  componentName: string;
  score: number;
  level: MasteryLevel;
  levels: {
    discovered: boolean;
    parametersParsed: boolean;
    templateGenerated: boolean;
    jobGenerated: boolean;
    roundTripReadWrite: boolean;
    opensInStudio: boolean;
    compilesWithoutProblems: boolean;
    runsInStudio: boolean;
    handlesErrors: boolean;
    safeEditingSupported: boolean;
    automationValidated: boolean;
  };
  missing: string[];
  lastValidated: number | null;
};

export type MasteryReport = {
  generatedAt: number;
  totalComponents: number;
  averageScore: number;
  levelDistribution: Record<MasteryLevel, number>;
  components: ComponentMastery[];
  summary: string;
};

export const MASTERY_LEVELS: Record<MasteryLevel, MasteryLevelInfo> = {
  0: {
    level: 0,
    name: "Detectado",
    description: "El componente fue detectado en el sistema pero no se sabe nada más",
    canGenerate: false,
    canRead: false,
    canExecute: false,
  },
  1: {
    level: 1,
    name: "Parámetros Leídos",
    description: "Se extrajeron los parámetros del componente",
    canGenerate: false,
    canRead: true,
    canExecute: false,
  },
  2: {
    level: 2,
    name: "Plantilla Generada",
    description: "Se puede generar una plantilla válida con parámetros por defecto",
    canGenerate: true,
    canRead: true,
    canExecute: false,
  },
  3: {
    level: 3,
    name: "Job Mínimo Generado",
    description: "Se puede generar un job mínimo funcional con el componente",
    canGenerate: true,
    canRead: true,
    canExecute: false,
  },
  4: {
    level: 4,
    name: "Round-Trip Válido",
    description: "El XML generado puede leerse y escribirse sin perder información",
    canGenerate: true,
    canRead: true,
    canExecute: false,
  },
  5: {
    level: 5,
    name: "Abre en Studio",
    description: "El job generado se puede abrir en Talend Studio sin errores",
    canGenerate: true,
    canRead: true,
    canExecute: false,
  },
  6: {
    level: 6,
    name: "Compila Sin Problems",
    description: "El job pasa el chequeo de compilación sin problemas ni warnings",
    canGenerate: true,
    canRead: true,
    canExecute: false,
  },
  7: {
    level: 7,
    name: "Ejecuta en Launch Config",
    description: "El job compila y ejecuta correctamente via launch config",
    canGenerate: true,
    canRead: true,
    canExecute: true,
  },
  8: {
    level: 8,
    name: "Errores Conocidos",
    description: "Se conocen los casos de error comunes y cómo manejarlos",
    canGenerate: true,
    canRead: true,
    canExecute: true,
  },
  9: {
    level: 9,
    name: "Edición Segura",
    description: "Se puede editar el componente de forma segura con snapshots y validación",
    canGenerate: true,
    canRead: true,
    canExecute: true,
  },
  10: {
    level: 10,
    name: "Automatización Completa",
    description: "El componente puede automatizarse de extremo a extremo sin intervención manual",
    canGenerate: true,
    canRead: true,
    canExecute: true,
  },
};

export function calculateMasteryLevel(levels: ComponentMastery["levels"]): { level: MasteryLevel; score: number } {
  let score = 0;

  if (levels.discovered) score += 10;
  if (levels.parametersParsed) score += 10;
  if (levels.templateGenerated) score += 10;
  if (levels.jobGenerated) score += 10;
  if (levels.roundTripReadWrite) score += 10;
  if (levels.opensInStudio) score += 10;
  if (levels.compilesWithoutProblems) score += 10;
  if (levels.runsInStudio) score += 10;
  if (levels.handlesErrors) score += 5;
  if (levels.safeEditingSupported) score += 5;
  if (levels.automationValidated) score += 5;

  let level: MasteryLevel = 0;
  if (score >= 95) level = 10;
  else if (score >= 85) level = 9;
  else if (score >= 75) level = 8;
  else if (score >= 65) level = 7;
  else if (score >= 55) level = 6;
  else if (score >= 45) level = 5;
  else if (score >= 35) level = 4;
  else if (score >= 25) level = 3;
  else if (score >= 15) level = 2;
  else if (score >= 10) level = 1;

  return { level, score };
}

export function getMissingCapabilities(levels: ComponentMastery["levels"]): string[] {
  const missing: string[] = [];

  if (!levels.discovered) missing.push("No se descubrió el componente");
  if (!levels.parametersParsed) missing.push("Parámetros no fueron parseados");
  if (!levels.templateGenerated) missing.push("No se generó plantilla");
  if (!levels.jobGenerated) missing.push("No se generó job mínimo");
  if (!levels.roundTripReadWrite) missing.push("Round-trip no validado");
  if (!levels.opensInStudio) missing.push("No se validó que abra en Studio");
  if (!levels.compilesWithoutProblems) missing.push("Compilación sin problems no validada");
  if (!levels.runsInStudio) missing.push("Ejecución en Studio no validada");
  if (!levels.handlesErrors) missing.push("Manejo de errores no documentado");
  if (!levels.safeEditingSupported) missing.push("Edición segura no implementada");
  if (!levels.automationValidated) missing.push("Automatización completa no validada");

  return missing;
}

export function createDefaultMastery(componentName: string): ComponentMastery {
  return {
    componentName,
    score: 0,
    level: 0,
    levels: {
      discovered: false,
      parametersParsed: false,
      templateGenerated: false,
      jobGenerated: false,
      roundTripReadWrite: false,
      opensInStudio: false,
      compilesWithoutProblems: false,
      runsInStudio: false,
      handlesErrors: false,
      safeEditingSupported: false,
      automationValidated: false,
    },
    missing: ["Componente no descubierto aún"],
    lastValidated: null,
  };
}

export function generateMasterySummary(report: MasteryReport): string {
  const levelCounts = Object.entries(report.levelDistribution)
    .map(([level, count]) => `${MASTERY_LEVELS[Number(level) as MasteryLevel].name}: ${count}`)
    .join(", ");

  return `Mastery Report: ${report.totalComponents} componentes, score promedio ${report.averageScore.toFixed(1)}/100. Distribución: ${levelCounts}`;
}