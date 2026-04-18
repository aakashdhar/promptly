export default function useWindowResize() {
  function resizeWindow(height) {
    requestAnimationFrame(() => {
      if (window.electronAPI) window.electronAPI.resizeWindow(height)
    })
  }
  return { resizeWindow }
}
