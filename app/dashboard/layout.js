import DashboardShell from './DashboardShell'
import { cookies } from 'next/headers'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export const metadata = {
  title: 'Dashboard | Anuminow Solution ERP',
  description: 'แดชบอร์ดระบบ ERP ของ Anuminow Solution',
  robots: 'index, follow',
}

export default async function DashboardLayout({ children }) {

  const cookieStore = await cookies()

  const token =
    cookieStore.get('accessToken')?.value

  const user = token
    ? safeVerifyToken(token)
    : null
  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  )
}
