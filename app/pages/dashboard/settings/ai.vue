<script lang="ts" setup>
import type { FieldDescriptor } from '~~/shared/types/settings'

definePageMeta({
  layout: 'dashboard',
})

useHead({
  title: () => $t('title.aiSettings'),
})

const {
  fields: rawSystemFields,
  state: systemState,
  submit: submitSystem,
  loading: systemLoading,
} = useSettingsForm('system')

const toast = useToast()
const mlActionLoading = ref<
  'vlm' | 'embedding' | 'face' | 'backfill' | 'cluster' | null
>(null)
const mlTestResults = ref<Record<'vlm' | 'embedding' | 'face', any | null>>({
  vlm: null,
  embedding: null,
  face: null,
})
const LOCALAI_DEFAULT_BASE_URL = 'http://chronoframe-localai:8080'
const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const JINA_DEFAULT_BASE_URL = 'https://api.jina.ai/v1'
const JINA_IMAGE_EMBEDDING_MODEL_VALUES = new Set([
  'jina-embeddings-v4',
  'jina-embeddings-v5-omni-small',
  'jina-embeddings-v5-omni-nano',
  'jina-clip-v1',
  'jina-clip-v2',
])

const systemFields = computed(() =>
  rawSystemFields.value.filter((field) => !field.isReadonly),
)

type SystemSection = {
  id: string
  titleKey: string
  keys: string[]
}

type SystemFieldGroup = {
  id: string
  titleKey: string
  descriptionKey: string
  keys: string[]
}

type SystemFieldGroupWithFields = SystemFieldGroup & {
  fields: FieldDescriptor[]
  visibleFields: FieldDescriptor[]
}

type SystemSectionWithFields = SystemSection & {
  fields: FieldDescriptor[]
  visibleFields: FieldDescriptor[]
  fieldGroups: SystemFieldGroupWithFields[]
}

const MACHINE_LEARNING_FIELD_GROUPS: SystemFieldGroup[] = [
  {
    id: 'base',
    titleKey: 'settings.system.ml.groups.base.title',
    descriptionKey: 'settings.system.ml.groups.base.description',
    keys: ['ml.language', 'ml.enabled', 'ml.localAiBaseUrl'],
  },
  {
    id: 'vision',
    titleKey: 'settings.system.ml.groups.vision.title',
    descriptionKey: 'settings.system.ml.groups.vision.description',
    keys: [
      'ml.vlmProvider',
      'ml.vlmBaseUrl',
      'ml.vlmApiKey',
      'ml.vlmModel',
      'ml.autoTag.enabled',
      'ml.autoTag.minScore',
      'ml.aiDescription.enabled',
    ],
  },
  {
    id: 'semantic',
    titleKey: 'settings.system.ml.groups.semantic.title',
    descriptionKey: 'settings.system.ml.groups.semantic.description',
    keys: [
      'ml.semanticSearch.enabled',
      'ml.embeddingBaseUrl',
      'ml.embeddingApiKey',
      'ml.embeddingModel',
    ],
  },
  {
    id: 'face',
    titleKey: 'settings.system.ml.groups.face.title',
    descriptionKey: 'settings.system.ml.groups.face.description',
    keys: ['ml.faceAlbum.enabled', 'ml.faceModel', 'ml.faceCluster.threshold'],
  },
  {
    id: 'vector',
    titleKey: 'settings.system.ml.groups.vector.title',
    descriptionKey: 'settings.system.ml.groups.vector.description',
    keys: [
      'ml.vectorProvider',
      'ml.vectorBaseUrl',
      'ml.vectorApiKey',
      'ml.vectorCollectionPrefix',
      'ml.ocr.enabled',
    ],
  },
] as const

const SYSTEM_SECTION_ORDER: SystemSection[] = [
  {
    id: 'machineLearning',
    titleKey: 'settings.system.sections.machineLearning',
    keys: MACHINE_LEARNING_FIELD_GROUPS.flatMap((group) => group.keys),
  },
] as const

const isFieldDescriptor = (
  field: FieldDescriptor | undefined,
): field is FieldDescriptor => Boolean(field)

const isMachineLearningEnabled = computed(() =>
  Boolean(systemState['ml.enabled']),
)

