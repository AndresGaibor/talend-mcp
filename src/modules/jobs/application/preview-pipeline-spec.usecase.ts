import type { PipelineSpec, PreviewPipelineSpecOptions } from "../domain/pipeline-spec.types";
import type { JobComponent, JobConnection } from "../domain/job.types";

export type PipelinePreview = {
  spec: PipelineSpec;
  transformedComponents: JobComponent[];
  transformedConnections: JobConnection[];
  defaultsApplied: boolean;
};

export class PreviewPipelineSpecUseCase {
  async execute(options: PreviewPipelineSpecOptions): Promise<PipelinePreview> {
    const { spec, includeUnsetDefaults = true } = options;
    const transformedComponents: JobComponent[] = [];
    const transformedConnections: JobConnection[] = [];

    for (const stage of spec.stages ?? []) {
      for (const component of stage.components ?? []) {
        transformedComponents.push({
          ...component,
          position: component.position ?? { x: 0, y: 0 },
          configuration: includeUnsetDefaults
            ? { ...component.configuration }
            : component.configuration,
        });
      }

      for (const connection of stage.connections ?? []) {
        transformedConnections.push(connection);
      }
    }

    return {
      spec,
      transformedComponents,
      transformedConnections,
      defaultsApplied: includeUnsetDefaults,
    };
  }
}