import { InviteCreateForm } from './components/InviteCreateForm';
import { InvitesTable } from './components/InvitesTable';
import { useInvites } from './hooks/useInvites';

export default function Invites() {
  const { data, isLoading } = useInvites();

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-h1 font-semibold">Invites</h1>
      <InviteCreateForm />
      <InvitesTable invites={data ?? []} loading={isLoading} />
    </div>
  );
}
