'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    FiBell,
    FiCheck,
    FiCheckCircle,
    FiChevronLeft,
    FiChevronRight,
    FiRefreshCw,
} from 'react-icons/fi'

const PAGE_SIZE = 10

function formatDateTime(date) {
    if (!date) return '-'

    return new Date(date).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

function getNotificationTypeLabel(type) {
    switch (type) {
        case 'task_assigned':
            return 'มอบหมายงาน'
        case 'task_comment':
            return 'Comment'
        case 'task_reply':
            return 'Reply'
        case 'task_status_change':
            return 'เปลี่ยนสถานะงาน'
        case 'task_due_soon':
            return 'งานใกล้ครบกำหนด'
        default:
            return type || 'แจ้งเตือน'
    }
}

async function requestNotifications(signal) {
    const res = await fetch('/api/v1/notification?limit=100', {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.message ||
            'โหลดแจ้งเตือนไม่สำเร็จ'
        )
    }

    return data
}

export default function NotificationPage() {
    const router = useRouter()

    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [filter, setFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const applyData = (data) => {
        const items =
            data.notifications ||
            data.data ||
            []

        setNotifications(items)
        setUnreadCount(Number(data.unread_count || 0))
        setError('')
    }

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        requestNotifications(controller.signal)
            .then((data) => {
                if (ignore) return
                applyData(data)
            })
            .catch((error) => {
                if (
                    ignore ||
                    error.name === 'AbortError'
                ) {
                    return
                }

                console.error(error)
                setError(error.message)
            })
            .finally(() => {
                if (!ignore) {
                    setLoading(false)
                }
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [])

    const reloadNotifications = async () => {
        try {
            setRefreshing(true)
            setError('')

            const data = await requestNotifications()
            applyData(data)
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setRefreshing(false)
        }
    }

    const filteredNotifications = useMemo(() => {
        if (filter === 'unread') {
            return notifications.filter((item) => !item.read_at)
        }

        if (filter === 'read') {
            return notifications.filter((item) => item.read_at)
        }

        return notifications
    }, [notifications, filter])

    const totalPages = Math.max(
        Math.ceil(filteredNotifications.length / PAGE_SIZE),
        1
    )

    const pagedNotifications = useMemo(() => {
        const startIndex =
            (currentPage - 1) * PAGE_SIZE

        return filteredNotifications.slice(
            startIndex,
            startIndex + PAGE_SIZE
        )
    }, [filteredNotifications, currentPage])

    const changeFilter = (nextFilter) => {
        setFilter(nextFilter)
        setCurrentPage(1)
    }

    const markOneAsRead = async (notificationId) => {
        const res = await fetch(
            `/api/v1/notification/${notificationId}/read`,
            {
                method: 'PATCH',
            }
        )

        const data = await res.json()

        if (!res.ok) {
            throw new Error(
                data.message ||
                'อ่านแจ้งเตือนไม่สำเร็จ'
            )
        }
    }

    const markAllAsRead = async () => {
        try {
            setRefreshing(true)
            setError('')

            const res = await fetch('/api/v1/notification', {
                method: 'PATCH',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.message ||
                    'อ่านแจ้งเตือนทั้งหมดไม่สำเร็จ'
                )
            }

            await reloadNotifications()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setRefreshing(false)
        }
    }

    const openNotification = async (notification) => {
        try {
            if (!notification.read_at) {
                await markOneAsRead(notification.notification_id)
            }

            if (notification.link) {
                router.push(notification.link)
                return
            }

            await reloadNotifications()
        } catch (error) {
            console.error(error)
            setError(error.message)
        }
    }

    return (
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">
                            การแจ้งเตือน
                        </h1>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            ดูรายการแจ้งเตือนทั้งหมดของคุณ
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={reloadNotifications}
                            disabled={refreshing}
                            className="
                                inline-flex items-center gap-2 rounded-2xl
                                border border-slate-300 px-4 py-2 text-sm
                                hover:bg-slate-100 disabled:opacity-60
                                dark:border-slate-700 dark:hover:bg-slate-800
                            "
                        >
                            <FiRefreshCw />
                            รีเฟรช
                        </button>

                        <button
                            type="button"
                            onClick={markAllAsRead}
                            disabled={refreshing || unreadCount === 0}
                            className="
                                inline-flex items-center gap-2 rounded-2xl
                                bg-sky-500 px-4 py-2 text-sm text-white
                                hover:bg-sky-600 disabled:opacity-60
                            "
                        >
                            <FiCheckCircle />
                            อ่านทั้งหมด
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                        {error}
                    </div>
                )}

                <section className="grid gap-5 md:grid-cols-3">
                    <button
                        type="button"
                        onClick={() => changeFilter('all')}
                        className={`rounded-3xl border p-5 text-left shadow-sm ${
                            filter === 'all'
                                ? 'border-sky-400 bg-sky-50 dark:bg-sky-950'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        }`}
                    >
                        <p className="text-sm text-slate-500">
                            ทั้งหมด
                        </p>

                        <p className="mt-2 text-3xl font-bold">
                            {notifications.length}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => changeFilter('unread')}
                        className={`rounded-3xl border p-5 text-left shadow-sm ${
                            filter === 'unread'
                                ? 'border-sky-400 bg-sky-50 dark:bg-sky-950'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        }`}
                    >
                        <p className="text-sm text-slate-500">
                            ยังไม่อ่าน
                        </p>

                        <p className="mt-2 text-3xl font-bold">
                            {unreadCount}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() => changeFilter('read')}
                        className={`rounded-3xl border p-5 text-left shadow-sm ${
                            filter === 'read'
                                ? 'border-sky-400 bg-sky-50 dark:bg-sky-950'
                                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        }`}
                    >
                        <p className="text-sm text-slate-500">
                            อ่านแล้ว
                        </p>

                        <p className="mt-2 text-3xl font-bold">
                            {
                                notifications.filter(
                                    (item) => item.read_at
                                ).length
                            }
                        </p>
                    </button>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className="font-semibold">
                                รายการแจ้งเตือน
                            </h2>

                            <p className="text-sm text-slate-500">
                                แสดง {filteredNotifications.length} รายการ
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-950">
                            กำลังโหลดแจ้งเตือน...
                        </div>
                    ) : pagedNotifications.length === 0 ? (
                        <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500 dark:bg-slate-950">
                            <FiBell className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                            ไม่พบแจ้งเตือน
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pagedNotifications.map((notification) => {
                                const unread =
                                    !notification.read_at

                                return (
                                    <button
                                        key={notification.notification_id}
                                        type="button"
                                        onClick={() =>
                                            openNotification(notification)
                                        }
                                        className={`
                                            w-full rounded-2xl border p-4 text-left
                                            transition hover:bg-slate-50
                                            dark:hover:bg-slate-800
                                            ${
                                                unread
                                                    ? 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40'
                                                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                                            }
                                        `}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className={`
                                                    mt-1 flex h-10 w-10 shrink-0
                                                    items-center justify-center rounded-2xl
                                                    ${
                                                        unread
                                                            ? 'bg-sky-500 text-white'
                                                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                                    }
                                                `}
                                            >
                                                {unread ? (
                                                    <FiBell />
                                                ) : (
                                                    <FiCheck />
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold">
                                                        {notification.title}
                                                    </p>

                                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500 dark:bg-slate-800">
                                                        {getNotificationTypeLabel(notification.type)}
                                                    </span>

                                                    {unread && (
                                                        <span className="rounded-full bg-sky-500 px-2 py-1 text-xs text-white">
                                                            ใหม่
                                                        </span>
                                                    )}
                                                </div>

                                                {notification.message && (
                                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                                        {notification.message}
                                                    </p>
                                                )}

                                                <p className="mt-3 text-xs text-slate-400">
                                                    {formatDateTime(notification.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {!loading && filteredNotifications.length > 0 && (
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-500">
                                หน้า {currentPage} / {totalPages}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={currentPage === 1}
                                    onClick={() =>
                                        setCurrentPage((prev) =>
                                            Math.max(prev - 1, 1)
                                        )
                                    }
                                    className="
                                        inline-flex items-center gap-2 rounded-xl
                                        border border-slate-300 px-3 py-2 text-sm
                                        disabled:opacity-50
                                        dark:border-slate-700
                                    "
                                >
                                    <FiChevronLeft />
                                    ก่อนหน้า
                                </button>

                                <button
                                    type="button"
                                    disabled={currentPage === totalPages}
                                    onClick={() =>
                                        setCurrentPage((prev) =>
                                            Math.min(prev + 1, totalPages)
                                        )
                                    }
                                    className="
                                        inline-flex items-center gap-2 rounded-xl
                                        border border-slate-300 px-3 py-2 text-sm
                                        disabled:opacity-50
                                        dark:border-slate-700
                                    "
                                >
                                    ถัดไป
                                    <FiChevronRight />
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                <div>
                    <Link
                        href="/dashboard"
                        className="text-sm text-sky-500 hover:text-sky-600"
                    >
                        กลับ Dashboard
                    </Link>
                </div>
            </div>
        </main>
    )
}