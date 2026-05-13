import { api } from './client';
import type { EvaluationResultDto, TestSuiteMessageDto } from './models';

export interface EvaluatorTestBenchPayloadDto {
  sourceTestResultId: string;
  testCaseId: string;
  testCaseSummary: string;
  conversation: TestSuiteMessageDto[];
  expectedResponse: string;
  actualResponse: string;
}

export interface RunEvaluatorOnBenchRequest {
  testCaseId: string;
  actualResponseOverride: string | null;
}

export interface EvaluatorTestBenchDefaultDto {
  testCaseId: string | null;
  label: string | null;
}

export interface EvaluatorTestBenchRecentItemDto {
  testCaseId: string;
  label: string;
}

export const evaluatorTestBenchApi = {
  load(evaluatorId: string, testCaseId: string): Promise<EvaluatorTestBenchPayloadDto> {
    return api.get<EvaluatorTestBenchPayloadDto>(
      `/api/evaluators/${encodeURIComponent(evaluatorId)}/test-bench/load?testCaseId=${encodeURIComponent(testCaseId)}`,
    );
  },
  default(evaluatorId: string): Promise<EvaluatorTestBenchDefaultDto> {
    return api.get<EvaluatorTestBenchDefaultDto>(
      `/api/evaluators/${encodeURIComponent(evaluatorId)}/test-bench/default`,
    );
  },
  recent(evaluatorId: string, count: number): Promise<EvaluatorTestBenchRecentItemDto[]> {
    return api.get<EvaluatorTestBenchRecentItemDto[]>(
      `/api/evaluators/${encodeURIComponent(evaluatorId)}/test-bench/recent?count=${count}`,
    );
  },
  run(evaluatorId: string, body: RunEvaluatorOnBenchRequest): Promise<EvaluationResultDto> {
    return api.post<EvaluationResultDto>(
      `/api/evaluators/${encodeURIComponent(evaluatorId)}/test-bench/run`,
      body,
    );
  },
};
