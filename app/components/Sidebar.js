'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { FiLogOut, FiX } from 'react-icons/fi'
import { navItems } from '../lib/navitems'
import AnuminowLogo from '../../public/AnuminowSolutionLogoNoBG.png'


export default function Sidebar({ sidebarOpen, onLogout, onClose, user }) {

  const pathname = usePathname()

  const logoSrc = user?.picture_path || AnuminowLogo
  const permissionRole = user?.permission_role

  const isAdmin = permissionRole === 'Admin'

  const canCreateEmployee =
    permissionRole === 'Admin'

  const canCreateProject =
    permissionRole === 'Admin' ||
    permissionRole === 'Manager'

  const canCreateTask =
    permissionRole === 'Admin' ||
    permissionRole === 'Manager' ||
    permissionRole === 'Team Lead'

  const canViewReport =
    permissionRole === 'Admin' ||
    permissionRole === 'Manager'


  const hasPermission = (permissions) => {
    if (!permissions) return true

    return permissions.includes(permissionRole)
  }



  return (
    <aside
      className={`fixed inset-y-0 left-0 z-20 w-72 transform bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 transition-transform duration-300 lg:sticky lg:translate-x-0 h-screen ${sidebarOpen ? 'translate-x-0 ' : '-translate-x-full lg:translate-x-0 '} flex flex-col`}
      aria-label="Sidebar"
    >
      <div className="flex items-center justify-between gap-3 mb-10 lg:justify-start">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-sky-100 dark:bg-sky-900/40 shadow-sm">
            <Image
              src={logoSrc}
              alt="Logo"
              width={100}
              height={100}
              className="object-contain w-auto h-auto"
              loading='lazy'
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Anuminow Solution</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">ERP Dashboard</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Close sidebar"
        >
          <FiX className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1">
        {navItems
          .filter((item) => hasPermission(item.permission))
          .map((item) => {
            const Icon = item.icon
            const activeParent =
              item.href &&
              (pathname === item.href || (item.subMenu && pathname.startsWith(`${item.href}/`)))
            return (
              <div key={item.label}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`w-full inline-flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${activeParent ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  aria-current={activeParent ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
                {item.subMenu && activeParent ? (
                  <div className="mt-2 space-y-1 pl-12 flex gap-1 flex-col">
                    {item.subMenu
                      .filter((sub) => {
                        if (!hasPermission(sub.permission)) {
                          return false
                        }

                        return true
                      })
                      .map((sub) => {
                        const activeSub = pathname === sub.href
                        return (
                          <Link
                            key={sub.label}
                            href={sub.href}
                            onClick={onClose}
                            className={`block rounded-2xl px-4 py-2 text-sm transition-colors ${activeSub ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            aria-current={activeSub ? 'page' : undefined}
                          >
                            {sub.label}
                          </Link>
                        )
                      })}
                  </div>
                ) : null}
              </div>
            )
          })}
      </nav>

      <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
        <button
          type="button"
          onClick={onLogout}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-transparent px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <FiLogOut className="h-4 w-4" />
          ออกจากระบบ
        </button>

      </div>
    </aside>
  )
}
