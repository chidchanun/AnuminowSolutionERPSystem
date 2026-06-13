'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { FiChevronDown, FiEye, FiEyeOff } from 'react-icons/fi'
import Link from 'next/link'

const initialForm = {
    prefix: 'นาย',
    first_name_th: '',
    last_name_th: '',
    first_name_en: '',
    last_name_en: '',
    phone: '',
    password: '',
    password_confirmed: '',
    department_id: '',
    role_id: '',
    department_name: '',
}

export default function CreateEmployeeForm() {
    const [form, setForm] = useState(initialForm)
    const [departments, setDepartments] = useState([])
    const [roles, setRoles] = useState([])
    const formRef = useRef(null)
    const [previewImage, setPreviewImage] = useState('')
    const [selectedPictureFile, setSelectedPictureFile] = useState(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [showConfirmModal, setShowConfirmModal] = useState(false)
    const [showPasswordPreview, setShowPasswordPreview] = useState(false)
    const [showConfirmPasswordPreview, setShowConfirmPasswordPreview] = useState(false)
    const [loading, setLoading] = useState(true)
    const [submitLoading, setSubmitLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const openConfirmModal = () => {
        if (formRef.current?.reportValidity()) {
            setShowConfirmModal(true)
        }
    }

    const closeConfirmModal = () => {
        setShowConfirmModal(false)
    }

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await fetch('/api/v1/department')
                const data = await res.json()

                if (!res.ok) {
                    setError(data.message || 'ไม่สามารถโหลดข้อมูลแผนกได้')
                    return
                }

                setDepartments(data.departments ?? [])
            } catch (err) {
                console.error('Error loading departments:', err)
                setError('เกิดข้อผิดพลาดในการโหลดข้อมูลแผนก')
            } finally {
                setLoading(false)
            }
        }

        fetchDepartments()
    }, [])

    const fetchRoles = async (departmentName) => {
        setRoles([])
        if (!departmentName) return

        try {
            const res = await fetch(`/api/v1/department/${encodeURIComponent(departmentName)}`)
            const data = await res.json()

            if (!res.ok) {
                setError(data.message || 'ไม่สามารถโหลดข้อมูลตำแหน่งได้')
                return
            }

            setRoles(data.roles ?? [])
        } catch (err) {
            console.error('Error loading roles:', err)
            setError('เกิดข้อผิดพลาดในการโหลดข้อมูลตำแหน่ง')
        }
    }

    const handleChange = (event) => {
        const { name, value } = event.target
        setForm((prev) => ({ ...prev, [name]: value }))
        setError('')
        setSuccess('')

        if (name === 'department_id') {
            const selectedDept = departments.find((item) => String(item.department_id) === value)
            setForm((prev) => ({
                ...prev,
                department_id: selectedDept?.department_id ?? '',
                department_name: selectedDept?.department_name ?? '',
                role_id: '',
            }))
            if (selectedDept?.department_name) {
                fetchRoles(selectedDept.department_name)
            } else {
                setRoles([])
            }
        }
    }

    const handlePictureChange = (event) => {
        const file = event.target.files?.[0]
        if (!file) return

        const objectUrl = URL.createObjectURL(file)
        setSelectedPictureFile(file)
        setPreviewImage(objectUrl)
    }

    const fileToDataUrl = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = reject
            reader.readAsDataURL(file)
        })
    }

    useEffect(() => {
        return () => {
            if (previewImage) {
                URL.revokeObjectURL(previewImage)
            }
        }
    }, [previewImage])

    const handleSubmit = async (event) => {
        if (event) {
            event.preventDefault()
        }
        setShowConfirmModal(false)
        setSubmitLoading(true)
        setError('')
        setSuccess('')

        try {
            const picture_data = selectedPictureFile ? await fileToDataUrl(selectedPictureFile) : undefined
            const payload = {
                prefix: form.prefix,
                first_name_th: form.first_name_th,
                last_name_th: form.last_name_th,
                first_name_en: form.first_name_en,
                last_name_en: form.last_name_en,
                phone: form.phone,
                password: form.password,
                password_confirmed: form.password_confirmed,
                department_id: form.department_id,
                role_id: form.role_id,
                picture_data,
            }

            if (form.password !== form.password_confirmed) {
                setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน')
                setSubmitLoading(false)
                return
            }

            const res = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.message || 'เพิ่มพนักงานไม่สำเร็จ')
                return
            }

            setSuccess('เพิ่มพนักงานสำเร็จ')
            setForm(initialForm)
            setRoles([])
            setSelectedPictureFile(null)
            setPreviewImage('')
        } catch (err) {
            console.error('Submit error:', err)
            setError('เกิดข้อผิดพลาดขณะบันทึกข้อมูล')
        } finally {
            setSubmitLoading(false)
        }
    }

    return (
        <div className="border-none   backdrop-blur-xl max-md:p-4 py-6">
            <div className="flex flex-col w-full h-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">
                <div className=" flex items-center justify-between gap-4 rounded-4xl border border-none dark:border-slate-800 bg-white dark:bg-slate-900  px-6 py-5 max-md:px-2">
                    <div>
                        <h1 className=" text-2xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg max-sm:text-md">เพิ่มพนักงานใหม่</h1>
                    </div>

                </div>
                {error ? (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-300">
                        {error}
                    </div>
                ) : null}
                {success ? (
                    <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-300">
                        {success}
                    </div>
                ) : null}

                <form ref={formRef} onSubmit={(event) => { event.preventDefault(); openConfirmModal(); }} className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-1">
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            คำนำหน้า
                            <div className="relative mt-2">
                                <select
                                    name="prefix"
                                    value={form.prefix}
                                    onChange={handleChange}
                                    className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none appearance-none focus:border-sky-300 focus:dark:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                >
                                    <option value="นาย">นาย</option>
                                    <option value="นาง">นาง</option>
                                    <option value="นางสาว">นางสาว</option>
                                </select>
                                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            </div>
                        </label>

                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            ชื่อ (ไทย)
                            <input
                                name="first_name_th"
                                value={form.first_name_th}
                                onChange={handleChange}
                                type="text"
                                placeholder="ชื่อภาษาไทย"
                                className="mt-2 w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                                required
                            />
                        </label>
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            นามสกุล (ไทย)
                            <input
                                name="last_name_th"
                                value={form.last_name_th}
                                onChange={handleChange}
                                type="text"
                                placeholder="นามสกุลภาษาไทย"
                                className="mt-2 w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                                required
                            />
                        </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            ชื่อ (อังกฤษ)
                            <input
                                name="first_name_en"
                                value={form.first_name_en}
                                onChange={handleChange}
                                type="text"
                                placeholder="ชื่อภาษาอังกฤษ"
                                className="mt-2 w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                                required
                            />
                        </label>
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            นามสกุล (อังกฤษ)
                            <input
                                name="last_name_en"
                                value={form.last_name_en}
                                onChange={handleChange}
                                type="text"
                                placeholder="นามสกุลภาษาอังกฤษ"
                                className="mt-2 w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                                required
                            />
                        </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            แผนก
                            <div className="relative mt-2">
                                <select
                                    name="department_id"
                                    value={form.department_id}
                                    onChange={handleChange}
                                    className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none appearance-none focus:border-sky-300 focus:dark:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    required
                                >
                                    <option value="">เลือกแผนก</option>
                                    {departments.map((dept) => (
                                        <option key={dept.department_id} value={dept.department_id}>
                                            {dept.department_name}
                                        </option>
                                    ))}
                                </select>
                                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            </div>
                        </label>
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            ตำแหน่ง
                            <div className="relative mt-2">
                                <select
                                    name="role_id"
                                    value={form.role_id}
                                    onChange={handleChange}
                                    className="w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none appearance-none focus:border-sky-300 focus:dark:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    disabled={!form.department_id || roles.length === 0}
                                    required
                                >
                                    <option value="">เลือกตำแหน่ง</option>
                                    {roles.map((role) => (
                                        <option key={role.role_id} value={role.role_id}>
                                            {role.role_name}
                                        </option>
                                    ))}
                                </select>
                                <FiChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
                            </div>
                        </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            รูปพนักงาน
                            <div className="mt-2 flex items-center gap-3 rounded-3xl border border-slate-800 bg-slate-950 ">
                                <input
                                    name="profile_picture"
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePictureChange}
                                    className="px-2 py-1 w-full rounded-3xl border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 file:mr-4 file:rounded-full file:border-0 file:bg-sky-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-sky-400"
                                />
                            </div>
                        </label>
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            เบอร์โทรศัพท์
                            <input
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                type="tel"
                                placeholder="เบอร์โทรศัพท์"
                                className="mt-2 w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 text-black dark:text-slate-100 focus:border-sky-300 focus:dark:border-sky-500 px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500/20"
                                required
                            />
                        </label>

                    </div>



                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            รหัสผ่าน
                            <div className="relative mt-2">
                                <input
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="รหัสผ่าน"
                                    className="mt-0 w-full rounded-3xl border border-slate-400 bg-slate-200 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-9 w-9 rounded-full dark:bg-slate-900/50 darK:text-slate-300  hover:dark:bg-slate-800 cursor-pointer dark:text-white text-black"
                                >
                                    {showPassword ? <FiEyeOff /> : <FiEye />}
                                </button>
                            </div>
                        </label>
                        <label className="block text-sm font-medium text-black dark:text-slate-300">
                            ยืนยันรหัสผ่าน
                            <div className="relative mt-2">
                                <input
                                    name="password_confirmed"
                                    value={form.password_confirmed}
                                    onChange={handleChange}
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="ยืนยันรหัสผ่าน"
                                    className="mt-0 w-full rounded-3xl border border-slate-400 bg-slate-300 dark:border-slate-800 dark:bg-slate-950 px-4 py-3 pr-12 text-black dark:text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((s) => !s)}
                                    aria-label={showConfirmPassword ? 'ซ่อนยืนยันรหัสผ่าน' : 'แสดงยืนยันรหัสผ่าน'}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-9 w-9 rounded-full dark:bg-slate-900/50 darK:text-slate-300  hover:dark:bg-slate-800 cursor-pointer dark:text-white text-black"
                                >
                                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                                </button>
                            </div>
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={openConfirmModal}
                        disabled={submitLoading}
                        className="w-full rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitLoading ? 'กำลังบันทึก...' : 'ดูตัวอย่างและยืนยัน'}
                    </button>
                </form>
            </div>


            {showConfirmModal ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
                    <div className="w-full max-w-3xl overflow-hidden rounded-4xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm uppercase tracking-[0.15em] text-slate-500">ยืนยันข้อมูลก่อนส่ง</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">ตรวจสอบข้อมูลพนักงาน</h2>
                            </div>
                            <button
                                type="button"
                                onClick={closeConfirmModal}
                                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
                            >
                                ปิด
                            </button>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs uppercase text-slate-500">คำนำหน้า</p>
                                <p className="mt-1 text-sm text-slate-100">{form.prefix}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-slate-500">เบอร์โทรศัพท์</p>
                                <p className="mt-1 text-sm text-slate-100">{form.phone || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-slate-500">ชื่อ (ไทย)</p>
                                <p className="mt-1 text-sm text-slate-100">{form.first_name_th || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-slate-500">นามสกุล (ไทย)</p>
                                <p className="mt-1 text-sm text-slate-100">{form.last_name_th || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-slate-500">ชื่อ (อังกฤษ)</p>
                                <p className="mt-1 text-sm text-slate-100">{form.first_name_en || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-slate-500">นามสกุล (อังกฤษ)</p>
                                <p className="mt-1 text-sm text-slate-100">{form.last_name_en || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-slate-500">แผนก</p>
                                <p className="mt-1 text-sm text-slate-100">{form.department_name || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-slate-500">ตำแหน่ง</p>
                                <p className="mt-1 text-sm text-slate-100">
                                    {roles.find((role) => String(role.role_id) === String(form.role_id))?.role_name || '-'}
                                </p>
                            </div>
                            <div className="relative">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">รหัสผ่าน</p>
                                <div className="mt-1 flex items-center gap-2 rounded-2xl border-none  px-3 py-2">
                                    <span className="text-sm text-slate-100">
                                        {form.password ? (showPasswordPreview ? form.password : '••••••••') : '-'}
                                    </span>
                                    {form.password ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswordPreview((prev) => !prev)}
                                            aria-label={showPasswordPreview ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                            className="cursor-pointer ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/50 text-slate-300 hover:bg-slate-800"
                                        >
                                            {showPasswordPreview ? <FiEyeOff /> : <FiEye />}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                            <div className="relative">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ยืนยันรหัสผ่าน</p>
                                <div className="mt-1 flex items-center gap-2 rounded-2xl border-none  px-3 py-2">
                                    <span className="text-sm text-slate-100">
                                        {form.password_confirmed ? (showConfirmPasswordPreview ? form.password_confirmed : '••••••••') : '-'}
                                    </span>
                                    {form.password_confirmed ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPasswordPreview((prev) => !prev)}
                                            aria-label={showConfirmPasswordPreview ? 'ซ่อนยืนยันรหัสผ่าน' : 'แสดงยืนยันรหัสผ่าน'}
                                            className="cursor-pointer ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/50 text-slate-300 hover:bg-slate-800"
                                        >
                                            {showConfirmPasswordPreview ? <FiEyeOff /> : <FiEye />}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {previewImage ? (
                            <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-4">
                                <p className="mb-3 text-sm text-slate-400">ตัวอย่างรูปพนักงาน</p>
                                <Image
                                    src={previewImage}
                                    alt="Preview"
                                    width={192}
                                    height={720}
                                    unoptimized
                                    className="h-full w-48 rounded-3xl object-cover"
                                />
                            </div>
                        ) : null}

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={closeConfirmModal}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 sm:w-auto"
                            >
                                แก้ไขข้อมูล
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitLoading}
                                className="w-full rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                {submitLoading ? 'กำลังบันทึก...' : 'ยืนยันและบันทึก'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
