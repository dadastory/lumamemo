<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

definePageMeta({
  layout: 'dashboard',
  middleware: [
    () => {
      const { user } = useUserSession()
      if (user.value && !user.value.isAdmin) {
        return navigateTo('/dashboard/photos')
      }
    },
  ],
})

useHead({
  title: () => $t('title.users'),
})

type Role = 'admin' | 'user'

interface ManagedUser {
  id: number
  email: string
  username: string
  displayName?: string | null
  publicId?: string | null
  avatar?: string | null
  role: Role
  isAdmin: boolean
  disabledAt?: string | Date | null
  createdAt?: string | Date | null
  storageUsageBytes: number
  storageFileCount: number
  storageQuotaBytes: number
  storageQuotaGB: number | null
  storageQuotaSource: 'default' | 'user'
  storageQuotaOverrideBytes?: number | null
  storageQuotaOverrideGB?: number | null
  storageUsageRatio: number
  storageOverQuota: boolean
}

interface UserInvitation {
  id: number
  email: string
  role: Role
  expiresAt: string | Date
  acceptedAt?: string | Date | null
  revokedAt?: string | Date | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  inviteUrl?: string
}

interface DeletePreview {
  user: ManagedUser
  restrictions: {
    isSelf: boolean
    isLastActiveAdmin: boolean
  }
  counts: {
    photos: number
    albums: number
    invitations: number
    storageFiles: number
    skippedStorageFiles: number
  }
}

const toast = useToast()

const { data: users, refresh: refreshUsers } = await useFetch<ManagedUser[]>(
  '/api/users',
  {
    default: () => [],
  },
)

const {
  data: defaultStorageQuotaSetting,
  refresh: refreshDefaultStorageQuota,
} = await useFetch<{
  namespace: string
  key: string
  value: number | null
}>('/api/system/settings/system/storage.defaultUserQuotaGB')

const { data: invitations, refresh: refreshInvitations } = await useFetch<
  UserInvitation[]
>('/api/users/invitations', {
  default: () => [],
})

const isUserModalOpen = ref(false)
const isInviteModalOpen = ref(false)
const isSaving = ref(false)
const isSavingDefaultStorageQuota = ref(false)
const isInviting = ref(false)
const isDeletingUser = ref(false)
const editingUser = ref<ManagedUser | null>(null)
const deletingUser = ref<ManagedUser | null>(null)
const deletePreview = ref<DeletePreview | null>(null)
const deleteConfirmText = ref('')
const latestInviteUrl = ref('')
const defaultStorageQuotaGB = ref<number | null>(null)

watch(
  defaultStorageQuotaSetting,
  (setting) => {
    defaultStorageQuotaGB.value = Number(setting?.value || 50)
  },
  { immediate: true },
)

const userForm = reactive({
  email: '',
  username: '',
  password: '',
  role: 'user' as Role,
  disabled: false,
  inheritStorageQuota: true,
  storageQuotaGB: null as number | null,
})

const inviteForm = reactive({
  email: '',
  role: 'user' as Role,
  expiresAt: '',
})

