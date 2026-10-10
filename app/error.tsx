"use client";
import Link from "next/link";

/** Any page that throws lands here: say what failed and offer a retry. */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <header className="page-head"><h1>Something went wrong</h1></header>
      <div className="card">
        <p className="banner bad" role="alert">This page couldn't load. {error.message ? error.message.slice(0, 160) : ""}</p>
        <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={reset}>Retry</button>
          <Link className="btn outline" href="/health">Check health</Link>
        </div>
      </div>
    </>
  );
}
