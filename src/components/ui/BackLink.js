import Link from 'next/link';

/** The one "back" link used on every detail and form screen. */
export default function BackLink({ href, children }) {
  return <Link href={href} className="nxt-back">{children}</Link>;
}
