<script setup lang="ts">
import { buildPublicAlbumDetailRoute } from '~/utils/public-profile-routes'

interface SessionProfile {
  publicId?: string | null
}

const route = useRoute()
const { loggedIn, user } = useUserSession()

const albumId = computed(() => String(route.params.albumId || '').trim())

const getOwnPublicId = async () => {
  if (user.value?.publicId) {
    return user.value.publicId
  }

  try {
    const profile = await $fetch<SessionProfile>('/api/me/profile')
    return profile.publicId || null
  } catch {
    return null
  }
}

if (!loggedIn.value) {
  await navigateTo('/signin', { replace: true })
} else {
  const publicId = await getOwnPublicId()
  if (!publicId || !albumId.value) {
    throw createError({
      statusCode: 404,
      statusMessage: $t('album.notFound'),
    })
  }

  await navigateTo(buildPublicAlbumDetailRoute(publicId, albumId.value), {
    replace: true,
  })
}
</script>

<template>
  <div />
</template>
