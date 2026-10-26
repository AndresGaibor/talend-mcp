import type {
  PatrónTalend,
  ResponsabilidadExterna,
  ResponsabilidadTalend,
  ToolSugerida,
} from "../task-types";

/** Una regla de patron: que palabras la activan y que responsabilidades aporta. */
export type PatternRule = {
  pattern: PatrónTalend;
  keywords: string[];
  talendResponsibilities: ResponsabilidadTalend[];
  externalResponsibilities: ResponsabilidadExterna[];
  suggestedTools: ToolSugerida[];
  weight: number;
};