const normalizeSettingValue = (value: unknown) =>
  value &&
  typeof value === 'object' &&
  'value' in (value as Record<string, unknown>)
    ? (value as Record<string, unknown>).value
    : value

const normalizeProviderValue = (value: unknown) => {
  const normalized = normalizeSettingValue(value)
  return typeof normalized === 'string' ? normalized.trim() : normalized
}

const isSameVisibleIfValue = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeSettingValue(left) ?? null) ===
  JSON.stringify(normalizeSettingValue(right) ?? null)

const isLocalAiVlmProvider = () =>
  normalizeProviderValue(systemState['ml.vlmProvider']) === 'localai'

const isOpenAiProviderValue = (value: unknown) =>
  normalizeProviderValue(value) === 'openai'

const getProviderDefaultBaseUrl = (provider: unknown) => {
  if (isOpenAiProviderValue(provider)) return OPENAI_DEFAULT_BASE_URL
  return ''
}

const isSystemFieldVisible = (
  section: SystemSection,
  field: FieldDescriptor,
) => {
  if (section.id !== 'machineLearning') return true
  if (field.key === 'ml.language') return true
  if (field.key === 'ml.enabled') return true
  if (!isMachineLearningEnabled.value) return false
  if (field.key === 'ml.vlmBaseUrl' || field.key === 'ml.vlmApiKey') {
    return !isLocalAiVlmProvider()
  }
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
    const fieldGroups =
      section.id === 'machineLearning'
        ? MACHINE_LEARNING_FIELD_GROUPS.map((group) => {
            const groupFields = group.keys
              .map((key) => fields.find((field) => field.key === key))
              .filter(isFieldDescriptor)
            return {
              ...group,
              fields: groupFields,
              visibleFields: groupFields.filter((field) =>
                isSystemFieldVisible(section, field),
              ),
            }
          }).filter((group) => group.visibleFields.length > 0)
        : []

    return {
      ...section,
      fields,
      visibleFields: fields.filter((field) =>
        isSystemFieldVisible(section, field),
      ),
      fieldGroups,
    }
  }).filter((section) => section.visibleFields.length > 0),
)

const sameValue = (left: any, right: any) =>
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

const getSectionSubmitFields = (section: SystemSectionWithFields) =>
  section.id === 'machineLearning' && !isMachineLearningEnabled.value
    ? section.visibleFields.filter((field) =>
        ['ml.language', 'ml.enabled'].includes(field.key),
      )
    : section.visibleFields

const resetSectionSettings = (section: SystemSectionWithFields) => {
  section.visibleFields.forEach((field) => {
    systemState[field.key] = getDefaultFieldValue(field)
  })
  if (section.id === 'machineLearning') {
    ensureProviderBaseUrls()
  }
}

const isBlankString = (value: unknown) =>
  typeof value !== 'string' || value.trim().length === 0

const isJinaImageEmbeddingModel = (value: unknown) =>
  typeof value === 'string' &&
  JINA_IMAGE_EMBEDDING_MODEL_VALUES.has(value.trim())

const ensureProviderBaseUrls = () => {
  if (
    (Boolean(systemState['ml.enabled']) || isLocalAiVlmProvider()) &&
    isBlankString(systemState['ml.localAiBaseUrl'])
  ) {
    systemState['ml.localAiBaseUrl'] = LOCALAI_DEFAULT_BASE_URL
  }
  const vlmDefault = getProviderDefaultBaseUrl(systemState['ml.vlmProvider'])
  if (vlmDefault && isBlankString(systemState['ml.vlmBaseUrl'])) {
    systemState['ml.vlmBaseUrl'] = vlmDefault
  }
  if (isBlankString(systemState['ml.embeddingBaseUrl'])) {
    systemState['ml.embeddingBaseUrl'] = JINA_DEFAULT_BASE_URL
  }
}

const validateMachineLearningSectionData = (data: Record<string, any>) => {
  if (!data['ml.enabled'] || !data['ml.semanticSearch.enabled']) return true

  const requiredFields = [
    'ml.embeddingBaseUrl',
    'ml.embeddingApiKey',
    'ml.embeddingModel',
  ]
  const missing = requiredFields.some((key) => isBlankString(data[key]))
  if (!missing) return true

  toast.add({
    title: $t('settings.system.ml.actions.embeddingRequired'),
    color: 'error',
  })
  return false
}

