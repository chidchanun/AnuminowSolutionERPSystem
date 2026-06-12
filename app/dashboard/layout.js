import DashboardShell from './DashboardShell'

export const metadata = {
  title: 'Dashboard | Anuminow Solution ERP',
  description: 'แดชบอร์ดระบบ ERP ของ Anuminow Solution',
  robots: 'index, follow',
}

export default function DashboardLayout({ children }) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  )
}
