"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/calls", label: "Calls", icon: "phone" },
  { href: "/pipeline", label: "Pipeline", icon: "chart" },
  { href: "/health", label: "Health", icon: "pulse" },
];

const save = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } };

function useIsActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`));
}

function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setTheme(set === "dark" || set === "light" ? set : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const pick = (t: "light" | "dark") => { document.documentElement.dataset.theme = t; save("theme", t); setTheme(t); };
  return (
    <div className="theme-switch" role="group" aria-label="Colour theme">
      <button type="button" aria-pressed={theme === "light"} onClick={() => pick("light")} data-label="Light"><Icon name="sun" /><span className="label">Light</span></button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => pick("dark")} data-label="Dark"><Icon name="moon" /><span className="label">Dark</span></button>
    </div>
  );
}

function NavBody({ onCollapse, collapsed, inSheet, onClose }: { onCollapse?: () => void; collapsed?: boolean; inSheet?: boolean; onClose?: () => void }) {
  const isActive = useIsActive();
  return (
    <>
      <div className="side-top">
        <Link href="/" className="logo" aria-label="Aangan, overview">
          <span className="logo-tile" aria-hidden="true">A</span><span className="logo-text">Aangan</span>
        </Link>
        {onCollapse && (
          <button type="button" className="iconbtn collapse-btn" onClick={onCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
            <Icon name="panel" />
          </button>
        )}
        {inSheet && <button type="button" className="iconbtn" onClick={onClose} aria-label="Close menu"><Icon name="close" /></button>}
      </div>
      <nav aria-label="Main">
        <ul className="navlist">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="navlink" aria-current={isActive(n.href) ? "page" : undefined} data-label={n.label}>
                <Icon name={n.icon} /><span className="label">{n.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="side-foot">
        <Link href="/settings" className="navlink" aria-current={isActive("/settings") ? "page" : undefined} data-label="Settings">
          <Icon name="gear" /><span className="label">Settings</span><Icon name="chevRight" className="i chev" />
        </Link>
        <ThemeSwitch />
      </div>
    </>
  );
}

function SearchForm({ id, inputRef }: { id: string; inputRef?: React.Ref<HTMLInputElement> }) {
  return (
    <form action="/calls" method="get" role="search" className="search">
      <label htmlFor={id} className="visually-hidden">Search calls by locality</label>
      <Icon name="search" />
      <input ref={inputRef} id={id} name="area" type="search" placeholder="Search calls by locality" autoComplete="off" />
    </form>
  );
}

export function Shell({ attention, children }: { attention: number | null; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const path = usePathname();

  useEffect(() => { setCollapsed(document.documentElement.dataset.sidebar === "collapsed"); }, []);
  useEffect(() => { sheet.current?.close(); setSearchOpen(false); }, [path]);
  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.documentElement.dataset.sidebar = "collapsed"; else delete document.documentElement.dataset.sidebar;
    save("sidebar", next ? "collapsed" : null);
  };
  const bellLabel = attention ? `Needs attention: ${attention}` : "Needs attention: none";

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Sidebar">
        <NavBody onCollapse={toggle} collapsed={collapsed} />
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button type="button" className="iconbtn only-phone" aria-label="Open menu" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}><Icon name="menu" /></button>
          <div className="hide-phone" style={{ flex: "0 1 380px", display: "flex" }}><SearchForm id="q-top" /></div>
          <button type="button" className="iconbtn only-phone" aria-label="Search calls" aria-expanded={searchOpen} aria-controls="searchbar" onClick={() => setSearchOpen((o) => !o)}><Icon name="search" /></button>
          <span className="spacer" />
          <Link href="/#attention" className="iconbtn" aria-label={bellLabel}>
            <Icon name="bell" />
            {attention ? <span className="badge" aria-hidden="true">{attention > 99 ? "99+" : attention}</span> : null}
          </Link>
          <div className="me hide-phone"><span className="initials" aria-hidden="true">AS</span><span>Aangan Studio</span></div>
        </header>
        <div id="searchbar" className={`searchbar ${searchOpen ? "open" : ""}`}><SearchForm id="q-phone" inputRef={searchInput} /></div>
        <main id="main" tabIndex={-1}>{children}</main>
      </div>

      <dialog ref={sheet} className="sheet" aria-label="Menu" onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}>
        <NavBody inSheet onClose={() => sheet.current?.close()} />
      </dialog>
    </div>
  );
}
