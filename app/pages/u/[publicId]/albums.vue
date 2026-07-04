<script setup lang="ts">
import { motion } from 'motion-v'
import {
  buildPublicAlbumDetailRoute,
  buildPublicProfileRoute,
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
const publicId = computed(() => String(route.params.publicId || ''))
const encodedPublicId = computed(() => encodeURIComponent(publicId.value))

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

useHead({
  title: () => $t('title.albums'),
})

const isMobile = useMediaQuery('(max-width: 768px)')
const waterfallPhotos = computed(() =>
  photos.value.toSorted(() => 0.5 - Math.random()).slice(0, 30),
)
const waterfallColumnCount = computed(() => (isMobile.value ? 3 : 8))
const columnDurations = ref<number[]>([])
const hoveredAlbum = ref<number | null>(null)

onMounted(() => {
  columnDurations.value = Array.from(
    { length: waterfallColumnCount.value },
    () => 120 + (Math.random() * 90 - 60),
  )
})

const columns = computed(() => {
  const cols: Photo[][] = Array.from(
    { length: waterfallColumnCount.value },
    () => [],
  )

  if (waterfallPhotos.value.length === 0) return cols

  for (let colIndex = 0; colIndex < waterfallColumnCount.value; colIndex++) {
    for (let i = 0; i < 8; i++) {
      const photoIndex =
        (colIndex + i * waterfallColumnCount.value) %
        waterfallPhotos.value.length
      cols[colIndex]?.push(waterfallPhotos.value[photoIndex]!)
    }
  }

  return cols
})

const getPhotoById = (photoId: string) =>
  photos.value.find((photo) => photo.id === photoId) || null

const getAlbumDisplayPhotos = (album: PublicAlbum) => {
  if (!album.photoIds?.length) return []

  const displayPhotos: Photo[] = []

  if (album.coverPhotoId) {
    const coverPhoto = getPhotoById(album.coverPhotoId)
    if (coverPhoto) displayPhotos.push(coverPhoto)
  }

  if (displayPhotos.length === 0 && album.photoIds[0]) {
    const firstPhoto = getPhotoById(album.photoIds[0])
    if (firstPhoto) displayPhotos.push(firstPhoto)
  }

  for (const photoId of album.photoIds) {
    if (displayPhotos.length >= 3) break
    const photo = getPhotoById(photoId)
    if (photo && !displayPhotos.some((item) => item.id === photo.id)) {
      displayPhotos.push(photo)
    }
  }

  return displayPhotos
}

const getPhotoTransform = (index: number, isHover: boolean) => {
  if (index === 0) {
    return { x: 0, y: 0, rotate: 0 }
  }
  if (index === 1) {
    return isHover
      ? { x: -20, y: -16, rotate: -8 }
      : { x: -6, y: -4, rotate: -4 }
  }
  return isHover ? { x: 28, y: -20, rotate: 10 } : { x: 8, y: -6, rotate: 5 }
}
</script>

<template>
  <div
    class="relative min-h-svh bg-white text-neutral-950 dark:bg-neutral-900 dark:text-white"
  >
    <div
      class="absolute inset-x-0 top-0 h-[30vh] sm:h-[50vh] overflow-hidden z-0"
    >
      <div class="absolute inset-0 flex h-full gap-0">
        <div
          v-for="(column, colIndex) in columns"
          :key="colIndex"
          class="flex-1 relative overflow-hidden select-none"
        >
          <div
            class="flex flex-col"
            :class="
              colIndex % 2 === 0 ? 'animate-scroll-down' : 'animate-scroll-up'
            "
            :style="{
              animationDuration: columnDurations[colIndex]
                ? `${columnDurations[colIndex]}s`
                : '200s',
            }"
          >
            <template
              v-for="groupIndex in 3"
              :key="groupIndex"
            >
              <div
                v-for="(photo, photoIndex) in column"
                :key="`${photo.id}-${groupIndex}-${photoIndex}`"
                class="w-full overflow-hidden"
              >
                <ClientOnly>
                  <ThumbImage
                    class="w-full h-auto object-cover saturate-50"
                    :lazy="false"
                    :src="photo.thumbnailUrl!"
                    :thumbhash="photo.thumbnailHash"
                    :alt="
                      photo.exif?.ImageDescription || $t('ui.photo.altFallback')
                    "
                    :style="{ aspectRatio: photo.aspectRatio || 1 }"
                  />
                </ClientOnly>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div
        class="absolute -inset-1 bg-linear-to-b from-neutral-100/80 to-white dark:from-neutral-900/80 dark:to-neutral-900"
      />
    </div>

    <div class="relative z-10 p-4">
      <UTooltip :text="$t('ui.action.home.tooltip')">
        <UButton
          variant="ghost"
          color="neutral"
          icon="tabler:arrow-left"
          :label="$t('ui.action.home.tooltip')"
          size="sm"
          :to="buildPublicProfileRoute(publicId)"
        />
      </UTooltip>
    </div>

    <div class="relative z-10 flex flex-col items-center pt-8 sm:pt-40 pb-24">
      <h1
        class="font-black text-6xl sm:text-7xl drop-shadow-2xl bg-clip-text bg-linear-to-br from-neutral-800 to-neutral-400 dark:from-white dark:to-neutral-500 text-transparent"
      >
        {{ $t('title.albums').toUpperCase() }}
      </h1>
      <p
        class="mt-2 text-lg text-neutral-600 dark:text-neutral-400 font-medium font-[Pacifico]"
      >
        {{ $t('title.gallery') }}
      </p>
    </div>

    <div class="relative z-10 container mx-auto px-10 sm:px-6 lg:px-8 py-12">
      <div
        v-if="albums.length"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-16"
      >
        <NuxtLink
          v-for="album in albums"
          :key="album.id"
          :to="buildPublicAlbumDetailRoute(publicId, album.id)"
          class="block"
          @mouseenter="hoveredAlbum = album.id"
          @mouseleave="hoveredAlbum = null"
        >
          <div class="relative h-48 mb-4 group">
            <motion.div
              v-for="(photo, index) in getAlbumDisplayPhotos(album)"
              :key="photo.id"
              class="absolute inset-0 rounded-xl shadow-lg overflow-hidden bg-white dark:bg-neutral-800"
              :initial="{
                x: getPhotoTransform(index, false).x,
                y: getPhotoTransform(index, false).y,
                rotate: getPhotoTransform(index, false).rotate,
                opacity: 1 - index * 0.12,
              }"
              :animate="{
                x: getPhotoTransform(index, hoveredAlbum === album.id).x,
                y: getPhotoTransform(index, hoveredAlbum === album.id).y,
                rotate: getPhotoTransform(index, hoveredAlbum === album.id)
                  .rotate,
                opacity: hoveredAlbum === album.id ? 1 : 1 - index * 0.12,
              }"
              :transition="{
                type: 'spring',
                stiffness: 300,
                damping: 30,
                mass: 0.8,
              }"
              :style="{ zIndex: 3 - index }"
            >
              <ThumbImage
                class="w-full h-full object-cover"
                :src="photo.thumbnailUrl!"
                :thumbhash="photo.thumbnailHash"
                :alt="album.title"
                :style="{ aspectRatio: photo.aspectRatio || 1 }"
              />
              <motion.div
                v-if="index > 0"
                class="absolute inset-0 bg-black/10 dark:bg-black/30"
                :initial="{ opacity: 1 }"
                :animate="{ opacity: hoveredAlbum === album.id ? 0 : 1 }"
                :transition="{ duration: 0.3 }"
              />
            </motion.div>

            <div
              v-if="!album.photoIds?.length"
              class="absolute inset-0 rounded-xl shadow-lg bg-linear-to-br from-neutral-100 to-neutral-50 dark:from-neutral-700 dark:to-neutral-800 flex flex-col items-center justify-center gap-3 border border-neutral-200 dark:border-neutral-600 group-hover:shadow-xl dark:group-hover:shadow-neutral-900/50 transition-shadow"
            >
              <Icon
                name="tabler:library-photo"
                class="size-10 text-neutral-400 dark:text-neutral-500"
              />
              <p
                class="text-sm font-medium text-neutral-700 dark:text-neutral-300"
              >
                {{ $t('ui.album.noImage') }}
              </p>
            </div>
          </div>

          <div class="px-2">
            <div class="flex items-center gap-8">
              <h2
                class="flex-1 truncate text-lg font-semibold text-neutral-800 dark:text-neutral-200 transition-colors"
                :class="{
                  'text-primary-600 dark:text-primary-400':
                    hoveredAlbum === album.id,
                }"
              >
                {{ album.title }}
              </h2>
              <p
                v-if="album.createdAt"
                class="flex items-center gap-0.5 text-sm text-neutral-600 dark:text-neutral-400"
              >
                <Icon
                  name="tabler:clock"
                  class="h-lh size-4"
                />
                {{ $dayjs(album.createdAt).fromNow() }}
              </p>
            </div>
            <p
              class="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2"
            >
              {{ album.description || $t('ui.album.noDescription') }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <div
        v-else
        class="flex flex-col items-center justify-center gap-4 py-24 text-center"
      >
        <Icon
          name="tabler:library-photo"
          class="size-16 text-neutral-300 dark:text-neutral-600"
        />
        <p class="text-base text-neutral-600 dark:text-neutral-400">
          {{ $t('dashboard.albums.noAlbums') }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes scroll-down {
  0% {
    transform: translateY(0);
  }
  100% {
    transform: translateY(calc(-100% / 3));
  }
}

@keyframes scroll-up {
  0% {
    transform: translateY(calc(-100% / 3));
  }
  100% {
    transform: translateY(0);
  }
}

.animate-scroll-down {
  animation: scroll-down linear infinite;
}

.animate-scroll-up {
  animation: scroll-up linear infinite;
}
</style>
