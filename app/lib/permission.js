// app/lib/permissions.js

import { navItems } from './navitems'
import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export const routePermissions = []

navItems.forEach((item) => {
  if (item.permission) {
    routePermissions.push({
      path: item.href,
      roles: item.permission,
    })
  }

  item.subMenu?.forEach((sub) => {
    if (sub.permission) {
      routePermissions.push({
        path: sub.href,
        roles: sub.permission,
      })
    }
  })
})

export async function getAuthUserWithRole(request) {
  const accessToken = request.cookies.get('accessToken')?.value

  if (!accessToken) return null

  const payload = await safeVerifyToken(accessToken)

  const userId = payload?.id || payload?.user_id

  if (!userId) return null

  const [rows] = await db.execute(
    `
        SELECT
            u.id,
            u.permission_role_id,
            upr.permission_role_name
        FROM \`user\` u
        INNER JOIN user_permission_role upr
            ON upr.permission_role_id = u.permission_role_id
        WHERE u.id = ?
        AND u.deleted_at IS NULL
        AND u.status = 'active'
        LIMIT 1
        `,
    [userId]
  )

  return rows[0] || null
}

export async function getPermissionKeysByRoleId(
  permissionRoleId,
  connection = db
) {
  const [rows] = await connection.execute(
    `
        SELECT
            p.permission_key
        FROM permission_role_map prm
        INNER JOIN permission p
            ON p.permission_id = prm.permission_id
        WHERE prm.permission_role_id = ?
        `,
    [permissionRoleId]
  )

  return rows.map((row) => row.permission_key)
}

export async function getUserPermissionKeys(
  userId,
  connection = db
) {
  const [rows] = await connection.execute(
    `
        SELECT
            p.permission_key
        FROM \`user\` u
        INNER JOIN permission_role_map prm
            ON prm.permission_role_id = u.permission_role_id
        INNER JOIN permission p
            ON p.permission_id = prm.permission_id
        WHERE u.id = ?
        AND u.deleted_at IS NULL
        AND u.status = 'active'
        `,
    [userId]
  )

  return rows.map((row) => row.permission_key)
}

export async function hasPermission(
  userId,
  permissionKey,
  connection = db
) {
  const [rows] = await connection.execute(
    `
        SELECT
            p.permission_id
        FROM \`user\` u
        INNER JOIN permission_role_map prm
            ON prm.permission_role_id = u.permission_role_id
        INNER JOIN permission p
            ON p.permission_id = prm.permission_id
        WHERE u.id = ?
        AND p.permission_key = ?
        AND u.deleted_at IS NULL
        AND u.status = 'active'
        LIMIT 1
        `,
    [userId, permissionKey]
  )

  return rows.length > 0
}

export async function hasAnyPermission(
  userId,
  permissionKeys = [],
  connection = db
) {
  if (!permissionKeys.length) return true

  const placeholders = permissionKeys.map(() => '?').join(', ')

  const [rows] = await connection.execute(
    `
        SELECT
            p.permission_id
        FROM \`user\` u
        INNER JOIN permission_role_map prm
            ON prm.permission_role_id = u.permission_role_id
        INNER JOIN permission p
            ON p.permission_id = prm.permission_id
        WHERE u.id = ?
        AND p.permission_key IN (${placeholders})
        AND u.deleted_at IS NULL
        AND u.status = 'active'
        LIMIT 1
        `,
    [
      userId,
      ...permissionKeys,
    ]
  )

  return rows.length > 0
}

export async function getAuthUserWithPermissions(request) {
  const user = await getAuthUserWithRole(request)

  if (!user) return null

  const permissions = await getPermissionKeysByRoleId(
    user.permission_role_id
  )

  return {
    ...user,
    permissions,
  }
}

export async function requirePermission(
  request,
  permissionKey
) {
  const user = await getAuthUserWithPermissions(request)

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      ),
    }
  }

  const allowed = hasPermissionKey(user, permissionKey)

  if (!allowed) {
    return {
      user,
      response: NextResponse.json(
        {
          success: false,
          message: `ไม่มีสิทธิ์: ${permissionKey}`,
        },
        { status: 403 }
      ),
    }
  }

  return {
    user,
    response: null,
  }
}

export async function requireAnyPermission(
  request,
  permissionKeys = []
) {
  const user = await getAuthUserWithPermissions(request)

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        {
          success: false,
          message: 'Unauthorized',
        },
        { status: 401 }
      ),
    }
  }

  const allowed = hasAnyPermissionKey(user, permissionKeys)

  if (!allowed) {
    return {
      user,
      response: NextResponse.json(
        {
          success: false,
          message: `ไม่มีสิทธิ์: ${permissionKeys.join(', ')}`,
        },
        { status: 403 }
      ),
    }
  }

  return {
    user,
    response: null,
  }
}

export function isAdmin(user) {
  return user?.permission_role_name === 'Admin'
}

export function hasPermissionKey(user, permissionKey) {
  return Array.isArray(user?.permissions) &&
    user.permissions.includes(permissionKey)
}

export function hasAnyPermissionKey(
  user,
  permissionKeys = []
) {
  if (!permissionKeys.length) return true

  return permissionKeys.some((permissionKey) =>
    hasPermissionKey(user, permissionKey)
  )
}

export function hasProjectWideAccess(user) {
  return hasAnyPermissionKey(user, [
    'project.create',
    'project.update',
    'project.delete',
  ])
}

export function hasTaskWideAccess(user) {
  return hasAnyPermissionKey(user, [
    'task.create',
    'task.update',
    'task.delete',
  ])
}

export function hasTaskRelatedAccess(user) {
  return hasAnyPermissionKey(user, [
    'task.create',
    'task.update',
    'task.delete',
  ])
}
