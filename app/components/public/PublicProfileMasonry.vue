<script setup lang="ts">
import {
  buildPublicAlbumsRoute,
  buildPublicGlobeRoute,
  buildPublicPeopleRoute,
  buildPublicProfileRoute,
} from '~/utils/public-profile-routes'

interface PublicProfile {
  publicId: string
  displayName: string
  profileTitle?: string | null
  profileSlogan?: string | null
  profileBio?: string | null
  avatar?: string | null
}

const props = defineProps<{
  publicId: string
  photoId?: string | null
}>()

const encodedPublicId = computed(() => encodeURIComponent(props.publicId))
const profileRoute = computed(() => buildPublicProfileRoute(props.publicId))

const { data: profile, error: profileError } = await useFetch<PublicProfile>(
  () => `/api/public/profiles/${encodedPublicId.value}`,
  { watch: [encodedPublicId] },
)

if (profileError.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Profile not found',
  })
}

const { photos, status } = usePhotos()
const viewerState = useViewerState()
const { isViewerOpen, scopedPhotos } = storeToRefs(viewerState)
const { openViewer, switchToIndex, closeViewer } = viewerState

const headerProfile = computed(() => ({
  title: profile.value?.profileTitle || profile.value?.displayName,
  slogan: profile.value?.profileSlogan,
  avatarUrl: profile.value?.avatar,
  author: profile.value?.displayName,
}))

useHead({
  title: () =>
    profile.value?.profileTitle ||
    profile.value?.displayName ||
    $t('title.profile'),
})

watch(
  [() => props.photoId, photos, status],
  ([currentPhotoId, currentPhotos, currentStatus]) => {
    if (!currentPhotoId) {
      return
    }

    if (currentStatus === 'pending' || currentPhotos.length === 0) {
      return
    }

    let activePhotos =
      isViewerOpen.value && scopedPhotos.value
        ? scopedPhotos.value
        : currentPhotos
    let foundIndex = activePhotos.findIndex(
      (photo) => photo.id === currentPhotoId,
    )
    let shouldResetToProfileScope = false

    if (foundIndex === -1 && activePhotos !== currentPhotos) {
      activePhotos = currentPhotos
      foundIndex = activePhotos.findIndex(
        (photo) => photo.id === currentPhotoId,
      )
      shouldResetToProfileScope = true
    }

    if (foundIndex === -1) {
      closeViewer()
      return
    }

    useHead({
      title:
        activePhotos[foundIndex]?.title ||
        profile.value?.profileTitle ||
        $t('title.fallback.photo'),
    })

    if (!isViewerOpen.value || shouldResetToProfileScope) {
      openViewer(
        foundIndex,
        profileRoute.value,
        currentPhotos as Photo[],
        buildPublicGlobeRoute(props.publicId),
        buildPublicAlbumsRoute(props.publicId),
      )
      return
    }

    switchToIndex(foundIndex)
  },
  { immediate: true },
)
</script>

<template>
  <div class="relative h-screen">
    <div class="h-svh px-1">
      <ClientOnly>
        <MasonryRoot
          :photos="photos"
          columns="auto"
          :header-profile="headerProfile"
          :album-route="buildPublicAlbumsRoute(publicId)"
          :globe-route="buildPublicGlobeRoute(publicId)"
          :people-route="buildPublicPeopleRoute(publicId)"
          :photo-route-base="profileRoute"
          :return-route="profileRoute"
        />
        <template #fallback>
          <div
            class="fixed inset-0 flex flex-col gap-4 items-center justify-center"
          >
            <LoaderAvatar />
            <span class="loading-scan-wrapper">
              <span class="text-base font-medium loading-scan-text">
                {{ $t('ui.loading') }}
              </span>
            </span>
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.loading-scan-wrapper {
  display: inline-block;
  position: relative;
}

.loading-scan-text {
  display: inline-block;
  background: linear-gradient(
    90deg,
    var(--ui-text-highlighted) 0%,
    var(--ui-text-highlighted) 30%,
    var(--ui-text-muted) 50%,
    var(--ui-text-highlighted) 70%,
    var(--ui-text-highlighted) 100%
  );
  background-size: 200% 100%;
  background-position: 200% 0;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  animation: scan-x-text 1.2s linear infinite;
}

@keyframes scan-x-text {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
