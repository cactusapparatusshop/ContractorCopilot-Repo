"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ChevronDown,
  CreditCard,
  FileText,
  HardHat,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

export type WorkspaceShellViewer = {
  name?: string | null;
  email: string;
  initials: string;
  isPlatformAdmin?: boolean;
};

export type WorkspaceShellCompany = {
  name: string;
  notificationsEnabled: boolean;
} | null;

const iconMap = {
  layout: LayoutDashboard,
  hardhat: HardHat,
  file: FileText,
  users: Users,
  credit: CreditCard,
};

const primary = [
  { label: "Overview", href: "/dashboard", icon: "layout" as const },
  { label: "Jobs", href: "/jobs", icon: "hardhat" as const },
  { label: "Proposals", href: "/estimates", icon: "file" as const },
  { label: "Customers", href: "/customers", icon: "users" as const },
  { label: "Billing", href: "/billing", icon: "credit" as const },
];

function isCurrentRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function SidebarNav({ viewer, company, onNavigate }: { viewer: WorkspaceShellViewer; company: WorkspaceShellCompany; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <>
    <Link className="brand" href="/dashboard" onClick={onNavigate}><span className="brand-mark">C</span>ContractorCopilot</Link>
    <div className="sidebar-group">
      <span className="sidebar-label">Workspace</span>
      {primary.map((item) => {
        const Icon = iconMap[item.icon];
        return <Link key={item.label} href={item.href} onClick={onNavigate} className={`nav-link ${isCurrentRoute(pathname, item.href) ? "active" : ""}`}><Icon />{item.label}</Link>;
      })}
    </div>
    <div className="sidebar-group" style={{ marginTop: 22 }}>
      <span className="sidebar-label">Manage</span>
      <Link href="/settings" onClick={onNavigate} className={`nav-link ${isCurrentRoute(pathname, "/settings") ? "active" : ""}`}><Settings />Settings</Link>
      {viewer.isPlatformAdmin && <Link href="/admin" onClick={onNavigate} className={`nav-link ${isCurrentRoute(pathname, "/admin") ? "active" : ""}`}><ShieldCheck />Platform admin</Link>}
    </div>
    <div className="sidebar-bottom">
      <div className="help-card"><b>Need a hand?</b><p>Guided setup makes your next quote the fastest one yet.</p><a href="mailto:support@contractorcopilot.com">Visit help center →</a></div>
      <Link href="/settings" className="user-mini" onClick={onNavigate}><span className="avatar">{viewer.initials}</span><span><b>{viewer.name || viewer.email}</b><small>{company?.name || "Your workspace"}</small></span><ChevronDown size={14} style={{ marginLeft: "auto", color: "#91a7ab" }} /></Link>
    </div>
  </>;
}

export function Sidebar({ viewer, company }: { viewer: WorkspaceShellViewer; company: WorkspaceShellCompany }) {
  return <aside className="sidebar"><SidebarNav viewer={viewer} company={company} /></aside>;
}

function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } finally {
      window.location.assign("/sign-in");
    }
  }

  return <button type="button" className="button button-outline button-sm" onClick={signOut} disabled={pending} aria-label="Log out"><LogOut size={14} />{pending ? "Logging out…" : "Log out"}</button>;
}

function NotificationButton({ initialEnabled }: { initialEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggleNotifications() {
    const next = !enabled;
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ section: "notifications", notificationsEnabled: next }),
      });
      if (!response.ok) throw new Error();
      setEnabled(next);
    } finally {
      setSaving(false);
    }
  }

  return <div style={{ position: "relative" }}>
    <button className="icon-button" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((current) => !current)}><Bell /></button>
    {open && <div className="topbar-popover" role="dialog" aria-label="Notifications">
      <div className="topbar-popover-heading"><b>Notifications</b><button className="button button-ghost button-sm" onClick={() => setOpen(false)}>Close</button></div>
      <p>{enabled ? "You’re all caught up. New proposal activity will appear here." : "Notifications are paused for this workspace."}</p>
      <button type="button" className="button button-outline button-sm" onClick={toggleNotifications} disabled={saving} style={{ width: "100%" }}>{saving ? "Saving…" : enabled ? "Pause notifications" : "Turn on notifications"}</button>
    </div>}
  </div>;
}

export function Topbar({ viewer, company }: { viewer: WorkspaceShellViewer; company: WorkspaceShellCompany }) {
  const [open, setOpen] = useState(false);
  return <>
    <header className="topbar">
      <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></button>
      <label className="search-box"><Search size={15} /><input aria-label="Search" placeholder="Search jobs, customers, or proposals…" /><kbd>⌘ K</kbd></label>
      <div className="topbar-actions"><NotificationButton initialEnabled={company?.notificationsEnabled ?? true} /><span className="topbar-user" title={viewer.email}><span className="avatar">{viewer.initials}</span><span>{viewer.name || "Account"}</span></span><SignOutButton /><Link href="/jobs/new" className="button button-primary button-sm"><Plus size={15} /> New proposal</Link></div>
    </header>
    {open && <div className="mobile-drawer" role="dialog" aria-modal="true"><div className="mobile-drawer-panel"><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close navigation" style={{ position: "absolute", top: 18, right: 16 }}><X /></button><SidebarNav viewer={viewer} company={company} onNavigate={() => setOpen(false)} /><div style={{ marginTop: "auto", padding: 12 }}><SignOutButton /></div></div><button className="mobile-drawer-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} /></div>}
  </>;
}

export function AppShell({ children, viewer, company }: { children: React.ReactNode; viewer: WorkspaceShellViewer; company: WorkspaceShellCompany }) {
  return <div className="app-shell"><Sidebar viewer={viewer} company={company} /><section className="workspace"><Topbar viewer={viewer} company={company} /><main className="workspace-content">{children}</main></section></div>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  return <div className="page-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="page-actions">{children}</div>}</div>;
}

export function MiniProductMark() {
  return <span className="proposal-brand"><i>C</i>ContractorCopilot</span>;
}

export function JobIcon() {
  return <BriefcaseBusiness size={16} />;
}

export function HelpLink() {
  return <a className="text-link" href="mailto:support@contractorcopilot.com"><HelpCircle size={13} style={{ verticalAlign: "-2px" }} /> Get help</a>;
}
