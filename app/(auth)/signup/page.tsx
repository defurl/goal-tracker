import { AuthForm } from '../AuthForm';

export const metadata = { title: 'Create an account · Be Better Everyday' };

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
