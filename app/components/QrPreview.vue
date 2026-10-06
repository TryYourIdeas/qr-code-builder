<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { QrCapacityError, buildMatrix } from '~/utils/qr/matrix'
import { renderSvg } from '~/utils/qr/renderSvg'
import { svgToPng } from '~/utils/qr/rasterize'
import { scansBack } from '~/utils/qr/scanCheck'
import { debugLog } from '~/utils/log'
import type { StyleState } from '~/utils/qrOptions'

const props = defineProps<{ text: string | null; qrStyle: StyleState }>()
const emit = defineEmits<{ error: [message: string | null]; scan: [ok: boolean | null] }>()

const svg = ref<string | null>(null)
const error = ref<string | null>(null)
let scanTimer: ReturnType<typeof setTimeout> | undefined
let scanRun = 0

const TOO_LONG = 'This content is too long to fit in a QR code. Shorten it or lower the error-correction level.'
// With a logo the error-correction level is locked to High, so that control cannot help.
const TOO_LONG_WITH_LOGO = 'This content is too long to fit in a QR code with a logo. Remove the logo or shorten the content.'

const previewSrc = computed(() =>
  svg.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.value)}` : null,
)

function scheduleScanCheck(markup: string, text: string) {
  const run = scanRun
  scanTimer = setTimeout(async () => {
    try {
      const ok = await scansBack(markup, text)
      debugLog('scan check', { ok })
      if (run === scanRun) emit('scan', ok)
    } catch (e) {
      console.error('[qr-code-builder] scan check failed', { length: text.length }, e)
      if (run === scanRun) emit('scan', null)
    }
  }, 300)
}

function update() {
  clearTimeout(scanTimer)
  scanRun++
  svg.value = null
  error.value = null
  emit('scan', null)
  if (props.text === null) {
    emit('error', null)
    return
  }
  try {
    const level = props.qrStyle.logo ? 'H' : props.qrStyle.errorLevel
    svg.value = renderSvg(buildMatrix(props.text, level), props.qrStyle)
    debugLog('qr rendered', { length: props.text.length, level })
  } catch (e) {
    console.error('[qr-code-builder] render failed', { length: props.text.length }, e)
    error.value =
      e instanceof QrCapacityError
        ? props.qrStyle.logo ? TOO_LONG_WITH_LOGO : TOO_LONG
        : 'Could not render the QR code.'
  }
  emit('error', error.value)
  if (svg.value) scheduleScanCheck(svg.value, props.text)
}

watch(() => [props.text, props.qrStyle], update, { deep: true, immediate: true })
onBeforeUnmount(() => clearTimeout(scanTimer))

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function download(ext: 'png' | 'svg') {
  if (!svg.value || error.value) return
  debugLog('download', ext)
  try {
    const blob = ext === 'svg' ? new Blob([svg.value], { type: 'image/svg+xml' }) : await svgToPng(svg.value, props.qrStyle.size)
    saveBlob(blob, `qr-code.${ext}`)
  } catch (e) {
    console.error('[qr-code-builder] download failed', { ext }, e)
    error.value = 'Download failed. Please try again.'
  }
}
defineExpose({ download })
</script>

<template>
  <div data-testid="qr-preview" class="flex min-h-72 flex-col items-center justify-center gap-3">
    <p v-if="text === null" class="text-slate-600">Fill in the form to see your QR code.</p>
    <p v-else-if="error" role="alert" class="max-w-sm text-center text-red-700">{{ error }}</p>
    <img
      v-else-if="previewSrc"
      :src="previewSrc"
      alt="QR code preview"
      :width="qrStyle.size"
      :height="qrStyle.size"
      class="h-auto max-w-full"
    />
  </div>
</template>
