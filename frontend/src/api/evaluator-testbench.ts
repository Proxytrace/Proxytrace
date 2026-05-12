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

export const evaluatorTestBenchApi = {
  load(evaluatorId: string, testCaseId: string): Promise<EvaluatorTestBenchPayloadDto> {
    return api.get<EvaluatorTestBenchPayloadDto>(
      `/api/evaluators/${encodeURIComponent(evaluatorId)}/test-bench/load?testCaseId=${encodeURIComponent(testCaseId)}`,
    );
  },
  run(evaluatorId: string, body: RunEvaluatorOnBenchRequest): Promise<EvaluationResultDto> {
    return api.post<EvaluationResultDto>(
      `/api/evaluators/${encodeURIComponent(evaluatorId)}/test-bench/run`,
      body,
    );
  },
};
