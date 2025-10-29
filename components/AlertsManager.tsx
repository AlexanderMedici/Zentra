'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toggleAlertActive, deleteAlertById, getNotificationPreferences } from '@/lib/actions/alerts.actions';
import NotificationPermissionModal from '@/components/NotificationPermissionModal';
import { toast } from 'sonner';

type AlertItem = {
  id: string;
  symbol: string;
  company: string;
  alertName: string;
  alertType: 'upper' | 'lower';
  threshold: number;
  active?: boolean;
  createdAt?: Date;
};

export default function AlertsManager({ initialAlerts }: { initialAlerts: AlertItem[] }) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts || []);
  const [permOpen, setPermOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const prefs = await getNotificationPreferences();
      if (!prefs || (!prefs.emailAllowed && !prefs.phoneAllowed)) {
        setPermOpen(true);
      }
    })();
  }, []);

  const onToggle = async (id: string, _current?: boolean) => {
    const prevActive = alerts.find((a) => a.id === id)?.active ?? false;
    const next = !prevActive;
    // Optimistic update for only this alert
    setAlerts((list) => list.map((a) => (a.id === id ? { ...a, active: next } : a)));
    try {
      const res = await toggleAlertActive(id, next);
      if (!res.success) {
        // Revert only this alert on failure
        setAlerts((list) => list.map((a) => (a.id === id ? { ...a, active: prevActive } : a)));
        toast.error(res.error || 'Failed to update');
      }
    } catch (e) {
      // Revert only this alert on exception
      setAlerts((list) => list.map((a) => (a.id === id ? { ...a, active: prevActive } : a)));
      toast.error('Failed to update');
    }
  };

  const onDelete = async (id: string) => {
    const prev = alerts;
    setAlerts((list) => list.filter((a) => a.id !== id));
    const res = await deleteAlertById(id);
    if (!res.success) {
      toast.error(res.error || 'Failed to delete');
      setAlerts(prev);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="watchlist-title">My Alerts</h2>
        <Button className="add-alert" onClick={() => setPermOpen(true)}>Notification Settings</Button>
      </div>
      {alerts.length === 0 ? (
        <div className="alert-empty">You have no alerts yet.</div>
      ) : (
        <div className="alert-list">
          {alerts.map((a) => (
            <div key={a.id} className="alert-item">
              <div className="alert-details">
                <div>
                  <div className="alert-name">{a.alertName}</div>
                  <div className="text-sm text-gray-400">{a.company} • {a.symbol} • {a.alertType === 'upper' ? 'Price above' : 'Price below'} {a.threshold}</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span>Active</span>
                    {/* Simple checkbox as switch to avoid adding extra deps */}
                    <input type="checkbox" checked={!!a.active} onChange={() => onToggle(a.id, a.active)} />
                  </label>
                  <Button variant="ghost" onClick={() => onDelete(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <NotificationPermissionModal open={permOpen} setOpen={setPermOpen} />
    </div>
  );
}
