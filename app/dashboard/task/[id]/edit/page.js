'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
    FiArrowLeft,
    FiChevronDown,
    FiSearch,
    FiX,
    FiCheck,
    FiPlus,
    FiTrash2,
} from 'react-icons/fi'
import TextEditor from '@/app/components/TextEditor'

const statusOptions = [
    {
        value: 'todo',
        label: 'Todo',
    },
    {
        value: 'in_progress',
        label: 'In Progress',
    },
    {
        value: 'review',
        label: 'Review',
    },
    {
        value: 'done',
        label: 'Done',
    },
]

const priorityOptions = [
    {
        value: 'low',
        label: 'Low',
    },
    {
        value: 'medium',
        label: 'Medium',
    },
    {
        value: 'high',
        label: 'High',
    },
    {
        value: 'critical',
        label: 'Critical',
    },
]

function SelectBox({
    value,
    onChange,
    children,
    name,
}) {
    return (
        <div className="relative w-full">
            <select
                name={name}
                value={value}
                onChange={onChange}
                className="
                    w-full appearance-none rounded-2xl
                    border border-slate-300 bg-white
                    px-4 py-3 text-sm
                    dark:border-slate-700 dark:bg-slate-950
                "
            >
                {children}
            </select>

            <FiChevronDown
                className="
                    pointer-events-none absolute right-4 top-1/2
                    -translate-y-1/2 text-slate-400
                "
            />
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

function getUserName(user) {
    return (
        user.full_name ||
        `${user.first_name_th || ''} ${user.last_name_th || ''}`.trim() ||
        user.id
    )
}

function formatDateInput(dateValue) {
    if (!dateValue) return ''

    return String(dateValue).split('T')[0]
}

export default function EditTaskPage() {
    const params = useParams()
    const router = useRouter()

    const [formData, setFormData] = useState({
        project_id: '',
        task_name: '',
        description: '',
        priority: 'medium',
        status: 'todo',
        start_date: '',
        due_date: '',
    })

    const [projects, setProjects] = useState([])
    const [allUsers, setAllUsers] = useState([])
    const [assignees, setAssignees] = useState([])

    const [search, setSearch] = useState('')
    const [showMemberModal, setShowMemberModal] = useState(false)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        let ignore = false

        const controller = new AbortController()

        async function loadData() {
            try {
                const [taskRes, projectRes, userRes] =
                    await Promise.all([
                        fetch(`/api/v1/task/${params.id}`, {
                            cache: 'no-store',
                            signal: controller.signal,
                        }),
                        fetch('/api/v1/project', {
                            cache: 'no-store',
                            signal: controller.signal,
                        }),
                        fetch('/api/v1/user', {
                            cache: 'no-store',
                            signal: controller.signal,
                        }),
                    ])

                const taskData = await taskRes.json()
                const projectData = await projectRes.json()
                const userData = await userRes.json()

                if (!taskRes.ok) {
                    throw new Error(
                        taskData.error_detail ||
                        taskData.message ||
                        'โหลดข้อมูลงานไม่สำเร็จ'
                    )
                }

                if (!projectRes.ok) {
                    throw new Error(
                        projectData.message ||
                        'โหลดข้อมูลโปรเจกต์ไม่สำเร็จ'
                    )
                }

                if (!userRes.ok) {
                    throw new Error(
                        userData.message ||
                        'โหลดข้อมูลผู้ใช้ไม่สำเร็จ'
                    )
                }

                if (ignore) return

                const task = taskData.task

                setFormData({
                    project_id: task.project_id || '',
                    task_name: task.task_name || '',
                    description: task.description || '',
                    priority: task.priority || 'medium',
                    status: task.status || 'todo',
                    start_date: formatDateInput(task.start_date),
                    due_date: formatDateInput(task.due_date),
                })

                setAssignees(taskData.assignees || [])

                setProjects(
                    projectData.projects ||
                    projectData.projectData ||
                    projectData.data ||
                    []
                )

                setAllUsers(userData.userData || [])
                setError('')
            } catch (error) {
                if (
                    error.name === 'AbortError' ||
                    ignore
                ) {
                    return
                }

                console.error(error)
                setError(error.message)
            } finally {
                if (!ignore) {
                    setLoading(false)
                }
            }
        }

        if (params.id) {
            loadData()
        }

        return () => {
            ignore = true
            controller.abort()
        }
    }, [params.id])

    const filteredUsers = useMemo(() => {
        const keyword =
            search.trim().toLowerCase()

        if (!keyword) return allUsers

        return allUsers.filter((user) => {
            const name = getUserName(user).toLowerCase()
            const role =
                user.role_name?.toLowerCase() || ''
            const department =
                user.department_name?.toLowerCase() || ''
            const id =
                String(user.id).toLowerCase()

            return (
                name.includes(keyword) ||
                role.includes(keyword) ||
                department.includes(keyword) ||
                id.includes(keyword)
            )
        })
    }, [allUsers, search])

    const handleChange = (e) => {
        const { name, value } = e.target

        setFormData((prev) => {
            const next = {
                ...prev,
                [name]: value,
            }

            // ถ้าเปลี่ยนวันเริ่มต้น แล้วกำหนดส่งเดิมต่ำกว่าวันเริ่มต้นใหม่
            // ให้ล้างกำหนดส่งออก
            if (
                name === 'start_date' &&
                value &&
                next.due_date &&
                next.due_date < value
            ) {
                next.due_date = ''
            }

            return next
        })
    }

    const addAssignee = (user) => {
        const exists =
            assignees.some(
                (member) => member.id === user.id
            )

        if (exists) return

        setAssignees((prev) => [
            ...prev,
            {
                ...user,
                full_name: getUserName(user),
            },
        ])
    }

    const removeAssignee = (id) => {
        setAssignees((prev) =>
            prev.filter((member) => member.id !== id)
        )
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (
            formData.start_date &&
            formData.due_date &&
            formData.due_date < formData.start_date
        ) {
            setError('กำหนดส่งต้องไม่ต่ำกว่าวันเริ่มต้น')
            return
        }
        try {
            setSaving(true)
            setError('')

            const res = await fetch(
                `/api/v1/task/${params.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...formData,
                        assignee_ids: assignees.map(
                            (member) => member.id
                        ),
                    }),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'แก้ไขงานไม่สำเร็จ'
                )
            }

            setShowSuccess(true)
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="py-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลดข้อมูลงาน...
                </div>
            </div>
        )
    }

    if (error && !formData.task_name) {
        return (
            <div className="py-6">
                <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900 dark:bg-slate-900">
                    <h1 className="text-xl font-semibold text-red-500">
                        ไม่สามารถโหลดข้อมูลงานได้
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="mt-5 rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        กลับ
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 py-6">

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-500"
                        >
                            <FiArrowLeft />
                            กลับ
                        </button>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            แก้ไขงาน
                        </h1>

                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            แก้ไขรายละเอียดงานและผู้รับผิดชอบ
                        </p>
                    </div>

                    <Link
                        href={`/dashboard/task/${params.id}`}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 sm:w-auto"
                    >
                        ดูรายละเอียด
                    </Link>
                </div>

                {error && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
                        {error}
                    </div>
                )}

                <form
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >
                    <div className="grid gap-5 lg:grid-cols-2">

                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium">
                                ชื่องาน
                            </label>

                            <input
                                type="text"
                                name="task_name"
                                value={formData.task_name}
                                onChange={handleChange}
                                required
                                className="
                                    w-full rounded-2xl border border-slate-300
                                    bg-white px-4 py-3 text-sm
                                    dark:border-slate-700 dark:bg-slate-950
                                "
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                โปรเจกต์
                            </label>

                            <SelectBox
                                name="project_id"
                                value={formData.project_id}
                                onChange={handleChange}
                            >
                                <option value="">
                                    เลือกโปรเจกต์
                                </option>

                                {projects.map((project) => (
                                    <option
                                        key={project.project_id}
                                        value={project.project_id}
                                    >
                                        {project.project_name}
                                    </option>
                                ))}
                            </SelectBox>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Priority
                            </label>

                            <SelectBox
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                            >
                                {priorityOptions.map((item) => (
                                    <option
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                    </option>
                                ))}
                            </SelectBox>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                Status
                            </label>

                            <SelectBox
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                {statusOptions.map((item) => (
                                    <option
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                    </option>
                                ))}
                            </SelectBox>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                วันเริ่มต้น
                            </label>

                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                                className="
                                    w-full rounded-2xl border border-slate-300
                                    bg-white px-4 py-3 text-sm
                                    dark:border-slate-700 dark:bg-slate-950
                                "
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium">
                                กำหนดส่ง
                            </label>

                            <input
                                type="date"
                                name="due_date"
                                value={formData.due_date}
                                onChange={handleChange}
                                min={formData.start_date || undefined}
                                className="
                                    w-full rounded-2xl border border-slate-300
                                    bg-white px-4 py-3 text-sm
                                    dark:border-slate-700 dark:bg-slate-950
                                "
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                กำหนดส่งต้องไม่ต่ำกว่าวันเริ่มต้น
                            </p>
                        </div>

                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">
                            รายละเอียดงาน
                        </label>

                        <TextEditor
                            value={formData.description}
                            onChange={(html) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    description: html,
                                }))
                            }
                        />
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">

                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="font-semibold">
                                    ผู้รับผิดชอบ
                                </h2>

                                <p className="text-sm text-slate-500">
                                    เลือกพนักงานที่รับผิดชอบงานนี้
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowMemberModal(true)
                                }
                                className="
                                    inline-flex w-full items-center justify-center gap-2
                                    rounded-xl bg-sky-500 px-4 py-2 text-sm text-white
                                    hover:bg-sky-600 sm:w-auto
                                "
                            >
                                <FiPlus />
                                เพิ่มผู้รับผิดชอบ
                            </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            {assignees.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700 md:col-span-2">
                                    ยังไม่มีผู้รับผิดชอบ
                                </div>
                            ) : (
                                assignees.map((member) => {
                                    const name = getUserName(member)

                                    return (
                                        <div
                                            key={member.id}
                                            className="
                                                flex items-center justify-between gap-3
                                                rounded-xl bg-slate-50 p-3
                                                dark:bg-slate-800
                                            "
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <UserAvatar
                                                    src={member.picture_path}
                                                    name={name}
                                                />

                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">
                                                        {name}
                                                    </p>

                                                    <p className="truncate text-xs text-slate-500">
                                                        {member.role_name || '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeAssignee(member.id)
                                                }
                                                className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                    </div>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="
                                inline-flex w-full items-center justify-center
                                rounded-2xl border border-slate-300 px-5 py-3
                                text-sm hover:bg-slate-100
                                dark:border-slate-700 dark:hover:bg-slate-800
                                sm:w-auto
                            "
                        >
                            ยกเลิก
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="
                                inline-flex w-full items-center justify-center gap-2
                                rounded-2xl bg-sky-500 px-5 py-3 text-sm text-white
                                hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60
                                sm:w-auto
                            "
                        >
                            {saving ? (
                                'กำลังบันทึก...'
                            ) : (
                                <>
                                    <FiCheck />
                                    บันทึกการแก้ไข
                                </>
                            )}
                        </button>

                    </div>
                </form>

            </div>

            {showMemberModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

                    <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 sm:p-6">

                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    เพิ่มผู้รับผิดชอบ
                                </h2>

                                <p className="text-sm text-slate-500">
                                    ค้นหาและเลือกพนักงาน
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowMemberModal(false)
                                }
                                className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <FiX />
                            </button>
                        </div>

                        <div className="relative mb-4">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={search}
                                onChange={(e) =>
                                    setSearch(e.target.value)
                                }
                                placeholder="ค้นหาชื่อ / ตำแหน่ง / แผนก"
                                className="
                                    w-full rounded-xl border border-slate-300
                                    bg-white px-10 py-3 text-sm
                                    dark:border-slate-700 dark:bg-slate-950
                                "
                            />
                        </div>

                        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                            {filteredUsers.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
                                    ไม่พบพนักงาน
                                </div>
                            ) : (
                                filteredUsers.map((user) => {
                                    const name = getUserName(user)

                                    const exists =
                                        assignees.some(
                                            (member) =>
                                                member.id === user.id
                                        )

                                    return (
                                        <div
                                            key={user.id}
                                            className="
                                                flex items-center justify-between gap-3
                                                rounded-xl border border-slate-200 p-3
                                                dark:border-slate-800
                                            "
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <UserAvatar
                                                    src={user.picture_path}
                                                    name={name}
                                                />

                                                <div className="min-w-0">
                                                    <p className="truncate font-medium">
                                                        {name}
                                                    </p>

                                                    <p className="truncate text-xs text-slate-500">
                                                        {user.role_name || '-'}
                                                    </p>

                                                    <p className="truncate text-xs text-slate-500">
                                                        {user.department_name || '-'}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                disabled={exists}
                                                onClick={() =>
                                                    addAssignee(user)
                                                }
                                                className={`shrink-0 rounded-xl px-3 py-2 text-sm text-white ${exists
                                                    ? 'cursor-not-allowed bg-slate-400'
                                                    : 'bg-sky-500 hover:bg-sky-600'
                                                    }`}
                                            >
                                                {exists ? 'เพิ่มแล้ว' : 'เพิ่ม'}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                    </div>

                </div>
            )}

            {showSuccess && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">

                    <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl dark:bg-slate-900">

                        <div className="mb-5 flex justify-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                                <FiCheck className="h-10 w-10 text-green-600" />
                            </div>
                        </div>

                        <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
                            บันทึกสำเร็จ
                        </h2>

                        <p className="mt-3 text-center text-slate-500">
                            ข้อมูลงานถูกแก้ไขเรียบร้อยแล้ว
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() =>
                                    router.push(
                                        `/dashboard/task/${params.id}`
                                    )
                                }
                                className="flex-1 rounded-xl bg-sky-500 px-4 py-3 text-white hover:bg-sky-600"
                            >
                                ดูรายละเอียด
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setShowSuccess(false)
                                }
                                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                                แก้ไขต่อ
                            </button>
                        </div>

                    </div>

                </div>
            )}

        </div>
    )
}