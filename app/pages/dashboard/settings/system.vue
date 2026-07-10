<script lang="ts" setup>
import type { FieldDescriptor } from '~~/shared/types/settings'

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => $t('title.systemSettings'),
})

const {
  fields: rawSystemFields,
  state: systemState,
  submit: submitSystem,
  loading: systemLoading,
} = useSettingsForm('system')

const systemFields = computed(() =>
  rawSystemFields.value.filter((field) => !field.isReadonly),
)

type SystemSection = {
  id: string
  titleKey: string
  keys: string[]
}

type SystemSectionWithFields = SystemSection & {
  fields: FieldDescriptor[]
  visibleFields: FieldDescriptor[]
}

const SYSTEM_SECTION_ORDER: SystemSection[] = [
  {
    id: 'fileProcessing',
    titleKey: 'settings.system.sections.fileProcessing',
    keys: [
      'upload.maxFileSize',
      'upload.duplicateCheck.enabled',
      'upload.duplicateCheck.mode',
    ],
  },
  {
    id: 'debug',
    titleKey: 'settings.system.sections.debugSettings',
    keys: ['webglImageViewerDebug'],
  },
] as const

const isFieldDescriptor = (
  field: FieldDescriptor | undefined,
): field is FieldDescriptor => Boolean(field)

const normalizeSettingValue = (value: unknown) =>
  value &&
  typeof value === 'object' &&
  'value' in (value as Record<string, unknown>)
    ? (value as Record<string, unknown>).value
    : value

const isSameVisibleIfValue = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeSettingValue(left) ?? null) ===
  JSON.stringify(normalizeSettingValue(right) ?? null)

const isSystemFieldVisible = (field: FieldDescriptor) => {
  if (!field.ui.visibleIf) return true
  return isSameVisibleIfValue(
    systemState[field.ui.visibleIf.fieldKey],
    field.ui.visibleIf.value,
  )
}

const systemFieldSections = computed<SystemSectionWithFields[]>(() =>
  SYSTEM_SECTION_ORDER.map((section) => {
    const fields = section.keys
      .map((key) => systemFields.value.find((field) => field.key === key))
      .filter(isFieldDescriptor)

    return {
      ...section,
      fields,
      visibleFields: fields.filter(isSystemFieldVisible),
    }
  }).filter((section) => section.visibleFields.length > 0),
)

const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeSettingValue(left) ?? null) ===
  JSON.stringify(normalizeSettingValue(right) ?? null)

const getDefaultFieldValue = (field: (typeof rawSystemFields.value)[number]) =>
  field.value ?? field.defaultValue ?? null

const getSectionFormId = (sectionId: string) =>
  `systemSettingsForm-${sectionId}`

const isSectionDirty = (section: SystemSectionWithFields) =>
  section.visibleFields.some(
    (field) => !sameValue(systemState[field.key], getDefaultFieldValue(field)),
  )

const resetSectionSettings = (section: SystemSectionWithFields) => {
  section.visibleFields.forEach((field) => {
    systemState[field.key] = getDefaultFieldValue(field)
  })
}

const handleSectionSettingsSubmit = async (
  section: SystemSectionWithFields,
) => {
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
  <UDashboardPanel id="settings-system">
    <template #header>
      <UDashboardNavbar :title="$t('title.systemSettings')" />
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-4 sm:px-6">
        <header>
          <h1
            class="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white"
          >
            {{ $t('title.systemSettings') }}
          </h1>
          <p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            {{ $t('settings.system.sectionDescription') }}
          </p>
        </header>

        <section
          v-for="section in systemFieldSections"
          :key="section.id"
          class="rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
        >
          <header class="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <h2 class="text-sm font-semibold text-neutral-950 dark:text-white">
              {{ $t(section.titleKey) }}
            </h2>
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

          <footer
            class="border-t border-neutral-200 px-5 py-4 dark:border-neutral-800"
          >
            <div
              v-if="isSectionDirty(section)"
              class="mb-3 rounded-md border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-800 dark:border-warning-900/60 dark:bg-warning-950/30 dark:text-warning-200"
            >
              {{ $t('common.unsavedChanges') }}
            </div>

            <div class="flex items-center justify-end gap-2">
              <UButton
                type="button"
                variant="ghost"
                color="neutral"
                :disabled="systemLoading"
                @click="resetSectionSettings(section)"
              >
                {{ $t('common.actions.reset') }}
              </UButton>

              <UButton
                type="submit"
                :form="getSectionFormId(section.id)"
                color="primary"
                :loading="systemLoading"
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
