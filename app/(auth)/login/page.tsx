import { AuthForm } from '../AuthForm';

export const metadata = { title: 'Sign in · Be Better Everyday' };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { link?: string };
}) {
  // Set by app/auth/callback when a confirmation or OAuth link was stale.
  const notice =
    searchParams.link === 'expired' ? 'That link has already been used. Sign in here.' : undefined;
  return <AuthForm mode="login" notice={notice} />;
}