const validateJinaImageEmbeddingModel = (data: Record<string, any>) => {
  if (!data['ml.enabled'] || !data['ml.semanticSearch.enabled']) return true
  if (isJinaImageEmbeddingModel(data['ml.embeddingModel'])) return true

  toast.add({
    title: $t('settings.system.ml.actions.embeddingImageModelRequired'),
    color: 'error',
  })
  return false
}

const normalizeMachineLearningSectionData = (
  section: SystemSectionWithFields,
  data: Record<string, any>,
) => {
  if (section.id !== 'machineLearning') return data
  let normalizedData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      key === 'ml.vlmProvider'
        ? normalizeProviderValue(value)
        : normalizeSettingValue(value),
    ]),
  )
  const vlmProvider = normalizeProviderValue(
    normalizedData['ml.vlmProvider'] ?? systemState['ml.vlmProvider'],
  )
  if (
    (normalizedData['ml.enabled'] || vlmProvider === 'localai') &&
    isBlankString(normalizedData['ml.localAiBaseUrl'])
  ) {
    normalizedData = {
      ...normalizedData,
      'ml.localAiBaseUrl': LOCALAI_DEFAULT_BASE_URL,
    }
  }
  const vlmDefault = getProviderDefaultBaseUrl(vlmProvider)
  if (vlmDefault && isBlankString(normalizedData['ml.vlmBaseUrl'])) {
    normalizedData['ml.vlmBaseUrl'] = vlmDefault
  }
  if (isBlankString(normalizedData['ml.embeddingBaseUrl'])) {
    normalizedData['ml.embeddingBaseUrl'] = JINA_DEFAULT_BASE_URL
  }
  return normalizedData
}

const handleSectionSettingsSubmit = async (
  section: SystemSectionWithFields,
) => {
  const systemData = normalizeMachineLearningSectionData(
    section,
    Object.fromEntries(
      getSectionSubmitFields(section).map((f) => [f.key, systemState[f.key]]),
    ),
  )
  if (!validateMachineLearningSectionData(systemData)) return
  if (!validateJinaImageEmbeddingModel(systemData)) return

  try {
    await submitSystem(systemData)
  } catch {
    /* empty */
  }
}

watch(
  () => systemState['ml.enabled'],
  (enabled) => {
    if (enabled) {
      ensureProviderBaseUrls()
    }
  },
)

watch(
  () => [
    normalizeProviderValue(systemState['ml.vlmProvider']),
  ],
  () => {
    ensureProviderBaseUrls()
  },
)

watch(
  () => rawSystemFields.value.length,
  () => {
    ensureProviderBaseUrls()
  },
)

const getGroupTestCapability = (groupId: string) => {
  if (groupId === 'vision') return 'vlm'
  if (groupId === 'semantic') return 'embedding'
  if (groupId === 'face') return 'face'
  return null
}

const testGroupMachineLearningCapability = (groupId: string) => {
  if (groupId === 'vision') return testMachineLearningCapability('vlm')
  if (groupId === 'semantic') {
    return testMachineLearningCapability('embedding')
  }
  if (groupId === 'face') return testMachineLearningCapability('face')
}

const getCapabilityTestLabelKey = (capability: 'vlm' | 'embedding' | 'face') =>
  capability === 'vlm'
    ? 'settings.system.ml.actions.testVlm'
    : capability === 'embedding'
      ? 'settings.system.ml.actions.testEmbedding'
      : 'settings.system.ml.actions.testFace'

const getCapabilityTestIcon = (capability: 'vlm' | 'embedding' | 'face') =>
  capability === 'vlm'
    ? 'tabler:photo-ai'
    : capability === 'embedding'
      ? 'tabler:vector'
      : 'tabler:face-id'

const getCapabilityTestResult = (capability: 'vlm' | 'embedding' | 'face') =>
  mlTestResults.value[capability]

const getGroupTestResult = (groupId: string) => {
  const capability = getGroupTestCapability(groupId)
  return capability ? getCapabilityTestResult(capability) : null
}

const getGroupTestLabelKey = (groupId: string) => {
  const capability = getGroupTestCapability(groupId)
  return capability ? getCapabilityTestLabelKey(capability) : ''
}

