export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <>
      <header className="page-head"><div><h1>Sign in</h1><p className="sub">For Nikhil and the studio team: shows full names and numbers, and lets you update outcomes.</p></div></header>
      <form className="card" method="post" action="/api/login" style={{ maxWidth: 440 }}>
        <label htmlFor="pw" style={{ display: "grid", gap: 8 }}>Dashboard password<input id="pw" name="password" type="password" autoComplete="current-password" required aria-describedby={sp.error ? "pw-err" : undefined} /></label>
        {sp.error && <p id="pw-err" role="alert" className="banner bad">That password didn't match. Try again.</p>}
        <button type="submit" className="btn block">Sign in</button>
      </form>
    </>
  );
}
