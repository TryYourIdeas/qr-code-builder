<script setup lang="ts">
import { ref } from 'vue'
import type { StyleState } from '~/utils/qrOptions'
import { loadSvgUpload } from '~/utils/qr/upload'
import type { SanitizedSvg } from '~/utils/qr/sanitizeSvg'
import type { DotShape, EyeShape } from '~/utils/qr/shapes'

defineProps<{ warning: string | null }>()
const style = defineModel<StyleState>({ required: true })
const logoError = ref<string | null>(null)

const MAX_LOGO_BYTES = 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml']

function onLogo(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!LOGO_TYPES.includes(file.type)) {
    logoError.value = 'Logo must be a PNG, JPG or SVG image.'
    return
  }
  if (file.size > MAX_LOGO_BYTES) {
    logoError.value = 'Logo must be 1 MB or smaller.'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    style.value.logo = String(reader.result)
    logoError.value = null
  }
  reader.onerror = () => {
    console.error('[qr-code-builder] logo read failed', { name: file.name, size: file.size, type: file.type }, reader.error)
    logoError.value = 'Could not read the logo file.'
  }
  reader.readAsDataURL(file)
}

function removeLogo() {
  style.value.logo = null
  logoError.value = null
}

const dotError = ref<string | null>(null)
const eyeError = ref<string | null>(null)
let prevDot: DotShape = 'square'
let prevEye: EyeShape = 'square'

async function onSvg(kind: 'dot' | 'eye', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const result = await loadSvgUpload(file, kind === 'dot' ? 'dot-' : 'eye-')
  input.value = ''
  const setError = (message: string | null) => {
    if (kind === 'dot') dotError.value = message
    else eyeError.value = message
  }
  if (!result.ok) {
    setError(result.error)
    return
  }
  setError(null)
  if (kind === 'dot') {
    if (style.value.dotShape !== 'custom') prevDot = style.value.dotShape
    style.value.customDot = result.svg
    style.value.dotShape = 'custom'
  } else {
    if (style.value.eyeShape !== 'custom') prevEye = style.value.eyeShape
    style.value.customEye = result.svg
    style.value.eyeShape = 'custom'
  }
}

function removeSvg(kind: 'dot' | 'eye') {
  if (kind === 'dot') {
    style.value.customDot = null
    style.value.dotShape = prevDot
    dotError.value = null
  } else {
    style.value.customEye = null
    style.value.eyeShape = prevEye
    eyeError.value = null
  }
}

const thumb = (svg: SanitizedSvg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${svg.viewBox}">${svg.inner}</svg>`,
  )}`

const field = 'mt-1 block w-full rounded-md border border-slate-400 px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60'
const labelCls = 'block text-sm font-medium text-slate-800'
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="style-fg" :class="labelCls">Foreground color</label>
        <input id="style-fg" v-model="style.fg" type="color" class="mt-1 h-10 w-full rounded-md border border-slate-400" />
      </div>
      <div>
        <label for="style-bg" :class="labelCls">Background color</label>
        <input id="style-bg" v-model="style.bg" type="color" class="mt-1 h-10 w-full rounded-md border border-slate-400" />
      </div>
    </div>
    <p v-if="warning" role="status" class="rounded-md bg-amber-50 p-2 text-sm text-amber-900">{{ warning }}</p>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="style-dots" :class="labelCls">Dot shape</label>
        <select id="style-dots" v-model="style.dotShape" :class="field">
          <option value="square">Square</option>
          <option value="dots">Dots</option>
          <option value="rounded">Rounded</option>
          <option v-if="style.customDot" value="custom">Custom SVG</option>
        </select>
      </div>
      <div>
        <label for="style-eyes" :class="labelCls">Eye shape</label>
        <select id="style-eyes" v-model="style.eyeShape" :class="field">
          <option value="square">Square</option>
          <option value="rounded">Rounded</option>
          <option value="dot">Dot</option>
          <option v-if="style.customEye" value="custom">Custom SVG</option>
        </select>
      </div>
    </div>

    <div class="space-y-4">
      <div>
        <label for="style-custom-dot" :class="labelCls">Custom dot (SVG)</label>
        <input id="style-custom-dot" type="file" accept="image/svg+xml,.svg" :class="field" @change="onSvg('dot', $event)" />
        <div v-if="style.customDot" class="mt-2 flex items-center gap-3">
          <img :src="thumb(style.customDot)" alt="Custom dot preview" class="h-10 w-10 rounded border border-slate-300 bg-white" />
          <button type="button" class="text-sm text-indigo-700 underline" @click="removeSvg('dot')">Remove custom dot</button>
        </div>
        <p v-if="dotError" role="alert" class="mt-1 text-sm text-red-700">{{ dotError }}</p>
      </div>
      <div>
        <label for="style-custom-eye" :class="labelCls">Custom eye (SVG)</label>
        <input id="style-custom-eye" type="file" accept="image/svg+xml,.svg" :class="field" aria-describedby="style-eye-hint" @change="onSvg('eye', $event)" />
        <p id="style-eye-hint" class="mt-1 text-xs text-slate-600">
          One SVG for the whole 7x7 eye. It is placed at three corners, rotated 0°, -90° and +90°. Your SVG keeps its own colors.
        </p>
        <div v-if="style.customEye" class="mt-2 flex items-center gap-3">
          <img :src="thumb(style.customEye)" alt="Custom eye preview" class="h-10 w-10 rounded border border-slate-300 bg-white" />
          <button type="button" class="text-sm text-indigo-700 underline" @click="removeSvg('eye')">Remove custom eye</button>
        </div>
        <p v-if="eyeError" role="alert" class="mt-1 text-sm text-red-700">{{ eyeError }}</p>
      </div>
    </div>

    <div>
      <label for="style-size" :class="labelCls">Size (px): {{ style.size }}</label>
      <input id="style-size" v-model.number="style.size" type="range" min="200" max="1000" step="50" class="mt-1 w-full" />
    </div>

    <div>
      <label for="style-ec" :class="labelCls">Error correction</label>
      <select id="style-ec" v-model="style.errorLevel" :disabled="Boolean(style.logo)" :class="field" aria-describedby="style-ec-hint">
        <option value="L">Low (7%)</option>
        <option value="M">Medium (15%)</option>
        <option value="Q">Quartile (25%)</option>
        <option value="H">High (30%)</option>
      </select>
      <p id="style-ec-hint" class="mt-1 text-xs text-slate-600">
        {{ style.logo ? 'High is used automatically when a logo is present.' : 'Higher levels survive more damage but need a denser code.' }}
      </p>
    </div>

    <div>
      <label for="style-logo" :class="labelCls">Logo</label>
      <input id="style-logo" type="file" accept="image/png,image/jpeg,image/svg+xml" :class="field" @change="onLogo" />
      <button v-if="style.logo" type="button" class="mt-2 text-sm text-indigo-700 underline" @click="removeLogo">Remove logo</button>
      <p v-if="logoError" role="alert" class="mt-1 text-sm text-red-700">{{ logoError }}</p>
    </div>
  </div>
</template>
