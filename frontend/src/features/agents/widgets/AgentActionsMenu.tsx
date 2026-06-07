import { useNavigate } from 'react-router-dom';
import { Menu } from '../../../components/ui/Menu';
import { IconButton } from '../../../components/ui/Button';
import { MoreHorizontalIcon, PlayIcon, ActivityIcon, SparklesIcon } from '../../../components/icons';

interface Props {
  agentId: string;
}

export function AgentActionsMenu({ agentId }: Props) {
  const navigate = useNavigate();

  const items = [
    { label: 'Open in playground', icon: <PlayIcon size={13} />, to: `/playground?agentId=${agentId}` },
    { label: 'View traces', icon: <ActivityIcon size={13} />, to: `/traces?agentId=${agentId}` },
    { label: 'View proposals', icon: <SparklesIcon size={13} />, to: `/proposals?agentId=${agentId}` },
  ];

  return (
    <Menu
      trigger={
        <IconButton aria-label="More actions" data-testid="agent-actions-btn">
          <MoreHorizontalIcon size={15} />
        </IconButton>
      }
    >
      {items.map(item => (
        <Menu.Item
          key={item.label}
          icon={<span className="text-muted shrink-0">{item.icon}</span>}
          onSelect={() => navigate(item.to)}
          data-testid={`agent-action-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {item.label}
        </Menu.Item>
      ))}
    </Menu>
  );
}
