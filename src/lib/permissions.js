export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isOperator(user) {
  return user?.role === 'operator';
}

export function canEdit(user) {
  return user?.role === 'admin';
}

export function canCreateEditCadastros(user) {
  return user?.role === 'admin' || user?.role === 'operator';
}

export function canDelete(user) {
  return user?.role === 'admin';
}

export function canManageUsers(user) {
  return user?.role === 'admin';
}

export function canCreateMovements(user) {
  return user?.role === 'admin' || user?.role === 'operator';
}

export function canViewReports(user) {
  return user?.role === 'admin' || user?.role === 'operator';
}
