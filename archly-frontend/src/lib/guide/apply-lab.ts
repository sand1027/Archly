/**
 * Places a Guide lab graph onto Flow or Excalidraw canvas.
 */

import { getComponent } from "@/lib/components-registry";
import { getExcalidrawAPI } from "@/lib/excalidraw-api";
import { useCanvasStore } from "@/store/canvas.store";
import { useFlowStore } from "@/store/flow.store";
import { useSimulationStore } from "@/store/simulation.store";
import type { ExcalidrawElement } from "@/types";
import type { LabDefinition } from "@/lib/guide/content";

export type GuideCanvasTarget = "excalidraw" | "flow";

const GAP_X = 200;
const START_X = 80;
const START_Y = 160;

function clearActive(target: GuideCanvasTarget) {
  useSimulationStore.getState().clearAllChaos();
  useSimulationStore.getState().stop();
  useSimulationStore.getState().setMetrics({});
  useSimulationStore.getState().updatePackets([]);
  useSimulationStore.getState().setBottlenecks([]);

  if (target === "flow") {
    useFlowStore.getState().reset();
    return;
  }

  const api = getExcalidrawAPI();
  api?.updateScene?.({ elements: [] });
  api?.history?.clear?.();
  useCanvasStore.getState().setElements([]);
  useCanvasStore.getState().setSelectedElementIds([]);
  const configs = useCanvasStore.getState().nodeConfigs;
  for (const id of Object.keys(configs)) {
    useCanvasStore.getState().removeNodeConfig(id);
  }
}

function applyLabToFlow(lab: LabDefinition): string[] {
  const flow = useFlowStore.getState();
  const ids: string[] = [];

  lab.nodes.forEach((componentId, i) => {
    const comp = getComponent(componentId);
    if (!comp) return;
    const id = flow.addNode(
      comp.id,
      comp.name,
      comp.color,
      comp.strokeColor,
      comp.icon,
      { x: START_X + i * GAP_X, y: START_Y }
    );
    ids.push(id);
  });

  const { onConnect } = useFlowStore.getState();
  for (const [from, to] of lab.edges) {
    if (!ids[from] || !ids[to]) continue;
    onConnect({ source: ids[from], target: ids[to] });
  }

  // Architecture Notes node — explains why this design exists
  const roles = lab.nodeRoles.map((r) => {
    const comp = getComponent(r.componentId);
    return {
      name: comp?.name ?? r.componentId,
      role: r.role,
      why: r.whyHere,
    };
  });
  const noteId = `guide-note-${Date.now()}`;
  useFlowStore.setState((s) => ({
    nodes: [
      ...s.nodes,
      {
        id: noteId,
        type: "guideNote",
        position: { x: START_X, y: START_Y + 220 },
        data: {
          title: `Architecture — ${lab.title}`,
          body: lab.architectureNote,
          roles,
        },
        draggable: true,
        selectable: true,
      },
    ],
  }));

  if (ids[0]) useFlowStore.getState().setSelectedNodeId(ids[0]);
  return [...ids, noteId];
}

function makeRect(
  compId: string,
  label: string,
  color: string,
  stroke: string,
  x: number,
  y: number,
  w: number,
  h: number
): { rect: ExcalidrawElement; text: ExcalidrawElement; id: string } {
  const id = crypto.randomUUID();
  const rect: ExcalidrawElement = {
    id,
    type: "rectangle",
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: color,
    fillStyle: "solid",
    strokeWidth: 1.5,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [id],
    roundness: { type: 3 },
    isDeleted: false,
    version: 1,
    versionNonce: Math.floor(Math.random() * 1e9),
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { componentId: compId, label },
    seed: Math.floor(Math.random() * 1e9),
    index: null,
    frameId: null,
    boundElements: null,
  };
  const text: ExcalidrawElement = {
    id: crypto.randomUUID(),
    type: "text",
    x: x + w / 2 - 50,
    y: y + h / 2 - 10,
    width: 100,
    height: 20,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [id],
    roundness: null,
    isDeleted: false,
    version: 1,
    versionNonce: Math.floor(Math.random() * 1e9),
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { isLabel: true, parentId: id },
    seed: Math.floor(Math.random() * 1e9),
    index: null,
    frameId: null,
    boundElements: null,
    text: label,
    fontSize: 13,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: null,
    originalText: label,
    autoResize: true,
    lineHeight: 1.25,
  };
  return { rect, text, id };
}

