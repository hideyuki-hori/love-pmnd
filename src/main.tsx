import { createRoot } from 'react-dom/client'
import { useRef, useEffect, useState } from 'react'
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { World } from 'miniplex'
import { create } from 'zustand'
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three'
import { shaderMaterial, Text } from '@react-three/drei'
import { Noise as OriginalNoise, Glitch as OriginalGlitch } from '@react-three/postprocessing'
import { GlitchMode } from 'postprocessing'
import { Vector2 } from 'three'
import './styles.css'

const element = document.querySelector('.love-poimandres')!
createRoot(element).render(<App />)

type Agent = {
  position: Vector3
  velocity: Vector3
  acceleration: Vector3
  color: Color
  scale: number
  rotation: Euler
  lifespan: number
  maxLifespan: number
  isImmortal: boolean
}

type AppState = {
  mousePosition: Vector3
  isDragging: boolean
  setMousePosition(position: Vector3): void
  setIsDragging(isDragging: boolean): void
  addAgents(): void
}

const world = new World<Agent>()

export const useAppStore = create<AppState>((set) => ({
  mousePosition: new Vector3(),
  isDragging: false,
  setMousePosition: (position: Vector3) => set({ mousePosition: position }),
  setIsDragging: (isDragging: boolean) => set({ isDragging }),
  addAgents: () => {
    const immortals = world
      .with('isImmortal')
      .where(({ isImmortal }) => isImmortal)
      .entities
    const groupSize = random(600, 1000)

    for (let i = 0; i < immortals.length; i++) {
      const parent = immortals[i]
      const children = Math.floor(Math.random() * (groupSize / immortals.length))
      for (let j = 0; j < children; j++) {
        const offset = new Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        )
        const maxLifespan = random(1, 30)
        world.add({
          position: parent.position.clone().add(offset),
          velocity: new Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
          ),
          acceleration: new Vector3(),
          color: new Color().setHSL(0.98, 1, 0.5),
          scale: Math.random() * 0.2 + 0.1,
          rotation: new Euler(),
          lifespan: maxLifespan,
          maxLifespan,
          isImmortal: false,
        })
      }
    }
  }
}))

function flock(
  agent: Agent, neighbors: Agent[],
  target: Vector3, isDragging: boolean
) {
  const alignment = new Vector3()
  const cohesion = new Vector3()
  const separation = new Vector3()
  const pointer = new Vector3()

  for (let i = 0; i < neighbors.length; i++) {
    const neighbor = neighbors[i]
    alignment.add(neighbor.velocity)
    cohesion.add(neighbor.position)
    const diff = agent.position.clone().sub(neighbor.position)
    separation.add(diff.divideScalar(diff.lengthSq()))
  }

  if (neighbors.length > 0) {
    alignment.divideScalar(neighbors.length).sub(agent.velocity).multiplyScalar(0.05)
    cohesion.divideScalar(neighbors.length).sub(agent.position).multiplyScalar(0.05)
    separation.multiplyScalar(0.05)
  }

  if (isDragging) {
    pointer.copy(target).sub(agent.position).multiplyScalar(0.1)
  }

  agent.acceleration.add(alignment).add(cohesion).add(separation).add(pointer)
  agent.velocity.add(agent.acceleration).clampLength(0, 1)
  agent.position.add(agent.velocity)
  agent.acceleration.multiplyScalar(0)

  if (agent.velocity.length() > 0.01) {
    const lookAt = new Vector3().copy(agent.position).add(agent.velocity)
    const matrix4 = new Matrix4().lookAt(agent.position, lookAt, new Vector3(0, 1, 0))
    agent.rotation.setFromRotationMatrix(matrix4)
  }

  if (agent.position.length() > 15) {
    agent.position.setLength(15)
    agent.velocity.multiplyScalar(-1)
  }

  if (!agent.isImmortal) {
    agent.lifespan -= 1 / 60
    const lifespanRatio = agent.lifespan / agent.maxLifespan
    const hue = 0.98 - (0.88 - 0.55) * (1 - lifespanRatio)
    agent.color.setHSL(hue, 1, 0.2)
  }
}

