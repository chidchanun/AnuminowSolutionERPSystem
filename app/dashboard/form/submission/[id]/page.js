'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
    FiArrowLeft,
    FiDownload,
    FiFileText,
    FiPrinter,
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
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const layout = useMemo(
        () => safeLayout(submission?.layout_json),
        [submission]
    )

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestSubmission(submissionId, controller.signal)
            .then((data) => {
                if (ignore) return
                setSubmission(data)
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
                        <a
                            href={`/api/v1/form-submission/${submissionId}/export/pdf`}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 px-5 py-2 text-sm text-white hover:bg-green-600"
                        >
                            <FiDownload />
                            Export PDF
                        </a>
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

                <section className="no-print rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="grid gap-3 md:grid-cols-4">
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
                    </div>
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