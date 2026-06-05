import type { PipelineSpec, ValidationResult, ValidatePipelineSpecOptions } from "../domain/pipeline-spec.types";

export class ValidatePipelineSpecUseCase {
  async execute(options: ValidatePipelineSpecOptions): Promise<ValidationResult> {
    const { spec, strict = false } = options;
    const errors: ValidationResult["errors"] = [];
    const warnings: ValidationResult["warnings"] = [];

    if (!spec.name) {
      errors.push({
        path: "name",
        message: "Pipeline spec must have a name",
        code: "MISSING_NAME",
      });
    }

    if (!spec.stages || spec.stages.length === 0) {
      errors.push({
        path: "stages",
        message: "Pipeline spec must have at least one stage",
        code: "NO_STAGES",
      });
    }

    for (const stage of spec.stages ?? []) {
      if (!stage.id) {
        errors.push({
          path: `stages[${stage.name}]`,
          message: "Stage must have an id",
          code: "MISSING_STAGE_ID",
        });
      }
      if (!stage.name) {
        errors.push({
          path: `stages[${stage.id}]`,
          message: "Stage must have a name",
          code: "MISSING_STAGE_NAME",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}