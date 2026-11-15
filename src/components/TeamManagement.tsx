import { useEffect, useState, type FormEvent } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Ban,
  BookmarkPlus,
  Check,
  Copy,
  KeyRound,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { roleLabel } from '../lib/firestoreService';
import type {
  Milestone,
  PresenceMember,
  Project,
  ProjectInvite,
  ProjectMember,
  ProjectRole,
  TaskCard,
} from '../types/pm';
import { Avatar } from './Avatar';

interface TeamManagementProps {
  project: Project;
  members: ProjectMember[];
  tasks: TaskCard[];
  milestones: Milestone[];
  presenceMembers: PresenceMember[];
  currentUser: User;
  currentUserRole: ProjectRole;
  onCreateInvite: (params: {
    role: 'admin' | 'member';
    singleUse: boolean;
    maxUses: number;
    expiresInDays: number;
    invitedEmail?: string;
  }) => Promise<string>;
  onRevokeInvite: (code: string) => Promise<void>;
  onUpdateRole: (memberUid: string, role: 'admin' | 'member') => Promise<void>;
  onRemoveMember: (memberUid: string, memberName: string) => Promise<void>;
  onUpdateProjectDetails: (name: string, description: string) => Promise<void>;
  onSaveAsTemplate: (templateName: string, category: string) => Promise<void>;
}

