<script setup lang="ts">
import {
  buildPublicProfileRoute,
  buildPublicProfileUrl,
} from '~/utils/public-profile-routes'

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => $t('title.profile'),
})

type HomepageVisibility = 'private' | 'public'

interface ProfileResponse {
  publicId: string | null
  displayName: string
  profileTitle?: string | null
  profileSlogan?: string | null
  profileBio?: string | null
  avatar?: string | null
  homepageVisibility: HomepageVisibility
}

const toast = useToast()
const { fetch: refreshSession } = useUserSession()
const isSaving = ref(false)
const browserOrigin = ref('')

const { data: profile, refresh } = await useFetch<ProfileResponse>(
  '/api/me/profile',
)

onMounted(() => {
  browserOrigin.value = window.location.origin
})

const form = reactive({
  displayName: '',
  profileTitle: '',
  profileSlogan: '',
  profileBio: '',
  avatar: '',
  homepageVisibility: 'private' as HomepageVisibility,
})

watch(
  profile,
  (value) => {
    if (!value) return
    form.displayName = value.displayName || ''
    form.profileTitle = value.profileTitle || ''
    form.profileSlogan = value.profileSlogan || ''
    form.profileBio = value.profileBio || ''
    form.avatar = value.avatar || ''
    form.homepageVisibility = value.homepageVisibility || 'private'
  },
  { immediate: true },
)

const publicRoute = computed(() =>
  profile.value?.publicId
    ? buildPublicProfileRoute(profile.value.publicId)
    : '',
)
const publicUrl = computed(() =>
  profile.value?.publicId && browserOrigin.value
    ? buildPublicProfileUrl(browserOrigin.value, profile.value.publicId)
    : publicRoute.value,
)
const isHomepagePublic = computed(() => form.homepageVisibility === 'public')

const visibilityOptions = computed(() => [
  { label: $t('dashboard.profile.visibility.private'), value: 'private' },
  { label: $t('dashboard.profile.visibility.public'), value: 'public' },
])

const saveProfile = async () => {
  isSaving.value = true
  try {
    await $fetch('/api/me/profile', {
      method: 'PUT',
      body: {
        displayName: form.displayName,
        profileTitle: form.profileTitle || null,
        profileSlogan: form.profileSlogan || null,
        profileBio: form.profileBio || null,
        avatar: form.avatar || null,
        homepageVisibility: form.homepageVisibility,
      },
    })
    await refresh()
    await refreshSession()
    toast.add({
      title: $t('dashboard.profile.messages.saved'),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title: $t('dashboard.profile.messages.saveFailed'),
      description: error?.data?.message || error?.message,
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const copyPublicUrl = async () => {
  if (!publicUrl.value || !isHomepagePublic.value) return
  await navigator.clipboard.writeText(publicUrl.value)
  toast.add({
    title: $t('dashboard.profile.messages.linkCopied'),
    color: 'success',
  })
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('title.profile')" />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-3xl space-y-6">
        <section class="space-y-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <h1 class="text-2xl font-semibold">
            {{ $t('dashboard.profile.title') }}
          </h1>
          <p class="text-sm text-muted">
            {{ $t('dashboard.profile.description') }}
          </p>
        </section>

        <form
          class="space-y-5"
          @submit.prevent="saveProfile"
        >
          <UFormField
            :label="$t('dashboard.profile.form.displayName')"
            required
          >
            <UInput
              v-model="form.displayName"
              class="w-full"
              required
            />
          </UFormField>

          <UFormField :label="$t('dashboard.profile.form.profileTitle')">
            <UInput
              v-model="form.profileTitle"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('dashboard.profile.form.profileSlogan')">
            <UInput
              v-model="form.profileSlogan"
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('dashboard.profile.form.avatar')">
            <UInput
              v-model="form.avatar"
              class="w-full"
              type="url"
            />
          </UFormField>

          <UFormField :label="$t('dashboard.profile.form.profileBio')">
            <UTextarea
              v-model="form.profileBio"
              class="w-full"
              :rows="5"
            />
          </UFormField>

          <UFormField :label="$t('dashboard.profile.form.visibility')">
            <USelect
              v-model="form.homepageVisibility"
              class="w-full"
              :items="visibilityOptions"
            />
          </UFormField>

          <UAlert
            v-if="publicUrl"
            icon="tabler:link"
            color="neutral"
            variant="soft"
            :title="$t('dashboard.profile.publicLink.title')"
            :description="isHomepagePublic
              ? $t('dashboard.profile.publicLink.enabled')
              : $t('dashboard.profile.publicLink.disabled')"
          >
            <template #description>
              <p class="text-sm text-muted">
                {{
                  isHomepagePublic
                    ? $t('dashboard.profile.publicLink.enabled')
                    : $t('dashboard.profile.publicLink.disabled')
                }}
              </p>
              <div class="mt-3 flex gap-2">
                <UInput
                  :model-value="publicUrl"
                  readonly
                  class="min-w-0 flex-1"
                />
                <UButton
                  icon="tabler:copy"
                  :disabled="!isHomepagePublic"
                  :aria-label="$t('dashboard.profile.actions.copyLink')"
                  @click="copyPublicUrl"
                />
                <UButton
                  icon="tabler:external-link"
                  color="neutral"
                  variant="soft"
                  :disabled="!isHomepagePublic"
                  :to="isHomepagePublic ? publicRoute : undefined"
                  target="_blank"
                  :aria-label="$t('dashboard.profile.actions.openLink')"
                />
              </div>
            </template>
          </UAlert>

          <div class="flex justify-end">
            <UButton
              type="submit"
              icon="tabler:device-floppy"
              :loading="isSaving"
            >
              {{ $t('common.actions.save') }}
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </UDashboardPanel>
</template>
