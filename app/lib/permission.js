// app/lib/permissions.js

import { navItems } from './navitems'

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