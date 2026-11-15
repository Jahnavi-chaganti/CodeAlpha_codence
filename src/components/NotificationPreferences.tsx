import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import {
  DEFAULT_NOTIFICATION_PREFS,
  type NotificationPreference,
} from '../types/pm';
import {
  loadNotificationPreferences,
  saveNotificationPreferences,
} from '../lib/notificationService';

interface NotificationPreferencesProps {
  uid: string;
  onClose: () => void;
  onSaved?: (prefs: NotificationPreference) => void;
}

export function NotificationPreferences({
  uid,
  onClose,
  onSaved,
}: NotificationPreferencesProps) {
  const [prefs, setPrefs] = useState<NotificationPreference>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadNotificationPreferences(uid).then((loaded) => {
      if (active) {
        setPrefs(loaded);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [uid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveNotificationPreferences(uid, prefs);
      onSaved?.(prefs);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#2A0D19]/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notification preferences"
        className="relative z-10 w-full max-w-md glass-strong rounded-[20px] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#EAD7DE] dark:border-[#E9A8B8]/15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 text-[#7A2346] dark:text-[#F1BBC8] flex items-center justify-center">
              <BellRing className="w-4 h-4" />
            </div>
            <h2 className="font-display text-sm font-bold text-[#3D1023] dark:text-[#FFF5F6]">
              Notification Preferences
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="p-1.5 rounded-[10px] text-[#795D6B] hover:text-[#7A2346] hover:bg-[#FCE8EC] dark:text-[#D9B7C4] dark:hover:text-white dark:hover:bg-[#8F3157]/30 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] py-4">
              Loading saved preferences...
            </p>
          ) : (
            <div className="space-y-2.5">
              {[
                {
                  key: 'all' as const,
                  label: 'Enable workspace notifications',
                  desc: 'Master toggle for real-time toasts and inbox alerts.',
                },
                {
                  key: 'assignments' as const,
                  label: 'Task assignments & reassignments',
                  desc: 'Notify when a task is assigned or transferred to you.',
                },
                {
                  key: 'mentions' as const,
                  label: '@Mentions & comment replies',
                  desc: 'Notify when teammates tag you or reply on your tasks.',
                },
                {
                  key: 'reminders' as const,
                  label: 'Deadline & overdue reminders',
                  desc: 'Daily alerts for tasks due within 48 hours or past due.',
                },
                {
                  key: 'projectActivity' as const,
                  label: 'Project & sprint updates',
                  desc: 'Notify on member joins, sprint starts, and status moves.',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start justify-between gap-3 p-3.5 rounded-[14px] border border-[#EAD7DE] dark:border-[#E9A8B8]/18 bg-white/70 dark:bg-[#3D1023]/55 hover:bg-[#FCE8EC]/70 dark:hover:bg-[#5B1733]/55 hover:border-[#C86B88]/40 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    disabled={item.key !== 'all' && !prefs.all}
                    onChange={(e) =>
                      setPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-[#EAD7DE] dark:border-[#E9A8B8]/30 text-[#7A2346] accent-[#7A2346] focus:ring-[#C86B88]"
                  />
                </label>
              ))}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-blush px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleSave}
              className="btn-burgundy px-4 py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
