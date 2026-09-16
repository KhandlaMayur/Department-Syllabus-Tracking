import PageContainer from '../../components/layout/PageContainer';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';

/**
 * Phase 1 dashboards are intentionally placeholders — the goal of this
 * phase is the shell (auth, layout, routing), not the syllabus-tracking
 * features themselves. Each role page reuses this component with its
 * own copy so Phase 2 can drop real widgets in without touching routing.
 */
export default function DashboardPlaceholder({ title, subtitle, emptyTitle, emptyMessage }) {
  const { user } = useAuth();

  return (
    <PageContainer title={title} subtitle={subtitle}>
      <div className="card">
        <p className="text-muted" style={{ marginTop: 0 }}>
          Welcome back, <strong style={{ color: 'var(--color-text)' }}>{user?.name}</strong>.
        </p>
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </div>
    </PageContainer>
  );
}
