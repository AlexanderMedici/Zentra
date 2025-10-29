'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getNotificationPreferences, sendTestNotificationEmail, updateNotificationPreferences } from '@/lib/actions/alerts.actions';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

export default function NotificationPermissionModal({ open, setOpen }: Props) {
  const [emailAllowed, setEmailAllowed] = useState<boolean>(true);
  const [phoneAllowed, setPhoneAllowed] = useState<boolean>(false);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const prefs = await getNotificationPreferences();
      if (prefs) {
        setEmailAllowed(!!prefs.emailAllowed);
        setPhoneAllowed(!!prefs.phoneAllowed);
        setPhoneNumber(prefs.phoneNumber || '');
      }
    })();
  }, [open]);

  const onSave = async () => {
    setLoading(true);
    try {
      const res = await updateNotificationPreferences({ emailAllowed, phoneAllowed, phoneNumber });
      if (!res.success) return toast.error(res.error || 'Failed to save');
      if (emailAllowed) {
        await sendTestNotificationEmail();
      }
      toast.success('Notification preferences updated');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="alert-dialog">
        <DialogHeader>
          <DialogTitle className="alert-title">Allow Notifications</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-gray-400">
            Choose how you want to receive price alerts. You can change this anytime.
          </p>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={emailAllowed} onChange={(e) => setEmailAllowed(e.target.checked)} />
            <span>Email notifications</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={phoneAllowed} onChange={(e) => setPhoneAllowed(e.target.checked)} />
            <span>SMS notifications</span>
          </label>
          {phoneAllowed && (
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" placeholder="+1 555 000 1111" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button onClick={onSave} disabled={loading} className="ml-2">{loading ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

