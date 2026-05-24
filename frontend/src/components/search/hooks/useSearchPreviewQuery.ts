import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../../../api/agents';
import { agentCallsApi } from '../../../api/agent-calls';
import { testCasesApi } from '../../../api/test-cases';
import { testSuitesApi } from '../../../api/test-suites';
import { evaluatorsApi } from '../../../api/evaluators';
import type {
  AgentCallDto, AgentDto, EvaluatorDetailDto, TestCaseDto, TestSuiteDto,
} from '../../../api/models';

const PREVIEW_STALE_TIME = 60_000;

// Each hook returns the standard TanStack Query result shape.
// The `enabled` flag is derived from having a non-empty id.

export function useAgentCallPreview(id: string) {
  return useQuery<AgentCallDto>({
    queryKey: ['search-preview', 'agentCall', id],
    queryFn: () => agentCallsApi.get(id),
    enabled: !!id,
    staleTime: PREVIEW_STALE_TIME,
  });
}

export function useTestCasePreview(id: string) {
  return useQuery<TestCaseDto>({
    queryKey: ['search-preview', 'testCase', id],
    queryFn: () => testCasesApi.get(id),
    enabled: !!id,
    staleTime: PREVIEW_STALE_TIME,
  });
}

export function useAgentPreview(id: string) {
  return useQuery<AgentDto>({
    queryKey: ['search-preview', 'agent', id],
    queryFn: () => agentsApi.get(id),
    enabled: !!id,
    staleTime: PREVIEW_STALE_TIME,
  });
}

export function useTestSuitePreview(id: string) {
  return useQuery<TestSuiteDto>({
    queryKey: ['search-preview', 'testSuite', id],
    queryFn: () => testSuitesApi.get(id),
    enabled: !!id,
    staleTime: PREVIEW_STALE_TIME,
  });
}

export function useEvaluatorPreview(id: string) {
  return useQuery<EvaluatorDetailDto>({
    queryKey: ['search-preview', 'evaluator', id],
    queryFn: () => evaluatorsApi.get(id),
    enabled: !!id,
    staleTime: PREVIEW_STALE_TIME,
  });
}
