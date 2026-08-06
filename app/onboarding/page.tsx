import { listUserWorkspaces, requireSession } from "@/app/lib/session";
import OnboardingForm from "@/app/components/onboarding-form";

export default async function OnboardingPage() {
  const session = await requireSession();
  const workspaces = await listUserWorkspaces(session.user.id);
  return (
    <main className="auth-shell">
      <OnboardingForm hasWorkspaces={workspaces.length > 0} />
    </main>
  );
}
