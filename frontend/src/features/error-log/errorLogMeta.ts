import { ApplicationErrorLevel } from '../../api/models';

/** Severity → token color for the level tag (amber for Error, red for Critical). */
export const LEVEL_COLOR: Record<ApplicationErrorLevel, string> = {
  [ApplicationErrorLevel.Error]: 'var(--warn)',
  [ApplicationErrorLevel.Critical]: 'var(--danger)',
};
