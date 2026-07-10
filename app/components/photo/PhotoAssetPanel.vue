<script setup lang="ts">
interface Props {
  photo: Photo
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'photo-updated': [Photo]
}>()

type QueueTaskStatus = {
  status: 'pending' | 'in-stages' | 'completed' | 'failed'
  statusStage?: string | null
  errorMessage?: string | null
}

type PhotoMlTaskStatus = QueueTaskStatus & {
  id: number
  type: 'photo-ml-index' | 'photo-face-detect'
}

type PhotoMlTasksResponse = {
  tasks?: PhotoMlTaskStatus[]
}

const assets = ref<any[]>([])
const loading = ref(false)
const uploading = ref(false)
const processingTaskId = ref<number | null>(null)
const processingStage = ref<string | null>(null)
const errorMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const statusCheckInterval = ref<ReturnType<typeof setInterval> | null>(null)
const faceRefreshRunId = ref(0)

const isRawPhoto = computed(() => props.photo?.sourceType === 'raw')
const isProcessing = computed(() => processingTaskId.value !== null)
const isBusy = computed(
  () => loading.value || uploading.value || isProcessing.value,
)

const clearVariantTaskStatusCheck = () => {
  if (statusCheckInterval.value) {
    clearInterval(statusCheckInterval.value)
    statusCheckInterval.value = null
  }
  processingTaskId.value = null
  processingStage.value = null
}

const cancelFaceRefreshCheck = () => {
  faceRefreshRunId.value += 1
}

const loadAssets = async () => {
  if (!isRawPhoto.value || !props.photo?.id) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ assets: any[] }>(
      `/api/photos/${props.photo.id}/assets`,
    )
    assets.value = response.assets || []
  } catch (error) {
    errorMessage.value = (error as Error)?.message || $t('common.unknownError')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.photo?.id,
  () => {
    clearVariantTaskStatusCheck()
    cancelFaceRefreshCheck()
    assets.value = []
    loadAssets()
  },
  { immediate: true },
)

onUnmounted(() => {
  clearVariantTaskStatusCheck()
  cancelFaceRefreshCheck()
})

const refreshPhotoAfterVariantTask = async (photoId = props.photo?.id) => {
  if (!photoId) return

  try {
    const response = await $fetch<{ photo?: Photo }>(
      `/api/photos/${photoId}/detail`,
    )
    const refreshedPhoto = response.photo
    if (refreshedPhoto && props.photo?.id === photoId) {
      emit('photo-updated', refreshedPhoto)
    }
    if (props.photo?.id === photoId) {
      await loadAssets()
    }
  } catch (error) {
    errorMessage.value =
      (error as Error)?.message || $t('photo.rawVersions.reloadFailed')
  }
}

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const findTask = (
  tasks: PhotoMlTaskStatus[] | undefined,
  type: PhotoMlTaskStatus['type'],
) => tasks?.find((task) => task.type === type)

const refreshPhotoAfterFaceTask = async (photoId: string, afterTaskId: number) => {
  const runId = (faceRefreshRunId.value += 1)
  let failedChecks = 0

  for (let attempt = 0; attempt < 45; attempt += 1) {
    await wait(1500)
    if (faceRefreshRunId.value !== runId || props.photo?.id !== photoId) return

    try {
      const response = await $fetch<PhotoMlTasksResponse>(
        `/api/photos/${photoId}/ml-tasks?afterId=${encodeURIComponent(String(afterTaskId))}`,
      )
      failedChecks = 0
      const faceTask = findTask(response.tasks, 'photo-face-detect')
      const mlTask = findTask(response.tasks, 'photo-ml-index')

      if (
        faceTask?.status === 'completed' ||
        faceTask?.status === 'failed' ||
        mlTask?.status === 'failed'
      ) {
        await refreshPhotoAfterVariantTask(photoId)
        return
      }
    } catch {
      failedChecks += 1
      if (failedChecks >= 3) break
    }
  }

  if (faceRefreshRunId.value === runId && props.photo?.id === photoId) {
    await refreshPhotoAfterVariantTask(photoId)
  }
}

