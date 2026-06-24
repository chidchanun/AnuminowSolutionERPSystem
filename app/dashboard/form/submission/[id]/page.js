'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
    FiArrowLeft,
    FiCheck,
    FiCheckCircle,
    FiClock,
    FiDownload,
    FiFileText,
    FiMessageSquare,
    FiPrinter,
    FiUserCheck,
    FiX,
    FiXCircle,
} from 'react-icons/fi'
import FormDocumentRenderer from '@/app/components/FormDocumentRenderer'

function safeLayout(layout) {
    return {
        title: layout?.title || '',
        fields: Array.isArray(layout?.fields) ? layout.fields : [],
    }
}

async function requestSubmission(submissionId, signal) {
    const res = await fetch(`/api/v1/form-submission/${submissionId}`, {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดเอกสารไม่สำเร็จ')
    }

    return data.submission
}

async function requestPermissions(signal) {
    const res = await fetch('/api/v1/me/permissions', {
        cache: 'no-store',
        credentials: 'include',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลด Permission ไม่สำเร็จ')
    }

    return data.permissions || []
}

async function requestDecision(submissionId, action, comment) {
    const res = await fetch(`/api/v1/form-submission/${submissionId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action,
            comment,
        }),
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'อัปเดตสถานะเอกสารไม่สำเร็จ')
    }

    return data
}

function getSubmissionStatusTone(status) {
    switch (status) {
        case 'approved':
            return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
        case 'rejected':
            return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
        case 'cancelled':
            return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        default:
            return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
    }
}

function formatDateTime(value) {
    if (!value) return '-'

    return new Date(value).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

export default function FormSubmissionDetailPage() {
    const params = useParams()
    const submissionId = params.id

    const [submission, setSubmission] = useState(null)
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [decisionAction, setDecisionAction] = useState(null)
    const [decisionComment, setDecisionComment] = useState('')
    const [decisionSaving, setDecisionSaving] = useState(false)

    const layout = useMemo(
        () => safeLayout(submission?.layout_json),
        [submission]
    )

    const history = useMemo(
        () => Array.isArray(submission?.history) ? submission.history : [],
        [submission]
    )

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        Promise.all([
            requestSubmission(submissionId, controller.signal),
            requestPermissions(controller.signal),
        ])
            .then(([data, permissionItems]) => {
                if (ignore) return
                setSubmission(data)
                setPermissions(permissionItems)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return
                setError(err.message || 'โหลดเอกสารไม่สำเร็จ')
            })
            .finally(() => {
                if (ignore) return
                setLoading(false)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [submissionId])

    const canExportForm = permissions.includes('form.export')
    const canApproveForm =
        permissions.includes('form.approve') &&
        submission?.status === 'submitted'

    const handleDecision = async () => {
        if (!decisionAction) return

        if (decisionAction === 'reject' && !decisionComment.trim()) {
            setError('กรุณากรอกเหตุผลการ Reject')
            return
        }

        setDecisionSaving(true)
        setError('')
        setSuccess('')

        try {
            const result = await requestDecision(
                submissionId,
                decisionAction,
                decisionComment.trim()
            )
            const refreshed = await requestSubmission(submissionId)

            setSubmission(refreshed)
            setDecisionAction(null)
            setDecisionComment('')
            setSuccess(result.message || 'อัปเดตสถานะเอกสารสำเร็จ')
        } catch (err) {
            setError(err.message || 'อัปเดตสถานะเอกสารไม่สำเร็จ')
        } finally {
            setDecisionSaving(false)
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
                <div className="mx-auto max-w-7xl rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    กำลังโหลดเอกสาร...
                </div>
            </main>
        )
    }

    if (!submission) {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
                <div className="mx-auto max-w-7xl rounded-3xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">
                    {error || 'ไม่พบเอกสาร'}
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
            <div className="mx-auto max-w-[1200px] space-y-6">
                <section className="no-print flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                            <FiFileText className="text-xl" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            เอกสารแบบฟอร์ม
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {submission.submission_no}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/dashboard/form/submission"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            <FiArrowLeft />
                            กลับ
                        </Link>
                        {canExportForm && (
                            <a
                                href={`/api/v1/form-submission/${submissionId}/export/pdf`}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-5 py-2 text-sm text-white hover:bg-green-600"
                            >
                                <FiDownload />
                                Export PDF
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-2 text-sm text-white hover:bg-sky-600"
                        >
                            <FiPrinter />
                            Print / Save PDF
                        </button>
                    </div>
                </section>

                {error && (
                    <div className="no-print rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="no-print rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {success}
                    </div>
                )}

                <section className="no-print rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <div>
                            <p className="text-slate-400">แบบฟอร์ม</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {submission.form_name}
                            </p>
                        </div>

                        <div>
                            <p className="text-slate-400">รหัสฟอร์ม</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {submission.form_code}
                            </p>
                        </div>

                        <div>
                            <p className="text-slate-400">ผู้ส่ง</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {submission.submitted_by_name || submission.submitted_by}
                            </p>
                        </div>

                        <div>
                            <p className="text-slate-400">วันที่ส่ง</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {formatDateTime(submission.submitted_at)}
                            </p>
                        </div>

                        <div>
                            <p className="text-slate-400">สถานะ</p>
                            <span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-medium ${getSubmissionStatusTone(submission.status)}`}>
                                {submission.status}
                            </span>
                        </div>

                        <div>
                            <p className="text-slate-400">Template version</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                v{submission.template_version || 1}
                            </p>
                        </div>
                    </div>

                    {(submission.decided_by || submission.decided_at || submission.decision_comment) && (
                        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 md:grid-cols-3">
                            <div>
                                <p className="text-slate-400">ผู้อนุมัติ/ตัดสิน</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {submission.decided_by_name || submission.decided_by || '-'}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-400">วันที่ตัดสิน</p>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {formatDateTime(submission.decided_at)}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-400">Comment</p>
                                <p className="whitespace-pre-wrap font-medium text-slate-900 dark:text-slate-100">
                                    {submission.decision_comment || '-'}
                                </p>
                            </div>
                        </div>
                    )}
                </section>

                {canApproveForm && (
                    <section className="no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    <FiUserCheck className="h-5 w-5" />
                                </div>
                                <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                                    Approval
                                </h2>
                                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                    ตรวจเอกสารแล้วเลือก Approve หรือ Reject พร้อม comment
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDecisionAction('approve')
                                        setDecisionComment('')
                                        setError('')
                                        setSuccess('')
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                                >
                                    <FiCheck className="h-4 w-4" />
                                    Approve
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setDecisionAction('reject')
                                        setDecisionComment('')
                                        setError('')
                                        setSuccess('')
                                    }}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
                                >
                                    <FiX className="h-4 w-4" />
                                    Reject
                                </button>
                            </div>
                        </div>

                        {decisionAction && (
                            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {decisionAction === 'approve' ? (
                                        <FiCheckCircle className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <FiXCircle className="h-4 w-4 text-rose-500" />
                                    )}
                                    {decisionAction === 'approve' ? 'Confirm approve' : 'Confirm reject'}
                                </div>

                                <textarea
                                    value={decisionComment}
                                    onChange={(event) => setDecisionComment(event.target.value)}
                                    placeholder={decisionAction === 'reject' ? 'เหตุผลการ Reject' : 'Comment (optional)'}
                                    className="mt-3 min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900"
                                />

                                <div className="mt-3 flex flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDecisionAction(null)
                                            setDecisionComment('')
                                        }}
                                        disabled={decisionSaving}
                                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDecision}
                                        disabled={decisionSaving}
                                        className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                                            decisionAction === 'approve'
                                                ? 'bg-emerald-500 hover:bg-emerald-600'
                                                : 'bg-rose-500 hover:bg-rose-600'
                                        }`}
                                    >
                                        {decisionSaving ? 'กำลังบันทึก...' : 'ยืนยัน'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                <section className="no-print rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <FiClock className="h-4 w-4 text-slate-400" />
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            Status History
                        </h2>
                    </div>

                    {history.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-500">
                            ยังไม่มีประวัติสถานะ
                        </p>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {history.map((item) => (
                                <div
                                    key={item.history_id}
                                    className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800"
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${getSubmissionStatusTone(item.to_status)}`}>
                                                {item.to_status}
                                            </span>
                                            <span className="font-medium text-slate-900 dark:text-slate-100">
                                                {item.action}
                                            </span>
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {formatDateTime(item.created_at)}
                                        </span>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                        <span>
                                            โดย {item.changed_by_name || item.changed_by || '-'}
                                        </span>
                                        {item.from_status && (
                                            <span>
                                                {item.from_status} → {item.to_status}
                                            </span>
                                        )}
                                    </div>

                                    {item.comment && (
                                        <div className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                            <FiMessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                                            <p className="whitespace-pre-wrap">
                                                {item.comment}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-slate-200/60 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                    <FormDocumentRenderer
                        title={submission.form_name}
                        description={`เลขที่เอกสาร: ${submission.submission_no}`}
                        fields={layout.fields}
                        data={submission.data_json}
                        editable={false}
                        documentConfig={submission.layout_json?.document}
                    />
                </section>
            </div>
        </main>
    )
}
