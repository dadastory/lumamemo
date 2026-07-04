<script setup lang="ts">
import { motion } from 'motion-v'
import {
  buildPublicAlbumDetailRoute,
  buildPublicAlbumsRoute,
  buildPublicGlobeRoute,
  buildPublicPhotoRoute,
} from '~/utils/public-profile-routes'

definePageMeta({
  layout: false,
})

interface PublicAlbum {
  id: number
  title: string
  description?: string | null
  coverPhotoId?: string | null
  createdAt?: string | null
  photoIds?: string[]
}

const route = useRoute()
const router = useRouter()
const dayjs = useDayjs()

const publicId = computed(() => String(route.params.publicId || ''))
const encodedPublicId = computed(() => encodeURIComponent(publicId.value))
const albumId = computed(() =>
  Number.parseInt(String(route.params.albumId), 10),
)

const { photos } = usePhotos()
const { data: albums, error } = await useFetch<PublicAlbum[]>(
  () => `/api/public/profiles/${encodedPublicId.value}/albums`,
  {
    default: () => [],
    watch: [encodedPublicId],
  },
)

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Profile not found',
  })
}

const album = computed(() =>
  albums.value.find((item) => Number(item.id) === albumId.value),
)

const albumPhotos = computed(() => {
  const ids = new Set(album.value?.photoIds || [])
  return photos.value.filter((photo) => ids.has(photo.id))
})

const coverPhoto = computed(() => {
  if (!album.value) return null
  if (album.value.coverPhotoId) {
    const cover = albumPhotos.value.find(
      (photo) => photo.id === album.value?.coverPhotoId,
    )
    if (cover) return cover
  }
  return albumPhotos.value[0] || null
})

const albumStats = computed(() => {
  const currentPhotos = albumPhotos.value
  const dates = currentPhotos
    .map((photo) => photo.dateTaken)
    .filter((date): date is string => Boolean(date))
    .map((date) => dayjs(date))
    .sort((a, b) => (a.isBefore(b) ? -1 : 1))

  return {
    total: currentPhotos.length,
    dateRange:
      dates.length > 0
        ? {
            start: dates[0],
            end: dates[dates.length - 1],
          }
        : null,
  }
})

const dateRangeText = computed(() => {
  const range = albumStats.value.dateRange
  if (!range?.start || !range.end) return null

  if (range.start.isSame(range.end, 'day')) {
    return range.start.format('ll')
  }
  if (range.start.isSame(range.end, 'month')) {
    return range.start.format('MMM YYYY')
  }
  if (range.start.isSame(range.end, 'year')) {
    return `${range.start.format('MMM')} - ${range.end.format('MMM YYYY')}`
  }
  return `${range.start.format('ll')} - ${range.end.format('ll')}`
})

const masonryItems = computed(() =>
  albumPhotos.value.map((photo, index) => ({
    id: photo.id,
    photo,
    originalIndex: index,
  })),
)

const isMobile = useMediaQuery('(max-width: 768px)')
const columnWidth = computed(() => (isMobile.value ? 280 : 280))
const maxColumns = computed(() => (isMobile.value ? 2 : 8))
const minColumns = computed(() => 2)
const MASONRY_GAP = 4

const handleOpenViewer = (index: number) => {
  const photo = albumPhotos.value[index]
  if (!photo) return

  const { openViewer } = useViewerState()
  openViewer(
    index,
    buildPublicAlbumDetailRoute(publicId.value, albumId.value),
    albumPhotos.value,
    buildPublicGlobeRoute(publicId.value),
  )
  router.push(buildPublicPhotoRoute(publicId.value, photo.id))
}

const goBackToAlbums = () => {
  router.push(buildPublicAlbumsRoute(publicId.value))
}

useHead({
  title: () => album.value?.title || $t('title.albums'),
})
</script>

