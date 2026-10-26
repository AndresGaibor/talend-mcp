import { INPUT_RULES } from "./rules-inputs";
import { OUTPUT_RULES } from "./rules-outputs";
import { QUALITY_RULES } from "./rules-quality";
import { ORCHESTRATION_RULES } from "./rules-orchestration";
import { TRANSFORMATION_RULES } from "./rules-transformation";
import type { PatternRule } from "./rule-types";

/**
 * Todas las reglas, en el orden historico.
 *
 * El orden importa: `rawPatternMatches` se publica en este mismo orden, asi que
 * las reglas se agrupan por categoria pero se listan aqui en la secuencia de
 * siempre.
 */
export const PATTERN_RULES: PatternRule[] = [
  INPUT_RULES[0]!, // multi_csv_raw_loader
  QUALITY_RULES[0]!, // csv_to_db_with_audit_columns
  TRANSFORMATION_RULES[0]!, // db_to_db_copy
  ORCHESTRATION_RULES[0]!, // sql_orchestration_job
  OUTPUT_RULES[0]!, // api_to_db_loader
  INPUT_RULES[1]!, // file_watcher_pipeline
];
