<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: false,
})

useHead({
  title: () => $t('invite.title'),
})

const route = useRoute()
const toast = useToast()
const { fetch: fetchUserSession } = useUserSession()

const token = computed(() => route.params.token?.toString() || '')

const { data: invitation, error } = await useFetch<{
  email: string
  expiresAt: string
}>(() => `/api/invitations/${token.value}`, {
  watch: [token],
})

const schema = z.object({
  username: z.string().min(2, $t('invite.form.errors.username')),
  password: z.string().min(6, $t('invite.form.errors.password')),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  username: '',
  password: '',
})

const isSubmitting = ref(false)

const acceptInvite = async (event: FormSubmitEvent<Schema>) => {
  isSubmitting.value = true
  try {
    await $fetch(`/api/invitations/${token.value}/accept`, {
      method: 'POST',
      body: event.data,
    })
    await fetchUserSession()
    toast.add({
      title: $t('invite.messages.accepted'),
      color: 'success',
    })
    window.location.assign('/dashboard/photos')
  } catch (err: any) {
    toast.add({
      title: $t('invite.messages.failed'),
      description: err?.data?.message || err?.message,
      color: 'error',
    })
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-svh flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-md space-y-6">
      <UButton
        to="/"
        variant="link"
        color="neutral"
        icon="tabler:arrow-left"
        size="xs"
      >
        {{ $t('auth.form.action.backToHome') }}
      </UButton>

      <div class="rounded-md border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div class="mb-6 space-y-2">
          <div class="inline-flex size-10 items-center justify-center rounded-md bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300">
            <UIcon
              name="tabler:user-plus"
              class="size-5"
            />
          </div>
          <h1 class="text-xl font-semibold">
            {{ $t('invite.title') }}
          </h1>
          <p
            v-if="invitation"
            class="text-sm text-muted"
          >
            {{ $t('invite.subtitle', { email: invitation.email }) }}
          </p>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="tabler:alert-circle"
          :title="$t('invite.invalid.title')"
          :description="$t('invite.invalid.description')"
        />

        <UForm
          v-else
          class="space-y-4"
          :schema="schema"
          :state="state"
          @submit="acceptInvite"
        >
          <UFormField
            :label="$t('invite.form.email')"
          >
            <UInput
              :model-value="invitation?.email || ''"
              class="w-full"
              readonly
            />
          </UFormField>

          <UFormField
            :label="$t('invite.form.username')"
            name="username"
            required
          >
            <UInput
              v-model="state.username"
              class="w-full"
              autocomplete="username"
            />
          </UFormField>

          <UFormField
            :label="$t('invite.form.password')"
            name="password"
            required
          >
            <UInput
              v-model="state.password"
              class="w-full"
              type="password"
              autocomplete="new-password"
            />
          </UFormField>

          <UButton
            type="submit"
            block
            icon="tabler:login-2"
            :loading="isSubmitting"
          >
            {{ $t('invite.form.submit') }}
          </UButton>
        </UForm>
      </div>
    </div>
  </div>
</template>
