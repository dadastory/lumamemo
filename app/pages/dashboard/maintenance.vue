<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => $t('title.dataMaintenance'),
})

type CleanupScope = 'all' | 'user' | 'photo'

type CleanupResult = {
  ok: boolean
  deleted: {
    photos: number
    photoEmbeddings: number
    faceEmbeddings: number
    faceCrops: number
    aiMetadata: number
    people: number
    queueTasks: number
  }
  errors: Array<{ target: string; message: string }>
}

type PendingUploadCleanupResult = {
  scanned: number
  deletedFiles: number
  completedReferences: number
  deletedRows: number
  errors: Array<{ storageKey: string; message: string }>
}

const CONFIRMATION_TEXT = 'DELETE AI DATA'

const toast = useToast()
const cleanupScope = ref<CleanupScope>('all')
const userIdInput = ref('')
const photoIdInput = ref('')
const confirmationInput = ref('')
const cleanupLoading = ref(false)
const cleanupResult = ref<CleanupResult | null>(null)
const pendingUploadCleanupLoading = ref(false)
const pendingUploadCleanupResult = ref<PendingUploadCleanupResult | null>(null)

const cleanupScopeOptions = computed(() => [
  {
    label: $t('dashboard.maintenance.aiCleanup.scopes.all'),
    value: 'all',
  },
  {
    label: $t('dashboard.maintenance.aiCleanup.scopes.user'),
    value: 'user',
  },
  {
    label: $t('dashboard.maintenance.aiCleanup.scopes.photo'),
    value: 'photo',
  },
])

const normalizedUserId = computed(() => Number(userIdInput.value))
const hasValidUserId = computed(
  () => Number.isInteger(normalizedUserId.value) && normalizedUserId.value > 0,
)
const hasValidPhotoId = computed(() => photoIdInput.value.trim().length > 0)
const hasRequiredScopeTarget = computed(() => {
  if (cleanupScope.value === 'user') return hasValidUserId.value
  if (cleanupScope.value === 'photo') return hasValidPhotoId.value
  return true
})
const hasConfirmedCleanup = computed(
  () => confirmationInput.value === CONFIRMATION_TEXT,
)
const canRunCleanup = computed(
  () =>
    !cleanupLoading.value &&
    hasRequiredScopeTarget.value &&
    hasConfirmedCleanup.value,
)

const cleanupSummary = computed(() => {
  const deleted = cleanupResult.value?.deleted
  if (!deleted) return []
  return [
    {
      label: $t('dashboard.maintenance.aiCleanup.result.photos'),
      value: deleted.photos,
    },
    {
      label: $t('dashboard.maintenance.aiCleanup.result.photoEmbeddings'),
      value: deleted.photoEmbeddings,
    },
    {
      label: $t('dashboard.maintenance.aiCleanup.result.faceEmbeddings'),
      value: deleted.faceEmbeddings,
    },
    {
      label: $t('dashboard.maintenance.aiCleanup.result.faceCrops'),
      value: deleted.faceCrops,
    },
    {
      label: $t('dashboard.maintenance.aiCleanup.result.aiMetadata'),
      value: deleted.aiMetadata,
    },
    {
      label: $t('dashboard.maintenance.aiCleanup.result.people'),
      value: deleted.people,
    },
    {
      label: $t('dashboard.maintenance.aiCleanup.result.queueTasks'),
      value: deleted.queueTasks,
    },
  ]
})

const pendingUploadCleanupSummary = computed(() => {
  const result = pendingUploadCleanupResult.value
  if (!result) return []
  return [
    {
      label: $t('dashboard.maintenance.pendingUploads.result.scanned'),
      value: result.scanned,
    },
    {
      label: $t('dashboard.maintenance.pendingUploads.result.deletedFiles'),
      value: result.deletedFiles,
    },
    {
      label: $t('dashboard.maintenance.pendingUploads.result.completedReferences'),
      value: result.completedReferences,
    },
    {
      label: $t('dashboard.maintenance.pendingUploads.result.errors'),
      value: result.errors.length,
    },
  ]
})

watch(cleanupScope, () => {
  userIdInput.value = ''
  photoIdInput.value = ''
  cleanupResult.value = null
})

const buildCleanupBody = () => {
  if (cleanupScope.value === 'user') {
    return {
      scope: 'user' as const,
      userId: normalizedUserId.value,
      includeEditedPeople: false,
      includeQueueTasks: true,
    }
  }
  if (cleanupScope.value === 'photo') {
    return {
      scope: 'photo' as const,
      photoId: photoIdInput.value.trim(),
      includeEditedPeople: false,
      includeQueueTasks: true,
    }
  }
  return {
    scope: 'all' as const,
    includeEditedPeople: false,
    includeQueueTasks: true,
  }
}

