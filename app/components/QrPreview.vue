<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type QRCodeStyling from 'qr-code-styling'
import type { Options } from 'qr-code-styling'
import { debugLog } from '~/utils/log'

const props = defineProps<{ options: Options | null }>()
const emit = defineEmits<{ error: [message: string | null] }>()

const container = ref<HTMLDivElement>()
const error = ref<string | null>(null)
let Ctor: typeof QRCodeStyling | null = null
let qr: QRCodeStyling | null = null

const TOO_LONG = 'This content is too long to fit in a QR code. Shorten it or lower the error-correction level.'
// With a logo the error-correction level is locked to High, so that control cannot help.
const TOO_LONG_WITH_LOGO = 'This content is too long to fit in a QR code with a logo. Remove the logo or shorten the content.'

function render() {
  if (!Ctor || !container.value || !props.options) return
  try {
    if (!qr) {
      qr = new Ctor(props.options)
      qr.append(container.value)
    } else {
      qr.update(props.options)
    }
    debugLog('preview rendered', { length: props.options.data?.length })
    error.value = null
  } catch (e) {
    console.error('[qr-code-builder] render failed', { length: props.options.data?.length }, e)
    error.value = props.options.image ? TOO_LONG_WITH_LOGO : TOO_LONG
  }
  emit('error', error.value)
}

onMounted(async () => {
  Ctor = (await import('qr-code-styling')).default
  render()
})
watch(() => props.options, render, { deep: true })

async function download(ext: 'png' | 'svg') {
  if (!qr || error.value) return
  debugLog('download', ext)
  try {
    await qr.download({ name: 'qr-code', extension: ext })
  } catch (e) {
    console.error('[qr-code-builder] download failed', { ext }, e)
    error.value = 'Download failed. Please try again.'
  }
}
defineExpose({ download })
</script>

<template>
  <div data-testid="qr-preview" class="flex min-h-72 flex-col items-center justify-center gap-3">
    <p v-if="!options" class="text-slate-600">Fill in the form to see your QR code.</p>
    <p v-else-if="error" role="alert" class="max-w-sm text-center text-red-700">{{ error }}</p>
    <div v-show="options && !error" ref="container" class="max-w-full overflow-auto" aria-label="QR code preview" role="img" />
  </div>
</template>
