'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'
import TextEditor from '@/app/components/TextEditor'

export default function EditProjectPage() {
    const params = useParams()
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        project_name: '',
        project_code: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'planning',
    })

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await fetch(
                    `/api/v1/project/${params.id}`
                )

                if (!res.ok) return

                const data = await res.json()

                setFormData({
                    project_name:
                        data.project.project_name || '',
                    project_code:
                        data.project.project_code || '',
                    description:
                        data.project.description || '',
                    start_date:
                        data.project.start_date
                            ?.split('T')[0] || '',
                    end_date:
                        data.project.end_date
                            ?.split('T')[0] || '',
                    status:
                        data.project.status || 'planning',
                })
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }

        if (params.id) {
            fetchProject()
        }
    }, [params.id])

    const handleChange = (e) => {
        const { name, value } = e.target

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            setSaving(true)

            const res = await fetch(
                `/api/v1/project/${params.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                }
            )

            const data = await res.json()

            if (!res.ok) {
                alert(data.message)
                return
            }

            alert('แก้ไขโปรเจกต์สำเร็จ')

            router.push(
                `/dashboard/project/${params.id}`
            )
        } catch (error) {
            console.error(error)
            alert('เกิดข้อผิดพลาด')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="py-6">
                กำลังโหลดข้อมูล...
            </div>
        )
    }

    return (
        <div className="py-6">

            <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">

                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        แก้ไขโปรเจกต์
                    </h1>

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        แก้ไขข้อมูลโปรเจกต์ในระบบ
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-6"
                >

                    <div>
                        <label className="block text-sm mb-2">
                            ชื่อโปรเจกต์
                        </label>

                        <input
                            type="text"
                            name="project_name"
                            value={formData.project_name}
                            onChange={handleChange}
                            className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            รหัสโปรเจกต์
                        </label>

                        <input
                            type="text"
                            name="project_code"
                            value={formData.project_code}
                            onChange={handleChange}
                            className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm mb-2">
                            รายละเอียด
                        </label>

                       

                        <TextEditor
                            value={formData.description}
                            onChange={(html) =>
                                setFormData((prev) => ({
                                    ...prev,
                                    description: html
                                }))
                            }
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">

                        <div>
                            <label className="block text-sm mb-2">
                                วันเริ่มต้น
                            </label>

                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                                className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                        </div>

                        <div>
                            <label className="block text-sm mb-2">
                                วันสิ้นสุด
                            </label>

                            <input
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleChange}
                                className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                            />
                        </div>

                    </div>

                    <div className=''>
                        <label className="block text-sm mb-2">
                            สถานะ
                        </label>
                        <div className='relative'>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none appearance-none focus:border-sky-300 focus:dark:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            >
                                <option value="planning">
                                    วางแผน
                                </option>

                                <option value="active">
                                    กำลังดำเนินการ
                                </option>

                                <option value="completed">
                                    เสร็จสิ้น
                                </option>

                                <option value="cancelled">
                                    ยกเลิก
                                </option>
                            </select>
                            <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
                        </div>

                    </div>

                    <div className="flex justify-end gap-3">

                        <button
                            type="button"
                            onClick={() =>
                                router.back()
                            }
                            className="px-4 py-2 rounded-xl border border-slate-300"
                        >
                            ยกเลิก
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
                        >
                            {saving
                                ? 'กำลังบันทึก...'
                                : 'บันทึกข้อมูล'}
                        </button>

                    </div>

                </form>

            </div>

        </div>
    )
}