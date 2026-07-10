<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { motion } from 'motion-v'
import type { NeededExif } from '../../../shared/types/photo'
import type { KVData } from './KVRenderer.vue'
import { formatCameraInfo, formatLensInfo } from '~/utils/camera'
import { formatPhotoLocation } from '~/utils/photo-location'

interface Props {
  currentPhoto: Photo
  exifData?: NeededExif | null
  globeRoute?: string | null
  albumRoute?: string | null
  onClose?: () => void
}

interface Album {
  id: number
  title: string
  description: string | null
  coverPhotoId: string | null
  createdAt: Date
  updatedAt: Date
}

const dayjs = useDayjs()
const router = useRouter()
const { t } = useI18n()
const { localizeExif } = useExifLocalization()

const props = defineProps<Props>()
const emit = defineEmits<{
  'photo-updated': [Photo]
}>()
const { loggedIn, user } = useUserSession()
const canLoadPhotoAlbums = computed(() => {
  const ownerUserId = (props.currentPhoto as any).ownerUserId
  const userId = user.value?.id
  return Boolean(
    loggedIn.value &&
      ownerUserId != null &&
      userId != null &&
      Number(ownerUserId) === Number(userId),
  )
})

// 获取照片所属的相册
const { data: _albums } = useFetch<Album[]>(
  () => `/api/photos/${props.currentPhoto.id}/albums`,
  {
    immediate: canLoadPhotoAlbums,
    watch: [() => props.currentPhoto.id, canLoadPhotoAlbums],
  },
)

const albums = computed(() => (canLoadPhotoAlbums.value ? _albums.value || [] : []))

// 格式化曝光时间
const formatExposureTime = (
  exposureTime: string | number | undefined,
): string => {
  if (!exposureTime) return ''

  let seconds: number

  if (typeof exposureTime === 'string') {
    if (exposureTime.includes('/')) {
      const parts = exposureTime.split('/')
      if (parts.length === 2 && parts[0] && parts[1]) {
        const numerator = parseFloat(parts[0])
        const denominator = parseFloat(parts[1])
        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
          seconds = numerator / denominator
        } else {
          return exposureTime
        }
      } else {
        return exposureTime
      }
    } else {
      seconds = parseFloat(exposureTime)
      if (isNaN(seconds)) {
        return exposureTime
      }
    }
  } else {
    seconds = exposureTime
  }

  if (seconds >= 1) {
    return `${seconds}s`
  } else {
    const denominator = Math.round(1 / seconds)
    return `1/${denominator}`
  }
}

// 格式化GPS坐标为两行显示
const formatGPSCoordinatesMultiLine = (
  latitude: number,
  longitude: number,
): string => {
  const latDirection = latitude >= 0 ? 'N' : 'S'
  const lngDirection = longitude >= 0 ? 'E' : 'W'

  const latDegrees = Math.abs(latitude)
  const lngDegrees = Math.abs(longitude)

  const latDeg = Math.floor(latDegrees)
  const latMin = Math.floor((latDegrees - latDeg) * 60)
  const latSec = ((latDegrees - latDeg) * 60 - latMin) * 60

  const lngDeg = Math.floor(lngDegrees)
  const lngMin = Math.floor((lngDegrees - lngDeg) * 60)
  const lngSec = ((lngDegrees - lngDeg) * 60 - lngMin) * 60

  return `${latDeg}°${latMin}'${latSec.toFixed(2)}"${latDirection}\n${lngDeg}°${lngMin}'${lngSec.toFixed(2)}"${lngDirection}`
}

const gpsCoordinates = computed(() => {
  // 优先使用数据库中存储的坐标
  if (props.currentPhoto.latitude && props.currentPhoto.longitude) {
    return {
      latitude: props.currentPhoto.latitude,
      longitude: props.currentPhoto.longitude,
    }
  }

  // 如果数据库中没有，尝试从EXIF数据中获取
  if (!props.exifData) return null
  const { GPSLatitude, GPSLongitude } = props.exifData
  if (GPSLatitude && GPSLongitude) {
    return {
      latitude: parseFloat(`${GPSLatitude}`),
      longitude: parseFloat(`${GPSLongitude}`),
    }
  }
  return null
})

const displayLocation = computed(() => formatPhotoLocation(props.currentPhoto))
const photoFaces = computed(() => {
  const faces = (props.currentPhoto as any).photoFaces
  return Array.isArray(faces) ? faces : []
})
const failedFaceCropIds = ref<Record<string, boolean>>({})
const getFaceRenderId = (face: any) => String(face.id ?? face.faceId ?? '')
const markFaceCropFailed = (face: any) => {
  const id = getFaceRenderId(face)
  if (!id) return
  failedFaceCropIds.value = {
    ...failedFaceCropIds.value,
    [id]: true,
  }
}
const shouldShowFaceCrop = (face: any) =>
  Boolean(face.cropUrl && !failedFaceCropIds.value[getFaceRenderId(face)])