const getGroupTestIcon = (groupId: string) => {
  const capability = getGroupTestCapability(groupId)
  return capability ? getCapabilityTestIcon(capability) : undefined
}

const isGroupTestLoading = (groupId: string) =>
  mlActionLoading.value === getGroupTestCapability(groupId)

const getCapabilityTestMessage = (result: any) => {
  if (!result) return ''
  if (result.ok) {
    const dimensions = result.details?.textEmbeddingDim
      ? ` · ${result.details.textEmbeddingDim}d`
      : ''
    return `${result.requestedModel || result.model || result.provider || ''}${dimensions} · ${result.durationMs}ms`
  }
  return result.error || $t('settings.system.ml.actions.testFailed')
}

const getMachineLearningTestPayload = () =>
  normalizeMachineLearningSectionData(
    {
      id: 'machineLearning',
      titleKey: '',
      keys: [],
      fields: [],
      visibleFields: [],
      fieldGroups: [],
    },
    Object.fromEntries(
      systemFields.value
        .filter((field) => field.key.startsWith('ml.'))
        .map((field) => [field.key, systemState[field.key]]),
    ),
  )

const testMachineLearningCapability = async (
  capability: 'vlm' | 'embedding' | 'face',
) => {
  mlActionLoading.value = capability
  try {
    const result = await $fetch('/api/system/ml/test', {
      method: 'POST',
      body: {
        capability,
        settings: getMachineLearningTestPayload(),
      },
    })
    mlTestResults.value = {
      ...mlTestResults.value,
      [capability]: result,
    }
    toast.add({
      title: $t(
        result.ok
          ? 'settings.system.ml.actions.testSuccess'
          : 'settings.system.ml.actions.testFailed',
      ),
      description: getCapabilityTestMessage(result),
      color: result.ok ? 'success' : 'error',
    })
  } catch (error: any) {
    const result = {
      ok: false,
      error: getErrorMessage(
        error,
        $t('settings.system.ml.actions.testFailed'),
      ),
    }
    mlTestResults.value = {
      ...mlTestResults.value,
      [capability]: result,
    }
    toast.add({
      title: $t('settings.system.ml.actions.testFailed'),
      description: result.error,
      color: 'error',
    })
  } finally {
    mlActionLoading.value = null
  }
}

const enqueueMachineLearningTask = async (
  type: 'photo-ml-backfill' | 'photo-face-cluster',
) => {
  mlActionLoading.value = type === 'photo-ml-backfill' ? 'backfill' : 'cluster'
  try {
    await $fetch('/api/queue/add-task', {
      method: 'POST',
      body: {
        payload: { type },
        priority: type === 'photo-ml-backfill' ? 1 : 0,
        maxAttempts: 3,
      },
    })
    toast.add({
      title: $t('settings.system.ml.actions.enqueueSuccess'),
      color: 'success',
    })
  } catch (error: any) {
    toast.add({
      title:
        error?.data?.statusMessage ||
        error?.statusMessage ||
        $t('settings.system.ml.actions.enqueueFailed'),
      color: 'error',
    })
  } finally {
    mlActionLoading.value = null
  }
}

