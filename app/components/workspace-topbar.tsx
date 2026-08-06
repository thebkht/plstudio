import Link from "next/link";
import BrandMark from "@/app/components/brand-mark";
import WorkspaceSwitcher, { type SwitchableWorkspace } from "@/app/components/workspace-switcher";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";

/**
 * The shell shared by the dashboard, workspace, and settings pages. Navigation
 * uses next/link styled with buttonVariants rather than LinkButton, which
 * renders a bare anchor and would drop client-side routing.
 *
 * `workspaces` is every workspace the viewer belongs to and `current` the slug
 * of the one on screen (null in the personal space); the switcher is what makes
 * the others reachable, so pass them on every page that has a session.
 */
export default function WorkspaceTopbar({
  links,
  account,
  workspaces,
  current,
}: {
  links: { href: string; label: string }[];
  account: { href: string; label: string };
  workspaces?: SwitchableWorkspace[];
  current?: string | null;
}) {
  return (
    <header className="workspace-topbar">
      <Link href="/" aria-label="PLStudio home">
        <BrandMark />
      </Link>
      <Separator orientation="vertical" className="h-6" />
      {workspaces && <WorkspaceSwitcher workspaces={workspaces} current={current} />}
      <nav className="flex items-center gap-1">
        {links.map((link) => (
          <Link
            data-slot="button"
            key={link.href}
            href={link.href}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Link
        data-slot="button"
        href={account.href}
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "ml-auto",
        })}
      >
        {account.label}
      </Link>
    </header>
  );
}
