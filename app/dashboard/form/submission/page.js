'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
    FiFileText,
    FiRefreshCw,
} from 'react-icons/fi'

async function requestSubmissions(signal) {
    const res = await fetch('/api/v1/form-submission', {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดรายการเอกสารไม่สำเร็จ')
    }

    return data.submissions || []
}

function formatDateTime(value) {
    if (!value) return '-'

    return new Date(value).toLocaleString('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

export default function FormSubmissionPage() {
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const loadSubmissions = async () => {
        setLoading(true)
        setError('')

        try {
            const rows = await requestSubmissions()
            setSubmissions(rows)
        } catch (err) {
            setError(err.message || 'โหลดรายการเอกสารไม่สำเร็จ')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestSubmissions(controller.signal)
            .then((rows) => {
                if (ignore) return
                setSubmissions(rows)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return
                setError(err.message || 'โหลดรายการเอกสารไม่สำเร็จ')
            })
            .finally(() => {
                if (ignore) return
                setLoading(false)
            })

        return () => {
            ignore = true
            controller.abort()
        }
    }, [])

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
            <div className="mx-auto max-w-7xl space-y-6">
                <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                            <FiFileText className="text-xl" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            เอกสารที่ส่งแล้ว
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            รายการข้อมูลที่ user ส่งผ่านแบบฟอร์ม
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={loadSubmissions}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                        <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                        รีเฟรช
                    </button>
                </section>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {loading ? (
                        <p className="text-sm text-slate-500">กำลังโหลด...</p>
                    ) : submissions.length === 0 ? (
                        <p className="text-sm text-slate-500">ยังไม่มีเอกสารที่ส่งแล้ว</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-[900px] w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                                        <th className="px-4 py-3">เลขที่เอกสาร</th>
                                        <th className="px-4 py-3">แบบฟอร์ม</th>
                                        <th className="px-4 py-3">ผู้ส่ง</th>
                                        <th className="px-4 py-3">สถานะ</th>
                                        <th className="px-4 py-3">วันที่ส่ง</th>
                                        <th className="px-4 py-3 text-right">จัดการ</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {submissions.map((item) => (
                                        <tr
                                            key={item.form_submission_id}
                                            className="border-b border-slate-100 dark:border-slate-800"
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                                                {item.submission_no}
                                            </td>

                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                                    {item.form_name}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    {item.form_code}
                                                </p>
                                            </td>

                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {item.submitted_by_name || item.submitted_by}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                    {item.status}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 text-slate-500">
                                                {formatDateTime(item.submitted_at)}
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                <Link
                                                    href={`/dashboard/form/submission/${item.form_submission_id}`}
                                                    className="rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                                                >
                                                    เปิดเอกสาร
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}