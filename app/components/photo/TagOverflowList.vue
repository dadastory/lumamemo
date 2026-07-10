<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    tags: string[]
    badgeClass?: string
    counterClass?: string
  }>(),
  {
    badgeClass: '',
    counterClass: '',
  },
)

const containerRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)
const visibleCount = ref(0)
let resizeObserver: ResizeObserver | null = null

const normalizedTags = computed(() =>
  (props.tags || []).map((tag) => String(tag || '').trim()).filter(Boolean),
)
const visibleTags = computed(() =>
  normalizedTags.value.slice(0, visibleCount.value),
)
const hiddenCount = computed(() =>
  Math.max(normalizedTags.value.length - visibleTags.value.length, 0),
)

const measureTags = async () => {
  await nextTick()

  const container = containerRef.value
  const measure = measureRef.value
  const tags = normalizedTags.value
  if (!container || !measure || tags.length === 0) {
    visibleCount.value = 0
    return
  }

  const availableWidth = container.clientWidth
  if (availableWidth <= 0) {
    visibleCount.value = 0
    return
  }

  const style = window.getComputedStyle(measure)
  const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0
  const tagWidths = Array.from(
    measure.querySelectorAll<HTMLElement>('[data-tag-measure]'),
  ).map((element) => element.offsetWidth)
  const counterWidth =
    measure.querySelector<HTMLElement>('[data-counter-measure]')
      ?.offsetWidth || 0

  let usedWidth = 0
  let count = 0
  for (const width of tagWidths) {
    const nextCount = count + 1
    const hiddenAfterNext = tags.length - nextCount
    const nextWidth = usedWidth + (count > 0 ? gap : 0) + width
    const totalWidth =
      hiddenAfterNext > 0
        ? nextWidth + gap + counterWidth
        : nextWidth

    if (totalWidth > availableWidth) break
    usedWidth = nextWidth
    count = nextCount
  }

  visibleCount.value = count
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    void measureTags()
  })
  if (containerRef.value) resizeObserver.observe(containerRef.value)
  void measureTags()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  normalizedTags,
  () => {
    void measureTags()
  },
  { deep: true },
)
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex max-w-full items-center gap-1 overflow-hidden"
  >
    <UBadge
      v-for="(tag, index) in visibleTags"
      :key="`${tag}-${index}`"
      size="sm"
      color="neutral"
      class="max-w-full overflow-hidden truncate whitespace-nowrap"
      :class="badgeClass"
      :title="tag"
    >
      {{ tag }}
    </UBadge>
    <UBadge
      v-if="hiddenCount > 0"
      size="sm"
      color="neutral"
      class="shrink-0 whitespace-nowrap"
      :class="counterClass"
    >
      +{{ hiddenCount }}
    </UBadge>

    <div
      ref="measureRef"
      aria-hidden="true"
      class="invisible pointer-events-none absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap"
    >
      <UBadge
        v-for="(tag, index) in normalizedTags"
        :key="`measure-${tag}-${index}`"
        data-tag-measure
        size="sm"
        color="neutral"
        class="max-w-full overflow-hidden truncate whitespace-nowrap"
        :class="badgeClass"
      >
        {{ tag }}
      </UBadge>
      <UBadge
        v-if="normalizedTags.length > 0"
        data-counter-measure
        size="sm"
        color="neutral"
        class="shrink-0 whitespace-nowrap"
        :class="counterClass"
      >
        +{{ normalizedTags.length }}
      </UBadge>
    </div>
  </div>
</template>
