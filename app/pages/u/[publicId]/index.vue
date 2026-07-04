<script setup lang="ts">
definePageMeta({
  layout: false,
})

const route = useRoute()
const publicId = computed(() => String(route.params.publicId || ''))
</script>

<template>
  <PublicProfileMasonry :public-id="publicId" />
</template>
