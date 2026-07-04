<script setup lang="ts">
import dayjsLocale_zhCN from 'dayjs/locale/zh-cn'
import dayjsLocale_zhTW from 'dayjs/locale/zh-tw'
import dayjsLocale_zhHK from 'dayjs/locale/zh-hk'
import { buildPublicPhotoRoute } from '~/utils/public-profile-routes'

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
const { loggedIn } = useUserSession()
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
const { data, refresh, status } = await useFetch(() => apiEndpoint.value, {
  immediate: computed(() => Boolean(apiEndpoint.value)),
  watch: [apiEndpoint, publicProfileId],
})

const photos = computed(() => (data.value as Photo[]) || [])

const { switchToIndex, closeViewer, clearReturnRoute } = useViewerState()
const {
  currentPhotoIndex,
  isViewerOpen,
  returnRoute,
  globeRoute,
  isDirectAccess,
  scopedPhotos,
} = storeToRefs(useViewerState())

// The photo collection the viewer actually navigates: the scoped list (e.g. an
// album) when present, otherwise the global list.
const viewerPhotos = computed(() => scopedPhotos.value ?? photos.value)

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
          @close="handleClose"
          @index-change="handleIndexChange"
        />
      </ClientOnly>
    </PhotosProvider>
  </UApp>
</template>

<style></style>
