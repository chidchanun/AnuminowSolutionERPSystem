'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import {
    FiArrowLeft,
    FiBriefcase,
    FiCheckSquare,
    FiEdit,
    FiMail,
    FiTrash2,
    FiUser,
    FiX,
} from 'react-icons/fi'

function formatDate(value) {
    if (!value) return '-'

    return new Date(value).toLocaleDateString('th-TH', {
        dateStyle: 'medium',
    })
}

function getStatusLabel(status) {
    switch (status) {
        case 'active':
            return 'ทำงานอยู่'
        case 'inactive':
            return 'ปิดใช้งาน'
        case 'resigned':
            return 'ลาออก'
        default:
            return status || '-'
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'active':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
        case 'inactive':
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        case 'resigned':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
}

function getPriorityLabel(priority) {
    switch (priority) {
        case 'low':
            return 'ต่ำ'
        case 'medium':
            return 'กลาง'
        case 'high':
            return 'สูง'
        case 'critical':
            return 'เร่งด่วน'
        default:
            return priority || '-'
    }
}

function getTaskStatusLabel(status) {
    switch (status) {
        case 'todo':
            return 'รอดำเนินการ'
        case 'in_progress':
            return 'กำลังทำ'
        case 'review':
            return 'ตรวจสอบ'
        case 'done':
            return 'เสร็จแล้ว'
        default:
            return status || '-'
    }
}

function fullNameTh(employee) {
    return `${employee.prefix || ''}${employee.first_name_th || ''} ${employee.last_name_th || ''}`.trim()
}

function fullNameEn(employee) {
    return `${employee.first_name_en || ''} ${employee.last_name_en || ''}`.trim()
}

export default function EmployeeDetailPage() {
    const params = useParams()
    const router = useRouter()
    const employeeId = params?.id

    const [employee, setEmployee] = useState(null)
    const [projects, setProjects] = useState([])
    const [tasks, setTasks] = useState([])
    const [activities, setActivities] = useState([])
    const [permission, setPermission] = useState({
        can_edit: false,
        can_delete: false,
    })

    const [loading, setLoading] = useState(true)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        fetch(`/api/v1/employee/${employeeId}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (res) => {
                const data = await res.json()

                if (!res.ok) {
                    throw new Error(
                        data.error_detail ||
                        data.message ||
                        'โหลดข้อมูลพนักงานไม่สำเร็จ'
                    )
                }

                return data
            })
            .then((data) => {
                if (ignore) return

                setEmployee(data.employee)
                setProjects(data.projects || [])
                setTasks(data.tasks || [])
                setActivities(data.activities || [])
                setPermission(data.permission || {})
                setError('')
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
    }, [employeeId])

    const deleteEmployee = async () => {
        if (!employee) return

        try {
            setDeleting(true)
            const res = await fetch(
                `/api/v1/employee/${employee.id}`,
                {
                    method: 'DELETE',
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'ลบพนักงานไม่สำเร็จ'
                )
            }

            router.push('/dashboard/employee')
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                <div className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
                    กำลังโหลดข้อมูลพนักงาน...
                </div>
            </main>
        )
    }

    if (error || !employee) {
        return (
            <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
                <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                    {error || 'ไม่พบข้อมูลพนักงาน'}
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-50 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <Link
                            href="/dashboard/employee"
                            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600"
                        >
                            <FiArrowLeft />
                            กลับหน้าพนักงาน
                        </Link>

                        <h1 className="mt-2 text-2xl font-bold">
                            รายละเอียดพนักงาน
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {permission.can_edit && (
                            <Link
                                href={`/dashboard/employee/${employee.id}/edit`}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                            >
                                <FiEdit />
                                แก้ไข
                            </Link>
                        )}

                        {permission.can_delete && (
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                            >
                                <FiTrash2 />
                                ลบพนักงาน
                            </button>
                        )}
                    </div>
                </div>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-4xl font-bold text-slate-500 dark:bg-slate-800">
                            {employee.picture_path ? (
                                <Image
                                    src={employee.picture_path}
                                    alt={fullNameTh(employee)}
                                    width={112}
                                    height={112}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <FiUser />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-bold">
                                    {fullNameTh(employee)}
                                </h2>

                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(employee.status)}`}
                                >
                                    {getStatusLabel(employee.status)}
                                </span>
                            </div>

                            <p className="mt-1 text-slate-500">
                                {fullNameEn(employee) || '-'}
                            </p>

                            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                                    <p className="text-slate-400">Email</p>
                                    <p className="mt-1 flex items-center gap-2 font-medium">
                                        <FiMail />
                                        {employee.email || '-'}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                                    <p className="text-slate-400">แผนก</p>
                                    <p className="mt-1 font-medium">
                                        {employee.department_name || '-'}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                                    <p className="text-slate-400">ตำแหน่ง</p>
                                    <p className="mt-1 font-medium">
                                        {employee.role_name || '-'}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                                    <p className="text-slate-400">วันที่สร้าง</p>
                                    <p className="mt-1 font-medium">
                                        {formatDate(employee.created_at)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-2">
                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <FiBriefcase className="text-sky-500" />
                            <h3 className="font-semibold">
                                Project ที่เกี่ยวข้อง
                            </h3>
                        </div>

                        {projects.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                ไม่พบ Project
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {projects.map((project) => (
                                    <Link
                                        key={project.project_id}
                                        href={`/dashboard/project/${project.project_id}`}
                                        className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                    >
                                        <p className="font-medium">
                                            {project.project_name}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {project.project_code || '-'} · {project.status}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="mb-4 flex items-center gap-2">
                            <FiCheckSquare className="text-sky-500" />
                            <h3 className="font-semibold">
                                Task ที่รับผิดชอบ
                            </h3>
                        </div>

                        {tasks.length === 0 ? (
                            <p className="text-sm text-slate-500">
                                ไม่พบ Task
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {tasks.map((task) => (
                                    <Link
                                        key={task.task_id}
                                        href={`/dashboard/task/${task.task_id}`}
                                        className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                    >
                                        <p className="font-medium">
                                            #{task.task_id} {task.task_name}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {task.project_name} · {getTaskStatusLabel(task.status)} · {getPriorityLabel(task.priority)}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="mb-4 font-semibold">
                        Activity ล่าสุดของพนักงาน
                    </h3>

                    {activities.length === 0 ? (
                        <p className="text-sm text-slate-500">
                            ไม่พบ Activity
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {activities.map((activity) => (
                                <Link
                                    key={activity.history_id}
                                    href={`/dashboard/task/${activity.task_id}`}
                                    className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                >
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="font-medium">
                                            {activity.description || activity.action_type}
                                        </p>

                                        <p className="text-xs text-slate-400">
                                            {formatDate(activity.created_at)}
                                        </p>
                                    </div>

                                    <p className="mt-1 text-sm text-slate-500">
                                        {activity.task_name || '-'} · {activity.project_name || '-'}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
                    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                <FiTrash2 className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                    ยืนยันการลบพนักงาน
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    ต้องการลบ {'"'}
                                    {fullNameTh(employee)}
                                    {'"'} ใช่ไหม?
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleting}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                <FiX className="h-4 w-4" />
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={deleteEmployee}
                                disabled={deleting}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                            >
                                <FiTrash2 className="h-4 w-4" />
                                {deleting ? 'กำลังลบ...' : 'ลบพนักงาน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
