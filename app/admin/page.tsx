import type { Metadata } from 'next';
import AdminPanel from '@/components/AdminPanel';

// Fora dos buscadores; a segurança de verdade está nas funções RPC do banco
// (SECURITY DEFINER + is_admin), não em esconder a URL.
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
