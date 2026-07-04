<script setup lang="ts">
definePageMeta({
  layout: false,
  key: 'public-profile-photo-viewer-route',
})

const route = useRoute()
const publicId = computed(() => String(route.params.publicId || ''))
const photoId = computed(() => String(route.params.photoId || ''))
</script>

<template>
  <PublicProfileMasonry
    :public-id="publicId"
    :photo-id="photoId"
  />
</template>
