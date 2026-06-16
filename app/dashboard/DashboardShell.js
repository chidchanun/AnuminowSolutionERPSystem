'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FiMenu, FiX } from 'react-icons/fi'
import Sidebar from '../components/Sidebar'
import { UserContext } from '../context/UserContext'

const getHeaderTitle = (pathname) => {
    if (!pathname) return 'Dashboard'

    const normalized = pathname.toLowerCase()

    if (normalized === '/dashboard' || normalized === '/dashboard/') {
        return 'Dashboard'
    }

    // Employee
    if (normalized.startsWith('/dashboard/employee/new')) {
        return 'Create Employee'
    }

    if (normalized.startsWith('/dashboard/employee')) {
        return 'Employee Dashboard'
    }

    // Project
    if (normalized.startsWith('/dashboard/project/gantt')) {
        return 'Project Gantt Chart'
    }

    if (normalized.startsWith('/dashboard/project/new')) {
        return 'Create Project'
    }

    if (/^\/dashboard\/project\/\d+\/edit\/?$/.test(normalized)) {
        return 'Edit Project'
    }

    if (/^\/dashboard\/project\/\d+\/?$/.test(normalized)) {
        return 'Project Detail'
    }

    if (normalized.startsWith('/dashboard/project/my-project')) {
        return 'My Projects'
    }

    if (normalized.startsWith('/dashboard/project')) {
        return 'Project Dashboard'
    }

    // Task
    if (normalized.startsWith('/dashboard/task/new')) {
        return 'Create Task'
    }

    if (/^\/dashboard\/task\/\d+\/edit\/?$/.test(normalized)) {
        return 'Edit Task'
    }

    if (/^\/dashboard\/task\/\d+\/?$/.test(normalized)) {
        return 'Task Detail'
    }

    if (normalized.startsWith('/dashboard/task/list')) {
        return 'All Tasks'
    }

    if (normalized.startsWith('/dashboard/task/my-task')) {
        return 'My Tasks'
    }

    if (normalized.startsWith('/dashboard/task/board')) {
        return 'Kanban Board'
    }

    if (normalized.startsWith('/dashboard/task')) {
        return 'Task Dashboard'
    }

    // Report
    if (normalized.startsWith('/dashboard/report/project')) {
        return 'Project Report'
    }

    if (normalized.startsWith('/dashboard/report/task')) {
        return 'Task Report'
    }

    if (normalized.startsWith('/dashboard/report')) {
        return 'Report Dashboard'
    }

    // Setting
    if (normalized.startsWith('/dashboard/setting/department')) {
        return 'Department Setting'
    }

    if (normalized.startsWith('/dashboard/setting/role')) {
        return 'Role Setting'
    }

    if (normalized.startsWith('/dashboard/setting/permission')) {
        return 'Permission Setting'
    }

    if (normalized.startsWith('/dashboard/setting')) {
        return 'System Setting'
    }

    if (normalized.startsWith('/dashboard/district')) {
        return 'District'
    }

    if (normalized.startsWith('/dashboard/postal')) {
        return 'Postal'
    }

    return 'Dashboard'
}

const getWelcomeText = (pathname) => {
    if (!pathname) return 'ยินดีต้อนรับกลับ'

    const normalized = pathname.toLowerCase()

    if (normalized === '/dashboard' || normalized === '/dashboard/') {
        return 'ระบบแดชบอร์ดภาพรวม'
    }

    // Employee
    if (normalized.startsWith('/dashboard/employee/new')) {
        return 'สร้างข้อมูลพนักงานใหม่'
    }

    if (normalized.startsWith('/dashboard/employee')) {
        return 'ระบบข้อมูลพนักงาน'
    }

    // Project
    if (normalized.startsWith('/dashboard/project/gantt')) {
        return 'แสดงแผนงานและช่วงเวลาของโปรเจกต์'
    }

    if (normalized.startsWith('/dashboard/project/new')) {
        return 'สร้างโปรเจกต์ใหม่'
    }

    if (/^\/dashboard\/project\/\d+\/edit\/?$/.test(normalized)) {
        return 'แก้ไขข้อมูลโปรเจกต์'
    }

    if (/^\/dashboard\/project\/\d+\/?$/.test(normalized)) {
        return 'รายละเอียดโปรเจกต์'
    }

    if (normalized.startsWith('/dashboard/project/my-project')) {
        return 'โปรเจกต์ที่คุณเกี่ยวข้อง'
    }

    if (normalized.startsWith('/dashboard/project')) {
        return 'ระบบข้อมูลโปรเจกต์'
    }

    // Task
    if (normalized.startsWith('/dashboard/task/new')) {
        return 'สร้างงานใหม่'
    }

    if (/^\/dashboard\/task\/\d+\/edit\/?$/.test(normalized)) {
        return 'แก้ไขข้อมูลงาน'
    }

    if (/^\/dashboard\/task\/\d+\/?$/.test(normalized)) {
        return 'รายละเอียดงาน'
    }

    if (normalized.startsWith('/dashboard/task/list')) {
        return 'รายการงานทั้งหมดตามสิทธิ์ผู้ใช้งาน'
    }

    if (normalized.startsWith('/dashboard/task/my-task')) {
        return 'งานที่คุณได้รับมอบหมาย'
    }

    if (normalized.startsWith('/dashboard/task/board')) {
        return 'มุมมองกระดานงาน'
    }

    if (normalized.startsWith('/dashboard/task')) {
        return 'ระบบแดชบอร์ดงาน'
    }

    // Report
    if (normalized.startsWith('/dashboard/report/project')) {
        return 'รายงานข้อมูลโปรเจกต์'
    }

    if (normalized.startsWith('/dashboard/report/task')) {
        return 'รายงานข้อมูลงาน'
    }

    if (normalized.startsWith('/dashboard/report')) {
        return 'ระบบรายงาน'
    }

    // Setting
    if (normalized.startsWith('/dashboard/setting/department')) {
        return 'ตั้งค่าข้อมูลแผนก'
    }

    if (normalized.startsWith('/dashboard/setting/role')) {
        return 'ตั้งค่าข้อมูลตำแหน่ง'
    }

    if (normalized.startsWith('/dashboard/setting/permission')) {
        return 'ตั้งค่าสิทธิ์การใช้งาน'
    }

    if (normalized.startsWith('/dashboard/setting')) {
        return 'ตั้งค่าระบบ'
    }

    if (normalized.startsWith('/dashboard/district')) {
        return 'ระบบข้อมูลอำเภอ'
    }

    if (normalized.startsWith('/dashboard/postal')) {
        return 'ระบบข้อมูลรหัสไปรษณีย์'
    }

    return 'ยินดีต้อนรับกลับ'
}

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
                        <div className="max-lg:pl-12 flex flex-col gap-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{welcomeText}</p>
                            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">{headerTitle}</h1>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </UserContext.Provider>
    )
}
