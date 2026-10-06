<script setup lang="ts">
import { computed, reactive } from 'vue'
import { FIELD_DEFS, type FieldDef, type FieldValues } from '~/utils/fields'
import type { ContentType } from '~/utils/payload'

const props = defineProps<{ type: ContentType; errors: Record<string, string> }>()
const model = defineModel<FieldValues>({ required: true })
const touched = reactive<Record<string, boolean>>({})

const fields = computed(() =>
  FIELD_DEFS[props.type].filter((f) => !f.hiddenWhen || model.value[f.hiddenWhen.key] !== f.hiddenWhen.equals),
)
const id = (f: FieldDef) => `field-${props.type}-${f.key}`
const error = (f: FieldDef) => (touched[f.key] ? props.errors[f.key] : undefined)
const set = (key: string, value: string | boolean) => {
  model.value = { ...model.value, [key]: value }
}
const inputType = (f: FieldDef) => (f.kind === 'url' || f.kind === 'text' ? 'text' : f.kind)
const inputMode = (f: FieldDef) => (f.kind === 'url' ? 'url' : undefined)
const base =
  'mt-1 block w-full rounded-md border border-slate-400 px-3 py-2 text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600 aria-[invalid=true]:border-red-700'
</script>

<template>
  <div class="space-y-4">
    <div v-for="f in fields" :key="f.key">
      <label v-if="f.kind === 'checkbox'" class="flex items-center gap-2 text-sm">
        <input
          :id="id(f)"
          type="checkbox"
          :checked="Boolean(model[f.key])"
          @change="set(f.key, ($event.target as HTMLInputElement).checked)"
        />
        {{ f.label }}
      </label>
      <template v-else>
        <label :for="id(f)" class="block text-sm font-medium text-slate-800">
          {{ f.label }}<span v-if="f.required" aria-hidden="true"> *</span>
        </label>
        <select
          v-if="f.kind === 'select'"
          :id="id(f)"
          :class="base"
          :value="model[f.key] as string"
          @change="set(f.key, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <textarea
          v-else-if="f.kind === 'textarea'"
          :id="id(f)"
          rows="3"
          :class="base"
          :value="model[f.key] as string"
          :aria-required="f.required || undefined"
          :aria-invalid="error(f) ? 'true' : undefined"
          :aria-describedby="`${id(f)}-error`"
          @input="set(f.key, ($event.target as HTMLTextAreaElement).value)"
          @blur="touched[f.key] = true"
        />
        <input
          v-else
          :id="id(f)"
          :type="inputType(f)"
          :inputmode="inputMode(f)"
          :placeholder="f.placeholder"
          :class="base"
          :value="model[f.key] as string"
          :aria-required="f.required || undefined"
          :aria-invalid="error(f) ? 'true' : undefined"
          :aria-describedby="`${id(f)}-error`"
          @input="set(f.key, ($event.target as HTMLInputElement).value)"
          @blur="touched[f.key] = true"
        />
        <p :id="`${id(f)}-error`" aria-live="polite" class="mt-1 min-h-5 text-sm text-red-700">{{ error(f) }}</p>
      </template>
    </div>
  </div>
</template>
