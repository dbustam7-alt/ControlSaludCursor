import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { PatientProvider } from '@/contexts/PatientContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Control de Salud - Gestión y Control Médico Familiar',
  description: 'Coordina de forma sencilla e inteligente el historial médico, recetas, citas y órdenes de laboratorio de tu familia.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${plusJakartaSans.variable}`}>
      <body className="font-sans antialiased text-slate-900 bg-slate-50 min-h-screen">
        <AuthProvider>
          <WorkspaceProvider>
            <PatientProvider>
              {children}
            </PatientProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
