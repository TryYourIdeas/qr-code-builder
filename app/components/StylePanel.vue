<script setup lang="ts">
import { ref } from 'vue'
import type { StyleState } from '~/utils/qrOptions'

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
