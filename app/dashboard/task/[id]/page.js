'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
    FiArrowLeft,
    FiEdit,
    FiCalendar,
    FiUser,
    FiClock,
    FiFolder,
} from 'react-icons/fi'

const statusLabel = {
    todo: 'Todo',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
}

const priorityLabel = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
}

const actionLabel = {
    create: 'สร้างงาน',
    update: 'แก้ไขงาน',
    assign: 'มอบหมายงาน',
    unassign: 'ยกเลิกการมอบหมาย',
    status_change: 'เปลี่ยนสถานะ',
    comment: 'แสดงความคิดเห็น',
    delete: 'ลบงาน',
}

function getStatusClass(status) {
    switch (status) {
        case 'todo':
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        case 'in_progress':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
        case 'review':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        case 'done':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
        default:
            return 'bg-slate-100 text-slate-700'
    }
}

function getPriorityClass(priority) {
    switch (priority) {
        case 'low':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        case 'medium':
            return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
        case 'high':
            return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
        case 'critical':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        default:
            return 'bg-slate-100 text-slate-700'
    }
}

function formatDate(dateValue) {
    if (!dateValue) return '-'

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(dateValue))
}

function formatDateTime(dateValue) {
    if (!dateValue) return '-'

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(dateValue))
}

function InfoCard({
    icon,
    label,
    value,
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800">
                    {icon}
                </div>

                <div className="min-w-0">
                    <p className="text-xs text-slate-500">
                        {label}
                    </p>

                    <p className="truncate font-medium text-slate-900 dark:text-white">
                        {value}
                    </p>
                </div>
            </div>
        </div>
    )
}

function UserAvatar({
    src,
    name,
}) {
    const initial =
        name?.trim()?.charAt(0) || '?'

    return (
        <div className=" flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full  text-sm font-semibold text-slate-600 bg-slate-300 dark:bg-slate-700 dark:text-slate-300">
            {src ? (
                <Image
                    src={src}
                    alt={name || 'user'}
                    width={48}
                    height={48}
                    className="object-cover"
                />
            ) : (
                initial
            )}
        </div>
    )
}

function getHistoryText(history) {
    if (history.description) {
        return history.description
    }

    if (history.action_type === 'status_change') {
        return `เปลี่ยนสถานะจาก ${history.old_value || '-'} เป็น ${history.new_value || '-'}`
    }

    if (history.action_type === 'assign') {
        return `มอบหมายงานให้ ${history.new_value || '-'}`
    }

    if (history.action_type === 'unassign') {
        return `ยกเลิกการมอบหมาย ${history.old_value || '-'}`
    }

    return actionLabel[history.action_type] || history.action_type
}

