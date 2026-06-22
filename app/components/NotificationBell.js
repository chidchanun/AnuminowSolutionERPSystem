'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    FiBell,
    FiCheck,
    FiRefreshCw,
    FiX,
} from 'react-icons/fi'
import { io } from 'socket.io-client'

async function requestNotifications(signal) {
    const res = await fetch('/api/v1/notification?limit=10', {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(
            data.error_detail ||
            data.message ||
            'โหลด notification ไม่สำเร็จ'
        )
    }

    return data
}

function formatDateTime(value) {
    if (!value) return '-'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return '-'
    }

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function getTypeLabel(type) {
    switch (type) {
        case 'task_assigned':
            return 'Assign'
        case 'task_comment':
            return 'Comment'
        case 'task_reply':
            return 'Reply'
        case 'task_status_change':
            return 'Status'
        case 'task_due_soon':
            return 'Due Soon'
        default:
            return 'Notification'
    }
}

function getTypeClass(type) {
    switch (type) {
        case 'task_assigned':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
        case 'task_comment':
            return 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
        case 'task_reply':
            return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
        case 'task_status_change':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        case 'task_due_soon':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
}

export default function NotificationBell() {
    const router = useRouter()
    const wrapperRef = useRef(null)

    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const applyNotificationData = (data) => {
        setNotifications(data.notifications || [])
        setUnreadCount(Number(data.unread_count || 0))
        setError('')
    }

    const loadNotifications = async () => {
        try {
            setLoading(true)

            const data = await requestNotifications()

            applyNotificationData(data)
        } catch (error) {
            if (error.name === 'AbortError') {
                return
            }

            console.error(error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        requestNotifications(controller.signal)
            .then((data) => {
                if (ignore) return

                applyNotificationData(data)
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

    useEffect(() => {
        const interval = setInterval(() => {
            requestNotifications()
                .then((data) => {
                    applyNotificationData(data)
                })
                .catch((error) => {
                    if (error.name === 'AbortError') {
                        return
                    }

                    console.error(error)
                })
        }, 30000)

        return () => {
            clearInterval(interval)
        }
    }, [])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target)
            ) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    useEffect(() => {
        const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_URL

        if (!socketUrl) return

        const socket = io(socketUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        })

        socket.on('connect', () => {
            console.log('Socket connected')
        })

        socket.on('connect_error', (error) => {
            console.error('Socket connect error:', error.message)
        })

        socket.on('notification:new', () => {
            requestNotifications()
                .then((data) => {
                    applyNotificationData(data)
                })
                .catch((error) => {
                    console.error(error)
                })
        })

        return () => {
            socket.disconnect()
        }
    }, [])

    const markAllAsRead = async () => {
        try {
            const res = await fetch('/api/v1/notification', {
                method: 'PATCH',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'อ่าน notification ไม่สำเร็จ'
                )
            }

            setUnreadCount(0)

            setNotifications((prev) =>
                prev.map((item) => ({
                    ...item,
                    read_at:
                        item.read_at ||
                        new Date().toISOString(),
                }))
            )
        } catch (error) {
            console.error(error)
            setError(error.message)
        }
    }

    const markOneAsRead = async (notificationId) => {
        try {
            const res = await fetch(
                `/api/v1/notification/${notificationId}/read`,
                {
                    method: 'PATCH',
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'อ่าน notification ไม่สำเร็จ'
                )
            }

            setNotifications((prev) =>
                prev.map((item) =>
                    item.notification_id === notificationId
                        ? {
                            ...item,
                            read_at:
                                item.read_at ||
                                new Date().toISOString(),
                        }
                        : item
                )
            )

            setUnreadCount((prev) =>
                Math.max(prev - 1, 0)
            )
        } catch (error) {
            console.error(error)
            setError(error.message)
        }
    }

    const handleOpenNotification = async (notification) => {
        if (!notification.read_at) {
            await markOneAsRead(notification.notification_id)
        }

        setOpen(false)

        if (notification.link) {
            router.push(notification.link)
        }
    }

    return (
        <div
            ref={wrapperRef}
            className="relative"
        >
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="
                    relative inline-flex h-10 w-10 items-center justify-center
                    rounded-xl border border-slate-200 bg-white text-slate-600
                    hover:bg-slate-100
                    dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300
                    dark:hover:bg-slate-800
                "
            >
                <FiBell className="h-5 w-5" />

                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="
                        absolute right-0 z-50 mt-3 w-[340px] overflow-hidden
                        rounded-2xl border border-slate-200 bg-white shadow-xl
                        dark:border-slate-800 dark:bg-slate-900
                        sm:w-[420px]
                    "
                >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                Notification
                            </h3>

                            <p className="text-xs text-slate-500">
                                ยังไม่ได้อ่าน {unreadCount} รายการ
                            </p>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={loadNotifications}
                                disabled={loading}
                                className="
                                    rounded-lg p-2 text-slate-400
                                    hover:bg-slate-100 hover:text-sky-500
                                    disabled:opacity-50
                                    dark:hover:bg-slate-800
                                "
                            >
                                <FiRefreshCw
                                    className={loading ? 'animate-spin' : ''}
                                />
                            </button>

                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={markAllAsRead}
                                    className="
                                        rounded-lg p-2 text-slate-400
                                        hover:bg-slate-100 hover:text-green-500
                                        dark:hover:bg-slate-800
                                    "
                                    title="อ่านทั้งหมด"
                                >
                                    <FiCheck />
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="
                                    rounded-lg p-2 text-slate-400
                                    hover:bg-slate-100 hover:text-red-500
                                    dark:hover:bg-slate-800
                                "
                            >
                                <FiX />
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="m-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                            {error}
                        </div>
                    )}

                    <div className="max-h-[420px] overflow-y-auto">
                        {loading ? (
                            <div className="p-5 text-center text-sm text-slate-500">
                                กำลังโหลด notification...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-5 text-center text-sm text-slate-500">
                                ยังไม่มี notification
                            </div>
                        ) : (
                            notifications.map((notification) => {
                                const unread =
                                    !notification.read_at

                                return (
                                    <button
                                        key={notification.notification_id}
                                        type="button"
                                        onClick={() =>
                                            handleOpenNotification(notification)
                                        }
                                        className={`
                                            block w-full border-b border-slate-100 p-4 text-left
                                            hover:bg-slate-50
                                            dark:border-slate-800 dark:hover:bg-slate-800/70
                                            ${unread
                                                ? 'bg-sky-50/70 dark:bg-sky-950/20'
                                                : 'bg-white dark:bg-slate-900'
                                            }
                                        `}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1">
                                                <span
                                                    className={`
                                                        inline-flex rounded-full px-2 py-1
                                                        text-[10px] font-semibold
                                                        ${getTypeClass(notification.type)}
                                                    `}
                                                >
                                                    {getTypeLabel(notification.type)}
                                                </span>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-3">
                                                    <p className="line-clamp-2 font-medium text-slate-900 dark:text-white">
                                                        {notification.title}
                                                    </p>

                                                    {unread && (
                                                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                                                    )}
                                                </div>

                                                {notification.message && (
                                                    <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                                                        {notification.message}
                                                    </p>
                                                )}

                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                    <span>
                                                        {formatDateTime(notification.created_at)}
                                                    </span>

                                                    {notification.created_by_name && (
                                                        <>
                                                            <span>·</span>
                                                            <span>
                                                                โดย {notification.created_by_name}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>

                    {notifications.length > 0 && (
                        <div className="border-t border-slate-200 p-3 text-center dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false)
                                    router.push('/dashboard/notification')
                                }}
                                className="text-sm font-medium text-sky-500 hover:text-sky-600"
                            >
                                ดูทั้งหมด
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}