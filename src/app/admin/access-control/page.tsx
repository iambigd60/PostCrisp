"use client";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type SignupMode = "open" | "invite" | "closed";

interface AccessControl {
  signup_mode: SignupMode;
  invite_code: string | null;
  login_enabled: boolean;
}

const MODE_META: Record<SignupMode, { label: string; description: string; color: string }> = {
  open:   { label: "Open",        description: "Anyone can sign up.",                              color: "text-emerald-300" },
  invite: { label: "Invite-only", description: "New users must enter a valid invite code.",         color: "text-brand-300"   },
  closed: { label: "Closed",      description: "No new signups. Existing users unaffected.",        color: "text-red-300"     },
};

export default function AdminAccessControlPage() {
  const [data, setData] = useState<AccessControl | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<SignupMode>("open");
  const [inviteCode, setInviteCode] = useState("");
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<AccessControl>("/api/admin/access-control");
        setData(res);
        setMode(res.signup_mode);
        setInviteCode(res.invite_code ?? "");
        setLoginEnabled(res.login_enabled);
      } catch (err) {
        addToast(err instanceof ApiError ? err.message : "Failed to load settings", "error");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (update: () => void) => { update(); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<{ ok: true; settings: AccessControl }>("/api/admin/access-control", {
        method: "PATCH",
        body: JSON.stringify({
          signup_mode: mode,
          invite_code: mode === "invite" ? inviteCode.trim() : null,
          login_enabled: loginEnabled,
        }),
      });
      setData(res.settings);
      setDirty(false);
      addToast("Access control settings saved", "success");
    } catch (err) {
      addToast(err instanceof ApiError ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!data) {
    return <div className="text-zinc-500">Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Access Control</h1>
        <p className="text-zinc-500 mt-1">Control who can sign up and log in. Changes take effect immediately.</p>
      </div>

      {/* Signup mode */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-1">Signup mode</h2>
        <p className="text-xs text-zinc-500 mb-4">Choose how new users get into PostCrisp.</p>

        <div className="space-y-3">
          {(Object.keys(MODE_META) as SignupMode[]).map((m) => {
            const meta = MODE_META[m];
            const selected = mode === m;
            return (
              <label
                key={m}
                className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  selected
                    ? "bg-surface-tertiary border-brand-500/40"
                    : "border-brand-500/10 hover:border-brand-500/20"
                }`}
              >
                <input
                  type="radio"
                  name="signup_mode"
                  value={m}
                  checked={selected}
                  onChange={() => onChange(() => setMode(m))}
                  className="mt-0.5 accent-brand-500"
                />
                <div>
                  <div className={`text-sm font-semibold ${meta.color}`}>{meta.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{meta.description}</div>
                </div>
              </label>
            );
          })}
        </div>

        {mode === "invite" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-3 text-xs text-brand-200/90">
              <strong className="block text-brand-200 mb-0.5">🎟️ Single-use codes recommended</strong>
              For beta tester rollout, generate one-time codes at <a href="/admin/invite-codes" className="underline hover:text-brand-100">Invite Codes</a> instead of using a shared code below. One-time codes consume on signup, so testers can&apos;t share them around.
            </div>

            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Shared invite code (legacy)
            </label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => onChange(() => setInviteCode(e.target.value))}
              placeholder="Leave blank to require single-use codes only"
              className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 px-4 py-2 text-sm focus:outline-none focus:border-brand-500/40 font-mono"
            />
            <p className="text-xs text-zinc-600 mt-1.5">
              Optional. A single shared code anyone can paste — fine for in-person events, but not for beta testers who might share it. Single-use codes always work in addition to this.
            </p>
          </div>
        )}
      </div>

      {/* Login toggle */}
      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-200 mb-1">Existing user logins</h2>
            <p className="text-xs text-zinc-500">
              When disabled, existing users see a maintenance message on the login page. Admin accounts (role = admin) always bypass this.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange(() => setLoginEnabled(!loginEnabled))}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
              loginEnabled ? "bg-emerald-500/70" : "bg-red-500/50"
            }`}
            aria-pressed={loginEnabled}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                loginEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <div className="mt-3 text-xs">
          {loginEnabled ? (
            <span className="text-emerald-300">✓ Logins enabled</span>
          ) : (
            <span className="text-red-300">⚠ Logins disabled (non-admins)</span>
          )}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">
          {dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <Button onClick={save} disabled={!dirty || saving} loading={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {/* Warning block */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/80">
        <strong className="block text-amber-200 mb-1">One-time Supabase setup</strong>
        For these controls to be airtight, make sure public signups are disabled in
        Supabase → Auth → Providers → Email → &quot;Enable new users to sign up&quot; unchecked.
        This forces all signup attempts through the app&apos;s gated flow.
      </div>
    </div>
  );
}
