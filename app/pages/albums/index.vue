<script setup lang="ts">
import { buildLegacyProfileEntryRoute } from '~/utils/profile-entry-redirects'

interface SessionProfile {
  publicId?: string | null
}

const { loggedIn, user } = useUserSession()

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
  await navigateTo(
    publicId ? buildLegacyProfileEntryRoute(publicId, 'albums') : '/signin',
    { replace: true },
  )
}
</script>

<template>
  <div />
</template>
