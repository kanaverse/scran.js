export = WebGLVis;

declare class WebGLVis {
  constructor(container: HTMLElement);
  setCanvasSize(width: Number, height: Number): void;
  addToDom(): void;
  setViewOptions(options: Object): void;
  setSchema(schema: Object): boolean;
  sendDrawerState(viewport: Object): void;
  forceDrawerRender(): void;
  selectPoints(points: Array<Number>): void;
  getClosestPoint(point: Array<Number>): void;
  initFpsmeter(): void;

  dataWorkerStream: Array<MessageEvent>;
}
