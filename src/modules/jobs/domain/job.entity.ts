import type { Job } from "./job.types";

export type JobEntity = Job;

export function createJobEntity(params: {
  id: string;
  name: string;
  version: string;
  path: string;
  description?: string;
  createdAt: Date;
  modifiedAt: Date;
  status: Job["status"];
  components?: Job["components"];
  connections?: Job["connections"];
}): JobEntity {
  return {
    id: params.id,
    name: params.name,
    version: params.version,
    path: params.path,
    description: params.description,
    createdAt: params.createdAt,
    modifiedAt: params.modifiedAt,
    status: params.status,
    components: params.components ?? [],
    connections: params.connections ?? [],
  };
}