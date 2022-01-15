import loadScran from "../build/scran.js";

const Module = await loadScran({ "locateFile": (x) => import.meta.url.substring(7) + "/../../build/" + x });

export default Module;