function makeArrow(
  fromId: string,
  toId: string,
  fromX: number,
  fromY: number,
  fromW: number,
  fromH: number,
  toX: number,
  toY: number,
  toH: number
): ExcalidrawElement {
  const startX = fromX + fromW;
  const startY = fromY + fromH / 2;
  const endX = toX;
  const endY = toY + toH / 2;
  return {
    id: crypto.randomUUID(),
    type: "arrow",
    x: startX,
    y: startY,
    width: endX - startX,
    height: endY - startY,
    angle: 0,
    strokeColor: "#64748b",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [],
    roundness: { type: 2 },
    isDeleted: false,
    version: 1,
    versionNonce: Math.floor(Math.random() * 1e9),
    updated: Date.now(),
    link: null,
    locked: false,
    seed: Math.floor(Math.random() * 1e9),
    index: null,
    frameId: null,
    boundElements: null,
    points: [
      [0, 0],
      [endX - startX, endY - startY],
    ],
    startBinding: { elementId: fromId, focus: 0, gap: 4 },
    endBinding: { elementId: toId, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow",
  };
}

function applyLabToExcalidraw(lab: LabDefinition): string[] {
  const placed: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const els: any[] = [];

  lab.nodes.forEach((componentId, i) => {
    const comp = getComponent(componentId);
    if (!comp) return;
    const x = START_X + i * (comp.defaultWidth + 60);
    const y = START_Y;
    const { rect, text, id } = makeRect(
      comp.id,
      comp.name,
      comp.color,
      comp.strokeColor,
      x,
      y,
      comp.defaultWidth,
      comp.defaultHeight
    );
    els.push(rect, text);
    placed.push({ id, x, y, w: comp.defaultWidth, h: comp.defaultHeight });
  });

  for (const [from, to] of lab.edges) {
    const a = placed[from];
    const b = placed[to];
    if (!a || !b) continue;
    els.push(
      makeArrow(a.id, b.id, a.x, a.y, a.w, a.h, b.x, b.y, b.h)
    );
  }

  // Architecture notes as a sticky text card under the graph
  const noteText = lab.architectureNote;
  const noteW = 420;
  const noteH = 160;
  const noteX = START_X;
  const noteY = START_Y + 140;
  const noteId = crypto.randomUUID();
  els.push({
    id: noteId,
    type: "rectangle",
    x: noteX,
    y: noteY,
    width: noteW,
    height: noteH,
    angle: 0,
    strokeColor: "#ca8a04",
    backgroundColor: "#fef9c3",
    fillStyle: "solid",
    strokeWidth: 1.5,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [noteId],
    roundness: { type: 3 },
    isDeleted: false,
    version: 1,
    versionNonce: Math.floor(Math.random() * 1e9),
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { componentId: "guide_note", label: "Architecture Notes" },
    seed: Math.floor(Math.random() * 1e9),
    index: null,
    frameId: null,
    boundElements: null,
  });
  els.push({
    id: crypto.randomUUID(),
    type: "text",
    x: noteX + 12,
    y: noteY + 10,
    width: noteW - 24,
    height: noteH - 20,
    angle: 0,
    strokeColor: "#713f12",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    groupIds: [noteId],
    roundness: null,
    isDeleted: false,
    version: 1,
    versionNonce: Math.floor(Math.random() * 1e9),
    updated: Date.now(),
    link: null,
    locked: false,
    customData: { isLabel: true, parentId: noteId },
    seed: Math.floor(Math.random() * 1e9),
    index: null,
    frameId: null,
    boundElements: null,
    text: noteText,
    fontSize: 12,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    originalText: noteText,
    autoResize: false,
    lineHeight: 1.3,
  });

  const api = getExcalidrawAPI();
  if (api) {
    api.updateScene({ elements: els });
    setTimeout(() => api.scrollToContent?.(), 50);
  } else {
    useCanvasStore.getState().setElements(els as ExcalidrawElement[]);
  }

  if (placed[0]) {
    useCanvasStore.getState().setSelectedElementIds([placed[0].id]);
  }
  return placed.map((p) => p.id);
}

/** Clear active canvas and place the lab graph. Returns placed node ids. */
export function applyGuideLab(
  lab: LabDefinition,
  target: GuideCanvasTarget
): string[] {
  clearActive(target);
  if (target === "flow") return applyLabToFlow(lab);
  return applyLabToExcalidraw(lab);
}

/** Focus / select a component id already on the active canvas, if present. */
export function focusComponentOnCanvas(
  componentId: string,
  target: GuideCanvasTarget
): boolean {
  if (target === "flow") {
    const node = useFlowStore
      .getState()
      .nodes.find((n: { data?: { componentId?: string } }) => n.data?.componentId === componentId);
    if (!node) return false;
    useFlowStore.getState().setSelectedNodeId(node.id);
    return true;
  }

  const elements = getExcalidrawAPI()?.getSceneElements?.() ?? useCanvasStore.getState().elements;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = (elements as any[]).find(
    (e) => !e.isDeleted && e.customData?.componentId === componentId
  );
  if (!el) return false;
  useCanvasStore.getState().setSelectedElementIds([el.id]);
  const api = getExcalidrawAPI();
  api?.updateScene?.({
    appState: { selectedElementIds: { [el.id]: true } },
  });
  return true;
}

/** Drop a single component near the center if not focusing an existing one. */
export function placeOrFocusComponent(
  componentId: string,
  target: GuideCanvasTarget
): void {
  if (focusComponentOnCanvas(componentId, target)) return;

  const comp = getComponent(componentId);
  if (!comp) return;

  if (target === "flow") {
    const id = useFlowStore.getState().addNode(
      comp.id,
      comp.name,
      comp.color,
      comp.strokeColor,
      comp.icon,
      { x: 240, y: 180 }
    );
    useFlowStore.getState().setSelectedNodeId(id);
    return;
  }

  const { rect, text, id } = makeRect(
    comp.id,
    comp.name,
    comp.color,
    comp.strokeColor,
    200,
    160,
    comp.defaultWidth,
    comp.defaultHeight
  );
  const api = getExcalidrawAPI();
  if (api) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = api.getSceneElements() as any[];
    api.updateScene({ elements: [...current, rect, text] });
    api.updateScene({
      appState: { selectedElementIds: { [id]: true } },
    });
  } else {
    const { elements, setElements } = useCanvasStore.getState();
    setElements([...elements, rect, text]);
  }
  useCanvasStore.getState().setSelectedElementIds([id]);
}
