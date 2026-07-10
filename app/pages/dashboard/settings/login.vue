<script lang="ts" setup>
import type { FieldDescriptor } from '~~/shared/types/settings'

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => $t('title.thirdPartyLoginSettings'),
})

const {
  fields: rawSystemFields,
  state: systemState,
  submit: submitSystem,
  loading: systemLoading,
} = useSettingsForm('system')

type LoginSection = {
  id: string
  titleKey: string
  keys: string[]
}

type LoginSectionWithFields = LoginSection & {
  fields: FieldDescriptor[]
  visibleFields: FieldDescriptor[]
}

const LOGIN_SECTION_ORDER: LoginSection[] = [
  {
    id: 'thirdPartyLogin',
    titleKey: 'settings.system.sections.thirdPartyLogin',
    keys: [
      'auth.github.enabled',
      'auth.github.clientId',
      'auth.github.clientSecret',
      'auth.oidc.enabled',
      'auth.oidc.label',
      'auth.oidc.issuer',
      'auth.oidc.clientId',
      'auth.oidc.clientSecret',
      'auth.oidc.scope',
      'auth.oidc.clientAuthMethod',
    ],
  },
] as const

const systemFields = computed(() =>
  rawSystemFields.value.filter((field) => !field.isReadonly),
)

const isFieldDescriptor = (
  field: FieldDescriptor | undefined,
): field is FieldDescriptor => Boolean(field)

const normalizeSettingValue = (value: unknown) =>
  value &&
  typeof value === 'object' &&
  'value' in (value as Record<string, unknown>)
    ? (value as Record<string, unknown>).value
    : value

const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeSettingValue(left) ?? null) ===
  JSON.stringify(normalizeSettingValue(right) ?? null)

const isSameVisibleIfValue = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeSettingValue(left) ?? null) ===
  JSON.stringify(normalizeSettingValue(right) ?? null)

const isLoginFieldVisible = (field: FieldDescriptor) => {
  if (!field.ui.visibleIf) return true
  return isSameVisibleIfValue(
    systemState[field.ui.visibleIf.fieldKey],
    field.ui.visibleIf.value,
  )
}

const loginFieldSections = computed<LoginSectionWithFields[]>(() =>
  LOGIN_SECTION_ORDER.map((section) => {
    const fields = section.keys
      .map((key) => systemFields.value.find((field) => field.key === key))
      .filter(isFieldDescriptor)

    return {
      ...section,
      fields,
      visibleFields: fields.filter(isLoginFieldVisible),
    }
  }).filter((section) => section.visibleFields.length > 0),
)

const getDefaultFieldValue = (field: (typeof rawSystemFields.value)[number]) =>
  field.value ?? field.defaultValue ?? null

const getSectionFormId = (sectionId: string) =>
  `thirdPartyLoginSettingsForm-${sectionId}`

const isSectionDirty = (section: LoginSectionWithFields) =>
  section.visibleFields.some(
    (field) => !sameValue(systemState[field.key], getDefaultFieldValue(field)),
  )

const resetSectionSettings = (section: LoginSectionWithFields) => {
  section.visibleFields.forEach((field) => {
    systemState[field.key] = getDefaultFieldValue(field)
  })
}

const handleSectionSettingsSubmit = async (section: LoginSectionWithFields) => {
  try {
    await submitSystem(
      Object.fromEntries(
        section.visibleFields.map((field) => [field.key, systemState[field.key]]),
      ),
    )
  } catch {
    /* empty */
  }
}
</script>

<template>
  <UDashboardPanel id="settings-login">
    <template #header>
      <UDashboardNavbar :title="$t('title.thirdPartyLoginSettings')" />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <section class="space-y-2 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <h2 class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {{ $t('title.thirdPartyLoginSettings') }}
          </h2>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ $t('settings.system.sections.thirdPartyLogin') }}
          </p>
        </section>

        <template v-if="systemLoading && loginFieldSections.length === 0">
          <section
            v-for="index in 2"
            :key="index"
            class="rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
          >
            <header class="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <USkeleton class="h-5 w-36" />
            </header>
            <div class="space-y-4 px-5 py-5">
              <USkeleton class="h-4 w-40" />
              <USkeleton class="h-10 w-full" />
            </div>
          </section>
        </template>

        <section
          v-for="section in loginFieldSections"
          :key="section.id"
          class="rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
        >
          <header class="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <h3 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {{ $t(section.titleKey) }}
            </h3>
          </header>

          <UForm
            :id="getSectionFormId(section.id)"
            :state="systemState"
            class="space-y-5 px-5 py-5"
            @submit="handleSectionSettingsSubmit(section)"
          >
            <SettingField
              v-for="field in section.visibleFields"
              :key="field.key"
              :field="field"
              :model-value="systemState[field.key]"
              @update:model-value="(val) => (systemState[field.key] = val)"
            />
          </UForm>

          <footer class="border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <div
              v-if="isSectionDirty(section)"
              class="mb-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-900/60 dark:bg-warning-950/30 dark:text-warning-200"
            >
              {{ $t('common.unsavedChanges') }}
            </div>

            <div class="flex items-center justify-end gap-2">
              <UButton
                color="neutral"
                variant="outline"
                :disabled="!isSectionDirty(section)"
                @click="resetSectionSettings(section)"
              >
                {{ $t('common.actions.reset') }}
              </UButton>
              <UButton
                :loading="systemLoading"
                type="submit"
                :form="getSectionFormId(section.id)"
                :disabled="!isSectionDirty(section)"
                icon="tabler:device-floppy"
              >
                {{ $t('common.actions.saveSettings') }}
              </UButton>
            </div>
          </footer>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
