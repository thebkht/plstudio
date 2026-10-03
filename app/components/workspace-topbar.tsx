import Link from "next/link";
import BrandMark from "@/app/components/brand-mark";
import NavUser, { type NavUserAccount } from "@/app/components/nav-user";
import WorkspaceSwitcher, { type SwitchableWorkspace } from "@/app/components/workspace-switcher";
import { buttonVariants } from "@/components/ui/button-variants";

/**
 * The shell shared by the dashboard, workspace, and settings pages. Navigation
 * uses next/link styled with buttonVariants rather than LinkButton, which
 * renders a bare anchor and would drop client-side routing.
 *
 * `workspaces` is every workspace the viewer belongs to and `current` the slug
 * of the one on screen (null in the personal space); the switcher is what makes
 * the others reachable, so pass them on every page that has a session.
 *
 * `account` is navigation (workspace settings); `user` is the account menu
 * proper — pass the session user on every page that has one. Omit `account`
 * when the page already offers that destination: the same action twice in one
 * viewport means neither reads as the way to do it.
 */
export default function WorkspaceTopbar({
  links,
  account,
  workspaces,
  current,
  user,
}: {
  links: { href: string; label: string; current?: boolean }[];
  account?: { href: string; label: string };
  workspaces?: SwitchableWorkspace[];
  current?: string | null;
  user?: NavUserAccount | null;
}) {
  return (
    <header className="workspace-topbar">
      <div className="workspace-topbar-lead">
        <Link href="/" aria-label="PLStudio home">
          <BrandMark />
        </Link>
        {workspaces && <WorkspaceSwitcher workspaces={workspaces} current={current} />}
      </div>
      {/* A segmented control, not a row of links: these are sibling views of
          one space. A lone destination is not a choice, so it is not drawn. */}
      {links.length > 1 && (
        <nav className="topbar-segments" aria-label="Sections">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={link.current ? "page" : undefined} className="topbar-segment">
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      <div className="workspace-topbar-trail">
        {account && (
          <Link data-slot="button" href={account.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {account.label}
          </Link>
        )}
        {user && <NavUser user={user} />}
      </div>
    </header>
  );
}
