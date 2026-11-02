import { getJob } from "@/api/endpoints/jobs";
import { queryKeys } from "@/api/queryKeys";
import type { Job } from "@/api/types";
import { useIsOnline } from "@/lib/network";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

// In-memory set of tracked active job ids
const activeTrackedJobIds = new Set<string>();

export function trackActiveJob(jobId: string) {
  activeTrackedJobIds.add(jobId);
}

export function untrackActiveJob(jobId: string) {
  activeTrackedJobIds.delete(jobId);
}

export function getTrackedActiveJobs(): string[] {
  return Array.from(activeTrackedJobIds);
}

/** Contract Section 7: poll quickly at first, then back off. */
export const JOB_POLL_INTERVAL_MS = 1500;
export const JOB_POLL_INTERVAL_SLOW_MS = 4000;
/** After this many milliseconds the slower interval is used. */
export const JOB_POLL_SLOW_AFTER_MS = 30_000;

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);

/**
 * Refetch interval for a job poll.
 *
 * - no data yet            -> poll fast (1.5 s)
 * - terminal job status    -> stop polling (false)
 * - running longer than 30s -> slow down (4 s)
 */
export function getJobRefetchInterval(
  data: Pick<Job, "status"> | undefined,
  elapsedMs: number,
): number | false {
  if (!data) return JOB_POLL_INTERVAL_MS;
  if (TERMINAL_STATUSES.has(data.status)) return false;
  return elapsedMs > JOB_POLL_SLOW_AFTER_MS ? JOB_POLL_INTERVAL_SLOW_MS : JOB_POLL_INTERVAL_MS;
}

export function useJob(jobId: string | null | undefined) {
  const queryClient = useQueryClient();
  const startTimeRef = useRef<number>(Date.now());
  const isOnline = useIsOnline();

  useEffect(() => {
    if (jobId) {
      startTimeRef.current = Date.now();
      trackActiveJob(jobId);
    }
  }, [jobId]);

  const query = useQuery<Job>({
    queryKey: jobId ? queryKeys.job(jobId) : ["job", "null"],
    queryFn: () => getJob(jobId!),
    enabled: Boolean(jobId && isOnline),
    refetchInterval: (queryState) => {
      const data = queryState.state.data;
      const elapsed = Date.now() - startTimeRef.current;
      const interval = getJobRefetchInterval(data, elapsed);
      if (interval === false && jobId) {
        untrackActiveJob(jobId);
      }
      return interval;
    },
  });

  const job = query.data;

  useEffect(() => {
    if (job?.status === "succeeded") {
      if (jobId) untrackActiveJob(jobId);
      queryClient.invalidateQueries({ queryKey: queryKeys.home });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      if (job.result?.sourceId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.source(job.result.sourceId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.sourceText(job.result.sourceId) });
      }
      if (job.result?.materialId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.material(job.result.materialId) });
      }
    } else if (job?.status === "failed" || job?.status === "canceled") {
      if (jobId) untrackActiveJob(jobId);
      queryClient.invalidateQueries({ queryKey: queryKeys.home });
    }
  }, [job?.status, job?.result, jobId, queryClient]);

  return {
    job,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isTerminal:
      job?.status === "succeeded" || job?.status === "failed" || job?.status === "canceled",
  };
}
