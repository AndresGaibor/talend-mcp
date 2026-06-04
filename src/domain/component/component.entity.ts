export type MasteryLevel =
  | 0 // No detectado
  | 1 // Detectado
  | 2 // Parametrizado
  | 3 // Template
  | 4 // Job completo
  | 5 // Roundtrip
  | 6 // Studio
  | 7 // Compila
  | 8 // Corre
  | 9 // Maneja errores
  | 10; // Automation completa

export interface ComponentMastery {
  componentName: string;
  level: MasteryLevel;
  uses: number;
  lastUsed?: string;
  validated: boolean;
}

export interface MasteryReport {
  totalComponents: number;
  masteredComponents: number;
  averageLevel: number;
  componentsByLevel: Record<number, string[]>;
}