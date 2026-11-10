import Link from "next/link";
import { DEMO_BANNER_TEXT, isDemoMode } from "@/lib/editions/demo-mode";

type FooterLink = { href: string; label: string };

/**
 * The ONE footer of an Edition. The organiser's identity leads; beside it, the Edition's secondary pages (anything the organiser has not put in the main navigation, such as
 * "About this concept" or "Image credits", and the Journal archive) and the way back to other Editions. Beneath, understated: "Powered by OneShetland" and OneShetland's
 * legal links. On a demonstration deployment the disclosure is repeated here. The full OneShetland site footer is not drawn on Edition pages (HideOnEditionPages).
 */
export function EditionFooter({ organiser, links, about = [], hub }: { organiser: { name: string; slug: string }; links: FooterLink[]; about?: FooterLink[]; hub?: { name: string; href: string } | null }) {
  return (
    <footer className="ed-foot">
      <div className="ed-wrap ed-foot__in">
        <div>
          <p className="ed-eyebrow" style={{ color: "var(--ed-glow)" }}>Presented by</p>
          <p className="ed-foot__org" style={{ margin: "0.6rem 0 0" }}>
            <Link href={`/organisers/${organiser.slug}`} style={{ textDecoration: "none" }}>{organiser.name}</Link>
          </p>
          {hub && <p className="ed-small" style={{ margin: "0.7rem 0 0", maxWidth: "34ch", color: "var(--ed-on-deep)" }}>A community Hub on OneShetland: <Link href={hub.href} style={{ color: "inherit" }}>{hub.name}</Link></p>}
        </div>
        {about.length > 0 && (
          <nav aria-label="About this Edition" className="ed-foot__col">
            <p className="ed-eyebrow" style={{ color: "var(--ed-glow)", margin: 0 }}>This Edition</p>
            <ul>{about.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}</ul>
          </nav>
        )}
        <nav aria-label="More from this organiser" className="ed-foot__col">
          <p className="ed-eyebrow" style={{ color: "var(--ed-glow)", margin: 0 }}>More</p>
          <ul>{links.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}</ul>
        </nav>
      </div>
      {isDemoMode() && <div className="ed-foot__demo"><div className="ed-wrap"><p style={{ margin: 0 }}>{DEMO_BANNER_TEXT}</p></div></div>}
      <div className="ed-foot__base">
        <div className="ed-wrap">
          <Link href="/editions" className="ed-powered">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.2" /></svg>
            <span>Powered by <b>OneShetland</b></span>
          </Link>
          <nav aria-label="OneShetland" className="ed-foot__legal">
            <Link href="/">OneShetland.com</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Support</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
