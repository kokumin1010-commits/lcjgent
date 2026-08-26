import { AlertTriangle, Archive, BadgeCheck, KeyRound, Link2, MailCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type MemberIdentityView = {
  group?: 'verified' | 'claimable' | 'reference';
  identityClass?: string;
  label: string;
  description: string;
  loginMethod?: 'line' | 'email' | 'none';
  linkageBasis?: string;
};

export function MemberIdentityBadge({ identity, compact = false }: { identity?: MemberIdentityView | null; compact?: boolean }) {
  if (!identity) return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700"><AlertTriangle className="mr-1 h-3 w-3" />会員未一致</Badge>;
  const identityClass = identity.identityClass || '';
  if (identityClass === 'verified_member' || identity.group === 'verified') {
    const Icon = identity.loginMethod === 'email' ? MailCheck : BadgeCheck;
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700" title={identity.description}><Icon className="mr-1 h-3 w-3" />{compact ? '確認済み' : identity.label}</Badge>;
  }
  if (identityClass === 'line_claimable_recovery' || identityClass === 'email_claimable_reset' || identity.group === 'claimable') {
    return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800" title={identity.description}><KeyRound className="mr-1 h-3 w-3" />{compact ? '認領待ち' : identity.label}</Badge>;
  }
  if (identityClass === 'unmatched') {
    return <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700" title={identity.description}><AlertTriangle className="mr-1 h-3 w-3" />会員未一致</Badge>;
  }
  return <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700" title={identity.description}>{identity.linkageBasis ? <Link2 className="mr-1 h-3 w-3" /> : <Archive className="mr-1 h-3 w-3" />}{compact ? '参照専用' : identity.label}</Badge>;
}

export function MemberIdentityExplanation({ identity }: { identity?: MemberIdentityView | null }) {
  if (!identity) return null;
  return <div className="rounded-md border bg-white/80 p-3 text-xs"><div className="mb-2"><MemberIdentityBadge identity={identity} /></div><p className="text-muted-foreground">{identity.description}</p>{identity.linkageBasis && <p className="mt-1 font-mono text-[11px] text-muted-foreground">関連根拠: {identity.linkageBasis}</p>}</div>;
}
