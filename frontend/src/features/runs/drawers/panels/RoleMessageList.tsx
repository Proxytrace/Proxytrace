import type { TestCaseMessageFixtureDto } from '../../../../api/models';
import { ConversationView } from '../../../../components/conversation/ConversationView';
import { fromFixtureInput } from '../../../../components/conversation/adapters';

/** Renders fixture input messages via the shared conversation renderer. */
export function RoleMessageList({ messages }: { messages: TestCaseMessageFixtureDto[] }) {
  return <ConversationView messages={fromFixtureInput(messages)} />;
}
