import { api, qs } from './client';
import type {
  CreateCustomAnomalyDetectorRequest,
  CustomAnomalyDetectorDto,
  UpdateCustomAnomalyDetectorRequest,
} from './models';

/** CRUD for user-defined LLM-based anomaly detectors (`/api/anomaly-detectors`, Enterprise-gated). */
export const anomalyDetectorsApi = {
  list: (projectId: string) =>
    api.get<CustomAnomalyDetectorDto[]>(`/api/anomaly-detectors${qs({ projectId })}`),
  create: (request: CreateCustomAnomalyDetectorRequest) =>
    api.post<CustomAnomalyDetectorDto>('/api/anomaly-detectors', request),
  update: (id: string, request: UpdateCustomAnomalyDetectorRequest) =>
    api.put<CustomAnomalyDetectorDto>(`/api/anomaly-detectors/${id}`, request),
  delete: (id: string) => api.del(`/api/anomaly-detectors/${id}`),
};