watch(
  () => props.currentPhoto.id,
  () => {
    failedFaceCropIds.value = {}
  },
)
const aiAnalysis = computed(
  () => (props.currentPhoto as any).aiAnalysis || null,
)

type AiAnalysisStage =
  | 'tags'
  | 'description'
  | 'score'
  | 'critique'
  | 'suggestions'

type AiStageLocalState = 'queueing' | 'processing' | 'refreshing'

type QueueTaskStatus = {
  status: 'pending' | 'in-stages' | 'completed' | 'failed'
  statusStage?: string | null
  errorMessage?: string | null
}

const activeAiStageStates = ref<
  Partial<Record<AiAnalysisStage, AiStageLocalState>>
>({})
const aiStageErrors = ref<Partial<Record<AiAnalysisStage, string>>>({})
const aiAnalysisTaskStatusIntervals = ref<
  Record<number, ReturnType<typeof setInterval>>
>({})

const aiStageState = (stage: AiAnalysisStage) =>
  aiAnalysis.value?.stages?.[stage]?.status || 'missing'
const isAiStageBusy = (stage: AiAnalysisStage) =>
  Boolean(activeAiStageStates.value[stage]) ||
  aiStageState(stage) === 'processing'
const isAnyAiStageBusy = computed(() =>
  (['description', 'score', 'critique', 'suggestions'] as AiAnalysisStage[]).some(
    (stage) => isAiStageBusy(stage),
  ),
)
const hasAiAnalysis = computed(() => {
  const analysis = aiAnalysis.value
  const stages = analysis?.stages || {}
  return Boolean(
    canRetryAiAnalysis.value ||
    isAnyAiStageBusy.value ||
    analysis?.description ||
    analysis?.score != null ||
    analysis?.evaluation ||
    (Array.isArray(analysis?.strengths) && analysis.strengths.length > 0) ||
    (Array.isArray(analysis?.suggestions) && analysis.suggestions.length > 0) ||
    Object.values(stages).some((stage: any) =>
      ['processing', 'failed', 'ready'].includes(stage?.status),
    ),
  )
})
const hasRenderableAiContent = computed(() => {
  const analysis = aiAnalysis.value
  return Boolean(
    analysis?.description ||
    analysis?.score != null ||
    aiScoreItems.value.length > 0 ||
    analysis?.evaluation ||
    (Array.isArray(analysis?.strengths) && analysis.strengths.length > 0) ||
    (Array.isArray(analysis?.suggestions) && analysis.suggestions.length > 0) ||
    (['description', 'score', 'critique', 'suggestions'] as AiAnalysisStage[]).some(
      (stage) => aiStageState(stage) === 'failed' || isAiStageBusy(stage),
    ),
  )
})
const aiScoreItems = computed(() => {
  const breakdown = aiAnalysis.value?.scoreBreakdown || {}
  return [
    ['composition', breakdown.composition],
    ['lighting', breakdown.lighting],
    ['color', breakdown.color],
    ['sharpness', breakdown.sharpness],
  ]
    .map(([key, value]) => ({
      key: String(key),
      label: t(`photo.aiAnalysis.score.${key}`),
      value: Number(value),
    }))
    .filter((item) => Number.isFinite(item.value))
})

const canRetryAiAnalysis = computed(() => {
  const ownerUserId = (props.currentPhoto as any).ownerUserId
  const userId = user.value?.id
  return Boolean(
    loggedIn.value &&
    ownerUserId != null &&
    userId != null &&
    Number(ownerUserId) === Number(userId),
  )
})

const setAiStagesLocalState = (
  stages: AiAnalysisStage[],
  state: AiStageLocalState | null,
) => {
  const next = { ...activeAiStageStates.value }
  for (const stage of stages) {
    if (state) next[stage] = state
    else delete next[stage]
  }
  activeAiStageStates.value = next
}

const setAiStagesError = (stages: AiAnalysisStage[], message: string | null) => {
  const next = { ...aiStageErrors.value }
  for (const stage of stages) {
    if (message) next[stage] = message
    else delete next[stage]
  }
  aiStageErrors.value = next
}

const clearAiAnalysisTaskStatusCheck = (taskId?: number) => {
  if (typeof taskId === 'number') {
    const interval = aiAnalysisTaskStatusIntervals.value[taskId]
    if (interval) clearInterval(interval)
    const { [taskId]: _removed, ...remaining } =
      aiAnalysisTaskStatusIntervals.value
    aiAnalysisTaskStatusIntervals.value = remaining
    return
  }

  for (const interval of Object.values(aiAnalysisTaskStatusIntervals.value)) {
    clearInterval(interval)
  }
  aiAnalysisTaskStatusIntervals.value = {}
}

