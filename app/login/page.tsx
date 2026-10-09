export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <p className="sub">For Nikhil and the studio team: shows full names and numbers, and lets you update outcomes.</p>
      <form className="card filters" method="post" action="/api/login" style={{ maxWidth: 420 }}>
        <label htmlFor="pw" style={{ width: "100%" }}>Dashboard password<input id="pw" name="password" type="password" autoComplete="current-password" required style={{ width: "100%" }} aria-describedby={sp.error ? "pw-err" : undefined} /></label>
        {sp.error && <p id="pw-err" role="alert" style={{ color: "var(--declined)", margin: 0 }}>That password didn't match. Try again.</p>}
        <button type="submit">Sign in</button>
      </form>
    </>
  );
}
