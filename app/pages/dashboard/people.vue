<script setup lang="ts">
import type { Photo } from '~~/server/utils/db'
import ThumbImage from '~/components/ui/ThumbImage.vue'

interface Person {
  id: number
  name?: string | null
  coverPhotoId?: string | null
  faceCropUrl?: string | null
  isHidden?: boolean
  isFavorite?: boolean
  birthDate?: string | null
  faceCount?: number
  photoCount?: number
}

interface PersonFace {
  id: number
  photoId: string
  cropUrl?: string | null
  qualityScore?: number | null
  photo?: Photo
}

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => $t('title.people'),
})

const toast = useToast()
const router = useRouter()
const route = useRoute()
const { photos } = usePhotos()
const { openViewer } = useViewerState()
const selectedPersonId = ref<number | null>(null)
const renameValue = ref('')
const isBusy = ref(false)

const {
  data: peopleData,
  refresh: refreshPeople,
  status: peopleStatus,
} = await useFetch<Person[]>('/api/people', {
  query: { includeHidden: true },
  default: () => [],
})

const selectedPerson = computed(() =>
  (peopleData.value || []).find((person) => person.id === selectedPersonId.value),
)

const routePersonId = computed(() => {
  const value = route.query.person
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
})

const selectedPersonRoute = computed(() =>
  selectedPersonId.value
    ? `/dashboard/people?person=${encodeURIComponent(String(selectedPersonId.value))}`
    : '/dashboard/people',
)

watch(
  [peopleData, routePersonId],
  ([people, queryPersonId]) => {
    if (!people?.length) {
      selectedPersonId.value = null
      return
    }

    if (queryPersonId && people.some((person) => person.id === queryPersonId)) {
      selectedPersonId.value = queryPersonId
      return
    }

    if (
      !selectedPersonId.value ||
      !people.some((person) => person.id === selectedPersonId.value)
    ) {
      selectedPersonId.value = people[0].id
    }
  },
  { immediate: true },
)

watch(selectedPerson, (person) => {
  renameValue.value = person?.name || ''
})

const selectPerson = (personId: number) => {
  selectedPersonId.value = personId
  if (routePersonId.value === personId) return

  void router.replace({
    query: {
      ...route.query,
      person: String(personId),
    },
  })
}

const personPhotosEndpoint = (personId: number) =>
  `/api/people/${personId}/photos`
const personFacesEndpoint = (personId: number) =>
  `/api/people/${personId}/faces`

const {
  data: selectedPhotos,
  refresh: refreshSelectedPhotos,
  status: selectedPhotosStatus,
  error: selectedPhotosError,
} = await useFetch<Photo[]>(
  () =>
    selectedPersonId.value
      ? personPhotosEndpoint(selectedPersonId.value)
      : null,
  {
    immediate: computed(() => Boolean(selectedPersonId.value)),
    watch: [selectedPersonId],
    default: () => [],
  },
)

const { data: selectedFaces, refresh: refreshSelectedFaces } = await useFetch<
  PersonFace[]
>(() =>
  selectedPersonId.value
    ? personFacesEndpoint(selectedPersonId.value)
    : null,
  {
    immediate: computed(() => Boolean(selectedPersonId.value)),
    watch: [selectedPersonId],
    default: () => [],
  },
)

const personLabel = (person: Person) =>
  person.name || $t('dashboard.people.unnamed', { id: person.id })

const coverPhoto = (person: Person) =>
  (photos.value || []).find((photo) => photo.id === person.coverPhotoId)

const faceCropUrl = (person: Person) =>
  person.faceCropUrl || getPhotoVariantUrl(coverPhoto(person), 'thumb')

const selectedPersonCoverPhoto = computed(() => {
  const person = selectedPerson.value
  const personPhotos = selectedPhotos.value || []
  if (!person) return null
  if (person.coverPhotoId) {
    const selectedCover = personPhotos.find(
      (photo) => photo.id === person.coverPhotoId,
    )
    if (selectedCover) return selectedCover
  }
  return personPhotos[0] || coverPhoto(person) || null
})

