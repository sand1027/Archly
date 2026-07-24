/**
 * Module-level singleton for the Excalidraw API instance.
 *
 * ExcalidrawWrapper sets this when the API is ready.
 * CanvasPage reads it for drag-drop and other imperative operations.
 *
 * This avoids prop drilling and React state, which would cause re-renders.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _api: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setExcalidrawAPI(api: any) {
  _api = api;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getExcalidrawAPI(): any {
  return _api;
}
