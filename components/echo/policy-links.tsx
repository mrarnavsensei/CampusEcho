const POLICY_LINKS = [
  ["Privacy", "/community#privacy"],
  ["Terms", "/community#terms"],
  ["Community guidelines", "/community#community-guidelines"],
  ["Retention and deletion", "/community#retention"],
  ["Support", "/community#support"],
] as const;

export function PolicyLinks({ includeAppeals = false, label = "Legal and privacy" }: { includeAppeals?: boolean; label?: string }) {
  const links = includeAppeals ? [...POLICY_LINKS, ["Appeals", "/community#appeals"] as const] : POLICY_LINKS;
  return <nav className="policy-links" aria-label={label}>{links.map(([text, href]) => <a href={href} key={href}>{text}</a>)}</nav>;
}

