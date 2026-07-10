<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { FieldDescriptor, FieldUIType } from '~~/shared/types/settings'

type SelectOption = {
  label: string
  value: any
  icon?: string
  description?: string
}

interface Props {
  field: FieldDescriptor
  modelValue: any
  disabled?: boolean
  dynamicOptions?: SelectOption[]
  optionsLoading?: boolean
  optionsLoaded?: boolean
  optionsLoadLabel?: string
  optionsError?: string | null
  optionsRetryLabel?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'retry-options': []
}>()

const getComponentName = (uiType: FieldUIType): string => {
  const componentMap: Record<FieldUIType, string> = {
    input: 'UInput',
    password: 'UInput',
    url: 'UInput',
    textarea: 'UTextarea',
    select: 'USelectMenu',
    'select-custom': 'UInput',
    radio: 'URadioGroup',
    tabs: 'UTabs',
    toggle: 'USwitch',
    number: 'UInput',
    custom: 'UInput', // 默认降级到 input
  }

  return componentMap[uiType] || 'UInput'
}

const UInput = resolveComponent('UInput')
const UTextarea = resolveComponent('UTextarea')
const USelectMenu = resolveComponent('USelectMenu')
const URadioGroup = resolveComponent('URadioGroup')
const UTabs = resolveComponent('UTabs')
const USwitch = resolveComponent('USwitch')
const UFormField = resolveComponent('UFormField')
const UButton = resolveComponent('UButton')

const componentName = computed(() => {
  const name = getComponentName(props.field.ui.type)
  switch (name) {
    case 'UInput':
      return UInput
    case 'UTextarea':
      return UTextarea
    case 'USelectMenu':
      return USelectMenu
    case 'URadioGroup':
      return URadioGroup
    case 'UTabs':
      return UTabs
    case 'USwitch':
      return USwitch
    default:
      return UInput
  }
})

const selectItems = computed(() =>
  props.field.ui.options
    ? Array.from(props.field.ui.options).map((opt: any) => ({
        label: $t(opt.label),
        value: opt.value,
        icon: opt.icon,
      }))
    : [],
)

/**
 * Get extra props for the component
 */
const getComponentProps = (): Record<string, any> => {
  const type = props.field.ui.type
  const propsMap: Record<string, any> = {}

  if (props.field.ui.placeholder) {
    propsMap.placeholder = props.field.ui.placeholder
  }

  if (props.disabled) {
    propsMap.disabled = true
  }

  switch (type) {
    case 'password':
    case 'url':
    case 'number':
      propsMap.type = type
      break
    case 'select':
      propsMap.items = selectItems.value
      propsMap['label-key'] = 'label'
      propsMap['value-key'] = 'value'
      break
    case 'radio':
      propsMap.options = props.field.ui.options
        ? Array.from(props.field.ui.options)
        : []
      break
    case 'tabs':
      propsMap.items = props.field.ui.options
        ? Array.from(props.field.ui.options).map((opt: any) => ({
            label: $t(opt.label),
            value: opt.value,
            icon: opt.icon,
          }))
        : []
      break
    case 'textarea':
      propsMap.rows = 3
      break
  }

  return propsMap
}

const componentProps = computed(() => getComponentProps())

const handleChange = (value: any) => {
  emit('update:modelValue', value)
}

const handleSelectChange = (value: any) => {
  emit('update:modelValue', value?.value ?? value)
}

const handleComponentUpdate = (value: any) => {
  if (props.field.ui.type === 'select') {
    handleSelectChange(value)
    return
  }
  handleChange(value)
}

const normalizedSelectValue = computed(() =>
  props.modelValue &&
  typeof props.modelValue === 'object' &&
  'value' in props.modelValue
    ? props.modelValue.value
    : props.modelValue,
)

const customSelectInput = computed({
  get: () => (typeof props.modelValue === 'string' ? props.modelValue : ''),
  set: (value: string) => emit('update:modelValue', value),
})

const staticCustomSelectOptions = computed(() =>
  props.field.ui.options
    ? Array.from(props.field.ui.options).map((opt: any) => ({
        label: $t(opt.label),
        value: opt.value,
        icon: opt.icon,
        description: opt.description ? $t(opt.description) : undefined,
      }))
    : [],
)

const customSelectOptions = computed(() =>
  props.dynamicOptions?.length
    ? props.dynamicOptions
    : staticCustomSelectOptions.value,
)

