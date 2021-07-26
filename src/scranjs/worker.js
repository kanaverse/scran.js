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
            FS.mkdir(DATA_PATH, 0o777);
            data = new scran({}, Module);

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

        var t0 = performance.now();

        const file_details = FS.stat(file_path);
        var file_size = file_details.size;

        var buffer_ptr = Module._malloc(file_size); // in bytes
        var buffer_vec = new Uint8Array(Module.HEAPU8.buffer, buffer_ptr, file_size);

        var stream = FS.open(file_path, "r")
        FS.read(stream, buffer_vec, 0, file_size, 0);
        console.log(buffer_vec);
        FS.close(stream);

        var t1 = performance.now();
        console.log("Reading the file took " + (t1 - t0) + " milliseconds.");

        var t0 = performance.now();

        var ext = file_path.split('.').pop();
        data.loadDataFromPath(buffer_ptr, file_size, (ext == "gz"));

        var t1 = performance.now();
        console.log("Loading the file took " + (t1 - t0) + " milliseconds.");

        // TODO: send multiple msgs for loading screen
        postMessage({
            type: payload.type,
            msg: `Success: Data Loaded into browser, ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })
    } else if (payload.type == "QC") {
        data.QC();

        postMessage({
            type: payload.type,
            msg: `Success: QC Complete, ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })
    } else if (payload.type == "FEATURE_SELECTION") {
        // need a fsel

        postMessage({
            type: payload.type,
            msg: `Success: FSEL done, ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })
    } else if (payload.type == "PCA") {
        data.PCA();

        postMessage({
            type: payload.type,
            msg: `Success: PCA done, ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })
    }
}
