import { getUserAlerts } from '@/lib/actions/alerts.actions';
import AlertsManager from '@/components/AlertsManager';

export default async function AlertsPage() {
  const alerts = await getUserAlerts();
  return (
    <section className="watchlist">
      <AlertsManager initialAlerts={alerts as any} />
    </section>
  );
}

