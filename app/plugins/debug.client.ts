import { setDebug } from '~/utils/log'

export default defineNuxtPlugin(() => {
  setDebug(Boolean(useRuntimeConfig().public.addDebugLogs))
})
