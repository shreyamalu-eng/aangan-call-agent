import Link from "next/link";
import { STATUS_LABEL } from "./ui";

/** Plain GET form: filters live in the URL, so views are shareable and the back button works. Locality comes from the card's search box. */
export function FilterBar({ f, base }: { f: Record<string, string>; base: string }) {
  const active = ["outcome", "from", "to", "area", "tests"].some((k) => f[k]);
  return (
    <form className="filters" method="get" action={base} aria-label="Filters">
      {f.area && <input type="hidden" name="area" value={f.area} />}
      <label htmlFor="f-outcome">Outcome
        <select id="f-outcome" name="outcome" defaultValue={f.outcome ?? ""}>
          <option value="">All outcomes</option>
          {Object.entries(STATUS_LABEL).filter(([k]) => k !== "new").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label htmlFor="f-from">From<input id="f-from" type="date" name="from" defaultValue={f.from ?? ""} /></label>
      <label htmlFor="f-to">To<input id="f-to" type="date" name="to" defaultValue={f.to ?? ""} /></label>
      <label htmlFor="f-tests" className="check">
        <input id="f-tests" type="checkbox" name="tests" value="1" defaultChecked={f.tests === "1"} /> Include replays
      </label>
      <button type="submit" className="btn sm">Apply</button>
      {active && <Link className="btn outline sm" href={base}>Clear filters</Link>}
    </form>
  );
}
