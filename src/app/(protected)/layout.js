import AppLayout from '@/components/layout/AppLayout';

export default function ProtectedLayout({ children }) {
  return <AppLayout>{children}</AppLayout>;
}
