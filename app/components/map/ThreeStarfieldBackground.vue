<script setup lang="ts">
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three'

const hostRef = ref<HTMLElement | null>(null)

const isMobileViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 768px)').matches

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const getStarfieldConfig = () => {
  const mobile = isMobileViewport()
  const reducedMotion = prefersReducedMotion()

  return {
    starCount: mobile ? 700 : 1500,
    dustCount: mobile ? 130 : 320,
    maxPixelRatio: mobile ? 1.2 : 1.75,
    rotationSpeed: reducedMotion ? 0 : mobile ? 0.000045 : 0.000075,
    parallaxStrength: reducedMotion ? 0 : mobile ? 0.008 : 0.018,
  }
}

const createStarGeometry = (count: number, radius: number) => {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const white = new Color('#f8fbff')
  const blue = new Color('#9cc8ff')
  const amber = new Color('#ffe4b5')

  for (let index = 0; index < count; index += 1) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    const distance = radius * (0.68 + Math.random() * 0.32)
    const positionIndex = index * 3

    positions[positionIndex] = Math.sin(phi) * Math.cos(theta) * distance
    positions[positionIndex + 1] = Math.sin(phi) * Math.sin(theta) * distance
    positions[positionIndex + 2] = Math.cos(phi) * distance

    const color = Math.random() > 0.88 ? amber : Math.random() > 0.42 ? blue : white
    const intensity = 0.62 + Math.random() * 0.38
    colors[positionIndex] = color.r * intensity
    colors[positionIndex + 1] = color.g * intensity
    colors[positionIndex + 2] = color.b * intensity
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let stars: Points | null = null
let dust: Points | null = null
let frameId: number | null = null
let resizeObserver: ResizeObserver | null = null

const pointerTarget = {
  x: 0,
  y: 0,
}

const pointerCurrent = {
  x: 0,
  y: 0,
}

const resizeRenderer = () => {
  if (!hostRef.value || !renderer || !camera) {
    return
  }

  const { width, height } = hostRef.value.getBoundingClientRect()
  if (width <= 0 || height <= 0) {
    return
  }

  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}

const renderFrame = (time: number) => {
  if (!renderer || !scene || !camera || !stars || !dust) {
    return
  }

  const config = getStarfieldConfig()
  pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.035
  pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.035

  stars.rotation.y = time * config.rotationSpeed
  stars.rotation.x = pointerCurrent.y * config.parallaxStrength
  dust.rotation.y = -time * config.rotationSpeed * 0.55
  dust.rotation.x = pointerCurrent.x * config.parallaxStrength
  camera.position.x = pointerCurrent.x * config.parallaxStrength * 2
  camera.position.y = pointerCurrent.y * config.parallaxStrength * 2
  camera.lookAt(0, 0, 0)

  renderer.render(scene, camera)

  if (config.rotationSpeed > 0 || config.parallaxStrength > 0) {
    frameId = requestAnimationFrame(renderFrame)
  }
}

const onPointerMove = (event: PointerEvent) => {
  pointerTarget.x = event.clientX / window.innerWidth - 0.5
  pointerTarget.y = 0.5 - event.clientY / window.innerHeight
}

const disposePointCloud = (cloud: Points | null) => {
  if (!cloud) {
    return
  }
  cloud.geometry.dispose()
  const material = cloud.material
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose())
  } else {
    material.dispose()
  }
}

const cleanup = () => {
  if (frameId !== null) {
    cancelAnimationFrame(frameId)
    frameId = null
  }

  window.removeEventListener('pointermove', onPointerMove)
  resizeObserver?.disconnect()
  resizeObserver = null

  disposePointCloud(stars)
  disposePointCloud(dust)
  stars = null
  dust = null
  scene = null
  camera = null

  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
    renderer = null
  }
}

onMounted(() => {
  if (!hostRef.value) {
    return
  }

  const config = getStarfieldConfig()

  renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, config.maxPixelRatio))
  renderer.domElement.className = 'h-full w-full'
  renderer.domElement.setAttribute('aria-hidden', 'true')
  hostRef.value.appendChild(renderer.domElement)

  scene = new Scene()
  camera = new PerspectiveCamera(58, 1, 0.1, 80)
  camera.position.z = 8

  stars = new Points(
    createStarGeometry(config.starCount, 18),
    new PointsMaterial({
      size: isMobileViewport() ? 0.026 : 0.022,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      depthWrite: false,
    }),
  )

  dust = new Points(
    createStarGeometry(config.dustCount, 9),
    new PointsMaterial({
      size: isMobileViewport() ? 0.055 : 0.048,
      transparent: true,
      opacity: 0.22,
      vertexColors: true,
      depthWrite: false,
    }),
  )

  scene.add(stars, dust)
  resizeRenderer()
  resizeObserver = new ResizeObserver(resizeRenderer)
  resizeObserver.observe(hostRef.value)
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  if (prefersReducedMotion()) {
    renderer.render(scene, camera)
  } else {
    frameId = requestAnimationFrame(renderFrame)
  }
})

onBeforeUnmount(cleanup)
</script>

<template>
  <div
    ref="hostRef"
    class="three-starfield absolute inset-0 overflow-hidden"
    aria-hidden="true"
  />
</template>

<style scoped>
.three-starfield {
  background:
    radial-gradient(circle at 50% 58%, rgba(56, 189, 248, 0.16), transparent 18%),
    radial-gradient(circle at 18% 24%, rgba(125, 211, 252, 0.14), transparent 24%),
    radial-gradient(circle at 82% 18%, rgba(148, 163, 184, 0.1), transparent 22%),
    linear-gradient(180deg, #01030a 0%, #030712 46%, #07111f 100%);
  pointer-events: none;
}

.three-starfield::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 50%, transparent 0 34%, rgba(1, 3, 10, 0.28) 68%, rgba(1, 3, 10, 0.82) 100%),
    linear-gradient(90deg, rgba(15, 23, 42, 0.38), transparent 22% 78%, rgba(15, 23, 42, 0.38));
  pointer-events: none;
}
</style>
