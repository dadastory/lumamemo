<script setup lang="ts">
import PhotoGlobePage from '~/pages/globe.vue'
import { buildPublicProfileRoute } from '~/utils/public-profile-routes'

definePageMeta({
  layout: false,
})

interface PublicProfile {
  displayName: string
  profileTitle?: string | null
}

const route = useRoute()
const publicId = computed(() => String(route.params.publicId || ''))
const encodedPublicId = computed(() => encodeURIComponent(publicId.value))

const { data: profile, error } = await useFetch<PublicProfile>(
  () => `/api/public/profiles/${encodedPublicId.value}`,
  { watch: [encodedPublicId] },
)

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Profile not found',
  })
}

useHead({
  title: () =>
    profile.value?.profileTitle ||
    profile.value?.displayName ||
    $t('title.globe'),
})
</script>

<template>
  <PhotoGlobePage
    :back-route="buildPublicProfileRoute(publicId)"
    :redirect-legacy-entry="false"
  />
</template>
