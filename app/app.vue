<script setup lang="ts">
import dayjsLocale_zhCN from 'dayjs/locale/zh-cn'
import dayjsLocale_zhTW from 'dayjs/locale/zh-tw'
import dayjsLocale_zhHK from 'dayjs/locale/zh-hk'
import {
  buildPublicAlbumsRoute,
  buildPublicPhotoRoute,
} from '~/utils/public-profile-routes'

const router = useRouter()
const dayjs = useDayjs()
const colorMode = useColorMode()
const localeRef = ref('en')
try {
  const { locale } = useI18n()
  watch(
    locale,
    (value) => {
      localeRef.value = value
    },
    { immediate: true },
  )
} catch {
  // i18n context may be unavailable during early server-side error rendering
}

// 初始化设置系统 - 一次性加载所有设置
const settingsStore = useSettingsStore()
await settingsStore.initSettings()

const appTitle = useSettingRef('app:title')

colorMode.preference = useSettingRef('app:appearance.theme').value as string

useHead({
  titleTemplate: (title) =>
    `${title ? title + ' | ' : ''}${appTitle.value || 'ChronoFrame'}`,
})

// 根据用户登录状态和当前路由决定使用哪个 API
// 登录用户或后台管理页面显示所有照片，未登录用户在前端页面只显示可见照片
const route = useRoute()
const { loggedIn, user } = useUserSession()
const isPublicProfileRoute = computed(() => route.path.startsWith('/u/'))
const publicProfileId = computed(() => {
  if (!isPublicProfileRoute.value) return ''
  const param = route.params.publicId
  if (typeof param === 'string') return param
  if (Array.isArray(param) && typeof param[0] === 'string') return param[0]
  return route.path.split('/')[2] || ''
})
const apiEndpoint = computed(() => {
  if (isPublicProfileRoute.value) {
    return publicProfileId.value
      ? `/api/public/profiles/${publicProfileId.value}/photos`
      : null
  }
  // 后台管理页面始终显示所有照片
  if (route.path.startsWith('/dashboard')) {
    return '/api/photos'
  }
  // 前端页面：登录用户显示所有照片，未登录用户只显示可见照片
  return loggedIn.value ? '/api/photos' : '/api/photos/visible'
})
const { data, refresh, status } = await useFetch<Photo[]>(
  () => apiEndpoint.value,
  {
    immediate: computed(() => Boolean(apiEndpoint.value)),
    watch: [apiEndpoint, publicProfileId],
    default: () => [],
  },
)

const photos = computed(() => (data.value as Photo[]) || [])

const { switchToIndex, closeViewer, clearReturnRoute } = useViewerState()
const {
  currentPhotoIndex,
  isViewerOpen,
  returnRoute,
  globeRoute,
  albumRoute,
  isDirectAccess,
  scopedPhotos,
} = storeToRefs(useViewerState())

// The photo collection the viewer actually navigates: the scoped list (e.g. an
// album) when present, otherwise the global list.
const viewerPhotos = computed(() => scopedPhotos.value ?? photos.value)

const appendPhotoUrlToken = (url: string | null | undefined, token: string) => {
  if (!url || !token) return url

  const hashIndex = url.indexOf('#')
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
  const urlWithoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url
  const queryIndex = urlWithoutHash.indexOf('?')
  const base =
    queryIndex >= 0 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash
  const query = queryIndex >= 0 ? urlWithoutHash.slice(queryIndex + 1) : ''
  const params = new URLSearchParams(query)
  params.set('v', token)
  const queryString = params.toString()

  return `${base}${queryString ? `?${queryString}` : ''}${hash}`
}

const withPhotoUrlCacheToken = (photo: Photo) => {
  if (photo.sourceType !== 'raw') return photo

  const token = String(photo.lastModified || Date.now())
  const tokenedImageVariants = photo.imageVariants
    ? Object.fromEntries(
        Object.entries(photo.imageVariants).map(([variantName, variant]) => [
          variantName,
          variant?.url
            ? {
                ...variant,
                url: appendPhotoUrlToken(variant.url, token),
              }
            : variant,
        ]),
      )
    : photo.imageVariants

  return {
    ...photo,
    originalUrl: appendPhotoUrlToken(photo.originalUrl, token),
    thumbnailUrl: appendPhotoUrlToken(photo.thumbnailUrl, token),
    imageVariants: tokenedImageVariants,
  } as Photo
}

const replacePhotoInList = (list: Photo[] | null | undefined, photo: Photo) => {
  if (!list?.length) return list

  const photoIndex = list.findIndex((item) => item.id === photo.id)
  if (photoIndex < 0) return list

  const nextPhotos = [...list]
  nextPhotos[photoIndex] = {
    ...nextPhotos[photoIndex],
    ...photo,
  }
  return nextPhotos
}

const handlePhotoUpdated = (photo: Photo) => {
  const updatedPhoto = withPhotoUrlCacheToken(photo)

  data.value = replacePhotoInList(data.value, updatedPhoto) ?? data.value
  scopedPhotos.value =
    replacePhotoInList(scopedPhotos.value, updatedPhoto) ?? scopedPhotos.value
}

const handleIndexChange = (newIndex: number) => {
  switchToIndex(newIndex)
  const nextPhotoId = viewerPhotos.value[newIndex]?.id
  if (!nextPhotoId) return

  if (route.path.startsWith('/u/') && publicProfileId.value) {
    router.replace(buildPublicPhotoRoute(publicProfileId.value, nextPhotoId))
    return
  }

  router.replace(`/${nextPhotoId}`)
}

const handleClose = () => {
  closeViewer()

  // 如果是直接访问详情页面，关闭时返回首页
  if (isDirectAccess.value) {
    isDirectAccess.value = false
    router.replace('/')
  } else if (returnRoute.value) {
    // 如果有指定的返回路由，返回到该路由
    const destination = returnRoute.value
    clearReturnRoute()
    router.replace(destination)
  } else {
    // 否则使用历史记录或默认返回首页
    if (window.history.length > 1) {
      router.back()
    } else {
      router.replace('/')
    }
  }
}

watchEffect(() => {
  dayjs.locale('zh-Hans', dayjsLocale_zhCN)
  dayjs.locale('zh-Hant-TW', dayjsLocale_zhTW)
  dayjs.locale('zh-Hant-HK', dayjsLocale_zhHK)
  dayjs.locale(localeRef.value)
})

watch(loggedIn, async () => {
  if (!isPublicProfileRoute.value) {
    await refresh()
  }
})

// 在全局级别提供筛选功能的状态管理
provide(
  'photosFiltering',
  reactive({
    activeFilters: {
      tags: [],
      cameras: [],
      lenses: [],
      cities: [],
      ratings: [],
    },
  }),
)
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />
    <PhotosProvider
      :photos="photos"
      :refresh="refresh"
      :status="status"
    >
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <ClientOnly>
        <PhotoViewer
          :photos="viewerPhotos"
          :current-index="currentPhotoIndex"
          :is-open="isViewerOpen"
          :globe-route="globeRoute"
          :public-profile-id="publicProfileId || null"
          :album-route="
            albumRoute ||
            (publicProfileId
              ? buildPublicAlbumsRoute(publicProfileId)
              : user?.publicId
                ? buildPublicAlbumsRoute(user.publicId)
                : null)
          "
          @close="handleClose"
          @index-change="handleIndexChange"
          @photo-updated="handlePhotoUpdated"
        />
      </ClientOnly>
    </PhotosProvider>
  </UApp>
</template>

<style></style>
