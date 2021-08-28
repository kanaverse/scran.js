export = WebGLVis;

declare class WebGLVis {
  constructor(container: HTMLElement);
  setCanvasSize(width: Number, height: Number): void;
  addToDom(): void;
  setViewOptions(options: Object): void;
  setSpecification(specification: Object): boolean;
  sendDrawerState(viewport: Object): void;
  forceDrawerRender(): void;
  selectPoints(points: Array<Number>): void;
  getClosestPoint(point: Array<Number>): void;
  initFpsmeter(): void;
  addEventListener(
    type: string,
    listener: (event: CustomEvent) => void,
    options?: Object
  );

  dataWorkerStream: Array<MessageEvent>;
}
