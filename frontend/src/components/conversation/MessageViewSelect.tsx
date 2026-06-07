import { FilterDropdown } from '../ui/FilterDropdown';
import { MESSAGE_VIEWS, MESSAGE_VIEW_LABEL, type MessageView } from './messageView';

interface Props {
  value: MessageView;
  onChange: (view: MessageView) => void;
}

const OPTIONS = MESSAGE_VIEWS.map(view => ({ key: view, label: MESSAGE_VIEW_LABEL[view] }));

/**
 * Header dropdown for switching a message bubble's content view between RAW, JSON, Markdown,
 * and HTML. Uses the app's compact FilterDropdown so it matches the toolbar selects rather than
 * a heavyweight form control.
 */
export function MessageViewSelect({ value, onChange }: Props) {
  return (
    <span data-testid="message-view-select">
      <FilterDropdown
        label=""
        value={value}
        options={OPTIONS}
        onChange={key => onChange(key as MessageView)}
        align="right"
        width={130}
      />
    </span>
  );
}