<template>
  <div
    class="relative min-h-svh bg-white text-neutral-950 dark:bg-neutral-900 dark:text-white"
  >
    <template v-if="album">
      <div
        v-if="coverPhoto"
        class="absolute inset-x-0 top-0 h-2/3 sm:h-[500px] overflow-hidden z-0"
      >
        <ThumbImage
          :src="coverPhoto.thumbnailUrl || ''"
          :thumbhash="coverPhoto.thumbnailHash"
          :alt="album.title"
          class="w-full h-full object-cover opacity-40 dark:opacity-20 scale-110 saturate-150"
        />
        <div
          class="absolute -inset-1 bg-gradient-to-b from-transparent via-white/50 to-white dark:via-neutral-900/50 dark:to-neutral-900 backdrop-blur-xl sm:backdrop-blur-2xl"
        />
      </div>

      <div class="relative container mx-auto px-4 sm:px-6 lg:px-8 pt-4 z-10">
        <UButton
          variant="ghost"
          color="neutral"
          icon="tabler:arrow-left"
          size="sm"
          @click="goBackToAlbums"
        />
      </div>

      <div class="relative container mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        <motion.div
          class="flex flex-col gap-6"
          :initial="{ opacity: 0, y: 10 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.4 }"
        >
          <div>
            <h1
              class="text-3xl sm:text-4xl font-bold text-neutral-900 dark:text-white tracking-tight"
            >
              {{ album.title }}
            </h1>
          </div>

          <div class="flex flex-col gap-4">
            <p
              class="text-base text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-2xl"
            >
              {{ album.description || $t('album.noDescription') }}
            </p>

            <div class="flex flex-wrap items-center gap-4 text-sm">
              <div class="flex items-center gap-1">
                <Icon
                  name="tabler:photo"
                  class="size-4 -mt-0.5 text-neutral-400 dark:text-neutral-500"
                />
                <span class="text-neutral-700 dark:text-neutral-200">
                  <span class="text-neutral-900 dark:text-white">
                    {{ albumStats.total }}
                  </span>
                  <span class="text-neutral-500 dark:text-neutral-400 ml-1">
                    {{ $t('album.metadata.photos') }}
                  </span>
                </span>
              </div>

              <div
                v-if="dateRangeText"
                class="flex items-center gap-1"
              >
                <Icon
                  name="tabler:calendar"
                  class="size-4 -mt-0.5 text-neutral-400 dark:text-neutral-500"
                />
                <span class="text-neutral-700 dark:text-neutral-200">
                  {{ dateRangeText }}
                </span>
              </div>

              <div
                v-if="album.createdAt"
                class="flex items-center gap-1"
                :title="
                  $t('album.createdTooltip', {
                    date: $dayjs(album.createdAt).format('YYYY-MM-DD HH:mm:ss'),
                  })
                "
              >
                <Icon
                  name="tabler:clock-plus"
                  class="size-4 -mt-0.5 text-neutral-400 dark:text-neutral-500"
                />
                <span class="text-neutral-700 dark:text-neutral-200">
                  {{ $t('album.metadata.created') }}
                  {{ $dayjs(album.createdAt).fromNow() }}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :transition="{ delay: 0.2, duration: 0.4 }"
        >
          <div
            v-if="albumStats.total === 0"
            class="flex flex-col items-center justify-center gap-6 px-4"
          >
            <Icon
              name="tabler:library-photo"
              class="size-20 text-neutral-300 dark:text-neutral-600"
            />
            <p
              class="text-xl font-normal text-neutral-800 dark:text-neutral-200"
            >
              {{ $t('album.emptyAlbumTitle') }}
            </p>
          </div>

          <MasonryWall
            v-else
            :items="masonryItems"
            :column-width="columnWidth"
            :gap="MASONRY_GAP"
            :min-columns="minColumns"
            :max-columns="maxColumns"
            :ssr-columns="2"
            :key-mapper="
              (_item, _column, _row, index) =>
                masonryItems[index]?.originalIndex ?? index
            "
          >
            <template #default="{ item }">
              <MasonryItem
                v-if="item.photo && typeof item.originalIndex === 'number'"
                :key="item.photo.id"
                :photo="item.photo"
                :index="item.originalIndex"
                :has-animated="false"
                :first-screen-items="50"
                @open-viewer="handleOpenViewer($event)"
              />
            </template>
          </MasonryWall>
        </motion.div>
      </div>
    </template>

    <div
      v-else
      class="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Icon
        name="tabler:alert-circle"
        class="size-20 text-red-400"
      />
      <div>
        <p
          class="mb-2 text-2xl font-semibold text-neutral-800 dark:text-neutral-200"
        >
          {{ $t('album.failedToLoadTitle') }}
        </p>
        <p class="max-w-md text-base text-neutral-600 dark:text-neutral-400">
          {{ $t('album.failedToLoadDescription') }}
        </p>
      </div>
      <UButton @click="goBackToAlbums">
        {{ $t('album.backToAlbums') }}
      </UButton>
    </div>
  </div>
</template>
