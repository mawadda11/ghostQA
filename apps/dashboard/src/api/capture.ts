import type { CaptureSession } from "@ghostqa/shared";

import { apiClient } from "./client.js";

export const startCapture = (projectId: string): Promise<CaptureSession> =>
  apiClient.request<CaptureSession>(
    `/api/projects/${encodeURIComponent(projectId)}/capture/start`,
    { method: "POST" },
  );

export const getCapture = (captureId: string): Promise<CaptureSession> =>
  apiClient.request<CaptureSession>(
    `/api/capture/${encodeURIComponent(captureId)}`,
  );

export const stopCapture = (captureId: string): Promise<CaptureSession> =>
  apiClient.request<CaptureSession>(
    `/api/capture/${encodeURIComponent(captureId)}/stop`,
    { method: "POST" },
  );

export const cancelCapture = (captureId: string): Promise<CaptureSession> =>
  apiClient.request<CaptureSession>(
    `/api/capture/${encodeURIComponent(captureId)}/cancel`,
    { method: "POST" },
  );

