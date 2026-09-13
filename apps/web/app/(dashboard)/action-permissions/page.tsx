'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  ApiError,
  actionPermissionsApi,
  type ActionPermission,
  type ActionPermissionMode,
} from '@/lib/api';

export default function ActionPermissionsPage() {
  const [permissions, setPermissions] = useState<ActionPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    actionPermissionsApi
      .list()
      .then(setPermissions)
      .catch(() => setError('Could not load your action settings.'))
      .finally(() => setLoading(false));
  }, []);

  const setMode = async (toolName: string, mode: ActionPermissionMode) => {
    setSaving(toolName);
    setError(null);

    // Optimistic: the toggle should feel instant, and a failure puts it back.
    const previous = permissions;
    setPermissions((prev) =>
      prev.map((p) => (p.name === toolName ? { ...p, mode, isDefault: false } : p)),
    );

    try {
      await actionPermissionsApi.setMode(toolName, mode);
    } catch (err) {
      setPermissions(previous);
      setError(err instanceof ApiError ? err.message : 'Could not save that setting.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="pb-4 text-white">
      <h1 className="text-3xl font-bold">Action permissions</h1>
      <p className="mt-2 text-sm text-white/60">
        Decide which actions Zoorzio carries out on its own and which it should check with you
        first. Anything set to <span className="text-white">Ask me</span> pauses and waits for your
        approval &mdash; on WhatsApp that arrives as a Yes/No message.
      </p>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <div className="mt-5 space-y-3">
        {permissions.map((permission) => (
          <div key={permission.name} className="dashboard-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">{permission.label}</p>
                <p className="mt-0.5 text-xs text-white/50">{permission.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ModeButton
                  label="Automatic"
                  active={permission.mode === 'AUTO'}
                  disabled={saving === permission.name}
                  onClick={() => setMode(permission.name, 'AUTO')}
                />
                <ModeButton
                  label="Ask me"
                  active={permission.mode === 'CONFIRM'}
                  disabled={saving === permission.name}
                  onClick={() => setMode(permission.name, 'CONFIRM')}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-card mt-5 flex gap-3 p-4">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-white/50" />
        <p className="text-xs text-white/50">
          These settings are enforced by Zoorzio itself, not by the assistant. No message or
          instruction can talk it into skipping an approval you have asked for.
        </p>
      </div>
    </div>
  );
}

function ModeButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || active}
      className={
        active
          ? 'dashboard-pill active px-3 py-1.5 text-xs'
          : 'dashboard-pill px-3 py-1.5 text-xs disabled:opacity-50'
      }
    >
      {label}
    </button>
  );
}