const getErrorMessage = (error: any, fallback: string) =>
  error?.data?.statusMessage ||
  error?.statusMessage ||
  error?.message ||
  fallback
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar :title="$t('title.aiSettings')" />
    </template>

    <template #body>
      <div class="mx-auto w-full max-w-5xl space-y-6">
        <section
          class="space-y-2 border-b border-neutral-200 pb-4 dark:border-neutral-800"
        >
          <h2
            class="text-xl font-semibold text-neutral-900 dark:text-neutral-100"
          >
            {{ $t('title.aiSettings') }}
          </h2>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ $t('settings.system.ml.sectionDescription') }}
          </p>
        </section>

        <template v-if="systemLoading && systemFieldSections.length === 0">
          <section
            v-for="index in 3"
            :key="index"
            class="rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
          >
            <header
              class="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"
            >
              <USkeleton class="h-5 w-32" />
            </header>
            <div class="space-y-4 px-5 py-5">
              <USkeleton class="h-4 w-40" />
              <USkeleton class="h-10 w-full" />
            </div>
          </section>
        </template>

        <section
          v-for="section in systemFieldSections"
          :key="section.id"
          class="rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
        >
          <header
            class="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"
          >
            <h3
              class="text-base font-semibold text-neutral-900 dark:text-neutral-100"
            >
              {{ $t(section.titleKey) }}
            </h3>
          </header>

          <UForm
            :id="getSectionFormId(section.id)"
            class="space-y-5 px-5 py-5"
            @submit="handleSectionSettingsSubmit(section)"
          >
            <template v-if="section.id === 'machineLearning'">
              <div class="space-y-8">
                <section
                  v-for="group in section.fieldGroups"
                  :key="group.id"
                  class="space-y-4"
                >
                  <header
                    class="border-b border-neutral-200 pb-3 dark:border-neutral-800"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <h4
                          class="text-sm font-semibold text-neutral-950 dark:text-neutral-100"
                        >
                          {{ $t(group.titleKey) }}
                        </h4>
                        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          {{ $t(group.descriptionKey) }}
                        </p>
                      </div>
                      <UButton
                        v-if="getGroupTestCapability(group.id)"
                        size="xs"
                        type="button"
                        variant="outline"
                        :icon="getGroupTestIcon(group.id)"
                        :loading="isGroupTestLoading(group.id)"
                        @click="testGroupMachineLearningCapability(group.id)"
                      >
                        {{ $t(getGroupTestLabelKey(group.id)) }}
                      </UButton>
                    </div>
                    <p
                      v-if="getGroupTestResult(group.id)"
                      class="mt-2 flex items-start gap-1.5 text-xs"
                      :class="
                        getGroupTestResult(group.id)?.ok
                          ? 'text-success-600 dark:text-success-400'
                          : 'text-error-600 dark:text-error-400'
                      "
                    >
                      <UIcon
                        :name="
                          getGroupTestResult(group.id)?.ok
                            ? 'tabler:circle-check'
                            : 'tabler:alert-circle'
                        "
                        class="mt-0.5 size-3.5 shrink-0"
                      />
                      <span class="min-w-0 break-words">
                        {{
                          getCapabilityTestMessage(getGroupTestResult(group.id))
                        }}
                        <span v-if="isSectionDirty(section)">
                          · {{ $t('settings.system.ml.actions.testUsesUnsaved') }}
                        </span>
                      </span>
                    </p>
                  </header>

                  <div class="grid gap-5 lg:grid-cols-2">
                    <div
                      v-for="field in group.visibleFields"
                      :key="field.key"
                      class="space-y-2"
                    >
                      <SettingField
                        :field="field"
                        :model-value="systemState[field.key]"
                        @update:model-value="
                          (val) => (systemState[field.key] = val)
                        "
                      />
                    </div>
                  </div>
                </section>

                <section
                  v-if="
                    section.id === 'machineLearning' &&
                    isMachineLearningEnabled
                  "
                  class="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800"
                >
                  <header>
                    <h4
                      class="text-sm font-semibold text-neutral-950 dark:text-neutral-100"
                    >
                      {{ $t('settings.system.ml.groups.actions.title') }}
                    </h4>
                    <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {{ $t('settings.system.ml.groups.actions.description') }}
                    </p>
                  </header>

                  <div class="flex flex-wrap items-center gap-2">
                    <UButton
                      size="sm"
                      type="button"
                      variant="outline"
                      icon="tabler:database-import"
                      :loading="mlActionLoading === 'backfill'"
                      @click="enqueueMachineLearningTask('photo-ml-backfill')"
                    >
                      {{ $t('settings.system.ml.actions.backfill') }}
                    </UButton>
                    <UButton
                      size="sm"
                      type="button"
                      variant="outline"
                      icon="tabler:users-group"
                      :loading="mlActionLoading === 'cluster'"
                      @click="enqueueMachineLearningTask('photo-face-cluster')"
                    >
                      {{ $t('settings.system.ml.actions.clusterFaces') }}
                    </UButton>
                  </div>
                </section>
              </div>
            </template>

            <template v-else>
              <div
                v-for="field in section.visibleFields"
                :key="field.key"
                class="space-y-2"
              >
                <SettingField
                  :field="field"
                  :model-value="systemState[field.key]"
                  @update:model-value="(val) => (systemState[field.key] = val)"
                />
              </div>
            </template>
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
