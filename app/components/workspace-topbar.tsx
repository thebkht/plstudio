import Link from "next/link";
import BrandMark from "@/app/components/brand-mark";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";

/**
 * The shell shared by the dashboard, workspace, and settings pages. Navigation
 * uses next/link styled with buttonVariants rather than LinkButton, which
 * renders a bare anchor and would drop client-side routing.
 */
export default function WorkspaceTopbar({
  links,
  account,
}: {
  links: { href: string; label: string }[];
  account: { href: string; label: string };
}) {
  return (
    <header className="workspace-topbar">
      <Link href="/" aria-label="PLStudio home">
        <BrandMark />
      </Link>
      <Separator orientation="vertical" className="h-6" />
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
