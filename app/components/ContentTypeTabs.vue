<script setup lang="ts">
import { nextTick } from 'vue'
import { TYPES } from '~/utils/fields'
import type { ContentType } from '~/utils/payload'

const model = defineModel<ContentType>({ required: true })

function onKeydown(e: KeyboardEvent) {
  const i = TYPES.findIndex((t) => t.value === model.value)
  const n = TYPES.length
  let next = i
  if (e.key === 'ArrowRight') next = (i + 1) % n
  else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = n - 1
  else return
  e.preventDefault()
  model.value = TYPES[next]!.value
  nextTick(() => document.getElementById(`tab-${model.value}`)?.focus())
}
</script>

<template>
  <div role="tablist" aria-label="Content type" class="flex flex-wrap gap-1" @keydown="onKeydown">
    <button
      v-for="t in TYPES"
      :id="`tab-${t.value}`"
      :key="t.value"
      type="button"
      role="tab"
      :aria-selected="model === t.value"
      aria-controls="panel"
      :tabindex="model === t.value ? 0 : -1"
      class="rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      :class="model === t.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'"
      @click="model = t.value"
    >
      {{ t.label }}
    </button>
  </div>
</template>