const startVariantTaskStatusCheck = (taskId: number) => {
  clearVariantTaskStatusCheck()
  cancelFaceRefreshCheck()
  processingTaskId.value = taskId
  processingStage.value = null

  const intervalId = setInterval(async () => {
    try {
      const response = await $fetch<QueueTaskStatus>(
        `/api/queue/stats/${taskId}`,
      )
      processingStage.value =
        response.status === 'in-stages' ? response.statusStage || null : null

      if (response.status === 'completed') {
        const photoId = props.photo?.id
        clearVariantTaskStatusCheck()
        await refreshPhotoAfterVariantTask(photoId)
        if (photoId) {
          void refreshPhotoAfterFaceTask(photoId, taskId)
        }
      } else if (response.status === 'failed') {
        clearVariantTaskStatusCheck()
        errorMessage.value =
          response.errorMessage || $t('photo.rawVersions.processingFailed')
      }
    } catch (error) {
      clearVariantTaskStatusCheck()
      errorMessage.value =
        (error as Error)?.message || $t('photo.rawVersions.processingFailed')
    }
  }, 1000)

  statusCheckInterval.value = intervalId
}

const setPrimaryAsset = async (assetId: number) => {
  if (!props.photo?.id) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ photo?: Photo; taskId?: number | null }>(
      `/api/photos/${props.photo.id}/assets/${assetId}/primary`,
      { method: 'POST' },
    )
    if (typeof response.taskId === 'number') {
      startVariantTaskStatusCheck(response.taskId)
    } else if (response.photo) {
      emit('photo-updated', response.photo)
    }
    await loadAssets()
  } catch (error) {
    errorMessage.value = (error as Error)?.message || $t('common.unknownError')
  } finally {
    loading.value = false
  }
}

const rotateDisplay = async (degrees: -90 | 90) => {
  if (!props.photo?.id) return
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<{ photo?: Photo; taskId?: number | null }>(
      `/api/photos/${props.photo.id}/display/rotate`,
      {
        method: 'POST',
        body: { degrees },
      },
    )
    if (typeof response.taskId === 'number') {
      startVariantTaskStatusCheck(response.taskId)
    } else if (response.photo) {
      emit('photo-updated', response.photo)
    }
    await loadAssets()
  } catch (error) {
    errorMessage.value = (error as Error)?.message || $t('common.unknownError')
  } finally {
    loading.value = false
  }
}

const deleteAsset = async (asset: any) => {
  if (!props.photo?.id || !asset?.id) return
  if (asset.isPrimary || asset.storageKey === props.photo.displayStorageKey) {
    errorMessage.value = $t('photo.rawVersions.cannotDeletePrimary')
    return
  }
  if (!confirm($t('photo.rawVersions.deleteConfirm'))) return

  loading.value = true
  errorMessage.value = ''
  try {
    await $fetch(`/api/photos/${props.photo.id}/assets/${asset.id}`, {
      method: 'DELETE',
    })
    await loadAssets()
  } catch (error) {
    errorMessage.value =
      (error as Error)?.message || $t('photo.rawVersions.deleteFailed')
  } finally {
    loading.value = false
  }
}

