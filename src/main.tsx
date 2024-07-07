import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '~/app'
import '~/app/styles.css'

const element = document.querySelector('.love-pmnd')!
const root = createRoot(element)

root.render(
  <StrictMode>
    <App />
  </StrictMode>
)
