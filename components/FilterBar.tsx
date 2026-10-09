import Link from "next/link";
import { STATUS_LABEL } from "./ui";

/** Plain GET form: filters live in the URL, so views are shareable and the back button works. */
export function FilterBar({ f, base }: { f: Record<string, string>; base: string }) {
  const active = ["outcome", "from", "to", "area", "tests"].some((k) => f[k]);
  return (
    <form className="filters card" method="get" action={base} aria-label="Filters">
      <label htmlFor="f-outcome">Outcome
        <select id="f-outcome" name="outcome" defaultValue={f.outcome ?? ""}>
          <option value="">All</option>
          {Object.entries(STATUS_LABEL).filter(([k]) => k !== "new").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label htmlFor="f-area">Locality
        <input id="f-area" name="area" defaultValue={f.area ?? ""} placeholder="e.g. Baner" />
      </label>
      <label htmlFor="f-from">From<input id="f-from" type="date" name="from" defaultValue={f.from ?? ""} /></label>
      <label htmlFor="f-to">To<input id="f-to" type="date" name="to" defaultValue={f.to ?? ""} /></label>
      <label htmlFor="f-tests" style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 44 }}>
        <input id="f-tests" type="checkbox" name="tests" value="1" defaultChecked={f.tests === "1"} style={{ minHeight: 0 }} /> Include replays
      </label>
      <button type="submit">Apply</button>
      {active && <Link className="btn secondary" href={base}>Clear filters</Link>}
    </form>
  );
}