const uploadAsset = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !props.photo?.id) return

  uploading.value = true
  errorMessage.value = ''
  const uploadManager = useUpload({ timeout: 10 * 60 * 1000 })

  try {
    const safeName = file.name.replace(/[\\/:*?"<>|\r\n]+/g, '-')
    const response = await $fetch<any>('/api/photos', {
      method: 'POST',
      body: {
        fileName: `raw-renders/${props.photo.id}/${Date.now()}-${safeName}`,
        contentType: file.type || 'application/octet-stream',
        skipDuplicateCheck: true,
      },
    })

    await uploadManager.uploadFile(file, response.signedUrl)
    await $fetch(`/api/photos/${props.photo.id}/assets`, {
      method: 'POST',
      body: {
        storageKey: response.fileKey,
        fileName: file.name,
        mimeType: file.type || undefined,
      },
    })
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
    await loadAssets()
  } catch (error) {
    errorMessage.value = (error as Error)?.message || $t('common.unknownError')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div
    v-if="isRawPhoto"
    class="pointer-events-auto absolute left-4 bottom-24 z-30 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/15 bg-black/55 p-3 text-white shadow-lg backdrop-blur-md"
  >
    <div
      v-if="isProcessing"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-white backdrop-blur-sm"
    >
      <Icon
        name="svg-spinners:180-ring"
        class="size-6"
      />
      <p class="text-sm font-medium">
        {{ $t('photo.rawVersions.processing') }}
      </p>
      <p
        v-if="processingStage"
        class="text-xs text-white/60"
      >
        {{ processingStage }}
      </p>
    </div>

    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm font-semibold truncate">
          {{ $t('photo.rawVersions.title') }}
        </p>
        <p class="text-xs text-white/60 truncate">
          {{
            $t(
              'photo.rawVersions.count',
              { count: assets.length },
              assets.length,
            )
          }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50"
          :aria-label="$t('photo.rawVersions.rotateLeft')"
          :title="$t('photo.rawVersions.rotateLeft')"
          :disabled="isBusy"
          @click="rotateDisplay(-90)"
        >
          <Icon
            name="tabler:rotate-2"
            class="size-4"
          />
        </button>
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-md bg-white/15 hover:bg-white/25 disabled:opacity-50"
          :aria-label="$t('photo.rawVersions.rotateRight')"
          :title="$t('photo.rawVersions.rotateRight')"
          :disabled="isBusy"
          @click="rotateDisplay(90)"
        >
          <Icon
            name="tabler:rotate-clockwise-2"
            class="size-4"
          />
        </button>
        <label
          class="cursor-pointer rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-medium hover:bg-white/25"
        >
          <input
            ref="fileInputRef"
            type="file"
            class="hidden"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            :disabled="isBusy"
            @change="uploadAsset"
          />
          {{
            uploading
              ? $t('photo.rawVersions.uploading')
              : $t('photo.rawVersions.addRender')
          }}
        </label>
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="mt-2 rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-100"
    >
      {{ errorMessage }}
    </div>

    <div class="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
      <div
        v-for="asset in assets"
        :key="asset.id"
        class="flex items-center gap-2 rounded-md bg-white/10 p-2"
      >
        <img
          :src="asset.url"
          :alt="asset.fileName"
          class="h-10 w-10 shrink-0 rounded object-cover"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium">{{ asset.fileName }}</p>
          <p class="truncate text-[11px] text-white/55">
            {{ asset.width }}x{{ asset.height }}
            <span v-if="asset.isPrimary">
              · {{ $t('photo.rawVersions.primary') }}
            </span>
          </p>
        </div>
        <button
          v-if="!asset.isPrimary"
          type="button"
          class="shrink-0 rounded bg-white/15 px-2 py-1 text-[11px] hover:bg-white/25 disabled:opacity-50"
          :disabled="isBusy"
          @click="setPrimaryAsset(asset.id)"
        >
          {{ $t('photo.rawVersions.setPrimary') }}
        </button>
        <button
          v-if="!asset.isPrimary"
          type="button"
          class="inline-flex size-7 shrink-0 items-center justify-center rounded bg-red-500/20 text-red-100 hover:bg-red-500/30 disabled:opacity-50"
          :aria-label="$t('photo.rawVersions.deleteVersion')"
          :title="$t('photo.rawVersions.deleteVersion')"
          :disabled="isBusy"
          @click="deleteAsset(asset)"
        >
          <Icon
            name="tabler:trash"
            class="size-4"
          />
        </button>
      </div>
    </div>
  </div>
</template>
