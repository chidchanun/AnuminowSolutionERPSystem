'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'
import {
    canAccessPage,
    getPagePermission,
} from '@/app/lib/pagePermissions'

async function requestPermissions(signal) {
    const res = await fetch('/api/v1/me/permissions', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
        const error = new Error(
            data.message || 'Permission request failed'
        )
        error.status = res.status
        throw error
    }

    return data.permissions || []
}

function GuardLoading() {
    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900 dark:border-slate-800 dark:border-t-slate-100" />
        </div>
    )
}

function AccessDenied({ permissionKey, onRetry }) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    <FiAlertTriangle className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Access denied
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Required permission: {permissionKey}
                </p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                >
                    <FiRefreshCw className="h-4 w-4" />
                    Retry
                </button>
            </div>
        </div>
    )
}

export default function DashboardPageGuard({ children }) {
    const pathname = usePathname()
    const router = useRouter()
    const permissionKey = useMemo(
        () => getPagePermission(pathname),
        [pathname]
    )
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        const controller = new AbortController()

        requestPermissions(controller.signal)
            .then((items) => {
                setPermissions(items)
            })
            .catch((error) => {
                if (error.name === 'AbortError') return

                setPermissions([])

                if (error.status === 401) {
                    router.replace('/login')
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            })

        return () => controller.abort()
    }, [reloadKey, router])

    if (loading) {
        return <GuardLoading />
    }

    if (!canAccessPage(pathname, permissions)) {
        return (
            <AccessDenied
                permissionKey={permissionKey}
                onRetry={() => {
                    setLoading(true)
                    setReloadKey((value) => value + 1)
                }}
            />
        )
    }

    return children
}
