'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
    FiChevronDown,
    FiLogOut,
    FiX,
} from 'react-icons/fi'
import { navGroups } from '../lib/navitems'
import AnuminowLogo from '../../public/AnuminowSolutionLogoNoBG.png'

const allNavItems = navGroups.flatMap((group) => group.items)

async function requestUserPermissions(signal) {
    const res = await fetch('/api/v1/me/permissions', {
        cache: 'no-store',
        credentials: 'include',
        signal,
    })

    const contentType = res.headers.get('content-type') || ''

    if (!contentType.includes('application/json')) {
        const text = await res.text()

        console.error('Permission API returned non-JSON:', {
            status: res.status,
            url: res.url,
            body: text.slice(0, 300),
        })

        throw new Error(
            `Permission API ไม่ได้ส่ง JSON กลับมา status ${res.status}`
        )
    }

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ')
    }

    return data.permissions || []
}

export default function Sidebar({
    sidebarOpen,
    onLogout,
    onClose,
    user,
}) {
    const pathname = usePathname()

    const logoSrc = user?.picture_path || AnuminowLogo

    const [permissionKeys, setPermissionKeys] = useState([])
    const [permissionLoading, setPermissionLoading] = useState(true)

    const [openMenus, setOpenMenus] = useState(() => {
        const initialState = {}

        allNavItems.forEach((item) => {
            if (
                item.subMenu &&
                (
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`)
                )
            ) {
                initialState[item.label] = true
            }
        })

        return initialState
    })

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestUserPermissions(controller.signal)
            .then((permissions) => {
                if (ignore) return
                setPermissionKeys(permissions)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return

                console.error('Load sidebar permissions error:', err)
                setPermissionKeys([])
            })
            .finally(() => {
                if (ignore) return
                setPermissionLoading(false)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [])

    const permissionSet = useMemo(
        () => new Set(permissionKeys),
        [permissionKeys]
    )

    const hasPermission = (item) => {
        if (!item.permissionKey) return true

        return permissionSet.has(item.permissionKey)
    }

    const filterVisibleSubMenus = (subMenu = []) => {
        return subMenu.filter((sub) => hasPermission(sub))
    }

    const canViewItem = (item) => {
        if (hasPermission(item)) return true

        if (item.subMenu?.length) {
            return filterVisibleSubMenus(item.subMenu).length > 0
        }

        return false
    }

    const toggleMenu = (label) => {
        setOpenMenus((prev) => ({
            ...prev,
            [label]: !prev[label],
        }))
    }

    const isParentActive = (item) => {
        if (item.subMenu?.length) {
            return (
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`)
            )
        }

        return pathname === item.href
    }

    return (
        <aside
            className={`
                fixed inset-y-0 left-0 z-20
                flex h-screen w-72 flex-col
                overflow-hidden
                transform
                border-r border-slate-200 bg-white py-6 px-4
                transition-transform duration-300
                dark:border-slate-800 dark:bg-slate-900
                lg:sticky lg:top-0 lg:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
            aria-label="Sidebar"
        >
            <div className="mb-6 flex shrink-0 items-center justify-between gap-3 lg:justify-start">
                <div className="flex items-center gap-3">
                    <div className="relative h-12 w-12 overflow-hidden rounded-2xl bg-sky-100 shadow-sm dark:bg-sky-900/40">
                        <Image
                            src={logoSrc}
                            alt="Logo"
                            width={100}
                            height={100}
                            className="h-auto w-auto object-contain"
                            priority
                        />
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            Anuminow Solution
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            ERP Dashboard
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
                    aria-label="Close sidebar"
                >
                    <FiX className="h-5 w-5" />
                </button>
            </div>

            <nav className="sidebar-scroll min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                {permissionLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-11 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                            />
                        ))}
                    </div>
                ) : (
                    navGroups.map((group) => {
                        const visibleItems = group.items.filter(canViewItem)

                        if (visibleItems.length === 0) return null

                        return (
                            <div key={group.label} className="space-y-1">
                                <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    {group.label}
                                </p>

                                {visibleItems.map((item) => {
                                    const Icon = item.icon
                                    const activeParent = isParentActive(item)
                                    const visibleSubMenus = filterVisibleSubMenus(
                                        item.subMenu
                                    )
                                    const hasSubMenu = visibleSubMenus.length > 0

                                    return (
                                        <div key={item.label}>
                                            {hasSubMenu ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleMenu(item.label)}
                                                    className={`
                                                        flex w-full cursor-pointer items-center justify-between
                                                        rounded-2xl px-4 py-3 text-sm font-medium
                                                        transition-colors
                                                        ${
                                                            activeParent
                                                                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                                                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Icon className="h-5 w-5" />
                                                        <span>{item.label}</span>
                                                    </div>

                                                    <FiChevronDown
                                                        className={`
                                                            transition-transform
                                                            ${openMenus[item.label] ? 'rotate-180' : ''}
                                                        `}
                                                    />
                                                </button>
                                            ) : (
                                                <Link
                                                    href={item.href}
                                                    onClick={onClose}
                                                    className={`
                                                        inline-flex w-full items-center gap-3
                                                        rounded-2xl px-4 py-3 text-sm font-medium
                                                        transition-colors
                                                        ${
                                                            activeParent
                                                                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                                                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                                                        }
                                                    `}
                                                >
                                                    <Icon className="h-5 w-5" />
                                                    <span>{item.label}</span>
                                                </Link>
                                            )}

                                            {hasSubMenu && openMenus[item.label] && (
                                                <div className="mt-2 flex flex-col gap-1 pl-12">
                                                    {visibleSubMenus.map((sub) => {
                                                        const activeSub =
                                                            pathname === sub.href

                                                        return (
                                                            <Link
                                                                key={sub.label}
                                                                href={sub.href}
                                                                onClick={onClose}
                                                                className={`
                                                                    rounded-2xl px-4 py-2 text-sm
                                                                    transition-colors
                                                                    ${
                                                                        activeSub
                                                                            ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100'
                                                                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                                                                    }
                                                                `}
                                                            >
                                                                {sub.label}
                                                            </Link>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })
                )}
            </nav>

            <div className="mt-4 shrink-0 border-t border-slate-200 pt-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <FiLogOut className="h-4 w-4" />
                    ออกจากระบบ
                </button>
            </div>
        </aside>
    )
}