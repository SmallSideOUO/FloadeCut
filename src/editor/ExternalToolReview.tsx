import type { AgentContext } from '../agent/context';
import { useExternalAgentBridge } from '../agent/useExternalAgentBridge';
import { ExternalProposalCard } from '../components/chat/ExternalProposalCard';
import type { TimelineState } from './types';
import { theme } from '../theme';
import { useT } from '../i18n/locale';

/** Editor transport and review only. All model reasoning stays in the external client. */
export function ExternalToolReview({ context, projectId, onPreviewState }: {
  context: AgentContext;
  projectId: string;
  onPreviewState: (state: TimelineState | null) => void;
}) {
  const external = useExternalAgentBridge(context, projectId);
  const t = useT();
  const visible = external.proposal || external.pendingGuard || external.error;
  return (
    <aside aria-label={t('外部工具修改審閱')} style={visible ? {
      position: 'absolute', right: 20, top: 60, zIndex: 100,
      width: 'min(440px, calc(100vw - 40px))', maxHeight: 'calc(100vh - 90px)',
      overflow: 'auto', padding: 16, borderRadius: 12,
      border: `1px solid ${theme.border}`, background: theme.panel,
      boxShadow: '0 12px 40px #0006',
    } : { display: 'none' }}>
      <ExternalProposalCard external={external} onPreviewState={onPreviewState} />
    </aside>
  );
}
