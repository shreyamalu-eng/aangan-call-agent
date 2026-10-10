import Link from "next/link";
export default function NotFound() {
  return (
    <>
      <header className="page-head"><h1>Not found</h1></header>
      <div className="card"><p className="sub">That call doesn't exist or was archived.</p><p><Link href="/calls" className="btn outline">Back to all calls</Link></p></div>
    </>
  );
}
