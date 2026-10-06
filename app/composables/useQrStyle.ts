import { computed, reactive } from 'vue'
import { contrastWarning } from '~/utils/contrast'
import { defaultStyle, type StyleState } from '~/utils/qrOptions'

export function useQrStyle() {
  const style = reactive<StyleState>(defaultStyle())
  const warning = computed(() => contrastWarning(style.fg, style.bg))
  return { style, warning }
}
