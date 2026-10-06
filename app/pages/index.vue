<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import ContentTypeTabs from '~/components/ContentTypeTabs.vue'
import ContentForm from '~/components/ContentForm.vue'
import StylePanel from '~/components/StylePanel.vue'
import QrPreview from '~/components/QrPreview.vue'
import DownloadButtons from '~/components/DownloadButtons.vue'
import { useQrStyle } from '~/composables/useQrStyle'
import { TYPES, defaultFields, type FieldValues } from '~/utils/fields'
import { buildPayload, type ContentType, type QrInput } from '~/utils/payload'
import { validateInput } from '~/utils/validate'
import { debugLog } from '~/utils/log'

const type = ref<ContentType>('url')
const inputs = reactive(
  Object.fromEntries(TYPES.map((t) => [t.value, defaultFields(t.value)])) as Record<ContentType, FieldValues>,
)
const fields = computed({
  get: () => inputs[type.value],
  set: (v: FieldValues) => {
    inputs[type.value] = v
  },
})

const qrInput = computed(() => ({ type: type.value, ...inputs[type.value] }) as QrInput)
const errors = computed(() => validateInput(qrInput.value))
const valid = computed(() => Object.keys(errors.value).length === 0)

const { style, warning } = useQrStyle()
const payload = computed(() => {
  if (!valid.value) return null
  const text = buildPayload(qrInput.value)
  debugLog('payload built', { type: type.value, length: text.length })
  return text
})
const scanOk = ref<boolean | null>(null)

const renderError = ref<string | null>(null)
const preview = ref<InstanceType<typeof QrPreview>>()
const canDownload = computed(() => valid.value && !renderError.value)
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8">
    <h1 class="text-3xl font-semibold text-slate-900">QR Code Builder</h1>
    <p class="mt-1 text-slate-600">Create a QR code from a link, phone number, and more. Everything stays in your browser.</p>

    <div class="mt-6 grid gap-8 lg:grid-cols-2">
      <section aria-label="Content and style" class="space-y-6">
        <ContentTypeTabs v-model="type" />
        <div id="panel" role="tabpanel" :aria-labelledby="`tab-${type}`" class="rounded-lg border border-slate-300 bg-white p-4">
          <ContentForm :key="type" v-model="fields" :type="type" :errors="errors" />
        </div>
        <details class="rounded-lg border border-slate-300 bg-white p-4" open>
          <summary class="cursor-pointer font-medium text-slate-900">Style</summary>
          <div class="mt-4"><StylePanel v-model="style" :warning="warning" /></div>
        </details>
      </section>

      <section aria-label="Preview" class="flex flex-col items-center gap-4 rounded-lg border border-slate-300 bg-white p-6 lg:sticky lg:top-6 lg:self-start">
        <QrPreview ref="preview" :text="payload" :qr-style="style" @error="renderError = $event" @scan="scanOk = $event" />
        <p v-if="scanOk === false" role="status" class="max-w-sm rounded-md bg-amber-50 p-2 text-sm text-amber-900">
          This design may not scan reliably: a scanner could not read it back. Try a simpler shape or higher contrast.
        </p>
        <DownloadButtons :disabled="!canDownload" @download="preview?.download($event)" />
      </section>
    </div>
  </main>
</template>