const runAiCleanup = async () => {
  if (!canRunCleanup.value) return
  cleanupLoading.value = true
  cleanupResult.value = null
  try {
    const result = await $fetch<CleanupResult>('/api/system/ml/cleanup', {
      method: 'POST',
      body: buildCleanupBody(),
    })
    cleanupResult.value = result
    toast.add({
      title: result.ok
        ? $t('dashboard.maintenance.aiCleanup.messages.success')
        : $t('dashboard.maintenance.aiCleanup.messages.partialSuccess'),
      color: result.ok ? 'success' : 'warning',
    })
    confirmationInput.value = ''
  } catch (error: any) {
    toast.add({
      title:
        error?.data?.statusMessage ||
        error?.statusMessage ||
        $t('dashboard.maintenance.aiCleanup.messages.failed'),
      color: 'error',
    })
  } finally {
    cleanupLoading.value = false
  }
}

const runPendingUploadCleanup = async () => {
  pendingUploadCleanupLoading.value = true
  pendingUploadCleanupResult.value = null
  try {
    const result = await $fetch<PendingUploadCleanupResult>(
      '/api/system/storage/cleanup-uploads',
      {
        method: 'POST',
      },
    )
    pendingUploadCleanupResult.value = result
    toast.add({
      title:
        result.errors.length === 0
          ? $t('dashboard.maintenance.pendingUploads.messages.success')
          : $t('dashboard.maintenance.pendingUploads.messages.partialSuccess'),
      color: result.errors.length === 0 ? 'success' : 'warning',
    })
  } catch (error: any) {
    toast.add({
      title:
        error?.data?.statusMessage ||
        error?.statusMessage ||
        $t('dashboard.maintenance.pendingUploads.messages.failed'),
      color: 'error',
    })
  } finally {
    pendingUploadCleanupLoading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="dashboard-maintenance">
    <template #header>
      <UDashboardNavbar :title="$t('title.dataMaintenance')" />
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6">
        <header>
          <h1 class="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {{ $t('title.dataMaintenance') }}
          </h1>
          <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {{ $t('dashboard.maintenance.description') }}
          </p>
        </header>

        <section class="rounded-lg border border-error-200 bg-white shadow-sm dark:border-error-900/70 dark:bg-neutral-950">
          <header class="border-b border-error-200 px-5 py-4 dark:border-error-900/70">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold text-neutral-950 dark:text-white">
                  {{ $t('dashboard.maintenance.aiCleanup.title') }}
                </h2>
                <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {{ $t('dashboard.maintenance.aiCleanup.description') }}
                </p>
              </div>
              <UBadge color="error" variant="soft">
                {{ $t('dashboard.maintenance.dangerous') }}
              </UBadge>
            </div>
          </header>

          <div class="space-y-5 px-5 py-5">
            <UAlert
              color="warning"
              variant="soft"
              icon="tabler:alert-triangle"
              :title="$t('dashboard.maintenance.aiCleanup.warningTitle')"
              :description="$t('dashboard.maintenance.aiCleanup.warningDescription')"
            />

            <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <UFormField :label="$t('dashboard.maintenance.aiCleanup.scopeLabel')">
                <USelect
                  v-model="cleanupScope"
                  class="w-full"
                  :items="cleanupScopeOptions"
                />
              </UFormField>

              <UFormField
                v-if="cleanupScope === 'user'"
                :label="$t('dashboard.maintenance.aiCleanup.userIdLabel')"
                :error="
                  userIdInput && !hasValidUserId
                    ? $t('dashboard.maintenance.aiCleanup.userIdError')
                    : undefined
                "
              >
                <UInput
                  v-model="userIdInput"
                  class="w-full"
                  inputmode="numeric"
                  placeholder="1"
                />
              </UFormField>

              <UFormField
                v-else-if="cleanupScope === 'photo'"
                :label="$t('dashboard.maintenance.aiCleanup.photoIdLabel')"
              >
                <UInput
                  v-model="photoIdInput"
                  class="w-full"
                  placeholder="photo-id"
                />
              </UFormField>
            </div>

            <div class="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
              <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {{ $t('dashboard.maintenance.aiCleanup.deletesTitle') }}
              </p>
              <ul class="mt-3 grid gap-2 text-sm text-neutral-600 dark:text-neutral-400 sm:grid-cols-2">
                <li>{{ $t('dashboard.maintenance.aiCleanup.deletes.photoEmbeddings') }}</li>
                <li>{{ $t('dashboard.maintenance.aiCleanup.deletes.faceEmbeddings') }}</li>
                <li>{{ $t('dashboard.maintenance.aiCleanup.deletes.faceCrops') }}</li>
                <li>{{ $t('dashboard.maintenance.aiCleanup.deletes.people') }}</li>
                <li>{{ $t('dashboard.maintenance.aiCleanup.deletes.queueTasks') }}</li>
              </ul>
            </div>

            <UFormField
              :label="$t('dashboard.maintenance.aiCleanup.confirmLabel', { text: CONFIRMATION_TEXT })"
            >
              <UInput
                v-model="confirmationInput"
                class="w-full"
                :placeholder="CONFIRMATION_TEXT"
              />
            </UFormField>

            <div
              v-if="cleanupResult"
              class="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="cleanupResult.ok ? 'tabler:circle-check' : 'tabler:alert-triangle'"
                  :class="cleanupResult.ok ? 'text-success-500' : 'text-warning-500'"
                />
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {{
                    cleanupResult.ok
                      ? $t('dashboard.maintenance.aiCleanup.messages.success')
                      : $t('dashboard.maintenance.aiCleanup.messages.partialSuccess')
                  }}
                </p>
              </div>
              <dl class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div
                  v-for="item in cleanupSummary"
                  :key="item.label"
                  class="rounded-md bg-neutral-50 px-3 py-2 dark:bg-neutral-900/60"
                >
                  <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                    {{ item.label }}
                  </dt>
                  <dd class="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {{ item.value }}
                  </dd>
                </div>
              </dl>
              <p
                v-if="cleanupResult.errors.length > 0"
                class="mt-3 text-sm text-warning-600 dark:text-warning-400"
              >
                {{
                  $t('dashboard.maintenance.aiCleanup.messages.errorCount', {
                    count: cleanupResult.errors.length,
                  })
                }}
              </p>
            </div>
          </div>

          <footer class="border-t border-error-200 px-5 py-4 dark:border-error-900/70">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ $t('dashboard.maintenance.aiCleanup.protectionNote') }}
              </p>
              <UButton
                color="error"
                icon="tabler:database-x"
                :loading="cleanupLoading"
                :disabled="!canRunCleanup"
                @click="runAiCleanup"
              >
                {{ $t('dashboard.maintenance.aiCleanup.action') }}
              </UButton>
            </div>
          </footer>
        </section>

        <section class="rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <header class="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 class="text-base font-semibold text-neutral-950 dark:text-white">
                  {{ $t('dashboard.maintenance.pendingUploads.title') }}
                </h2>
                <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {{ $t('dashboard.maintenance.pendingUploads.description') }}
                </p>
              </div>
              <UBadge color="warning" variant="soft">
                {{ $t('dashboard.maintenance.pendingUploads.badge') }}
              </UBadge>
            </div>
          </header>

          <div class="space-y-5 px-5 py-5">
            <UAlert
              color="warning"
              variant="soft"
              icon="tabler:cloud-off"
              :title="$t('dashboard.maintenance.pendingUploads.warningTitle')"
              :description="$t('dashboard.maintenance.pendingUploads.warningDescription')"
            />

            <div
              v-if="pendingUploadCleanupResult"
              class="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  :name="pendingUploadCleanupResult.errors.length === 0 ? 'tabler:circle-check' : 'tabler:alert-triangle'"
                  :class="pendingUploadCleanupResult.errors.length === 0 ? 'text-success-500' : 'text-warning-500'"
                />
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {{
                    pendingUploadCleanupResult.errors.length === 0
                      ? $t('dashboard.maintenance.pendingUploads.messages.success')
                      : $t('dashboard.maintenance.pendingUploads.messages.partialSuccess')
                  }}
                </p>
              </div>
              <dl class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div
                  v-for="item in pendingUploadCleanupSummary"
                  :key="item.label"
                  class="rounded-md bg-neutral-50 px-3 py-2 dark:bg-neutral-900/60"
                >
                  <dt class="text-xs text-neutral-500 dark:text-neutral-400">
                    {{ item.label }}
                  </dt>
                  <dd class="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {{ item.value }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <footer class="border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ $t('dashboard.maintenance.pendingUploads.protectionNote') }}
              </p>
              <UButton
                color="warning"
                variant="soft"
                icon="tabler:trash"
                :loading="pendingUploadCleanupLoading"
                @click="runPendingUploadCleanup"
              >
                {{ $t('dashboard.maintenance.pendingUploads.action') }}
              </UButton>
            </div>
          </footer>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