export default function TaskDetailPage() {
    const params = useParams()
    const router = useRouter()

    const [task, setTask] = useState(null)
    const [assignees, setAssignees] = useState([])
    const [histories, setHistories] = useState([])
    const [permission, setPermission] = useState({
        can_edit: false,
    })

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        fetch(`/api/v1/task/${params.id}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (res) => {
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(
                        data.error_detail ||
                        data.message ||
                        'โหลดรายละเอียดงานไม่สำเร็จ'
                    )
                }

                return data
            })
            .then((data) => {
                if (ignore) return

                setTask(data.task)
                setAssignees(data.assignees || [])
                setHistories(data.histories || [])
                setPermission(data.permission || {})
                setError('')
            })
            .catch((error) => {
                if (
                    error.name === 'AbortError' ||
                    ignore
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
    }, [params.id])

    console.log(assignees)
    if (loading) {
        return (
            <div className="py-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลดรายละเอียดงาน...
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="py-6">
                <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900 dark:bg-slate-900">
                    <h1 className="text-xl font-semibold text-red-500">
                        ไม่สามารถโหลดรายละเอียดงานได้
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        {error}
                    </p>

                    <button
                        onClick={() => router.back()}
                        className="mt-5 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        กลับ
                    </button>
                </div>
            </div>
        )
    }

    if (!task) {
        return null
    }

    return (
        <div className="flex flex-col gap-6 py-6">

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                    <div className="min-w-0">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-500 cursor-pointer"
                        >
                            <FiArrowLeft />
                            กลับ
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(task.status)}`}>
                                {statusLabel[task.status]}
                            </span>

                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityClass(task.priority)}`}>
                                {priorityLabel[task.priority]}
                            </span>
                        </div>

                        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                            {task.task_name}
                        </h1>

                        <Link
                            href={`/dashboard/project/${task.project_id}`}
                            className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-500"
                        >
                            <FiFolder />
                            {task.project_name}
                            {' '}
                            ({task.project_code})
                        </Link>
                    </div>

                    {permission.can_edit && (
                        <Link
                            href={`/dashboard/task/${task.task_id}/edit`}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-white hover:bg-sky-600 sm:w-auto"
                        >
                            <FiEdit />
                            แก้ไขงาน
                        </Link>
                    )}

                </div>

            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <InfoCard
                    icon={<FiCalendar />}
                    label="วันเริ่มต้น"
                    value={formatDate(task.start_date)}
                />

                <InfoCard
                    icon={<FiCalendar />}
                    label="กำหนดส่ง"
                    value={formatDate(task.due_date)}
                />

                <InfoCard
                    icon={<FiClock />}
                    label="วันที่เสร็จสิ้น"
                    value={formatDateTime(task.completed_at)}
                />

                <InfoCard
                    icon={<FiUser />}
                    label="ผู้สร้าง"
                    value={task.created_by_name}
                />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">

                <div className="xl:col-span-2 space-y-6">

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                        <h2 className="text-lg font-semibold">
                            รายละเอียดงาน
                        </h2>

                        {task.description ? (
                            <div
                                className="
                                    mt-4 rounded-xl text-slate-700 dark:text-slate-200
                                    [&_ul]:list-disc [&_ul]:pl-6
                                    [&_ol]:list-decimal [&_ol]:pl-6
                                    [&_li]:my-1
                                "
                                dangerouslySetInnerHTML={{
                                    __html: task.description,
                                }}
                            />
                        ) : (
                            <p className="mt-4 text-sm text-slate-500">
                                ไม่มีรายละเอียดงาน
                            </p>
                        )}
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                        <h2 className="text-lg font-semibold">
                            ประวัติการทำงาน
                        </h2>

                        <div className="mt-5 space-y-4">
                            {histories.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                                    ยังไม่มีประวัติการทำงาน
                                </div>
                            ) : (
                                histories.map((history) => (
                                    <div
                                        key={history.history_id}
                                        className="flex gap-3 items-center"
                                    >


                                        <div className="min-w-0 flex-1 rounded-xl bg-slate-50 p-3 dark:bg-slate-800 flex flex-row items-center gap-2">
                                            <UserAvatar
                                                src={history.action_by_picture}
                                                name={history.action_by_name}
                                            />
                                            <div>
                                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                    <p className="font-medium">
                                                        {actionLabel[history.action_type] || history.action_type}
                                                    </p>

                                                    <p className="text-xs text-slate-500">
                                                        {formatDateTime(history.created_at)}
                                                    </p>
                                                </div>

                                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                                                    {getHistoryText(history)}
                                                </p>

                                                <p className="mt-2 text-xs text-slate-500">
                                                    โดย {history.action_by_name}
                                                </p>
                                            </div>

                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                </div>

                <div className="space-y-6">

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                        <h2 className="text-lg font-semibold">
                            ผู้รับผิดชอบ
                        </h2>

                        <div className="mt-4 space-y-3">
                            {assignees.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                                    ยังไม่มีผู้รับผิดชอบ
                                </div>
                            ) : (
                                assignees.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
                                    >
                                        <UserAvatar
                                            src={user.picture_path}
                                            name={user.full_name}
                                        />

                                        <div className="min-w-0">
                                            <p className="truncate font-medium">
                                                {user.full_name}
                                            </p>

                                            <p className="truncate text-xs text-slate-500">
                                                {user.role_name || '-'}
                                            </p>

                                            <p className="truncate text-xs text-slate-500">
                                                {user.department_name || '-'}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                        <h2 className="text-lg font-semibold">
                            ข้อมูลเวลา
                        </h2>

                        <div className="mt-4 space-y-3 text-sm">
                            <div className="flex justify-between gap-3">
                                <span className="text-slate-500">
                                    สร้างเมื่อ
                                </span>

                                <span className="text-right">
                                    {formatDateTime(task.created_at)}
                                </span>
                            </div>

                            <div className="flex justify-between gap-3">
                                <span className="text-slate-500">
                                    แก้ไขล่าสุด
                                </span>

                                <span className="text-right">
                                    {formatDateTime(task.updated_at)}
                                </span>
                            </div>

                            <div className="flex justify-between gap-3">
                                <span className="text-slate-500">
                                    สถานะโปรเจกต์
                                </span>

                                <span className="text-right">
                                    {task.project_status}
                                </span>
                            </div>
                        </div>
                    </section>

                </div>

            </div>

        </div>
    )
}