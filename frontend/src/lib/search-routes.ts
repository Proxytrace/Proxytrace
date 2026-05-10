import type { SearchHit } from '../api/search';

export function searchHitToHref(hit: SearchHit): string {
  const id = encodeURIComponent(hit.entityId);
  switch (hit.kind) {
    case 'agent': return `/agents?focus=${id}`;
    case 'testSuite': return `/suites?focus=${id}`;
    case 'agentCall': return `/traces?focus=${id}`;
    case 'evaluator': return `/evaluators?focus=${id}`;
    case 'testCase': return `/suites?testCase=${id}`;
  }
}
