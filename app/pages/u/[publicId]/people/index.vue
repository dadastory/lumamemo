<script setup lang="ts">
import {
  buildPublicPersonRoute,
  buildPublicProfileRoute,
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
const publicId = computed(() => String(route.params.publicId || ''))
const encodedPublicId = computed(() => encodeURIComponent(publicId.value))
const { photos } = usePhotos()

const { data: people, error, status } = await useFetch<PublicPerson[]>(
  () => `/api/public/profiles/${encodedPublicId.value}/people`,
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

const personLabel = (person: PublicPerson) =>
  person.name || $t('dashboard.people.unnamed', { id: person.id })

const isMobile = useMediaQuery('(max-width: 768px)')
const waterfallPhotos = computed(() =>
  photos.value.toSorted(() => 0.5 - Math.random()).slice(0, 30),
)
const waterfallColumnCount = computed(() => (isMobile.value ? 3 : 8))
const columnDurations = ref<number[]>([])

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

useHead({
  title: () => $t('title.people'),
})
</script>

<template>
  <div
    class="relative min-h-svh bg-white text-neutral-950 dark:bg-neutral-900 dark:text-white"
  >
    <div
      class="absolute inset-x-0 top-0 h-[30vh] overflow-hidden sm:h-[50vh]"
    >
      <div class="absolute inset-0 flex h-full">
        <div
          v-for="(column, colIndex) in columns"
          :key="colIndex"
          class="relative flex-1 overflow-hidden select-none"
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
                    class="h-auto w-full object-cover saturate-50"
                    :lazy="false"
                    :src="getPhotoVariantUrl(photo, 'card')"
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

    <div class="relative z-10 flex flex-col items-center px-4 pb-20 pt-8 text-center sm:pt-40">
      <h1
        class="bg-linear-to-br from-neutral-800 to-neutral-400 bg-clip-text text-5xl font-black tracking-normal text-transparent drop-shadow-2xl dark:from-white dark:to-neutral-500 sm:text-7xl"
      >
        {{ $t('title.people') }}
      </h1>
      <p class="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400 sm:text-base">
        {{ $t('dashboard.people.description') }}
      </p>
    </div>

    <main class="relative z-10 container mx-auto px-5 py-10 sm:px-6 lg:px-8">
      <div
        v-if="status === 'pending'"
        class="py-16 text-center text-sm text-neutral-600 dark:text-neutral-400"
      >
        {{ $t('dashboard.people.loading') }}
      </div>
      <div
        v-else-if="!people.length"
        class="flex flex-col items-center justify-center gap-4 py-24 text-center"
      >
        <Icon
          name="tabler:face-id"
          class="size-16 text-neutral-300 dark:text-neutral-600"
        />
        <p class="text-base text-neutral-600 dark:text-neutral-400">
          {{ $t('dashboard.people.empty') }}
        </p>
      </div>
      <div
        v-else
        class="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5"
      >
        <NuxtLink
          v-for="person in people"
          :key="person.id"
          :to="buildPublicPersonRoute(publicId, person.id)"
          class="group block text-center"
        >
          <div class="relative mx-auto mb-4 flex size-32 items-center justify-center sm:size-40">
            <div class="absolute inset-3 rounded-full border border-neutral-200 bg-neutral-100 shadow-lg transition group-hover:scale-[1.03] dark:border-neutral-700 dark:bg-neutral-800" />
            <div
              v-if="person.faceCropUrl"
              class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/70 bg-neutral-100 shadow-xl ring-4 ring-white/80 dark:border-white/10 dark:bg-neutral-800 dark:ring-neutral-900/70"
            >
              <img
                class="h-full w-full rounded-full object-cover transition duration-300 group-hover:scale-[1.04]"
                :src="person.faceCropUrl"
                :alt="personLabel(person)"
                loading="lazy"
              >
            </div>
            <div
              v-else
              class="relative flex h-full w-full items-center justify-center rounded-full border border-white/70 bg-neutral-100 text-neutral-400 shadow-xl ring-4 ring-white/80 dark:border-white/10 dark:bg-neutral-800 dark:text-neutral-500 dark:ring-neutral-900/70"
            >
              <Icon
                name="tabler:face-id"
                class="size-12"
              />
            </div>
          </div>
          <div class="px-1">
            <p
              class="break-words text-base font-semibold leading-snug text-neutral-800 transition-colors group-hover:text-primary-600 dark:text-neutral-100 dark:group-hover:text-primary-400"
            >
              {{ personLabel(person) }}
            </p>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{
                $t('dashboard.people.faceCount', {
                  count: person.faceCount || 0,
                })
              }}
              · {{ person.photoCount || 0 }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </main>
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
