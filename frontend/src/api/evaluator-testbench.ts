import { api } from './client';
import type { EvaluationResultDto, EvaluationScore, TestSuiteMessageDto } from './models';

export interface EvaluatorTestBenchPayloadDto {
  sourceTestResultId: string;
  testCaseId: string;
  testCaseSummary: string;
  conversation: TestSuiteMessageDto[];
  expectedResponse: string;
  actualResponse: string;
  /** This evaluator's logged verdict on the source test result, when one exists. */
  loggedEvaluation: EvaluationResultDto | null;
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
  /** This evaluator's logged score on the recent result, when one exists. */
  score: EvaluationScore | null;
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
