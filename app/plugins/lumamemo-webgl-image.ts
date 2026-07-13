import { WebGLImageViewer } from '@lumamemo/webgl-image'
import '@lumamemo/webgl-image/style'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('WebGLImageViewer', WebGLImageViewer)
})
