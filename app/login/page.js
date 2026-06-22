'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import AnuminowLogo from '../../public/AnuminowSolutionLogoNoBG.webp'

export default function LoginPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({ id: '', password: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [showPassword, setShowPassword] = useState(false)


    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        setError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            if (!formData.id || !formData.password) {
                setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
                setLoading(false)
                return
            }

            const res = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(formData),
            })

            const data = await res.json().catch(() => ({}))

            if (!res.ok) {
                setError(data.message || 'เข้าสู่ระบบล้มเหลว')
                setLoading(false)
                return
            }

            if (data.user) {
                localStorage.setItem('user', JSON.stringify(data.user))
            }

            router.replace('/dashboard')
            router.refresh()

            // fallback สำหรับระบบที่ใช้ cookie + proxy
            setTimeout(() => {
                window.location.replace('/dashboard')
            }, 100)
        } catch (err) {
            console.error('Login error:', err)
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่')
            setLoading(false)
        }
    }



    return (
        <main className="min-h-screen flex items-center justify-center bg-linear-to-br
                        dark:from-slate-900 dark:to-slate-800 
                        light:from-slate-50 light:to-white
                        transition-colors duration-300 px-4 py-8" role="main">


            {/* Login Card */}
            <div className="w-full max-w-md rounded-2xl shadow-2xl 
                                bg-white dark:bg-slate-800
                                border border-slate-200 dark:border-slate-700
                                p-8 md:p-10 space-y-8
                                transition-all duration-300">

                {/* Logo Section */}
                <div className="flex justify-center items-center mb-4">
                    <Image
                        src={AnuminowLogo}
                        alt="Anuminow Solution Logo"
                        width={210}
                        height={210}
                        priority
                        className="object-contain w-auto h-auto"
                    />
                </div>

                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                        เข้าสู่ระบบ
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Anuminow Solution ERP System
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 
                                        rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* ID Input */}
                    <div className="space-y-2">
                        <label htmlFor="id" className="block text-sm font-medium 
                                                          text-slate-700 dark:text-slate-300">
                            ชื่อผู้ใช้ / รหัสพนักงาน
                        </label>
                        <input
                            type="text"
                            id="id"
                            name="id"
                            value={formData.id}
                            onChange={handleChange}
                            placeholder="กรอกรหัสพนักงาน"
                            disabled={loading}
                            className="w-full px-4 py-3 rounded-lg
                                          bg-slate-50 dark:bg-slate-700
                                          border border-slate-300 dark:border-slate-600
                                          text-slate-900 dark:text-slate-100
                                          placeholder-slate-500 dark:placeholder-slate-400
                                          focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400
                                          disabled:opacity-50 disabled:cursor-not-allowed
                                          transition-colors duration-200"
                            autoComplete="username"
                            required
                        />
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2">
                        <label htmlFor="password" className="block text-sm font-medium 
                                                                text-slate-700 dark:text-slate-300">
                            รหัสผ่าน
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="กรอกรหัสผ่าน"
                                disabled={loading}
                                className="w-full px-4 py-3 rounded-lg
                                              bg-slate-50 dark:bg-slate-700
                                              border border-slate-300 dark:border-slate-600
                                              text-slate-900 dark:text-slate-100
                                              placeholder-slate-500 dark:placeholder-slate-400
                                              focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400
                                              disabled:opacity-50 disabled:cursor-not-allowed
                                              transition-colors duration-200"
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                                className="absolute right-2 top-1/2 -translate-y-1/2 
                                              inline-flex items-center justify-center
                                              min-h-11 min-w-11 p-2 rounded-full
                                              bg-slate-100 dark:bg-slate-700
                                              text-slate-500 dark:text-slate-300
                                              hover:text-slate-800 dark:hover:text-slate-100
                                              hover:bg-slate-200 dark:hover:bg-slate-600
                                              focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400
                                              transition-colors duration-200"
                                disabled={loading}
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-lg font-semibold cursor-pointer
                                      bg-sky-500 hover:bg-sky-600 dark:bg-sky-400 dark:hover:bg-sky-500
                                      text-white dark:text-slate-900
                                      disabled:opacity-60 disabled:cursor-not-allowed
                                      transition-all duration-200
                                      focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
                                      flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                กำลังเข้าสู่ระบบ...
                            </>
                        ) : (
                            'เข้าสู่ระบบ'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                    <p className="text-xs text-center text-slate-600 dark:text-slate-400">
                        Anuminow Solution ERP System v1.0
                    </p>
                </div>
            </div>
        </main>
    )
}
