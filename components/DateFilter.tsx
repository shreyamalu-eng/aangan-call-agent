"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "./icons";

/** "Filter by date" dropdown. Each option is a plain link that sets from/to in the URL. Esc or a click outside closes it. */
export function DateFilter({ current, options }: { current: string; options: { label: string; href: string }[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && el.open) { el.open = false; el.querySelector("summary")?.focus(); } };
    const onClick = (e: MouseEvent) => { if (el.open && !el.contains(e.target as Node)) el.open = false; };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick); };
  }, []);
  return (
    <details className="menu" ref={ref} key={current}>
      <summary aria-label={`Filter by date: ${current}`}><span>{current === "All time" ? "Filter by date" : current}</span><Icon name="chevDown" /></summary>
      <ul className="menu-pop">
        {options.map((o) => (
          <li key={o.label}>
            <Link href={o.href} aria-current={o.label === current ? "true" : undefined} onClick={() => { if (ref.current) ref.current.open = false; }}>
              {o.label}{o.label === current && <span aria-hidden="true">✓</span>}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
