import { FiHome, FiUsers, FiBriefcase, FiBarChart2, FiSettings, FiFolder } from 'react-icons/fi'

export const navItems = [
    {
        label: 'ภาพรวม',
        icon: FiHome,
        href: '/dashboard',
    },

    {
        label: 'พนักงาน',
        icon: FiUsers,
        href: '/dashboard/employee',
        permission: ['Admin'],
        subMenu: [
            {
                label: 'ข้อมูลพนักงาน',
                href: '/dashboard/employee',
            },
            {
                label: 'เพิ่มพนักงาน',
                href: '/dashboard/employee/new',
            },
        ],
    },

    {
        label: 'โปรเจกต์',
        icon: FiFolder,
        href: '/dashboard/project',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
        subMenu: [
            {
                label: 'รายการโปรเจกต์',
                href: '/dashboard/project',
            },
            {
                label: 'สร้างโปรเจกต์',
                href: '/dashboard/project/new',
                permission: ['Admin', 'Manager'],
            },
        ],
    },

    {
        label: 'งาน',
        icon: FiBriefcase,
        href: '/dashboard/task',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
        subMenu: [
            {
                label: 'รายการงาน',
                href: '/dashboard/task',
            },
            {
                label: 'Kanban Board',
                href: '/dashboard/task/board',
            },
            {
                label: 'เพิ่มงาน',
                href: '/dashboard/task/new',
                permission: ['Admin', 'Manager', 'Team Lead'],
            },
            {
                label: 'งานของฉัน',
                href: '/dashboard/task/my-task',
            },
        ],
    },

    {
        label: 'รายงาน',
        icon: FiBarChart2,
        href: '/dashboard/',
        permission: ['Admin', 'Manager'],
    },

    {
        label: 'ตั้งค่า',
        icon: FiSettings,
        href: '/dashboard/',
        permission: ['Admin'],
    },
]