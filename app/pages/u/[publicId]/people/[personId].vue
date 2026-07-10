<script setup lang="ts">
import { motion } from 'motion-v'
import {
  buildPublicPeopleRoute,
  buildPublicPersonRoute,
  buildPublicPhotoRoute,
} from '~/utils/public-profile-routes'

definePageMeta({
  layout: false,
})

interface PublicPerson {
  id: number
  name?: string | null
  faceCropUrl?: string | null
  faceCount?: number
  photoCount?: number
}

const route = useRoute()
const router = useRouter()
const publicId = computed(() => String(route.params.publicId || ''))
const personId = computed(() => Number(route.params.personId || 0))
const encodedPublicId = computed(() => encodeURIComponent(publicId.value))

const { data: people } = await useFetch<PublicPerson[]>(
  () => `/api/public/profiles/${encodedPublicId.value}/people`,
  {
    default: () => [],
    watch: [encodedPublicId],
  },
)
const { data: photos, error, status } = await useFetch<Photo[]>(
  () =>
    `/api/public/profiles/${encodedPublicId.value}/people/${personId.value}/photos`,
  {
    default: () => [],
    watch: [encodedPublicId, personId],
  },
)

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Person not found',
  })
}

const viewerState = useViewerState()
const { openViewer } = viewerState

const person = computed(() =>
  (people.value || []).find((item) => Number(item.id) === personId.value),
)
const personTitle = computed(
  () => person.value?.name || $t('dashboard.people.unnamed', { id: personId.value }),
)

const coverPhoto = computed(() => photos.value[0] || null)
const albumStats = computed(() => ({
  total: photos.value.length,
  faces: person.value?.faceCount || 0,
}))

const masonryItems = computed(() =>
  photos.value.map((photo, index) => ({
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

const openPersonPhoto = (photo: Photo, index: number) => {
  openViewer(
    index,
    buildPublicPersonRoute(publicId.value, personId.value),
    photos.value as Photo[],
    null,
    null,
  )
  router.push(buildPublicPhotoRoute(publicId.value, photo.id))
}

const handleOpenViewer = (index: number) => {
  const photo = photos.value[index]
  if (!photo) return
  openPersonPhoto(photo, index)
}

useHead({
  title: () => personTitle.value,
})
</script>

<template>
  <div
    class="relative min-h-svh bg-white text-neutral-950 dark:bg-neutral-900 dark:text-white"
  >
    <template v-if="person">
      <div
        v-if="coverPhoto"
        class="absolute inset-x-0 top-0 h-2/3 overflow-hidden sm:h-[500px]"
      >
        <ThumbImage
          :src="getPhotoVariantUrl(coverPhoto, 'card')"
          :thumbhash="coverPhoto.thumbnailHash"
          :alt="personTitle"
          class="h-full w-full scale-110 object-cover opacity-40 saturate-150 dark:opacity-20"
        />
        <div
          class="absolute -inset-1 bg-gradient-to-b from-transparent via-white/50 to-white backdrop-blur-xl dark:via-neutral-900/50 dark:to-neutral-900 sm:backdrop-blur-2xl"
        />
      </div>

      <div class="relative z-10 container mx-auto px-4 pt-4 sm:px-6 lg:px-8">
        <UButton
          variant="ghost"
          color="neutral"
          icon="tabler:arrow-left"
          size="sm"
          :to="buildPublicPeopleRoute(publicId)"
        />
      </div>

      <div class="relative z-10 container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          class="flex flex-col gap-6"
          :initial="{ opacity: 0, y: 10 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.4 }"
        >
          <div class="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div
              v-if="person.faceCropUrl"
              class="flex size-28 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-neutral-100 shadow-xl ring-4 ring-white/80 dark:border-white/10 dark:bg-neutral-800 dark:ring-neutral-900/70 sm:size-32"
            >
              <img
                class="h-full w-full rounded-full object-cover"
                :src="person.faceCropUrl"
                :alt="personTitle"
                loading="lazy"
              >
            </div>
            <div
              v-else
              class="flex size-28 items-center justify-center rounded-full border border-white/70 bg-neutral-100 text-neutral-400 shadow-xl ring-4 ring-white/80 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-500 dark:ring-neutral-900/70 sm:size-32"
            >
              <Icon
                name="tabler:face-id"
                class="size-12"
              />
            </div>

            <div class="min-w-0 space-y-4">
              <h1
                class="break-words text-3xl font-bold tracking-normal text-neutral-900 dark:text-white sm:text-4xl"
              >
                {{ personTitle }}
              </h1>

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
                    <span class="ml-1 text-neutral-500 dark:text-neutral-400">
                      {{ $t('album.metadata.photos') }}
                    </span>
                  </span>
                </div>

                <div class="flex items-center gap-1">
                  <Icon
                    name="tabler:face-id"
                    class="size-4 -mt-0.5 text-neutral-400 dark:text-neutral-500"
                  />
                  <span class="text-neutral-700 dark:text-neutral-200">
                    <span class="text-neutral-900 dark:text-white">
                      {{ albumStats.faces }}
                    </span>
                    <span class="ml-1 text-neutral-500 dark:text-neutral-400">
                      {{ $t('photo.faces') }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div class="relative z-10 container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :transition="{ delay: 0.2, duration: 0.4 }"
        >
          <div
            v-if="status === 'pending'"
            class="py-16 text-center text-sm text-neutral-600 dark:text-neutral-400"
          >
            {{ $t('ui.loading') }}
          </div>
          <div
            v-else-if="albumStats.total === 0"
            class="flex flex-col items-center justify-center gap-6 px-4 py-16"
          >
            <Icon
              name="tabler:library-photo"
              class="size-20 text-neutral-300 dark:text-neutral-600"
            />
            <p
              class="text-xl font-normal text-neutral-800 dark:text-neutral-200"
            >
              {{ $t('dashboard.people.noPhotos') }}
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
      <UButton :to="buildPublicPeopleRoute(publicId)">
        {{ $t('title.people') }}
      </UButton>
    </div>
  </div>
</template>
