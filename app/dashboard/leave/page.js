'use client'

import { useEffect, useState } from 'react'
import { FiCheck, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi'

const leaveTypes = [
    { value: 'sick', label: 'ลาป่วย' },
    { value: 'personal', label: 'ลากิจ' },
    { value: 'vacation', label: 'ลาพักร้อน' },
    { value: 'other', label: 'อื่น ๆ' },
]

const statuses = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'pending', label: 'รออนุมัติ' },
    { value: 'approved', label: 'อนุมัติแล้ว' },
    { value: 'rejected', label: 'ปฏิเสธแล้ว' },
]

function getLeaveTypeLabel(value) {
    return leaveTypes.find((item) => item.value === value)?.label || value || '-'
}

function getStatusLabel(value) {
    switch (value) {
        case 'pending':
            return 'รออนุมัติ'
        case 'approved':
            return 'อนุมัติแล้ว'
        case 'rejected':
            return 'ปฏิเสธแล้ว'
        default:
            return value || '-'
    }
}

function getStatusClass(value) {
    switch (value) {
        case 'pending':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        case 'approved':
            return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
        case 'rejected':
            return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
        default:
            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
}

function formatDate(value) {
    if (!value) return '-'
    return new Date(value).toLocaleDateString('th-TH', {
        dateStyle: 'medium',
    })
}

function getConfirmTitle(status) {
    return status === 'approved'
        ? 'ยืนยันการอนุมัติคำขอลา'
        : 'ยืนยันการปฏิเสธคำขอลา'
}

function getConfirmDescription(status) {
    return status === 'approved'
        ? 'เมื่ออนุมัติแล้ว ระบบจะบันทึกวันลาเข้า Attendance ของพนักงาน'
        : 'เมื่อปฏิเสธแล้ว คำขอนี้จะถูกปิดและไม่สามารถอนุมัติซ้ำได้'
}

export default function LeavePage() {
    const [leaves, setLeaves] = useState([])
    const [permission, setPermission] = useState({
        can_approve: false,
        current_user_id: null,
    })
    const [status, setStatus] = useState('all')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [actionSaving, setActionSaving] = useState(false)
    const [confirmAction, setConfirmAction] = useState(null)
    const [error, setError] = useState('')

    const [formData, setFormData] = useState({
        leave_type: 'sick',
        start_date: '',
        end_date: '',
        reason: '',
    })

    const loadLeaves = async () => {
        try {
            setLoading(true)

            const res = await fetch(`/api/v1/leave?status=${status}`, {
                cache: 'no-store',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'โหลดรายการลาไม่สำเร็จ'
                )
            }

            setLeaves(data.leaves || [])
            setPermission(data.permission || {})
            setError('')
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    async function requestLeaves(status, signal) {
        const res = await fetch(`/api/v1/leave?status=${status}`, {
            cache: 'no-store',
            signal,
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(
                data.error_detail ||
                data.message ||
                'โหลดรายการลาไม่สำเร็จ'
            )
        }

        return data
    }

    useEffect(() => {
        let ignore = false
        const controller = new AbortController()

        requestLeaves(status, controller.signal)
            .then((data) => {
                if (ignore) return

                setLeaves(data.leaves || [])
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
    }, [status])

    const submitLeave = async (event) => {
        event.preventDefault()

        try {
            setSaving(true)

            const res = await fetch('/api/v1/leave', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'ส่งคำขอลาไม่สำเร็จ'
                )
            }

            setFormData({
                leave_type: 'sick',
                start_date: '',
                end_date: '',
                reason: '',
            })

            await loadLeaves()
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    const updateLeaveStatus = async (leaveId, nextStatus) => {
        try {
            setActionSaving(true)

            const res = await fetch(`/api/v1/leave/${leaveId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: nextStatus,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'อัปเดตคำขอลาไม่สำเร็จ'
                )
            }

            await loadLeaves()
            setConfirmAction(null)
        } catch (error) {
            console.error(error)
            setError(error.message)
        } finally {
            setActionSaving(false)
        }
    }

    const deleteLeave = async (leaveId) => {
        const confirmed = window.confirm('ต้องการลบคำขอนี้หรือไม่?')
        if (!confirmed) return

        try {
            const res = await fetch(`/api/v1/leave/${leaveId}`, {
                method: 'DELETE',
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(
                    data.error_detail ||
                    data.message ||
                    'ลบคำขอลาไม่สำเร็จ'
                )
            }

            await loadLeaves()
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
                            Leave Request
                        </h1>
                        <p className="text-sm text-slate-500">
                            ระบบขอลาและอนุมัติการลา
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadLeaves}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <FiRefreshCw />
                        รีเฟรช
                    </button>
                </div>

                {error && (
                    <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                        {error}
                    </div>
                )}

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="mb-4 font-semibold">
                        ส่งคำขอลา
                    </h2>

                    <form
                        onSubmit={submitLeave}
                        className="grid gap-4 lg:grid-cols-5"
                    >
                        <select
                            value={formData.leave_type}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    leave_type: e.target.value,
                                }))
                            }
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                        >
                            {leaveTypes.map((item) => (
                                <option
                                    key={item.value}
                                    value={item.value}
                                >
                                    {item.label}
                                </option>
                            ))}
                        </select>

                        <input
                            type="date"
                            value={formData.start_date}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    start_date: e.target.value,
                                }))
                            }
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            required
                        />

                        <input
                            type="date"
                            value={formData.end_date}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    end_date: e.target.value,
                                }))
                            }
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                            required
                        />

                        <input
                            value={formData.reason}
                            onChange={(e) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    reason: e.target.value,
                                }))
                            }
                            placeholder="เหตุผล"
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-950"
                        />

                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-2xl bg-sky-500 px-4 py-3 text-white hover:bg-sky-600 disabled:opacity-60"
                        >
                            {saving ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                        </button>
                    </form>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="font-semibold">
                            รายการขอลา
                        </h2>

                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                        >
                            {statuses.map((item) => (
                                <option
                                    key={item.value}
                                    value={item.value}
                                >
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {loading ? (
                        <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 dark:bg-slate-950">
                            กำลังโหลด...
                        </div>
                    ) : leaves.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                            ไม่พบรายการลา
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {leaves.map((leave) => (
                                <article
                                    key={leave.leave_id}
                                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                                >
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold">
                                                    {leave.full_name_th}
                                                </p>

                                                <span className={`rounded-full px-3 py-1 text-xs ${getStatusClass(leave.status)}`}>
                                                    {getStatusLabel(leave.status)}
                                                </span>
                                            </div>

                                            <p className="mt-1 text-sm text-slate-500">
                                                {getLeaveTypeLabel(leave.leave_type)} · {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                                            </p>

                                            <p className="mt-1 text-sm text-slate-500">
                                                {leave.reason || '-'}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {permission.can_approve &&
                                                leave.status === 'pending' &&
                                                String(leave.user_id) !==
                                                    String(permission.current_user_id) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmAction({
                                                                leave,
                                                                status: 'approved',
                                                            })
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-2xl bg-green-500 px-4 py-2 text-sm text-white hover:bg-green-600"
                                                    >
                                                        <FiCheck />
                                                        อนุมัติ
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmAction({
                                                                leave,
                                                                status: 'rejected',
                                                            })
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                                                    >
                                                        <FiX />
                                                        ปฏิเสธ
                                                    </button>
                                                </>
                                            )}

                                            {leave.status === 'pending' && (
                                                <button
                                                    type="button"
                                                    onClick={() => deleteLeave(leave.leave_id)}
                                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                                >
                                                    <FiTrash2 />
                                                    ลบ
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
                    <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex items-start gap-4">
                            <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                                    confirmAction.status === 'approved'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                }`}
                            >
                                {confirmAction.status === 'approved' ? (
                                    <FiCheck className="h-5 w-5" />
                                ) : (
                                    <FiX className="h-5 w-5" />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                    {getConfirmTitle(confirmAction.status)}
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    {getConfirmDescription(confirmAction.status)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="flex justify-between gap-3">
                                <span className="text-slate-500 dark:text-slate-400">
                                    ผู้ขอ
                                </span>
                                <span className="text-right font-medium text-slate-900 dark:text-slate-100">
                                    {confirmAction.leave.full_name_th}
                                </span>
                            </div>
                            <div className="mt-2 flex justify-between gap-3">
                                <span className="text-slate-500 dark:text-slate-400">
                                    ประเภท
                                </span>
                                <span className="text-right font-medium text-slate-900 dark:text-slate-100">
                                    {getLeaveTypeLabel(confirmAction.leave.leave_type)}
                                </span>
                            </div>
                            <div className="mt-2 flex justify-between gap-3">
                                <span className="text-slate-500 dark:text-slate-400">
                                    วันที่
                                </span>
                                <span className="text-right font-medium text-slate-900 dark:text-slate-100">
                                    {formatDate(confirmAction.leave.start_date)} - {formatDate(confirmAction.leave.end_date)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                disabled={actionSaving}
                                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                ยกเลิก
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    updateLeaveStatus(
                                        confirmAction.leave.leave_id,
                                        confirmAction.status
                                    )
                                }
                                disabled={actionSaving}
                                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                    confirmAction.status === 'approved'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                {actionSaving && (
                                    <FiRefreshCw className="h-4 w-4 animate-spin" />
                                )}
                                {confirmAction.status === 'approved'
                                    ? 'ยืนยันอนุมัติ'
                                    : 'ยืนยันปฏิเสธ'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
