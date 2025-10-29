'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createAlert } from '@/lib/actions/alerts.actions';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  symbol: string;
  company: string;
};

export default function AlertModal({ open, setOpen, symbol, company }: Props) {
  const [alertName, setAlertName] = useState<string>('Price Alert');
  const [alertType, setAlertType] = useState<'upper' | 'lower'>('upper');
  const [threshold, setThreshold] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!threshold.trim()) return toast.error('Please enter a threshold');
    setSubmitting(true);
    try {
      const res = await createAlert({ symbol, company, alertName, alertType, threshold });
      if (res.success) {
        toast.success('Alert created');
        setOpen(false);
      } else {
        toast.error(res.error || 'Failed to create alert');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="alert-dialog">
        <DialogHeader>
          <DialogTitle className="alert-title">Create Alert</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="alert-company">{company}</div>
            <div className="font-mono text-gray-300">{symbol}</div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="alertName">Alert name</Label>
            <Input id="alertName" value={alertName} onChange={(e) => setAlertName(e.target.value)} placeholder="My Alert" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as 'upper' | 'lower')}
                className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-200"
              >
                <option value="upper">Price above</option>
                <option value="lower">Price below</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="threshold">Threshold (USD)</Label>
              <Input
                id="threshold"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="100.00"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting} className="ml-2">
            {submitting ? 'Saving…' : 'Create Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

