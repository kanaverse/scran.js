importScripts("./scran.js");
// import scran from './scran.js';
// import Module from './scran_wasm.js';
// importScripts("./scran_wasm.js");

const DATA_PATH = "/data";
let wasmModule = null;
let data = null;

// only if MODULARIZE=1 during emcc
// function initWasm() {
//     if (wasmModule === null) {
//         new Module().then(mod => {
//             wasmModule = mod;
//         });
//     }
// }

// // initWasm();

onmessage = function (msg) {
    var self = this;
    console.log("in worker");
    console.log(msg);

    const payload = msg.data;

    if (payload.type == "LOAD") {
        // TODO: parcel2 doesn't load inline importScripts
        importScripts("./scran_wasm.js");
        // importScripts(new URL("./scran_wasm.js", import.meta.url),
        // { type: "module" });

        // initWasm();

        Module.onRuntimeInitialized = function load_done_callback() {
            data = new scran({}, Module);
            FS.mkdir(DATA_PATH, 0o777);

            postMessage({
                type: payload.type,
                msg: `Success: Module Loaded`
            })
        }
    } else if (payload.type == "MOUNT") {
        var files = payload.msg;

        if (!data) {
            console.log("need to initialize first");

            postMessage({
                type: payload.type,
                msg: `Error: module not initialized`
            })
        }

        data.files = files;

        // TODO: only dealing with first file for now, 
        // manage multiple files later on

        FS.mount(WORKERFS, {
            files: [files[0]],
            blobs: [{ "name": files[0].name, "data": files[0] }]
        }, DATA_PATH);

        const file_path = `${DATA_PATH}/${files[0].name}`;

        data.loadDataFromPath(file_path);

        // TODO: send multiple msgs for loading screen
        postMessage({
            type: payload.type,
            msg: `Success: Data Loaded into browser, ${data.matrix.ncol()}, ${data.matrix.nrow()}`
        })
    }
}