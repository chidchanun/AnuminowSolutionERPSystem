'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FiMenu, FiX } from 'react-icons/fi'
import Sidebar from '../components/Sidebar'
import { UserContext } from '../context/UserContext'
import NotificationBell from '../components/NotificationBell'
import { getHeaderTitle, getWelcomeText } from '../lib/HeaderText'


export default function DashboardShell({ children, user }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const headerTitle = getHeaderTitle(pathname)
    const welcomeText = getWelcomeText(pathname)


    const handleLogout = async () => {
        try {
            const res = await fetch('/api/v1/auth/logout', {
                method: 'POST',
                credentials: 'include',
            })

            if (res.ok) {
                router.push('/login')
                return
            }

            const data = await res.json()
            console.error('Logout failed:', data)
        } catch (err) {

        }
    }

    return (
        <UserContext.Provider value={user}>
            <div className="flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ">
                <button
                    type="button"
                    aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    aria-expanded={sidebarOpen}
                    onClick={() => setSidebarOpen((prev) => !prev)}
                    className={`${sidebarOpen ? 'hidden' : 'cursor-pointer fixed top-4 left-4 z-30 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/30 transition hover:bg-slate-900 lg:hidden'}`}
                >
                    {sidebarOpen ? <FiX className="h-5 w-5 hidden" /> : <FiMenu className="h-5 w-5 " />}
                </button>

                <div
                    className={`fixed inset-0 z-20 bg-slate-950/60 transition-opacity lg:hidden ${sidebarOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
                    onClick={() => setSidebarOpen(false)}
                />

                <Sidebar sidebarOpen={sidebarOpen} onLogout={handleLogout} onClose={() => setSidebarOpen(false)} user={user} />
                <div className="flex flex-col w-screen min-h-screen py-2 px-10 max-md:px-4 overflow-hidden">
                    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90  py-4 backdrop-blur backdrop-saturate-150 max-md:px-4">
                        <div className="max-lg:pl-12 flex flex-col gap-2 max-md:gap-1">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{welcomeText}</p>
                            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">{headerTitle}</h1>
                        </div>
                        <NotificationBell />
                    </div>
                    {children}
                </div>
            </div>
        </UserContext.Provider>
    )
}
