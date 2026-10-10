/** Loading placeholders in the shape of the real cards. */
const Bar = ({ w = "100%", h = 14 }: { w?: string | number; h?: number }) => <span className="skel" style={{ display: "block", width: w, height: h }} />;

export function SkelCard({ lines = 3, chart = false }: { lines?: number; chart?: boolean }) {
  return (
    <div className="card" aria-hidden="true">
      <Bar w="40%" h={18} />
      {chart ? <Bar h={220} /> : Array.from({ length: lines }, (_, i) => <Bar key={i} w={`${90 - i * 12}%`} />)}
    </div>
  );
}

export function SkelKpi() {
  return (
    <div className="card kpi" aria-hidden="true">
      <div className="kpi-head"><span className="skel" style={{ width: 40, height: 40, borderRadius: 10 }} /><Bar w="50%" /></div>
      <Bar w="40%" h={34} />
    </div>
  );
}

export function SkelPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <header className="page-head"><h1>{title}</h1></header>
      <p className="visually-hidden" role="status">Loading…</p>
      {children}
    </>
  );
}

export function SkelTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card" aria-hidden="true">
      <Bar w="25%" h={20} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", height: 56 }}>
          <span className="skel" style={{ width: 40, height: 40, borderRadius: "50%", flex: "none" }} />
          <Bar w="30%" /><Bar w="15%" /><Bar w="20%" />
        </div>
      ))}
    </div>
  );
}
