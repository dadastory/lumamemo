<script lang="ts" setup>
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()
const { loggedIn, user } = useUserSession()
const isAdmin = computed(() => Boolean(user.value?.isAdmin))

const isTruthySetting = (value: unknown) =>
  value === true || value === 'true' || value === 1 || value === '1'

const mlEnabled = useSettingRef('system:ml.enabled')
const faceAlbumEnabled = useSettingRef('system:ml.faceAlbum.enabled')
const showPeopleNav = computed(
  () =>
    isTruthySetting(mlEnabled.value) && isTruthySetting(faceAlbumEnabled.value),
)

const appTitle = computed(() => {
  return user.value?.profileTitle || $t('title.dashboard')
})

const navItems = computed<NavigationMenuItem[][]>(() => {
  const primaryItems: NavigationMenuItem[] = [
    ...(isAdmin.value
      ? [
          {
            label: $t('title.dashboard'),
            icon: 'tabler:dashboard',
            to: '/dashboard',
          },
        ]
      : []),
    {
      label: $t('title.profile'),
      icon: 'tabler:user-circle',
      to: '/dashboard/profile',
    },
    {
      label: $t('title.photos'),
      icon: 'tabler:photo-cog',
      to: '/dashboard/photos',
    },
    {
      label: $t('title.albums'),
      icon: 'tabler:album',
      to: '/dashboard/albums',
    },
    ...(showPeopleNav.value
      ? [
          {
            label: $t('title.people'),
            icon: 'tabler:face-id',
            to: '/dashboard/people',
          },
        ]
      : []),
    ...(isAdmin.value
      ? [
          {
            label: $t('title.queue'),
            icon: 'tabler:list-check',
            to: '/dashboard/queue',
          },
          {
            label: $t('title.dataMaintenance'),
            icon: 'tabler:tool',
            to: '/dashboard/maintenance',
          },
          {
            label: $t('title.logs'),
            icon: 'tabler:file-text',
            to: '/dashboard/logs',
          },
          {
            label: $t('title.users'),
            icon: 'tabler:users',
            to: '/dashboard/users',
          },
          {
            label: $t('title.siteAdministration'),
            icon: 'tabler:settings',
            defaultOpen: route.path.startsWith('/dashboard/settings'),
            children: [
              {
                label: $t('title.generalSettings'),
                icon: 'tabler:settings-2',
                to: '/dashboard/settings/general',
              },
              {
                label: $t('title.storageSettings'),
                icon: 'tabler:database',
                to: '/dashboard/settings/storage',
              },
              {
                label: $t('title.privacySettings'),
                icon: 'tabler:shield-lock',
                to: '/dashboard/settings/privacy',
              },
              {
                label: $t('title.mapAndLocation'),
                icon: 'tabler:map-pin',
                to: '/dashboard/settings/map',
              },
              {
                label: $t('title.thirdPartyLoginSettings'),
                icon: 'tabler:login-2',
                to: '/dashboard/settings/login',
              },
              {
                label: $t('title.aiSettings'),
                icon: 'tabler:sparkles',
                to: '/dashboard/settings/ai',
              },
              {
                label: $t('title.systemSettings'),
                icon: 'tabler:cpu',
                to: '/dashboard/settings/system',
              },
            ],
          },
        ]
      : []),
  ]

  return [
    primaryItems,
    [
      {
        label: 'GitHub',
        icon: 'tabler:brand-github',
        to: 'https://github.com/HoshinoSuzumi/chronoframe',
        target: '_blank',
      },
      {
        label: $t('dashboard.nav.documentation'),
        icon: 'tabler:book',
        to: 'https://chronoframe.bh8.ga/',
        target: '_blank',
      },
      {
        label: 'Discord',
        icon: 'tabler:brand-discord',
        to: 'https://discord.gg/MM4ZK4Ed7s',
        target: '_blank',
      },
    ],
  ]
})

useHead({
  title: () => $t('title.dashboard'),
  titleTemplate: (title) => `${title ? `${title} | ` : ''}${appTitle.value}`,
})

const handleLogin = () => {
  router.push({
    path: '/signin',
    query: { redirect: route.fullPath },
  })
}
</script>

<template>
  <!-- TODO: unified error page -->
  <div
    v-if="!loggedIn"
    class="h-svh flex flex-col gap-4 items-center justify-center px-4"
  >
    <Icon
      name="tabler:alert-triangle"
      class="size-12 text-primary"
    />
    <p class="text-gray-500 text-center">
      {{ $t('dashboard.access.pleaseLogin') }}
    </p>
    <UButton @click="handleLogin">{{ $t('auth.form.signin.title') }}</UButton>
  </div>
  <UDashboardGroup v-else>
    <UDashboardSidebar
      id="cframe-dashboard-sidebar"
      resizable
      collapsible
      mode="drawer"
      :min-size="8"
      :max-size="12"
      :ui="{ footer: 'border-t border-default' }"
      :toggle="{
        color: 'primary',
        variant: 'subtle',
        class: 'rounded-full',
      }"
    >
      <template #toggle>
        <UDashboardSidebarToggle variant="soft" />
      </template>

      <template #header="{ collapsed }">
        <div
          v-if="!collapsed"
          class="flex items-center gap-2"
        >
          <img
            src="/favicon.svg"
            class="h-8 w-auto shrink-0"
          />
          <div class="flex flex-col overflow-hidden">
            <NuxtLink
              to="/"
              class="text-lg font-medium line-clamp-1"
            >
              {{ appTitle }}
            </NuxtLink>
          </div>
        </div>
        <img
          v-else
          src="/favicon.svg"
          class="size-8 mx-auto"
        />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="navItems[0]"
          orientation="vertical"
        />
        <UNavigationMenu
          :collapsed="collapsed"
          :items="navItems[1]"
          orientation="vertical"
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UButton
          :avatar="{
            src: user?.avatar || '',
            alt:
              user?.displayName ||
              user?.username ||
              user?.email ||
              'User Avatar',
            icon: 'tabler:user',
          }"
          :label="
            collapsed
              ? undefined
              : user?.displayName || user?.username || 'User'
          "
          size="lg"
          color="neutral"
          variant="ghost"
          class="w-full"
          :block="collapsed"
          to="/dashboard/profile"
        />
      </template>
    </UDashboardSidebar>

    <NuxtPage />
  </UDashboardGroup>
</template>

<style scoped></style>
