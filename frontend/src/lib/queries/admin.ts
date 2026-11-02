import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/lib/api"
import type {
  CreateInvitationRequest,
  CreateRoleRequest,
  Id,
  InvitationFilter,
  PageQuery,
  UpdateRoleRequest,
} from "@/lib/api/types"

export const adminKeys = {
  scopes: ["scopes"] as const,
  tenant: ["tenant"] as const,
  users: ["users"] as const,
  userList: (query: PageQuery) => ["users", "list", query] as const,
  user: (id: Id) => ["users", "detail", id] as const,
  userRoles: (id: Id) => ["users", "roles", id] as const,
  roles: ["roles"] as const,
  roleList: () => ["roles", "list"] as const,
  role: (id: Id) => ["roles", "detail", id] as const,
  invitations: ["invitations"] as const,
  invitationList: (filter: InvitationFilter) =>
    ["invitations", "list", filter] as const,
  invitation: (id: Id) => ["invitations", "detail", id] as const,
}

export const adminQueries = {
  scopes: () =>
    queryOptions({
      queryKey: adminKeys.scopes,
      queryFn: () => api.tenants.scopes(),
      staleTime: Infinity,
    }),
  tenant: () =>
    queryOptions({
      queryKey: adminKeys.tenant,
      queryFn: () => api.tenants.me(),
    }),
  users: (query: PageQuery = {}) =>
    queryOptions({
      queryKey: adminKeys.userList(query),
      queryFn: () => api.users.list(query),
    }),
  user: (id: Id) =>
    queryOptions({
      queryKey: adminKeys.user(id),
      queryFn: () => api.users.get(id),
    }),
  userRoles: (id: Id) =>
    queryOptions({
      queryKey: adminKeys.userRoles(id),
      queryFn: () => api.users.roles(id),
    }),
  roles: () =>
    queryOptions({
      queryKey: adminKeys.roleList(),
      queryFn: () => api.roles.list(),
    }),
  role: (id: Id) =>
    queryOptions({
      queryKey: adminKeys.role(id),
      queryFn: () => api.roles.get(id),
    }),
  invitations: (filter: InvitationFilter = {}) =>
    queryOptions({
      queryKey: adminKeys.invitationList(filter),
      queryFn: () => api.invitations.list(filter),
    }),
  invitation: (id: Id) =>
    queryOptions({
      queryKey: adminKeys.invitation(id),
      queryFn: () => api.invitations.get(id),
    }),
}

// Users ---------------------------------------------------------------------

export function useSetUserStatus(userId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (action: "suspend" | "reinstate") =>
      action === "suspend"
        ? api.users.suspend(userId)
        : api.users.reinstate(userId),
    onSuccess: (user) => queryClient.setQueryData(adminKeys.user(userId), user),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  })
}

export function useSetUserScopes(userId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scopes: string[]) => api.users.setScopes(userId, scopes),
    onSuccess: (user) => queryClient.setQueryData(adminKeys.user(userId), user),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  })
}

export function useAssignRole(userId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ roleId, assign }: { roleId: Id; assign: boolean }) =>
      assign
        ? api.roles.assign(roleId, userId)
        : api.roles.unassign(roleId, userId),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.userRoles(userId) }),
  })
}

// Roles ---------------------------------------------------------------------

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRoleRequest) => api.roles.create(body),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.roles }),
  })
}

export function useUpdateRole(roleId: Id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateRoleRequest) => api.roles.update(roleId, body),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.roles }),
        queryClient.invalidateQueries({ queryKey: adminKeys.users }),
      ]),
  })
}

export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (roleId: Id) => api.roles.remove(roleId),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.roles }),
        queryClient.invalidateQueries({ queryKey: adminKeys.users }),
      ]),
  })
}

// Invitations ---------------------------------------------------------------

export function useCreateInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateInvitationRequest) => api.invitations.create(body),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.invitations }),
  })
}

export function useInvitationAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: Id; action: "resend" | "revoke" }) =>
      action === "resend"
        ? api.invitations.resend(id)
        : api.invitations.revoke(id),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: adminKeys.invitations }),
  })
}
