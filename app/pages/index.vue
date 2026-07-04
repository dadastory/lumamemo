<script setup lang="ts">
import { resolveAuthenticatedLandingRoute } from '~/utils/profile-entry-redirects'

interface SessionProfile {
  publicId?: string | null
}

const { loggedIn, user } = useUserSession()

const getOwnPublicId = async () => {
  if (!loggedIn.value) {
    return null
  }

  try {
    const profile = await $fetch<SessionProfile>('/api/me/profile')
    return profile.publicId || null
  } catch {
    return user.value?.publicId || null
  }
}

await navigateTo(
  loggedIn.value
    ? resolveAuthenticatedLandingRoute(await getOwnPublicId())
    : '/signin',
  { replace: true },
)
</script>

<template>
  <div />
</template>