const personStats = computed(() => ({
  photos: selectedPhotos.value?.length || selectedPerson.value?.photoCount || 0,
  faces: selectedFaces.value?.length || selectedPerson.value?.faceCount || 0,
}))

const personMasonryItems = computed(() =>
  (selectedPhotos.value || []).map((photo, index) => ({
    id: photo.id,
    photo,
    originalIndex: index,
  })),
)

const personDisplayFaces = computed(() => (selectedFaces.value || []).slice(0, 24))
const isMobile = useMediaQuery('(max-width: 768px)')
const columnWidth = computed(() => (isMobile.value ? 260 : 280))
const maxColumns = computed(() => (isMobile.value ? 2 : 6))
const minColumns = computed(() => 2)
const MASONRY_GAP = 4

const updatePerson = async (personId: number, body: Record<string, unknown>) => {
  isBusy.value = true
  try {
    await $fetch(`/api/people/${personId}`, {
      method: 'PATCH',
      body,
    })
    await refreshPeople()
    await refreshSelectedPhotos()
    await refreshSelectedFaces()
    toast.add({
      title: $t('dashboard.people.messages.saved'),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title: $t('dashboard.people.messages.saveFailed'),
      description:
        error?.data?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        $t('dashboard.people.messages.operationFailed'),
      color: 'error',
    })
  } finally {
    isBusy.value = false
  }
}

const enqueueMachineLearningTask = async (
  type: 'photo-ml-backfill' | 'photo-face-cluster',
) => {
  isBusy.value = true
  try {
    const result = await $fetch('/api/queue/add-task', {
      method: 'POST',
      body: {
        payload: { type },
        priority: type === 'photo-face-cluster' ? 0 : 1,
        maxAttempts: 3,
      },
    })
    toast.add({
      title:
        type === 'photo-face-cluster'
          ? $t('dashboard.people.messages.clusterQueued')
          : $t('dashboard.people.messages.backfillQueued'),
      description: $t('dashboard.photos.messages.reprocessTaskId', {
        taskId: result.taskId,
      }),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title: $t('dashboard.people.messages.operationFailed'),
      description:
        error?.data?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        $t('dashboard.people.messages.operationFailed'),
      color: 'error',
    })
  } finally {
    isBusy.value = false
  }
}

const openPersonPhoto = (photo: Photo, index: number) => {
  openViewer(index, selectedPersonRoute.value, selectedPhotos.value as Photo[])
  router.push(`/${photo.id}`)
}

const handlePersonMasonryOpen = (index: number) => {
  const photo = selectedPhotos.value?.[index]
  if (!photo) return
  openPersonPhoto(photo, index)
}

const openFacePhoto = (face: PersonFace) => {
  const personPhotos = selectedPhotos.value || []
  const photoIndex = personPhotos.findIndex((photo) => photo.id === face.photoId)
  if (photoIndex >= 0) {
    openViewer(photoIndex, selectedPersonRoute.value, personPhotos as Photo[])
    router.push(`/${face.photoId}`)
    return
  }

  if (face.photo) {
    openViewer(0, selectedPersonRoute.value, [face.photo] as Photo[])
    router.push(`/${face.photoId}`)
  }
}
</script>