const GlowingParticleMaterial = shaderMaterial(
  {},
  `
    varying vec3 vColor;
    void main() {
      vColor = instanceColor;
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  `
    varying vec3 vColor;
    void main() {
      gl_FragColor = vec4(vColor, 1.0);
    }
  `
)
extend({ GlowingParticleMaterial })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'glowingParticleMaterial': any
    }
  }
}

function Swarm() {
  const mesh = useRef<InstancedMesh>(null!)
  const materialRef = useRef<ShaderMaterial>(null!)
  const { mousePosition, isDragging, addAgents: addIndividualGroup } = useAppStore()
  const [lastSpawnTime, setLastSpawnTime] = useState(0)
  const [nextSpawnInterval, setNextSpawnInterval] = useState(0)

  useFrame((state) => {
    if (!mesh.current) return

    const aliveIndividuals: Agent[] = []
    for (const individual of world.entities) {
      if (individual.lifespan > 0 || individual.isImmortal) {
        const neighbors = world.entities.filter(other => other !== individual && individual.position.distanceTo(other.position) < 2)
        flock(individual, neighbors, mousePosition, isDragging)
        aliveIndividuals.push(individual)
      }
    }

    for (let i = 0; i < aliveIndividuals.length; i++) {
      const individual = aliveIndividuals[i]
      const matrix = new Matrix4()
      matrix.compose(individual.position, new Quaternion().setFromEuler(individual.rotation), new Vector3(individual.scale, individual.scale, individual.scale))
      mesh.current.setMatrixAt(i, matrix)
      mesh.current.setColorAt(i, individual.color)
    }

    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) {
      mesh.current.instanceColor.needsUpdate = true
    }

    mesh.current.count = aliveIndividuals.length

    world.clear()
    for (const individual of aliveIndividuals) {
      world.add(individual)
    }

    if (isDragging && state.clock.getElapsedTime() - lastSpawnTime > nextSpawnInterval) {
      addIndividualGroup()
      setLastSpawnTime(state.clock.getElapsedTime())
      const intervalSeconds = random(1, 3)
      setNextSpawnInterval(intervalSeconds)
    }
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, world.entities.length]}>
      <boxGeometry />
      <glowingParticleMaterial ref={materialRef} transparent depthWrite />
    </instancedMesh>
  )
}

export function InteractionTracker() {
  const { camera, gl } = useThree()
  const { setMousePosition, setIsDragging } = useAppStore()

  const updatePosition = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    const vector = new Vector3(x, y, 0.5)
    vector.unproject(camera)
    const dir = vector.sub(camera.position).normalize()
    const distance = -camera.position.z / dir.z
    const pos = camera.position.clone().add(dir.multiplyScalar(distance))
    setMousePosition(pos)
  }

  useEffect(() => {
    const down = () => setIsDragging(true)
    const up = () => setIsDragging(false)
    const moveByMouse = (event: MouseEvent) => updatePosition(event.clientX, event.clientY)
    const moveByTouch = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      updatePosition(touch.clientX, touch.clientY)
    }

    document.body.addEventListener('mousedown', down)
    document.body.addEventListener('touchstart', down)
    document.body.addEventListener('mouseup', up)
    document.body.addEventListener('touchup', up)
    document.body.addEventListener('touchcancel', up)
    document.body.addEventListener('mousemove', moveByMouse)
    document.body.addEventListener('touchmove', moveByTouch)

    return () => {
      document.body.removeEventListener('mousedown', down)
      document.body.removeEventListener('touchstart', down)
      document.body.removeEventListener('mouseup', up)
      document.body.removeEventListener('touchup', up)
      document.body.removeEventListener('touchcancel', up)
      document.body.removeEventListener('mousemove', moveByMouse)
      document.body.removeEventListener('touchmove', moveByTouch)
    }
  }, [gl, camera, setIsDragging, setMousePosition])

  return null
}

export function App() {
  const { isDragging } = useAppStore()
  useEffect(() => {
    for (let i = 0; i < 50; i++) {
      world.add({
        position: new Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20),
        velocity: new Vector3(
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.1
        ),
        acceleration: new Vector3(),
        color: new Color(0xfff8e0),
        scale: Math.random() * 0.2 + 0.1,
        rotation: new Euler(),
        lifespan: Infinity,
        maxLifespan: Infinity,
        isImmortal: true
      })
    }
  }, [])

  return (
    <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
      <color attach='background' args={['#5e595d']} />
      <Swarm />
      <InteractionTracker />
      <Text
        position={[0, 0, 0]}
        fontSize={0.8}
        color={0xfff8e0}
        anchorX='center'
        anchorY='middle'
        fillOpacity={isDragging ? 0.03 : 0.8}
      >
        Poimandres
      </Text>
      <EffectComposer>
        <Glitch />
        <Bloom
          intensity={0.5}
          luminanceThreshold={0}
          luminanceSmoothing={0.3}
          height={300}
        />
        <Noise />
        <Vignette
          eskil={false}
          offset={0.23}
          darkness={0.73}
        />
      </EffectComposer>
    </Canvas>
  )
}

function random(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function Glitch() {
  const [active, setActive] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const { isDragging } = useAppStore()

  useFrame(({ clock }) => {
    if (isDragging) {
      setElapsedTime(prevTime => {
        const newTime = prevTime + (clock.getDelta() * 80)
        return newTime
      })
      if (elapsedTime >= 2 && !active) {
        setActive(true)
      }
    } else {
      setActive(false)
      setElapsedTime(0)
    }
  })

  return (
    <OriginalGlitch
      delay={new Vector2(0, 0)}
      duration={(new Vector2(0.3, 0.8), new Vector2())}
      strength={(new Vector2(0.8, 0.0), new Vector2())}
      mode={GlitchMode.CONSTANT_MILD}
      active={active}
      ratio={0.45}
    />
  )
}

export function Noise() {
  const { isDragging } = useAppStore()
  const [opacity, setOpacity] = useState(0.08)

  useFrame(() => {
    const nextOpacity = isDragging
      ? Math.min(opacity + 0.001, 0.45)
      : Math.max(opacity - 0.03, 0.08)
    setOpacity(nextOpacity)
  })

  return <OriginalNoise opacity={opacity} />
}