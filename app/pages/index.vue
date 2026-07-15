<script setup lang="ts">
import { resolveAuthenticatedLandingRoute } from '~/utils/profile-entry-redirects'

interface SessionProfile {
  publicId?: string | null
}

// The redirect runs as route middleware rather than in `<script setup>`.
// Redirecting from page setup commits `/` to history first and then fires a
// second navigation, which dead-locks vue-router on browser back/forward
// (popstate) and leaves the app stuck on the loading indicator until a hard
// refresh. Middleware redirects before `/` is ever committed, so back
// navigation returns straight to the previous page.
definePageMeta({
  middleware: [
    async () => {
      const { loggedIn, user } = useUserSession()

      if (!loggedIn.value) {
        return navigateTo('/signin', { replace: true })
      }

      const requestFetch = useRequestFetch()
      let ownPublicId: string | null = null
      try {
        const profile =
          await requestFetch<SessionProfile>('/api/me/profile')
        ownPublicId = profile.publicId || null
      } catch {
        ownPublicId = user.value?.publicId || null
      }

      return navigateTo(resolveAuthenticatedLandingRoute(ownPublicId), {
        replace: true,
      })
    },
  ],
})
</script>

<template>
  <div />
</template>