const defaultInviteExpiryInput = () => {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const roleOptions = computed(() => [
  { label: $t('dashboard.users.roles.admin'), value: 'admin' },
  { label: $t('dashboard.users.roles.user'), value: 'user' },
])

const BYTES_PER_GB = 1024 * 1024 * 1024

const formattedDefaultStorageQuota = computed(() =>
  formatBytes(
    Math.max(0, Number(defaultStorageQuotaGB.value || 0)) * BYTES_PER_GB,
  ),
)

const userColumns: TableColumn<ManagedUser>[] = [
  { accessorKey: 'username', header: () => $t('dashboard.users.table.user') },
  { accessorKey: 'email', header: () => $t('dashboard.users.table.email') },
  { accessorKey: 'role', header: () => $t('dashboard.users.table.role') },
  {
    accessorKey: 'storageUsageBytes',
    header: () => $t('dashboard.users.table.storage'),
  },
  {
    accessorKey: 'disabledAt',
    header: () => $t('dashboard.users.table.status'),
  },
  { id: 'actions', header: () => $t('dashboard.users.table.actions') },
]

const inviteColumns: TableColumn<UserInvitation>[] = [
  { accessorKey: 'email', header: () => $t('dashboard.users.invites.email') },
  { accessorKey: 'role', header: () => $t('dashboard.users.table.role') },
  {
    accessorKey: 'expiresAt',
    header: () => $t('dashboard.users.invites.expiresAt'),
  },
  { accessorKey: 'status', header: () => $t('dashboard.users.table.status') },
  { id: 'actions', header: () => $t('dashboard.users.table.actions') },
]

const openCreate = () => {
  editingUser.value = null
  userForm.email = ''
  userForm.username = ''
  userForm.password = ''
  userForm.role = 'user'
  userForm.disabled = false
  userForm.inheritStorageQuota = true
  userForm.storageQuotaGB = null
  isUserModalOpen.value = true
}

const openEdit = (user: ManagedUser) => {
  editingUser.value = user
  userForm.email = user.email
  userForm.username = user.username
  userForm.password = ''
  userForm.role = user.role
  userForm.disabled = Boolean(user.disabledAt)
  userForm.inheritStorageQuota = user.storageQuotaSource !== 'user'
  userForm.storageQuotaGB = user.storageQuotaOverrideGB ?? null
  isUserModalOpen.value = true
}

const openInvite = () => {
  inviteForm.email = ''
  inviteForm.role = 'user'
  inviteForm.expiresAt = defaultInviteExpiryInput()
  latestInviteUrl.value = ''
  isInviteModalOpen.value = true
}

const saveUser = async () => {
  isSaving.value = true
  try {
    if (editingUser.value) {
      await $fetch(`/api/users/${editingUser.value.id}`, {
        method: 'PUT',
        body: {
          email: userForm.email,
          username: userForm.username,
          role: userForm.role,
          disabled: userForm.disabled,
          storageQuotaGB: userForm.inheritStorageQuota
            ? null
            : userForm.storageQuotaGB,
          ...(userForm.password ? { password: userForm.password } : {}),
        },
      })
      toast.add({
        title: $t('dashboard.users.messages.updated'),
        color: 'success',
      })
    } else {
      await $fetch('/api/users', {
        method: 'POST',
        body: {
          email: userForm.email,
          username: userForm.username,
          password: userForm.password,
          role: userForm.role,
          disabled: userForm.disabled,
          storageQuotaGB: userForm.inheritStorageQuota
            ? null
            : userForm.storageQuotaGB,
        },
      })
      toast.add({
        title: $t('dashboard.users.messages.created'),
        color: 'success',
      })
    }

    isUserModalOpen.value = false
    await refreshUsers()
  } catch (error: any) {
    toast.add({
      title: $t('dashboard.users.messages.saveFailed'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const saveDefaultStorageQuota = async () => {
  const quotaGB = Number(defaultStorageQuotaGB.value)
  if (!Number.isFinite(quotaGB) || quotaGB <= 0) {
    toast.add({
      title: $t('dashboard.users.messages.defaultQuotaSaveFailed'),
      description: $t('dashboard.users.storageSettings.invalidValue'),
      color: 'error',
    })
    return
  }

  isSavingDefaultStorageQuota.value = true
  try {
    await $fetch('/api/system/settings/system/storage.defaultUserQuotaGB', {
      method: 'PUT',
      body: { value: quotaGB },
    })
    await refreshSettings()
    await refreshDefaultStorageQuota()
    await refreshUsers()
    toast.add({
      title: $t('dashboard.users.messages.defaultQuotaSaved'),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title: $t('dashboard.users.messages.defaultQuotaSaveFailed'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    isSavingDefaultStorageQuota.value = false
  }
}

const createInvite = async () => {
  isInviting.value = true
  try {
    const response = await $fetch<UserInvitation & { inviteUrl: string }>(
      '/api/users/invitations',
      {
        method: 'POST',
        body: {
          email: inviteForm.email,
          role: inviteForm.role,
          expiresAt: inviteForm.expiresAt
            ? new Date(inviteForm.expiresAt).toISOString()
            : undefined,
        },
      },
    )
    latestInviteUrl.value = response.inviteUrl
    await refreshInvitations()
    toast.add({
      title: $t('dashboard.users.messages.inviteCreated'),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title: $t('dashboard.users.messages.inviteFailed'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    isInviting.value = false
  }
}

const copyInviteUrl = async (url: string) => {
  await navigator.clipboard.writeText(url)
  toast.add({
    title: $t('dashboard.users.messages.inviteCopied'),
    color: 'success',
  })
}

const revokeInvite = async (invite: UserInvitation) => {
  await $fetch(`/api/users/invitations/${invite.id}`, {
    method: 'DELETE',
  })
  await refreshInvitations()
  toast.add({
    title: $t('dashboard.users.messages.inviteDeleted'),
    color: 'success',
  })
}

const openDeleteUser = async (user: ManagedUser) => {
  deletingUser.value = user
  deleteConfirmText.value = ''
  deletePreview.value = await $fetch<DeletePreview>(
    `/api/users/${user.id}/delete-preview`,
  )
}

const closeDeleteUser = () => {
  deletingUser.value = null
  deletePreview.value = null
  deleteConfirmText.value = ''
}

const canConfirmDeleteUser = computed(
  () =>
    deletingUser.value &&
    deletePreview.value &&
    !deletePreview.value.restrictions.isSelf &&
    !deletePreview.value.restrictions.isLastActiveAdmin &&
    deleteConfirmText.value === deletingUser.value.username,
)

const deleteUser = async () => {
  if (!deletingUser.value || !canConfirmDeleteUser.value) return
  isDeletingUser.value = true
  try {
    await $fetch(`/api/users/${deletingUser.value.id}`, {
      method: 'DELETE',
    })
    toast.add({
      title: $t('dashboard.users.messages.userDeleted'),
      color: 'success',
    })
    closeDeleteUser()
    await refreshUsers()
    await refreshInvitations()
  } catch (error: any) {
    toast.add({
      title: $t('dashboard.users.messages.deleteUserFailed'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    isDeletingUser.value = false
  }
}

const statusColor = (status: string) => {
  if (status === 'pending') return 'warning'
  if (status === 'accepted') return 'success'
  if (status === 'revoked') return 'neutral'
  return 'error'
}

const storagePercent = (user: ManagedUser) =>
  Math.min(100, Math.max(0, Math.round((user.storageUsageRatio || 0) * 100)))

const storageProgressClass = (user: ManagedUser) => {
  if (user.storageOverQuota) return 'bg-error-500'
  if ((user.storageUsageRatio || 0) >= 0.9) return 'bg-warning-500'
  return 'bg-primary-500'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('title.users')">
        <template #right>
          <UButton
            icon="tabler:mail-plus"
            variant="soft"
            @click="openInvite"
          >
            {{ $t('dashboard.users.inviteButton') }}
          </UButton>
          <UButton
            icon="tabler:user-plus"
            variant="soft"
            @click="openCreate"
          >
            {{ $t('dashboard.users.createButton') }}
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <section
          class="rounded-md border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <header
            class="border-b border-gray-200 px-5 py-4 dark:border-neutral-800"
          >
            <h2 class="text-base font-semibold">
              {{ $t('dashboard.users.storageSettings.title') }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ $t('dashboard.users.storageSettings.description') }}
            </p>
          </header>
          <form
            class="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto]"
            @submit.prevent="saveDefaultStorageQuota"
          >
            <UFormField
              :label="$t('dashboard.users.form.defaultStorageQuota')"
              :help="$t('dashboard.users.form.defaultStorageQuotaHelp')"
              required
            >
              <UInput
                v-model.number="defaultStorageQuotaGB"
                class="w-full"
                type="number"
                min="0.1"
                step="0.1"
                required
              >
                <template #trailing>
                  <span class="text-xs text-muted">GB</span>
                </template>
              </UInput>
            </UFormField>
            <div class="flex items-end justify-between gap-3 md:justify-end">
              <p class="text-sm text-muted">
                {{
                  $t('dashboard.users.storageSettings.currentDefault', {
                    quota: formattedDefaultStorageQuota,
                  })
                }}
              </p>
              <UButton
                type="submit"
                icon="tabler:device-floppy"
                :loading="isSavingDefaultStorageQuota"
              >
                {{ $t('common.actions.saveSettings') }}
              </UButton>
            </div>
          </form>
        </section>

        <section
          class="rounded-md border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <header
            class="border-b border-gray-200 px-5 py-4 dark:border-neutral-800"
          >
            <h2 class="text-base font-semibold">
              {{ $t('dashboard.users.sections.users') }}
            </h2>
          </header>
          <UTable
            :data="users || []"
            :columns="userColumns"
          >
            <template #username-cell="{ row }">
              <div class="flex items-center gap-3">
                <UAvatar
                  :src="row.original.avatar || undefined"
                  :alt="row.original.username"
                  icon="tabler:user"
                />
                <div class="min-w-0">
                  <div class="truncate font-medium">
                    {{ row.original.username }}
                  </div>
                  <div class="text-xs text-muted">#{{ row.original.id }}</div>
                </div>
              </div>
            </template>

            <template #role-cell="{ row }">
              <UBadge
                :color="row.original.role === 'admin' ? 'primary' : 'neutral'"
                variant="soft"
              >
                {{ $t(`dashboard.users.roles.${row.original.role}`) }}
              </UBadge>
            </template>

            <template #storageUsageBytes-cell="{ row }">
              <div class="min-w-44 space-y-1.5">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="font-medium text-highlighted">
                    {{
                      $t('dashboard.users.storage.used', {
                        value: formatBytes(row.original.storageUsageBytes || 0),
                      })
                    }}
                  </span>
                  <span class="text-muted">
                    {{
                      $t('dashboard.users.storage.limit', {
                        value: formatBytes(row.original.storageQuotaBytes || 0),
                      })
                    }}
                  </span>
                </div>
                <div
                  class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800"
                  :aria-label="$t('dashboard.users.storage.usage')"
                >
                  <div
                    class="h-full rounded-full transition-all"
                    :class="storageProgressClass(row.original)"
                    :style="{ width: `${storagePercent(row.original)}%` }"
                  />
                </div>
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span
                    :class="
                      row.original.storageOverQuota
                        ? 'text-error-500'
                        : 'text-muted'
                    "
                  >
                    {{
                      row.original.storageOverQuota
                        ? $t('dashboard.users.storage.overQuotaStatus')
                        : $t('dashboard.users.storage.usagePercent', {
                            percent: storagePercent(row.original),
                          })
                    }}
                  </span>
                  <UBadge
                    size="xs"
                    variant="soft"
                    :color="
                      row.original.storageQuotaSource === 'user'
                        ? 'primary'
                        : 'neutral'
                    "
                  >
                    {{
                      row.original.storageQuotaSource === 'user'
                        ? $t('dashboard.users.storage.customOverride')
                        : $t('dashboard.users.storage.defaultInherited')
                    }}
                  </UBadge>
                </div>
              </div>
            </template>

            <template #disabledAt-cell="{ row }">
              <UBadge
                :color="row.original.disabledAt ? 'error' : 'success'"
                variant="soft"
              >
                {{
                  row.original.disabledAt
                    ? $t('dashboard.users.status.disabled')
                    : $t('dashboard.users.status.enabled')
                }}
              </UBadge>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  icon="tabler:edit"
                  variant="ghost"
                  color="neutral"
                  :aria-label="$t('dashboard.users.actions.edit')"
                  @click="openEdit(row.original)"
                />
                <UButton
                  icon="tabler:trash"
                  variant="ghost"
                  color="error"
                  :aria-label="$t('dashboard.users.actions.deleteUser')"
                  @click="openDeleteUser(row.original)"
                />
              </div>
            </template>
          </UTable>
        </section>

        <section
          class="rounded-md border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        >
          <header
            class="border-b border-gray-200 px-5 py-4 dark:border-neutral-800"
          >
            <h2 class="text-base font-semibold">
              {{ $t('dashboard.users.sections.invitations') }}
            </h2>
          </header>
          <UTable
            :data="invitations || []"
            :columns="inviteColumns"
          >
            <template #role-cell="{ row }">
              <UBadge
                :color="row.original.role === 'admin' ? 'primary' : 'neutral'"
                variant="soft"
              >
                {{ $t(`dashboard.users.roles.${row.original.role}`) }}
              </UBadge>
            </template>

            <template #expiresAt-cell="{ row }">
              {{ $dayjs(row.original.expiresAt).format('YYYY-MM-DD HH:mm') }}
            </template>

            <template #status-cell="{ row }">
              <UBadge
                :color="statusColor(row.original.status)"
                variant="soft"
              >
                {{ $t(`dashboard.users.inviteStatus.${row.original.status}`) }}
              </UBadge>
            </template>

            <template #actions-cell="{ row }">
              <UButton
                v-if="row.original.status === 'pending'"
                icon="tabler:trash"
                variant="ghost"
                color="error"
                :aria-label="$t('dashboard.users.actions.deleteInvite')"
                @click="revokeInvite(row.original)"
              />
            </template>
          </UTable>
        </section>
      </div>

      <UModal v-model:open="isUserModalOpen">
        <template #content>
          <form
            class="space-y-5 p-6"
            @submit.prevent="saveUser"
          >
            <h2 class="text-lg font-semibold">
              {{
                editingUser
                  ? $t('dashboard.users.editTitle')
                  : $t('dashboard.users.createTitle')
              }}
            </h2>

            <UFormField
              :label="$t('dashboard.users.form.username')"
              required
            >
              <UInput
                v-model="userForm.username"
                class="w-full"
                required
              />
            </UFormField>

            <UFormField
              :label="$t('dashboard.users.form.email')"
              required
            >
              <UInput
                v-model="userForm.email"
                class="w-full"
                type="email"
                required
              />
            </UFormField>

            <UFormField
              :label="
                editingUser
                  ? $t('dashboard.users.form.resetPassword')
                  : $t('dashboard.users.form.password')
              "
              :required="!editingUser"
            >
              <UInput
                v-model="userForm.password"
                class="w-full"
                type="password"
                :required="!editingUser"
                autocomplete="new-password"
              />
            </UFormField>

            <UFormField :label="$t('dashboard.users.form.role')">
              <USelect
                v-model="userForm.role"
                class="w-full"
                :items="roleOptions"
              />
            </UFormField>

            <UCheckbox
              v-model="userForm.disabled"
              :label="$t('dashboard.users.form.disabled')"
            />

            <div class="space-y-3 rounded-md border border-gray-200 p-3 dark:border-neutral-800">
              <UCheckbox
                v-model="userForm.inheritStorageQuota"
                :label="
                  $t('dashboard.users.form.inheritStorageQuota', {
                    quota: formattedDefaultStorageQuota,
                  })
                "
              />
              <UFormField
                :label="$t('dashboard.users.form.storageQuota')"
                :help="$t('dashboard.users.form.storageQuotaHelp')"
                :required="!userForm.inheritStorageQuota"
              >
                <UInput
                  v-model.number="userForm.storageQuotaGB"
                  class="w-full"
                  type="number"
                  min="0.1"
                  step="0.1"
                  :disabled="userForm.inheritStorageQuota"
                  :required="!userForm.inheritStorageQuota"
                >
                  <template #trailing>
                    <span class="text-xs text-muted">GB</span>
                  </template>
                </UInput>
              </UFormField>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                @click="isUserModalOpen = false"
              >
                {{ $t('common.actions.cancel') }}
              </UButton>
              <UButton
                type="submit"
                :loading="isSaving"
              >
                {{ $t('common.actions.save') }}
              </UButton>
            </div>
          </form>
        </template>
      </UModal>

      <UModal v-model:open="isInviteModalOpen">
        <template #content>
          <form
            class="space-y-5 p-6"
            @submit.prevent="createInvite"
          >
            <h2 class="text-lg font-semibold">
              {{ $t('dashboard.users.inviteTitle') }}
            </h2>

            <UAlert
              v-if="latestInviteUrl"
              color="success"
              variant="soft"
              icon="tabler:link"
              :title="$t('dashboard.users.invites.createdTitle')"
            >
              <template #description>
                <div class="mt-2 flex gap-2">
                  <UInput
                    :model-value="latestInviteUrl"
                    readonly
                    class="min-w-0 flex-1"
                  />
                  <UButton
                    icon="tabler:copy"
                    @click="copyInviteUrl(latestInviteUrl)"
                  />
                </div>
              </template>
            </UAlert>

            <UFormField
              :label="$t('dashboard.users.form.email')"
              required
            >
              <UInput
                v-model="inviteForm.email"
                class="w-full"
                type="email"
                required
              />
            </UFormField>

            <UFormField :label="$t('dashboard.users.form.role')">
              <USelect
                v-model="inviteForm.role"
                class="w-full"
                :items="roleOptions"
              />
            </UFormField>

            <UFormField :label="$t('dashboard.users.invites.expiresAt')">
              <UInput
                v-model="inviteForm.expiresAt"
                class="w-full"
                type="datetime-local"
              />
            </UFormField>

            <div class="flex justify-end gap-2 pt-2">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                @click="isInviteModalOpen = false"
              >
                {{ $t('common.actions.cancel') }}
              </UButton>
              <UButton
                type="submit"
                icon="tabler:mail-plus"
                :loading="isInviting"
              >
                {{ $t('dashboard.users.inviteButton') }}
              </UButton>
            </div>
          </form>
        </template>
      </UModal>

      <UModal
        :open="Boolean(deletingUser)"
        @update:open="(open) => !open && closeDeleteUser()"
      >
        <template #content>
          <div class="space-y-5 p-6">
            <div class="flex items-start gap-3">
              <UIcon
                name="tabler:alert-triangle"
                class="mt-1 size-6 text-error"
              />
              <div class="min-w-0 space-y-1">
                <h2 class="text-lg font-semibold">
                  {{ $t('dashboard.users.delete.title') }}
                </h2>
                <p class="text-sm text-muted">
                  {{
                    $t('dashboard.users.delete.description', {
                      username: deletingUser?.username,
                    })
                  }}
                </p>
              </div>
            </div>

            <UAlert
              v-if="deletePreview?.restrictions.isSelf"
              color="error"
              variant="soft"
              icon="tabler:ban"
              :title="$t('dashboard.users.delete.restrictions.self')"
            />
            <UAlert
              v-else-if="deletePreview?.restrictions.isLastActiveAdmin"
              color="error"
              variant="soft"
              icon="tabler:ban"
              :title="$t('dashboard.users.delete.restrictions.lastAdmin')"
            />

            <dl
              v-if="deletePreview"
              class="grid grid-cols-2 gap-3 rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800"
            >
              <div>
                <dt class="text-muted">
                  {{ $t('dashboard.users.delete.counts.albums') }}
                </dt>
                <dd class="font-semibold">
                  {{ deletePreview.counts.albums }}
                </dd>
              </div>
              <div>
                <dt class="text-muted">
                  {{ $t('dashboard.users.delete.counts.photos') }}
                </dt>
                <dd class="font-semibold">
                  {{ deletePreview.counts.photos }}
                </dd>
              </div>
              <div>
                <dt class="text-muted">
                  {{ $t('dashboard.users.delete.counts.files') }}
                </dt>
                <dd class="font-semibold">
                  {{ deletePreview.counts.storageFiles }}
                </dd>
              </div>
              <div>
                <dt class="text-muted">
                  {{ $t('dashboard.users.delete.counts.invitations') }}
                </dt>
                <dd class="font-semibold">
                  {{ deletePreview.counts.invitations }}
                </dd>
              </div>
              <div v-if="deletePreview.counts.skippedStorageFiles > 0">
                <dt class="text-muted">
                  {{ $t('dashboard.users.delete.counts.skippedFiles') }}
                </dt>
                <dd class="font-semibold text-warning">
                  {{ deletePreview.counts.skippedStorageFiles }}
                </dd>
              </div>
            </dl>

            <UFormField
              :label="
                $t('dashboard.users.delete.confirmLabel', {
                  username: deletingUser?.username,
                })
              "
            >
              <UInput
                v-model="deleteConfirmText"
                class="w-full"
                autocomplete="off"
              />
            </UFormField>

            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="closeDeleteUser"
              >
                {{ $t('common.actions.cancel') }}
              </UButton>
              <UButton
                color="error"
                icon="tabler:trash"
                :disabled="!canConfirmDeleteUser"
                :loading="isDeletingUser"
                @click="deleteUser"
              >
                {{ $t('dashboard.users.delete.confirm') }}
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
