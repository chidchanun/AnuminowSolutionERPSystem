'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FiFileText, FiPlus, FiRefreshCw } from 'react-icons/fi'

async function requestTemplates(signal) {
    const res = await fetch('/api/v1/form-template', {
        cache: 'no-store',
        signal,
    })

    const data = await res.json()

    if (!res.ok) {
        throw new Error(data.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
    }

    return data.templates || []
}

export default function FormPage() {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const loadTemplates = async () => {
        setLoading(true)
        setError('')

        try {
            const rows = await requestTemplates()
            setTemplates(rows)
        } catch (err) {
            setError(err.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const controller = new AbortController()
        let ignore = false

        requestTemplates(controller.signal)
            .then((rows) => {
                if (ignore) return
                setTemplates(rows)
            })
            .catch((err) => {
                if (ignore || err.name === 'AbortError') return
                setError(err.message || 'โหลดแบบฟอร์มไม่สำเร็จ')
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
                            แบบฟอร์ม
                        </h1>

                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            สร้างและจัดการแบบฟอร์มเอกสาร A4
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={loadTemplates}
                            disabled={loading}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                            รีเฟรช
                        </button>

                        <Link
                            href="/dashboard/form/new"
                            className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                        >
                            <FiPlus />
                            สร้างแบบฟอร์ม
                        </Link>
                    </div>
                </section>

                {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </div>
                )}

                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {loading ? (
                        <p className="text-sm text-slate-500">กำลังโหลด...</p>
                    ) : templates.length === 0 ? (
                        <p className="text-sm text-slate-500">ยังไม่มีแบบฟอร์ม</p>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {templates.map((item) => (
                                <div
                                    key={item.form_template_id}
                                    className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                                                {item.form_name}
                                            </h2>
                                            <p className="mt-1 text-xs text-slate-400">
                                                {item.form_code}
                                            </p>
                                        </div>

                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                            {item.status}
                                        </span>
                                    </div>

                                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                                        {item.description || 'ไม่มีคำอธิบาย'}
                                    </p>

                                    <div className="mt-5 flex flex-wrap gap-2">
                                        <Link
                                            href={`/dashboard/form/${item.form_template_id}/fill`}
                                            className="rounded-2xl bg-sky-500 px-4 py-2 text-sm text-white hover:bg-sky-600"
                                        >
                                            กรอกฟอร์ม
                                        </Link>

                                        <Link
                                            href={`/dashboard/form/${item.form_template_id}/builder`}
                                            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                                        >
                                            แก้ไข
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}