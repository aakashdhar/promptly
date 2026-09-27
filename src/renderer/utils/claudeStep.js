// One call to main for something the user is waiting on (a builder step, a prompt, a revision).
// It claims the current operation (opIdRef), so Cancel, Escape or a newer request makes its
// answer stale; a stale or cancelled answer comes back as null and the caller just returns.
// A call that throws (a main handler error) or returns nothing comes back as
// { success: false, error }, so no screen is left waiting on a spinner.
// Pass opIdRef = null for background work that must not replace the current operation.
export async function runStep(opIdRef, call) {
  const opId = opIdRef ? ++opIdRef.current : null
  let result
  try {
    result = await call()
  } catch (err) {
    window.electronAPI?.log?.('error', `Call to main failed: ${err?.message || err}`)
    result = { success: false, error: 'Something went wrong — try again', errorType: 'unknown' }
  }
  if (opIdRef && opId !== opIdRef.current) return null
  if (!result || typeof result !== 'object') return { success: false, error: 'No answer came back — try again', errorType: 'unknown' }
  if (result.cancelled) return null
  return result
}