const refreshPhotoAfterAiAnalysisTask = async (
  photoId = props.currentPhoto.id,
) => {
  if (!photoId || props.currentPhoto.id !== photoId) return

  const response = await $fetch<{ photo?: Photo }>(
    `/api/photos/${photoId}/detail`,
  )
  const refreshedPhoto = response.photo
  if (refreshedPhoto && props.currentPhoto.id === photoId) {
    emit('photo-updated', refreshedPhoto)
  }
}

const startAiAnalysisTaskStatusCheck = (
  taskId: number,
  photoId: string,
  stages: AiAnalysisStage[],
) => {
  clearAiAnalysisTaskStatusCheck(taskId)

  const intervalId = setInterval(async () => {
    try {
      const response = await $fetch<QueueTaskStatus>(
        `/api/queue/stats/${taskId}`,
      )
      if (response.status === 'pending' || response.status === 'in-stages') {
        setAiStagesLocalState(stages, 'processing')
        return
      }

      if (response.status === 'completed') {
        clearAiAnalysisTaskStatusCheck(taskId)
        setAiStagesLocalState(stages, 'refreshing')
        setAiStagesError(stages, null)
        await refreshPhotoAfterAiAnalysisTask(photoId)
        setAiStagesLocalState(stages, null)
      } else if (response.status === 'failed') {
        clearAiAnalysisTaskStatusCheck(taskId)
        setAiStagesLocalState(stages, 'refreshing')
        setAiStagesError(
          stages,
          response.errorMessage || t('photo.aiAnalysis.failed'),
        )
        await refreshPhotoAfterAiAnalysisTask(photoId)
        setAiStagesLocalState(stages, null)
      }
    } catch (error: any) {
      clearAiAnalysisTaskStatusCheck(taskId)
      setAiStagesLocalState(stages, null)
      setAiStagesError(
        stages,
        error?.data?.statusMessage ||
          error?.statusMessage ||
          error?.message ||
          t('common.unknownError'),
      )
    }
  }, 1000)

  aiAnalysisTaskStatusIntervals.value = {
    ...aiAnalysisTaskStatusIntervals.value,
    [taskId]: intervalId,
  }
}

const retryAiAnalysisStages = async (stages: AiAnalysisStage[]) => {
  if (!canRetryAiAnalysis.value) return
  const queuedStages = stages.filter((stage) => !isAiStageBusy(stage))
  if (queuedStages.length === 0) return

  setAiStagesLocalState(queuedStages, 'queueing')
  setAiStagesError(queuedStages, null)

  try {
    const result = await $fetch('/api/queue/add-task', {
      method: 'POST',
      body: {
        payload: {
          type: 'photo-ai-analysis',
          photoId: props.currentPhoto.id,
          ownerUserId: props.currentPhoto.ownerUserId,
          stages: queuedStages,
        },
        priority: 1,
        maxAttempts: 3,
      },
    })
    if (typeof (result as any).taskId === 'number') {
      setAiStagesLocalState(queuedStages, 'processing')
      startAiAnalysisTaskStatusCheck(
        (result as any).taskId,
        props.currentPhoto.id,
        queuedStages,
      )
    } else {
      setAiStagesLocalState(queuedStages, 'refreshing')
      await refreshPhotoAfterAiAnalysisTask(props.currentPhoto.id)
      setAiStagesLocalState(queuedStages, null)
    }
  } catch (error: any) {
    setAiStagesLocalState(queuedStages, null)
    setAiStagesError(
      queuedStages,
      error?.data?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        t('common.unknownError'),
    )
  }
}

const getAiStageError = (stage: AiAnalysisStage) =>
  aiStageErrors.value[stage] ||
  aiAnalysis.value?.stages?.[stage]?.error ||
  null

const getAiRetryButtonProps = (stage: AiAnalysisStage) => ({
  loading: Boolean(activeAiStageStates.value[stage]),
  disabled: isAiStageBusy(stage),
})

const retryAiAnalysisStage = (stage: AiAnalysisStage) =>
  retryAiAnalysisStages([stage])

onUnmounted(() => {
  clearAiAnalysisTaskStatusCheck()
})