export function TeamManagement({
  project,
  members,
  tasks,
  presenceMembers,
  currentUser,
  currentUserRole,
  onCreateInvite,
  onRevokeInvite,
  onUpdateRole,
  onRemoveMember,
  onUpdateProjectDetails,
  onSaveAsTemplate,
}: TeamManagementProps) {
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [singleUse, setSingleUse] = useState(true);
  const [maxUses, setMaxUses] = useState('5');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [invitedEmail, setInvitedEmail] = useState('');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const [projName, setProjName] = useState(project.name);
  const [projDesc, setProjDesc] = useState(project.description);
  const [savingProj, setSavingProj] = useState(false);

  const [tplName, setTplName] = useState(`${project.name} Template`);
  const [tplCategory, setTplCategory] = useState('Custom');
  const [savingTpl, setSavingTpl] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManageInvites = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';
  const onlineUids = new Set(presenceMembers.map((p) => p.uid));

  useEffect(() => {
    setProjName(project.name);
    setProjDesc(project.description);
    setTplName(`${project.name} Template`);
  }, [project]);

  useEffect(() => {
    if (!canManageInvites) {
      setInvites([]);
      return;
    }
    const q = query(
      collection(db, 'projects', project.id, 'invites'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvites(snap.docs.map((d) => d.data() as ProjectInvite));
      },
      (err) => {
        console.warn('Invites listener warning:', err);
      }
    );
    return () => unsub();
  }, [project.id, canManageInvites]);

  const handleCreateInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setCreatingInvite(true);
    try {
      const code = await onCreateInvite({
        role: inviteRole,
        singleUse,
        maxUses: singleUse ? 1 : Math.max(0, Number(maxUses) || 0),
        expiresInDays: Math.max(1, Number(expiresInDays) || 7),
        invitedEmail: invitedEmail.trim(),
      });
      setGeneratedCode(code);
      setInvitedEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate invite code.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold text-[#3D1023] dark:text-[#FFF5F6] tracking-tight">
            Team, Invitations &amp; Project Settings
          </h2>
          <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] mt-0.5">
            Manage collaborators, cryptographic expiring invitations, role access control, and project templates.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-[12px] border border-[#D94C65]/30 bg-[#D94C65]/10 text-xs text-[#D94C65] dark:text-[#F1BBC8]"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="p-3 rounded-[12px] border border-[#21865B]/30 bg-[#21865B]/10 text-xs text-[#21865B] dark:text-[#5FD09E]"
          >
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <section className="lg:col-span-2 glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
                </div>
                <h3 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                  Collaborators
                </h3>
              </div>
              <span className="font-mono text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                {members.length}
              </span>
            </div>

            <div className="divide-y divide-[#EAD7DE]/70 dark:divide-[#E9A8B8]/12">
              {members.map((m) => {
                const assigned = tasks.filter((t) => t.assigneeUid === m.uid);
                const done = assigned.filter((t) => t.status === 'done').length;
                const isOnline = onlineUids.has(m.uid);
                return (
                  <div
                    key={m.uid}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FCE8EC]/40 dark:hover:bg-[#5B1733]/25 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={m.displayName}
                        photoURL={m.photoURL}
                        size="md"
                        ringColor={isOnline ? '#21865B' : undefined}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-[#3D1023] dark:text-[#FFF5F6] truncate">
                            {m.displayName}
                            {m.uid === currentUser.uid ? ' (You)' : ''}
                          </p>
                          {isOnline && (
                            <span className="text-[11px] text-[#21865B] dark:text-[#5FD09E] font-semibold">
                              Online
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                          {roleLabel(m.role)} · {done}/{assigned.length} tasks done
                        </p>
                      </div>
                    </div>

                    {isOwner && m.uid !== currentUser.uid && m.role !== 'owner' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={m.role}
                          onChange={(e) =>
                            onUpdateRole(m.uid, e.target.value as 'admin' | 'member')
                          }
                          aria-label={`Role for ${m.displayName}`}
                          className="input-blush px-2.5 py-1 text-xs"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => onRemoveMember(m.uid, m.displayName)}
                          title="Remove member"
                          aria-label={`Remove ${m.displayName}`}
                          className="p-1.5 rounded-[10px] text-[#A58C98] hover:text-[#D94C65] hover:bg-[#D94C65]/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-5">
            {canManageInvites && (
              <section className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                    <KeyRound className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                    Create Invitation
                  </h3>
                </div>

                <form onSubmit={handleCreateInvite} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4] mb-1">
                        Role
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                        className="input-blush w-full px-2.5 py-1.5 text-xs"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4] mb-1">
                        Expires (days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={expiresInDays}
                        onChange={(e) => setExpiresInDays(e.target.value)}
                        className="input-blush w-full px-2.5 py-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-[#513443] dark:text-[#F8DDE3] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={singleUse}
                        onChange={(e) => setSingleUse(e.target.checked)}
                        className="rounded border-[#C86B88] accent-[#7A2346]"
                      />
                      <span>Single-use code</span>
                    </label>
                    {!singleUse && (
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        aria-label="Max uses (0 unlimited)"
                        placeholder="Max uses"
                        className="input-blush w-24 px-2 py-1 font-mono text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#795D6B] dark:text-[#D9B7C4] mb-1">
                      Restrict to email (optional)
                    </label>
                    <input
                      type="email"
                      value={invitedEmail}
                      onChange={(e) => setInvitedEmail(e.target.value)}
                      placeholder="teammate@company.com"
                      className="input-blush w-full px-3 py-1.5 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="btn-burgundy w-full py-2 text-xs font-semibold disabled:opacity-60 cursor-pointer"
                  >
                    {creatingInvite ? 'Generating...' : 'Generate 12-Char Invite Code'}
                  </button>
                </form>

                {generatedCode && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-[12px] border border-[#C86B88]/40 bg-[#FCE8EC]/80 dark:bg-[#5B1733]/45">
                    <span className="font-mono text-sm font-bold text-[#7A2346] dark:text-[#F1BBC8] tracking-wider">
                      {generatedCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedCode)}
                      className="btn-blush inline-flex items-center gap-1 px-2.5 py-1 text-xs cursor-pointer"
                    >
                      {copiedCode === generatedCode ? (
                        <Check className="w-3.5 h-3.5 text-[#21865B] dark:text-[#5FD09E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedCode === generatedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                )}

                {invites.length > 0 && (
                  <div className="pt-3 border-t border-[#EAD7DE]/80 dark:border-[#E9A8B8]/15 space-y-2">
                    <p className="text-[11px] font-semibold text-[#795D6B] dark:text-[#D9B7C4] uppercase tracking-wider">
                      Recent Invitations
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {invites.map((inv) => (
                        <div
                          key={inv.code}
                          className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-[12px] border border-[#EAD7DE] dark:border-[#E9A8B8]/16 bg-white/60 dark:bg-[#2A0D19]/45 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-mono font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                              {inv.code}
                            </p>
                            <p className="text-[10px] text-[#795D6B] dark:text-[#D9B7C4] tabular-nums">
                              {inv.role} · uses: {inv.useCount ?? 0}
                              {inv.maxUses ? `/${inv.maxUses}` : ''} ·{' '}
                              {inv.active ? 'Active' : 'Revoked'}
                            </p>
                          </div>
                          {inv.active && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopy(inv.code)}
                                title="Copy invite code"
                                className="p-1 text-[#A58C98] hover:text-[#7A2346] dark:hover:text-[#F1BBC8] cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRevokeInvite(inv.code)}
                                title="Revoke invite"
                                className="p-1 text-[#A58C98] hover:text-[#D94C65] cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {canManageInvites && (
              <section className="glass-card p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                    <Settings className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                    Project Settings
                  </h3>
                </div>
                <input
                  type="text"
                  value={projName}
                  maxLength={80}
                  onChange={(e) => setProjName(e.target.value)}
                  className="input-blush w-full px-3 py-1.5 text-xs"
                />
                <textarea
                  rows={2}
                  value={projDesc}
                  maxLength={500}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="Project description"
                  className="input-blush w-full px-3 py-1.5 text-xs resize-none"
                />
                <button
                  type="button"
                  disabled={savingProj}
                  onClick={async () => {
                    setSavingProj(true);
                    try {
                      await onUpdateProjectDetails(projName, projDesc);
                      setNotice('Project details updated.');
                    } finally {
                      setSavingProj(false);
                    }
                  }}
                  className="btn-blush w-full py-2 text-xs font-semibold cursor-pointer"
                >
                  {savingProj ? 'Saving...' : 'Save Project Settings'}
                </button>
              </section>
            )}

            <section className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[10px] bg-[#FCE8EC] dark:bg-[#8F3157]/35 border border-[#EAD7DE] dark:border-[#E9A8B8]/20 flex items-center justify-center">
                  <BookmarkPlus className="w-3.5 h-3.5 text-[#7A2346] dark:text-[#E9A8B8]" />
                </div>
                <h3 className="font-display text-sm font-semibold text-[#3D1023] dark:text-[#FFF5F6]">
                  Save as Template
                </h3>
              </div>
              <input
                type="text"
                value={tplName}
                maxLength={80}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Template name"
                className="input-blush w-full px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={tplCategory}
                maxLength={40}
                onChange={(e) => setTplCategory(e.target.value)}
                placeholder="Category (e.g. Engineering)"
                className="input-blush w-full px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                disabled={savingTpl || !tplName.trim()}
                onClick={async () => {
                  setSavingTpl(true);
                  try {
                    await onSaveAsTemplate(tplName.trim(), tplCategory.trim() || 'Custom');
                    setNotice('Saved current project structure as a reusable template.');
                  } finally {
                    setSavingTpl(false);
                  }
                }}
                className="btn-burgundy w-full py-2 text-xs font-semibold cursor-pointer disabled:opacity-60"
              >
                {savingTpl ? 'Saving...' : 'Save Reusable Template'}
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
