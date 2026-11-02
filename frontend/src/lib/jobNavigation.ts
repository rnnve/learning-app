import type { Job } from "@/api/types";

export function getJobTarget(
  job: Job,
): `/material/${string}` | `/source/${string}` | "/(tabs)/history" {
  const materialId = job.result?.materialId ?? job.materialId;
  if (materialId) return `/material/${materialId}`;
  const sourceId = job.result?.sourceId ?? job.sourceId;
  return sourceId ? `/source/${sourceId}` : "/(tabs)/history";
}