const combinedSelectItems = computed(() => {
  const items = customSelectOptions.value
  const value = customSelectInput.value.trim()
  if (!value || items.some((item) => item.value === value)) return items

  return [
    {
      label: value,
      value,
      icon: 'tabler:pencil',
      description: $t('settings.form.customValue'),
    },
    ...items,
  ]
})

const selectedCustomSelectItem = computed(() => {
  const selected = combinedSelectItems.value.find(
    (item) => item.value === customSelectInput.value,
  )
  return selected || null
})

const handleCustomSelectChange = (value: any) => {
  emit('update:modelValue', value?.value ?? value ?? '')
}

const labelKey = computed(() => {
  // 尝试从 label 字段获取翻译键
  if (props.field.label) {
    return props.field.label
  }
  // 否则构造一个默认的翻译键
  return `settings.${props.field.namespace}.${props.field.key}.label`
})

const descriptionKey = computed(() => {
  if (props.field.description) {
    return props.field.description
  }
  return `settings.${props.field.namespace}.${props.field.key}.description`
})

const isToggleField = computed(() => props.field.ui.type === 'toggle')
const isCustomSelectField = computed(
  () => props.field.ui.type === 'select-custom',
)
</script>

<template>
  <div
    v-if="isToggleField"
    class="rounded-md border border-neutral-200 bg-neutral-50/50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/40"
    :class="disabled ? 'opacity-60' : ''"
  >
    <div class="flex items-start justify-between gap-6">
      <div class="space-y-1">
        <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {{ $t(labelKey) }}
        </p>
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          {{ $t(descriptionKey) }}
        </p>
        <p
          v-if="field.ui.help"
          class="text-xs text-neutral-500 dark:text-neutral-500"
        >
          {{ $t(field.ui.help) }}
        </p>
      </div>

      <component
        :is="componentName"
        :model-value="modelValue"
        v-bind="componentProps"
        :disabled="disabled"
        @update:model-value="handleChange"
      />
    </div>
  </div>

  <component
    :is="UFormField"
    v-else
    :name="field.key"
    :label="$t(labelKey)"
    :description="$t(descriptionKey)"
    :help="field.ui.help ? $t(field.ui.help) : undefined"
    :required="field.ui.required"
    :ui="{
      container: 'w-full *:w-full',
      label: 'text-sm font-medium',
      description: 'text-sm text-neutral-600 dark:text-neutral-400',
    }"
  >
    <div
      v-if="isCustomSelectField"
      class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]"
      :class="disabled ? 'opacity-60' : ''"
    >
      <component
        :is="USelectMenu"
        :model-value="selectedCustomSelectItem"
        :items="combinedSelectItems"
        label-key="label"
        value-key="value"
        :disabled="disabled"
        :loading="optionsLoading"
        @update:model-value="handleCustomSelectChange"
      />
      <component
        :is="UInput"
        v-model="customSelectInput"
        :placeholder="field.ui.placeholder || $t('settings.form.customValue')"
        :disabled="disabled"
      />
      <div
        v-if="optionsLoadLabel && !optionsLoaded && !optionsError"
        class="sm:col-span-2 flex flex-wrap items-center gap-2 text-xs"
      >
        <component
          :is="UButton"
          size="xs"
          type="button"
          variant="link"
          icon="tabler:download"
          :disabled="disabled"
          :loading="optionsLoading"
          @click="emit('retry-options')"
        >
          {{ optionsLoadLabel }}
        </component>
      </div>
      <p
        v-if="optionsError"
        class="sm:col-span-2 flex flex-wrap items-center gap-2 text-xs text-error-500"
      >
        <span>{{ optionsError }}</span>
        <component
          :is="UButton"
          v-if="optionsRetryLabel"
          size="xs"
          type="button"
          variant="link"
          color="error"
          icon="tabler:refresh"
          :loading="optionsLoading"
          @click="emit('retry-options')"
        >
          {{ optionsRetryLabel }}
        </component>
      </p>
    </div>
    <component
      v-else
      :is="componentName"
      :model-value="field.ui.type === 'select' ? normalizedSelectValue : modelValue"
      v-bind="componentProps"
      :class="disabled ? 'opacity-60' : ''"
      @update:model-value="handleComponentUpdate"
    />
  </component>
</template>

<style scoped></style>