<template>
  <UDashboardPanel>
    <UDashboardNavbar :title="$t('dashboard.people.title')">
      <template #right>
        <UButton
          color="neutral"
          variant="soft"
          icon="tabler:list-check"
          to="/dashboard/queue"
        >
          {{ $t('dashboard.people.actions.openQueue') }}
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          icon="tabler:sparkles"
          :loading="isBusy"
          @click="enqueueMachineLearningTask('photo-ml-backfill')"
        >
          {{ $t('dashboard.people.actions.backfill') }}
        </UButton>
        <UButton
          icon="tabler:face-id"
          :loading="isBusy"
          @click="enqueueMachineLearningTask('photo-face-cluster')"
        >
          {{ $t('dashboard.people.actions.cluster') }}
        </UButton>
      </template>
    </UDashboardNavbar>

    <div class="flex-1 overflow-y-auto px-3 py-4 sm:px-4 lg:px-5">
      <div class="flex w-full max-w-none flex-col gap-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div class="space-y-1">
            <p class="text-sm font-medium text-highlighted">
              {{ $t('dashboard.people.listTitle') }}
            </p>
            <p class="max-w-2xl text-sm text-muted">
              {{ $t('dashboard.people.description') }}
            </p>
          </div>
        </div>

        <div
          v-if="peopleStatus === 'pending'"
          class="py-16 text-center text-sm text-muted"
        >
          {{ $t('dashboard.people.loading') }}
        </div>
        <div
          v-else-if="!peopleData?.length"
          class="flex flex-col items-center justify-center gap-4 py-20 text-center"
        >
          <Icon
            name="tabler:face-id"
            class="size-16 text-muted"
          />
          <div class="max-w-md space-y-2">
            <p class="text-base font-medium text-highlighted">
              {{ $t('dashboard.people.empty') }}
            </p>
            <p class="text-sm text-muted">
              {{ $t('dashboard.people.description') }}
            </p>
          </div>
          <div class="flex flex-wrap justify-center gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="tabler:sparkles"
              :loading="isBusy"
              @click="enqueueMachineLearningTask('photo-ml-backfill')"
            >
              {{ $t('dashboard.people.actions.backfill') }}
            </UButton>
            <UButton
              icon="tabler:face-id"
              :loading="isBusy"
              @click="enqueueMachineLearningTask('photo-face-cluster')"
            >
              {{ $t('dashboard.people.actions.cluster') }}
            </UButton>
          </div>
        </div>
        <div
          v-else
          class="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start"
        >
          <aside
            class="hidden lg:block"
            :aria-label="$t('dashboard.people.listTitle')"
          >
            <div class="sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
              <div class="space-y-2">
                <button
                  v-for="person in peopleData"
                  :key="person.id"
                  type="button"
                  class="group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition"
                  :class="
                    selectedPersonId === person.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-default bg-default/30 hover:border-primary/40 hover:bg-muted/40'
                  "
                  @click="selectPerson(person.id)"
                >
                  <div class="relative shrink-0">
                    <ThumbImage
                      v-if="faceCropUrl(person)"
                      :src="faceCropUrl(person)"
                      :srcset="getPhotoVariantSrcset(coverPhoto(person))"
                      sizes="56px"
                      :alt="personLabel(person)"
                      class="size-14 rounded-full border border-default object-cover shadow-sm ring-2 ring-default/80 transition group-hover:scale-[1.03]"
                    />
                    <div
                      v-else
                      class="flex size-14 items-center justify-center rounded-full border border-default bg-muted text-muted shadow-sm ring-2 ring-default/80"
                    >
                      <Icon
                        name="tabler:face-id"
                        class="size-6"
                      />
                    </div>
                    <Icon
                      v-if="person.isFavorite"
                      name="tabler:star-filled"
                      class="absolute -right-1 bottom-0 size-4 rounded-full bg-default text-warning"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start gap-2">
                      <p class="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-highlighted">
                        {{ personLabel(person) }}
                      </p>
                      <Icon
                        v-if="person.isHidden"
                        name="tabler:eye-off"
                        class="mt-0.5 size-4 shrink-0 text-muted"
                      />
                    </div>
                    <p class="mt-1 text-xs text-muted">
                      {{
                        $t('dashboard.people.faceCount', {
                          count: person.faceCount || 0,
                        })
                      }}
                      · {{ person.photoCount || 0 }}
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </aside>

          <div class="min-w-0 space-y-6">
            <div class="overflow-x-auto pb-2 lg:hidden">
              <div class="flex gap-3">
                <button
                  v-for="person in peopleData"
                  :key="person.id"
                  type="button"
                  class="group flex w-28 shrink-0 flex-col items-center gap-2 rounded-lg border p-3 text-center transition"
                  :class="
                    selectedPersonId === person.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-default bg-default/30 hover:border-primary/40 hover:bg-muted/40'
                  "
                  @click="selectPerson(person.id)"
                >
                  <div class="relative">
                    <ThumbImage
                      v-if="faceCropUrl(person)"
                      :src="faceCropUrl(person)"
                      :srcset="getPhotoVariantSrcset(coverPhoto(person))"
                      sizes="64px"
                      :alt="personLabel(person)"
                      class="size-16 rounded-full border border-default object-cover shadow-sm ring-2 ring-default/80 transition group-hover:scale-[1.03]"
                    />
                    <div
                      v-else
                      class="flex size-16 items-center justify-center rounded-full border border-default bg-muted text-muted shadow-sm ring-2 ring-default/80"
                    >
                      <Icon
                        name="tabler:face-id"
                        class="size-7"
                      />
                    </div>
                    <Icon
                      v-if="person.isFavorite"
                      name="tabler:star-filled"
                      class="absolute -right-1 bottom-0 size-4 rounded-full bg-default text-warning"
                    />
                  </div>
                  <p class="line-clamp-2 min-h-8 w-full break-words text-xs font-semibold leading-tight text-highlighted">
                    {{ personLabel(person) }}
                  </p>
                </button>
              </div>
            </div>

            <section
              v-if="selectedPerson"
              class="space-y-6"
            >
              <div class="flex flex-col gap-8">
                <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                    <ThumbImage
                      v-if="faceCropUrl(selectedPerson)"
                      :src="faceCropUrl(selectedPerson)"
                      :srcset="getPhotoVariantSrcset(selectedPersonCoverPhoto)"
                      sizes="128px"
                      :alt="personLabel(selectedPerson)"
                      class="size-28 rounded-full border border-default object-cover shadow-xl ring-4 ring-default/80 sm:size-32"
                    />
                    <div
                      v-else
                      class="flex size-28 items-center justify-center rounded-full border border-default bg-muted text-muted shadow-xl ring-4 ring-default/80 sm:size-32"
                    >
                      <Icon
                        name="tabler:face-id"
                        class="size-12"
                      />
                    </div>

                    <div class="min-w-0 space-y-4">
                      <div class="space-y-2">
                        <h1
                          class="break-words text-3xl font-bold tracking-normal text-highlighted sm:text-4xl"
                        >
                          {{ personLabel(selectedPerson) }}
                        </h1>
                        <div class="flex flex-wrap items-center gap-4 text-sm">
                          <span class="flex items-center gap-1 text-muted">
                            <Icon
                              name="tabler:photo"
                              class="size-4"
                            />
                            <span class="text-highlighted">{{ personStats.photos }}</span>
                            {{ $t('album.metadata.photos') }}
                          </span>
                          <span class="flex items-center gap-1 text-muted">
                            <Icon
                              name="tabler:face-id"
                              class="size-4"
                            />
                            <span class="text-highlighted">{{ personStats.faces }}</span>
                            {{ $t('photo.faces') }}
                          </span>
                          <span
                            v-if="selectedPerson.isHidden"
                            class="flex items-center gap-1 text-muted"
                          >
                            <Icon
                              name="tabler:eye-off"
                              class="size-4"
                            />
                            {{ $t('dashboard.people.actions.hide') }}
                          </span>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center gap-2">
                        <UInput
                          v-model="renameValue"
                          class="w-64 max-w-full"
                          :placeholder="$t('dashboard.people.fields.name')"
                        />
                        <UButton
                          icon="tabler:device-floppy"
                          :loading="isBusy"
                          @click="
                            updatePerson(selectedPerson.id, {
                              name: renameValue.trim() || null,
                            })
                          "
                        >
                          {{ $t('dashboard.people.actions.saveName') }}
                        </UButton>
                        <UButton
                          color="neutral"
                          variant="soft"
                          :icon="
                            selectedPerson.isFavorite
                              ? 'tabler:star-filled'
                              : 'tabler:star'
                          "
                          :loading="isBusy"
                          @click="
                            updatePerson(selectedPerson.id, {
                              isFavorite: !selectedPerson.isFavorite,
                            })
                          "
                        >
                          {{ $t('dashboard.people.actions.favorite') }}
                        </UButton>
                        <UButton
                          color="neutral"
                          variant="soft"
                          :icon="
                            selectedPerson.isHidden ? 'tabler:eye' : 'tabler:eye-off'
                          "
                          :loading="isBusy"
                          @click="
                            updatePerson(selectedPerson.id, {
                              isHidden: !selectedPerson.isHidden,
                            })
                          "
                        >
                          {{
                            selectedPerson.isHidden
                              ? $t('dashboard.people.actions.show')
                              : $t('dashboard.people.actions.hide')
                          }}
                        </UButton>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  v-if="selectedFaces?.length"
                  class="space-y-3"
                >
                  <p class="text-sm font-medium text-highlighted">
                    {{ $t('dashboard.people.faceSamples') }}
                  </p>
                  <div class="flex gap-3 overflow-x-auto pb-2">
                    <button
                      v-for="face in personDisplayFaces"
                      :key="face.id"
                      type="button"
                      class="group flex size-16 shrink-0 items-center justify-center rounded-full border border-default bg-default p-1 shadow-sm transition hover:border-primary/60 hover:bg-muted/50 sm:size-18"
                      @click="openFacePhoto(face)"
                    >
                      <img
                        :src="face.cropUrl || getPhotoVariantUrl(face.photo, 'thumb')"
                        :alt="personLabel(selectedPerson)"
                        class="h-full w-full rounded-full object-cover transition group-hover:scale-[1.04]"
                        loading="lazy"
                      >
                    </button>
                  </div>
                </div>

                <div
                  v-if="selectedPhotosStatus === 'pending'"
                  class="flex flex-col items-center justify-center gap-4 py-16 text-center"
                >
                  <Icon
                    name="svg-spinners:180-ring"
                    class="size-10 text-muted"
                  />
                  <p class="text-sm text-muted">
                    {{ $t('dashboard.people.loading') }}
                  </p>
                </div>
                <div
                  v-else-if="selectedPhotosError"
                  class="flex flex-col items-center justify-center gap-4 py-16 text-center"
                >
                  <Icon
                    name="tabler:alert-circle"
                    class="size-16 text-error"
                  />
                  <p class="text-sm text-muted">
                    {{ $t('dashboard.people.messages.operationFailed') }}
                  </p>
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="tabler:refresh"
                    @click="refreshSelectedPhotos()"
                  >
                    {{ $t('ui.action.retry') }}
                  </UButton>
                </div>
                <div
                  v-else-if="!selectedPhotos?.length"
                  class="flex flex-col items-center justify-center gap-4 py-16 text-center"
                >
                  <Icon
                    name="tabler:library-photo"
                    class="size-16 text-muted"
                  />
                  <p class="text-sm text-muted">
                    {{ $t('dashboard.people.noPhotos') }}
                  </p>
                </div>
                <MasonryWall
                  v-else
                  :items="personMasonryItems"
                  :column-width="columnWidth"
                  :gap="MASONRY_GAP"
                  :min-columns="minColumns"
                  :max-columns="maxColumns"
                  :ssr-columns="2"
                  :key-mapper="
                    (_item, _column, _row, index) =>
                      personMasonryItems[index]?.originalIndex ?? index
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
                      @open-viewer="handlePersonMasonryOpen($event)"
                    />
                  </template>
                </MasonryWall>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </UDashboardPanel>
</template>
