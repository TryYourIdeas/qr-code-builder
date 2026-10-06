<script setup lang="ts">
defineProps<{ disabled: boolean }>()
const emit = defineEmits<{ download: [ext: 'png' | 'svg'] }>()
const btn =
  'rounded-md px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <div class="flex gap-3">
    <button type="button" :disabled="disabled" :class="[btn, 'bg-indigo-600 text-white hover:bg-indigo-700']" @click="emit('download', 'png')">
      Download PNG
    </button>
    <button type="button" :disabled="disabled" :class="[btn, 'bg-slate-200 text-slate-900 hover:bg-slate-300']" @click="emit('download', 'svg')">
      Download SVG
    </button>
  </div>
</template>
