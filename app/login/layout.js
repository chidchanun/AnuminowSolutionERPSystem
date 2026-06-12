import { Metadata } from 'next'

export const metadata = {
    title: 'เข้าสู่ระบบ | Anuminow Solution ERP',
    description: 'เข้าสู่ระบบ Anuminow Solution ERP System สำหรับพนักงาน',
    robots: 'index, follow',
    openGraph: {
        title: 'เข้าสู่ระบบ | Anuminow Solution ERP',
        description: 'เข้าสู่ระบบ Anuminow Solution ERP System',
        type: 'website',
    },
}

export function generateViewport() {
    return {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 5,
    }
}

export default function LoginLayout({ children }) {
    return children
}