const formatedExifData = computed<Record<string, KVData[]>>(() => {
  const sections: Record<string, KVData[]> = {}

  // 基本信息
  sections.basicInfo = [
    {
      title: $t('exif.sections.basic'),
      items: [
        props.currentPhoto.storageKey
          ? {
              label: $t('exif.filename'),
              value:
                props.currentPhoto.storageKey.split('/').pop() ||
                props.currentPhoto.storageKey,
              icon: 'tabler:file',
            }
          : null,
        props.currentPhoto.fileSize
          ? {
              label: $t('exif.fileSize'),
              value: formatBytes(props.currentPhoto.fileSize),
              icon: 'tabler:database',
            }
          : null,
        props.currentPhoto.width && props.currentPhoto.height
          ? {
              label: $t('exif.resolution'),
              value: `${props.currentPhoto.width} × ${props.currentPhoto.height}`,
              icon: 'tabler:dimensions',
            }
          : null,
        props.currentPhoto.owner
          ? {
              label: $t('photo.owner'),
              value: props.currentPhoto.owner.username,
              icon: 'tabler:user',
            }
          : null,
        photoFaces.value.length > 0
          ? {
              label: $t('photo.faces'),
              value: String(photoFaces.value.length),
              icon: 'tabler:face-id',
            }
          : null,
        props.currentPhoto.width && props.currentPhoto.height
          ? {
              label: $t('exif.pixels'),
              value: `${((props.currentPhoto.width * props.currentPhoto.height) / 1000000).toFixed(2)} MP`,
              icon: 'tabler:grid-dots',
            }
          : null,
        props.exifData?.DateTimeOriginal
          ? {
              label: $t('exif.dateTaken.title'),
              value: dayjs(props.exifData.DateTimeOriginal).format('L LT'),
              icon: 'tabler:calendar',
            }
          : null,
        props.exifData?.ColorSpace
          ? {
              label: $t('exif.colorSpace.title'),
              value: localizeExif('colorSpace', props.exifData.ColorSpace),
              icon: 'tabler:palette',
            }
          : null,
        props.exifData?.Artist
          ? {
              label: $t('exif.artist'),
              value: props.exifData.Artist,
              icon: 'tabler:user',
            }
          : null,
        props.exifData?.Software
          ? {
              label: $t('exif.software'),
              value: props.exifData.Software,
              icon: 'tabler:app-window',
            }
          : null,
        props.exifData?.tz
          ? {
              label: $t('exif.tz'),
              value: props.exifData.tz,
              icon: 'tabler:world',
            }
          : null,
        displayLocation.value
          ? {
              label: $t('exif.location'),
              value: displayLocation.value,
              icon: 'tabler:map-pin',
            }
          : null,
        props.currentPhoto.country
          ? {
              label: $t('exif.country'),
              value: props.currentPhoto.country,
              icon: 'tabler:map-pin',
            }
          : null,
        props.currentPhoto.city
          ? {
              label: $t('exif.city'),
              value: props.currentPhoto.city,
              icon: 'tabler:building',
            }
          : null,
        props.currentPhoto.latitude && props.currentPhoto.longitude
          ? {
              label: $t('exif.gps.title'),
              value: formatGPSCoordinatesMultiLine(
                props.currentPhoto.latitude,
                props.currentPhoto.longitude,
              ),
              icon: 'tabler:gps',
            }
          : null,
      ],
    },
  ]

  // 拍摄参数
  sections.captureParams = [
    {
      title: $t('exif.sections.shooting.parameters'),
      items: [
        props.exifData?.FocalLengthIn35mmFormat
          ? {
              label: $t('exif.focal.length.actual'),
              value: `${props.exifData.FocalLengthIn35mmFormat}`,
              icon: 'tabler:telescope',
            }
          : null,
        props.exifData?.FNumber
          ? {
              label: $t('exif.aperture'),
              value: `f/${props.exifData.FNumber}`,
              icon: 'tabler:aperture',
            }
          : null,
        props.exifData?.ExposureTime
          ? {
              label: $t('exif.exposure.time'),
              value: formatExposureTime(props.exifData.ExposureTime),
              icon: 'tabler:clock',
            }
          : null,
        props.exifData?.ISO
          ? {
              label: $t('exif.iso'),
              value: props.exifData.ISO.toString(),
              icon: 'tabler:sun-electricity',
            }
          : null,
      ],
    },
  ]

  // 设备信息
  sections.deviceInfo = [
    {
      title: $t('exif.sections.deviceInfomation'),
      items: [
        props.exifData?.Make && props.exifData?.Model
          ? {
              label: $t('exif.camera'),
              value: formatCameraInfo(
                props.exifData.Make,
                props.exifData.Model,
              ),
              icon: 'tabler:camera',
            }
          : null,
        props.exifData?.LensModel
          ? {
              label: $t('exif.lens'),
              value: formatLensInfo(
                props.exifData.LensMake,
                props.exifData.LensModel,
              ),
              icon: 'tabler:focus',
            }
          : null,
        props.exifData?.MaxApertureValue
          ? {
              label: $t('exif.maxAperture'),
              value: `f/${props.exifData.MaxApertureValue}`,
              icon: 'tabler:aperture',
            }
          : null,
        props.exifData?.FocalLength
          ? {
              label: $t('exif.focal.length.actual'),
              value: props.exifData.FocalLength,
              icon: 'tabler:telescope',
            }
          : null,
        props.exifData?.FocalLengthIn35mmFormat
          ? {
              label: $t('exif.focal.length.equivalent'),
              value: props.exifData.FocalLengthIn35mmFormat,
              icon: 'tabler:zoom-in-area',
            }
          : null,
      ],
    },
  ]

  // 拍摄模式
  sections.captureMode = [
    {
      title: $t('exif.sections.shooting.mode'),
      items: [
        props.exifData?.WhiteBalance
          ? {
              label: $t('exif.wb.title'),
              value: localizeExif('whiteBalance', props.exifData.WhiteBalance),
              icon: 'mdi:white-balance-auto',
            }
          : null,
        props.exifData?.WBShiftAB
          ? {
              label: $t('exif.wb.shiftAB'),
              value: `${props.exifData.WBShiftAB}`,
              icon: 'mdi:white-balance-auto',
            }
          : null,
        props.exifData?.WBShiftGM
          ? {
              label: $t('exif.wb.shiftGM'),
              value: `${props.exifData.WBShiftGM}`,
              icon: 'mdi:white-balance-auto',
            }
          : null,
        props.exifData?.WhiteBalanceBias
          ? {
              label: $t('exif.wb.bias'),
              value: `${props.exifData.WhiteBalanceBias}`,
              icon: 'mdi:white-balance-auto',
            }
          : null,
        props.exifData?.WhiteBalanceFineTune
          ? {
              label: $t('exif.wb.fineTune'),
              value: `${props.exifData.WhiteBalanceFineTune}`,
              icon: 'mdi:white-balance-auto',
            }
          : null,
        props.exifData?.ExposureProgram
          ? {
              label: $t('exif.exposure.program'),
              value: localizeExif(
                'exposureProgram',
                props.exifData.ExposureProgram,
              ),
              icon: 'tabler:exposure',
            }
          : null,
        props.exifData?.ExposureMode
          ? {
              label: $t('exif.exposure.mode'),
              value: localizeExif('exposureMode', props.exifData.ExposureMode),
              icon: 'tabler:exposure-filled',
            }
          : null,
        props.exifData?.MeteringMode
          ? {
              label: $t('exif.metering.title'),
              value: localizeExif('meteringMode', props.exifData.MeteringMode),
              icon: 'tabler:focus-auto',
            }
          : null,
        props.exifData?.Flash
          ? {
              label: $t('exif.flash.title'),
              value: localizeExif('flash', props.exifData.Flash),
              icon: 'material-symbols:flash-on-rounded',
            }
          : null,
        props.exifData?.FlashMeteringMode
          ? {
              label: $t('exif.flash.meteringMode'),
              value: localizeExif(
                'meteringMode',
                props.exifData.FlashMeteringMode,
              ),
              icon: 'material-symbols:flash-on-rounded',
            }
          : null,
        props.exifData?.SceneCaptureType
          ? {
              label: $t('exif.scene.captureType'),
              value: localizeExif(
                'sceneCaptureType',
                props.exifData.SceneCaptureType,
              ),
              icon: 'material-symbols:scene',
            }
          : null,
      ],
    },
  ]

  // 技术参数
  sections.technicalParams = [
    {
      title: $t('exif.sections.specification'),
      items: [
        props.exifData?.BrightnessValue
          ? {
              label: $t('exif.brightness.value'),
              value: `${props.exifData.BrightnessValue.toFixed(1)} EV`,
              icon: 'tabler:sun',
            }
          : null,
        props.exifData?.SensingMethod
          ? {
              label: $t('exif.sensing.method'),
              value: localizeExif(
                'sensingMethod',
                props.exifData.SensingMethod,
              ),
              icon: 'tabler:photo-sensor',
            }
          : null,
        props.exifData?.FocalPlaneXResolution &&
        props.exifData?.FocalPlaneYResolution
          ? {
              label: $t('exif.focal.plane.resolution'),
              value: `${props.exifData.FocalPlaneXResolution.toFixed(2)} x ${props.exifData.FocalPlaneYResolution.toFixed(2)}`,
              icon: 'tabler:photo-sensor',
            }
          : null,
      ],
    },
  ]

  return sections
})

