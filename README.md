# ♥ Poimandres

![Screenshot of Poimandres](/public/ss.jpg)

[DEMO](https://love-poimandres.every.fail/)

## Overview

Poimandres is an interactive 3D particle system visualization using React Three Fiber. It features a swarm of glowing particles that respond to user interaction.

## Key Features

- Dynamic particle spawning and flocking behavior
- Particle movement responsive to user interaction
- Post-processing effects including bloom, glitch, and noise

## Tech Stack

- React
- Three.js
- React Three Fiber
- @react-three/drei
- @react-three/postprocessing
- Zustand

## Setup

1. Clone the repository:

```sh
git clone https://github.com/hideyuki-hori/love-poimandres.git
```

2. Navigate to the project directory:

```sh
cd love-poimandres
```

3. Install dependencies:

```sh
bun i
```

4. Start the development server:

```sh
bun run dev
```

5. Open `http://localhost:5173` in your browser to view the application.

## Usage

- Drag your mouse to control the movement of particles.
- New particles are generated while dragging.
- The opacity of the central "Poimandres" text changes based on interaction.

## License

[MIT License](/LICENSE.md)

## Acknowledgements

This project was inspired by the [Poimandres](https://github.com/pmndrs) community.