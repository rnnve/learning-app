import { apiClient } from "../client";
import type { Job } from "../types";

export async function getJob(id: string): Promise<Job> {
  const response = await apiClient.get<Job>(`/jobs/${id}`);
  return response.data;
}

export async function getActiveJobs(): Promise<{ items: Job[] }> {
  const response = await apiClient.get<{ items: Job[] }>("/jobs", {
    params: { active: true },
  });
  return response.data;
}

export async function retryJob(id: string): Promise<Job> {
  const response = await apiClient.post<Job>(`/jobs/${id}/retry`);
  return response.data;
}

export async function cancelJob(id: string): Promise<Job> {
  const response = await apiClient.post<Job>(`/jobs/${id}/cancel`);
  return response.data;
}