const isMobile = useMediaQuery('(max-width: 768px)')

const onMinimapClick = (photoId: string) => {
  const baseGlobeRoute = props.globeRoute || '/globe'
  const query = new URLSearchParams({ photoId })
  window.open(`${baseGlobeRoute}?${query.toString()}`)
}

const onTagClick = (tag: string) => {
  router.push({
    path: '/',
    query: { tag },
  })
}

const onAlbumClick = (albumId: number) => {
  if (!props.albumRoute) return
  const baseAlbumRoute = props.albumRoute.replace(/\/+$/, '')
  const target = `${baseAlbumRoute}/${encodeURIComponent(String(albumId))}`
  const opened = window.open(target, '_blank', 'noopener')
  if (!opened) {
    window.location.assign(target)
  }
}
</script>

<template>
  <motion.div
    :initial="{
      opacity: 0,
      x: isMobile ? 0 : 80,
      y: isMobile ? 20 : 0,
    }"
    :animate="{
      opacity: 1,
      x: 0,
      y: 0,
    }"
    :exit="{
      opacity: 0,
      x: isMobile ? 0 : 80,
      y: isMobile ? 20 : 0,
    }"
    :transition="{ type: 'spring', duration: 0.4, bounce: 0, delay: 0.1 }"
    class="bg-black/20 dark:bg-black/30 backdrop-blur-xl border-white/10"
    :class="{
      'fixed inset-x-2 bottom-2 max-h-[70vh] border rounded-xl z-50 flex flex-col':
        isMobile,
      'w-80 border-l': !isMobile,
    }"
  >
    <div
      class="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0"
    >
      <h3 class="font-black text-white text-ellipsis line-clamp-1">
        {{ currentPhoto.title }}
      </h3>
      <UButton
        v-if="isMobile && onClose"
        icon="tabler:x"
        variant="ghost"
        color="neutral"
        class="text-white"
        size="sm"
        @click="onClose"
      />
    </div>

    <!-- 内容区域 -->
    <div
      class="p-4 space-y-4 flex-1 min-h-0"
      :class="{
        'overflow-y-auto': isMobile,
        'overflow-y-auto max-h-full pb-16': !isMobile,
      }"
    >
      <!-- 照片描述 -->
      <div
        v-if="currentPhoto.description"
        class="text-sm text-white text-justify"
      >
        {{ currentPhoto.description }}
      </div>

      <PhotoMiniMap
        v-if="gpsCoordinates"
        :photo="currentPhoto"
        :latitude="gpsCoordinates?.latitude"
        :longitude="gpsCoordinates?.longitude"
        class="cursor-pointer"
        @click="onMinimapClick(currentPhoto.id)"
      />

      <PhotoKVRenderer
        v-if="formatedExifData.basicInfo"
        :data="formatedExifData.basicInfo"
      />

      <div
        v-if="currentPhoto.exif?.Rating"
        class="flex items-center gap-2 justify-between"
      >
        <h4 class="text-sm font-medium text-white uppercase tracking-wide">
          {{ $t('exif.sections.rating') }}
        </h4>

        <Rating
          :model-value="currentPhoto.exif.Rating"
          readonly
          size="sm"
        />
      </div>

      <!-- 相册 -->
      <div
        v-if="albums && albums.length > 0"
        class="mt-4"
      >
        <h4
          class="text-sm font-medium text-white/90 uppercase tracking-wide mb-2"
        >
          {{ $t('exif.sections.albums') }}
        </h4>
        <div class="space-y-2">
          <div
            v-for="album in albums"
            :key="album.id"
            class="p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors"
            @click="onAlbumClick(album.id)"
          >
            <p class="text-sm text-white font-medium line-clamp-1">
              {{ album.title }}
            </p>
            <p
              v-if="album.description"
              class="text-xs text-white/60 line-clamp-1"
            >
              {{ album.description }}
            </p>
          </div>
        </div>
      </div>

      <!-- 标签 -->
      <div
        v-if="currentPhoto.tags && currentPhoto.tags.length > 0"
        class="mt-4"
      >
        <h4
          class="text-sm font-medium text-white/90 uppercase tracking-wide mb-2"
        >
          {{ $t('exif.sections.tags') }}
        </h4>
        <div class="flex flex-wrap max-w-full gap-1 overflow-hidden">
          <UBadge
            v-for="tag in currentPhoto.tags"
            :key="tag"
            :label="tag"
            variant="soft"
            size="sm"
            color="neutral"
            class="max-w-full cursor-pointer select-none truncate whitespace-nowrap bg-white/10 text-white transition-colors hover:bg-white/20"
            :title="tag"
            @click="onTagClick(tag)"
          />
        </div>
      </div>
      <PhotoKVRenderer
        v-if="formatedExifData.captureParams"
        :data="formatedExifData.captureParams"
      />

      <div class="space-y-2">
        <h4 class="text-sm font-medium text-white uppercase tracking-wide">
          {{ $t('exif.sections.histogram') }}
        </h4>

        <Histogram
          v-if="getPhotoVariantUrl(currentPhoto, 'card')"
          :thumbnail-url="getPhotoVariantUrl(currentPhoto, 'card')"
        />
      </div>

      <PhotoKVRenderer
        v-if="formatedExifData.deviceInfo"
        :data="formatedExifData.deviceInfo"
      />

      <PhotoKVRenderer
        v-if="formatedExifData.captureMode"
        :data="formatedExifData.captureMode"
      />

      <PhotoKVRenderer
        v-if="formatedExifData.technicalParams"
        :data="formatedExifData.technicalParams"
      />

      <div
        v-if="photoFaces.length > 0"
        class="space-y-3 border-t border-white/10 pt-4"
      >
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-sm font-medium uppercase tracking-wide text-white">
            {{ $t('photo.faces') }}
          </h4>
          <span
            class="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/60"
          >
            {{ photoFaces.length }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-3 sm:grid-cols-4">
          <div
            v-for="face in photoFaces"
            :key="face.id"
            class="flex min-w-0 flex-col items-center gap-2 px-1 py-1"
          >
            <div
              class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-sm ring-2 ring-white/5"
            >
              <img
                v-if="shouldShowFaceCrop(face)"
                :src="face.cropUrl"
                :alt="face.personName || $t('photo.faces')"
                class="h-full w-full rounded-full object-cover"
                loading="lazy"
                @error="markFaceCropFailed(face)"
              />
              <Icon
                v-else
                name="tabler:face-id"
                class="size-7 text-white/55"
              />
            </div>
            <p
              class="w-full break-words text-center text-[11px] leading-snug text-white/75"
            >
              {{ face.personName || $t('photo.faces') }}
            </p>
          </div>
        </div>
      </div>

      <div
        v-if="hasAiAnalysis"
        class="space-y-4 border-t border-white/10 pt-4"
      >
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-sm font-medium uppercase tracking-wide text-white">
            {{ $t('photo.aiAnalysis.title') }}
          </h4>
          <UButton
            v-if="canRetryAiAnalysis"
            icon="tabler:refresh"
            size="xs"
            variant="ghost"
            color="neutral"
            :label="$t('photo.aiAnalysis.retryAll')"
            :loading="isAnyAiStageBusy"
            :disabled="isAnyAiStageBusy"
            class="text-white/70 hover:text-white"
            @click="
              retryAiAnalysisStages([
                'tags',
                'description',
                'score',
                'critique',
                'suggestions',
              ])
            "
          />
        </div>

        <p
          v-if="!hasRenderableAiContent"
          class="text-xs leading-relaxed text-white/50"
        >
          {{ $t('photo.aiAnalysis.empty') }}
        </p>

        <div
          v-if="
            aiAnalysis?.description ||
            aiStageState('description') === 'failed' ||
            isAiStageBusy('description')
          "
          class="space-y-2"
        >
          <div class="flex items-center justify-between gap-3">
            <p
              class="text-xs font-semibold uppercase tracking-wide text-white/60"
            >
              {{ $t('photo.aiAnalysis.description') }}
            </p>
            <UButton
              v-if="canRetryAiAnalysis"
              icon="tabler:refresh"
              size="xs"
              variant="ghost"
              color="neutral"
              v-bind="getAiRetryButtonProps('description')"
              class="text-white/60 hover:text-white"
              @click="retryAiAnalysisStage('description')"
            />
          </div>
          <div
            v-if="isAiStageBusy('description') && !aiAnalysis?.description"
            class="space-y-2"
          >
            <USkeleton class="h-4 w-full bg-white/10" />
            <USkeleton class="h-4 w-4/5 bg-white/10" />
          </div>
          <p
            v-else-if="aiAnalysis?.description"
            class="text-sm leading-relaxed text-white/82"
          >
            {{ aiAnalysis.description }}
          </p>
          <p
            v-else
            class="text-xs text-error-300"
          >
            {{
              getAiStageError('description') ||
              $t('photo.aiAnalysis.failed')
            }}
          </p>
        </div>

        <div
          v-if="
            aiAnalysis?.score != null ||
            aiScoreItems.length > 0 ||
            aiStageState('score') === 'failed' ||
            isAiStageBusy('score')
          "
          class="space-y-2"
        >
          <div class="flex items-center justify-between gap-3">
            <p
              class="text-xs font-semibold uppercase tracking-wide text-white/60"
            >
              {{ $t('photo.aiAnalysis.score.title') }}
            </p>
            <UButton
              v-if="canRetryAiAnalysis"
              icon="tabler:refresh"
              size="xs"
              variant="ghost"
              color="neutral"
              v-bind="getAiRetryButtonProps('score')"
              class="text-white/60 hover:text-white"
              @click="retryAiAnalysisStage('score')"
            />
          </div>
          <div
            v-if="isAiStageBusy('score') && aiAnalysis?.score == null"
            class="space-y-2"
          >
            <USkeleton class="h-8 w-20 bg-white/10" />
            <div class="grid grid-cols-2 gap-2">
              <USkeleton class="h-8 w-full bg-white/10" />
              <USkeleton class="h-8 w-full bg-white/10" />
            </div>
          </div>
          <div
            v-else-if="aiAnalysis?.score != null"
            class="flex items-end gap-2"
          >
            <span class="text-3xl font-semibold leading-none text-white">
              {{ aiAnalysis.score }}
            </span>
            <span class="pb-1 text-xs font-medium text-white/45">/100</span>
          </div>
          <div
            v-if="aiScoreItems.length > 0"
            class="grid grid-cols-2 gap-2"
          >
            <div
              v-for="item in aiScoreItems"
              :key="item.key"
              class="space-y-1"
            >
              <div
                class="flex items-center justify-between text-[11px] text-white/55"
              >
                <span>{{ item.label }}</span>
                <span>{{ item.value }}</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  class="h-full rounded-full bg-white/70"
                  :style="{
                    width: `${Math.max(0, Math.min(100, item.value))}%`,
                  }"
                />
              </div>
            </div>
          </div>
          <p
            v-if="aiStageState('score') === 'failed'"
            class="text-xs text-error-300"
          >
            {{
              getAiStageError('score') || $t('photo.aiAnalysis.failed')
            }}
          </p>
        </div>

        <div
          v-if="
            aiAnalysis?.evaluation ||
            (aiAnalysis?.strengths && aiAnalysis.strengths.length > 0) ||
            aiStageState('critique') === 'failed' ||
            isAiStageBusy('critique')
          "
          class="space-y-2"
        >
          <div class="flex items-center justify-between gap-3">
            <p
              class="text-xs font-semibold uppercase tracking-wide text-white/60"
            >
              {{ $t('photo.aiAnalysis.evaluation') }}
            </p>
            <UButton
              v-if="canRetryAiAnalysis"
              icon="tabler:refresh"
              size="xs"
              variant="ghost"
              color="neutral"
              v-bind="getAiRetryButtonProps('critique')"
              class="text-white/60 hover:text-white"
              @click="retryAiAnalysisStage('critique')"
            />
          </div>
          <div
            v-if="isAiStageBusy('critique') && !aiAnalysis?.evaluation"
            class="space-y-2"
          >
            <USkeleton class="h-4 w-full bg-white/10" />
            <USkeleton class="h-4 w-3/4 bg-white/10" />
            <USkeleton class="h-4 w-5/6 bg-white/10" />
          </div>
          <p
            v-else-if="aiAnalysis?.evaluation"
            class="text-sm leading-relaxed text-white/82"
          >
            {{ aiAnalysis.evaluation }}
          </p>
          <ul
            v-if="aiAnalysis?.strengths && aiAnalysis.strengths.length > 0"
            class="space-y-1 text-sm text-white/75"
          >
            <li
              v-for="strength in aiAnalysis.strengths"
              :key="strength"
              class="flex gap-2"
            >
              <Icon
                name="tabler:check"
                class="mt-0.5 size-4 shrink-0 text-success-300"
              />
              <span>{{ strength }}</span>
            </li>
          </ul>
          <p
            v-if="aiStageState('critique') === 'failed'"
            class="text-xs text-error-300"
          >
            {{
              getAiStageError('critique') ||
              $t('photo.aiAnalysis.failed')
            }}
          </p>
        </div>

        <div
          v-if="
            (aiAnalysis?.suggestions && aiAnalysis.suggestions.length > 0) ||
            aiStageState('suggestions') === 'failed' ||
            isAiStageBusy('suggestions')
          "
          class="space-y-2"
        >
          <div class="flex items-center justify-between gap-3">
            <p
              class="text-xs font-semibold uppercase tracking-wide text-white/60"
            >
              {{ $t('photo.aiAnalysis.suggestions') }}
            </p>
            <UButton
              v-if="canRetryAiAnalysis"
              icon="tabler:refresh"
              size="xs"
              variant="ghost"
              color="neutral"
              v-bind="getAiRetryButtonProps('suggestions')"
              class="text-white/60 hover:text-white"
              @click="retryAiAnalysisStage('suggestions')"
            />
          </div>
          <div
            v-if="
              isAiStageBusy('suggestions') &&
              (!aiAnalysis?.suggestions || aiAnalysis.suggestions.length === 0)
            "
            class="space-y-2"
          >
            <USkeleton class="h-4 w-full bg-white/10" />
            <USkeleton class="h-4 w-5/6 bg-white/10" />
            <USkeleton class="h-4 w-2/3 bg-white/10" />
          </div>
          <ol
            v-else-if="
              aiAnalysis?.suggestions && aiAnalysis.suggestions.length > 0
            "
            class="space-y-2 text-sm text-white/75"
          >
            <li
              v-for="(suggestion, index) in aiAnalysis.suggestions"
              :key="suggestion"
              class="flex gap-2"
            >
              <span
                class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white/70"
              >
                {{ index + 1 }}
              </span>
              <span>{{ suggestion }}</span>
            </li>
          </ol>
          <p
            v-if="aiStageState('suggestions') === 'failed'"
            class="text-xs text-error-300"
          >
            {{
              getAiStageError('suggestions') ||
              $t('photo.aiAnalysis.failed')
            }}
          </p>
        </div>
      </div>
    </div>
  </motion.div>
</template>

<style scoped>
/* 自定义滚动条样式 */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
