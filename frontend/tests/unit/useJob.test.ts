/**
 * Job polling tests (contract Section 7 / 13):
 *  - poll fast (1.5 s) while the job is running
 *  - back off to 4 s after 30 s
 *  - stop polling on a terminal status
 *  - resume polling when the status goes back to a running state
 */
import {
  JOB_POLL_INTERVAL_MS,
  JOB_POLL_INTERVAL_SLOW_MS,
  JOB_POLL_SLOW_AFTER_MS,
  getJobRefetchInterval,
  getTrackedActiveJobs,
  trackActiveJob,
  untrackActiveJob,
} from "@/features/sources/useJob";

const job = (status: string) => ({ status }) as { status: never };

describe("getJobRefetchInterval", () => {
  it("polls every 1.5 s while no data has arrived yet", () => {
    expect(getJobRefetchInterval(undefined, 0)).toBe(JOB_POLL_INTERVAL_MS);
    expect(JOB_POLL_INTERVAL_MS).toBe(1500);
  });

  it("polls every 1.5 s while the job is queued or running", () => {
    expect(getJobRefetchInterval(job("queued"), 0)).toBe(1500);
    expect(getJobRefetchInterval(job("running"), 10_000)).toBe(1500);
  });

  it("backs off to 4 s once the job has been running for more than 30 s", () => {
    expect(getJobRefetchInterval(job("running"), JOB_POLL_SLOW_AFTER_MS + 1)).toBe(
      JOB_POLL_INTERVAL_SLOW_MS,
    );
    expect(JOB_POLL_INTERVAL_SLOW_MS).toBe(4000);
    expect(JOB_POLL_SLOW_AFTER_MS).toBe(30_000);
  });

  it("stops polling when the job succeeded", () => {
    expect(getJobRefetchInterval(job("succeeded"), 0)).toBe(false);
  });

  it("stops polling when the job failed", () => {
    expect(getJobRefetchInterval(job("failed"), 0)).toBe(false);
  });

  it("stops polling when the job was canceled", () => {
    expect(getJobRefetchInterval(job("canceled"), 0)).toBe(false);
  });

  it("resumes polling when the status returns to a running state", () => {
    const interval = getJobRefetchInterval(job("running"), 0);
    expect(interval).toBe(1500);
    expect(interval).not.toBe(false);
  });
});

describe("active job tracking", () => {
  afterEach(() => {
    for (const id of getTrackedActiveJobs()) untrackActiveJob(id);
  });

  it("tracks a job and stops tracking it again", () => {
    trackActiveJob("job-1");
    expect(getTrackedActiveJobs()).toContain("job-1");

    untrackActiveJob("job-1");
    expect(getTrackedActiveJobs()).not.toContain("job-1");
  });

  it("does not track the same job twice", () => {
    trackActiveJob("job-2");
    trackActiveJob("job-2");
    expect(getTrackedActiveJobs().filter((id) => id === "job-2")).toHaveLength(1);
  });
});
