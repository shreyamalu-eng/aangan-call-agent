import Link from "next/link";
export default function NotFound() {
  return <><h1>Not found</h1><p className="sub">That call doesn't exist or was archived. <Link href="/calls">Back to all calls</Link></p></>;
}
