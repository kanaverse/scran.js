importScripts("./scran.js");
// import scran from './scran.js';
// import Module from './scran_wasm.js';
// importScripts("./scran_wasm.js");

importScripts("https://cdn.jsdelivr.net/npm/d3-dsv@3");
console.log(d3);

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

onmessage = function (msg) {
    var self = this;
    console.log("in worker");
    console.log(msg.data);

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
        // barcodes, genes, mtx
        var input = payload.msg;

        if (!data) {
            console.log("need to initialize first");

            postMessage({
                type: payload.type,
                msg: `Error: module not initialized`
            })
        }

        // data.loadData([], 100,100);

        data.files = input;

        var mtx_file = input[2];
        const mtx_file_path = `${DATA_PATH}/${mtx_file[0].name}`;

        // FS.unmount(mtx_file_path);
        // TODO: only dealing with first file for now, 
        // manage multiple files later on
        FS.mount(WORKERFS, {
            files: [input[0][0], input[1][0], input[2][0]]
            // blobs: [{ "name": input[0].name, "data": input[0] },
            // { "name": input[1].name, "data": input[1]},
            // { "name": input[2].name, "data": input[2]}]
        }, DATA_PATH);


        // var t0 = performance.now();
        const file_details = FS.stat(mtx_file_path);
        var file_size = file_details.size;

        var buffer_ptr = Module._malloc(file_size); // in bytes
        var buffer_vec = new Uint8Array(Module.HEAPU8.buffer, buffer_ptr, file_size);

        var stream = FS.open(mtx_file_path, "r")
        FS.read(stream, buffer_vec, 0, file_size, 0);
        // console.log(buffer_vec);
        FS.close(stream);
        // var t1 = performance.now();
        // console.log("Reading the file took " + (t1 - t0) + " milliseconds.");
        
        var t0 = performance.now();
        var ext = mtx_file_path.split('.').pop();
        data.loadDataFromPath(buffer_ptr, file_size, (ext == "gz"));
        var t1 = performance.now();
        console.log("Loading the file took " + (t1 - t0) + " milliseconds.");

        const tsv = d3.dsvFormat("\t");

        var barcode_file = input[0];
        const barcode_file_path = `${DATA_PATH}/${barcode_file[0].name}`;

        // FS.unmount(barcode_file_path);
        // FS.mount(WORKERFS, {
        //     files: [barcode_file[0]],
        //     blobs: [{ "name": barcode_file[0].name, "data": barcode_file[0] }]
        // }, DATA_PATH);

        const barcode_str = FS.readFile(barcode_file_path, {"encoding": "utf8"});
        data.barcodes = tsv.parse(barcode_str);
        console.log(data.barcodes);

        var genes_file = input[1];
        const genes_file_path = `${DATA_PATH}/${genes_file[0].name}`;

        // FS.unmount(genes_file_path);
        // FS.mount(WORKERFS, {
        //     files: [genes_file[0]],
        //     blobs: [{ "name": genes_file[0].name, "data": genes_file[0] }]
        // }, DATA_PATH);

        const genes_str = FS.readFile(genes_file_path, {"encoding": "utf8"});
        data.genes = tsv.parse(genes_str);

        console.log(data.genes);

        // TODO: send multiple msgs for loading screen
        postMessage({
            type: payload.type,
            msg: `Success: Data Loaded into browser, ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })
    } else if (payload.type == "QC") {
        const resp = data.qcMetrics();

        postMessage({
            type: payload.type,
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: QC Complete, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })
    } else if (payload.type == "FEATURE_SELECTION") {
        // need a fsel

        postMessage({
            type: payload.type,
            msg: `Success: FSEL done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })
    } else if (payload.type == "PCA") {
        var t0 = performance.now();
        var resp = data.PCA();
        var t1 = performance.now();
        console.log("PCA took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: PCA done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })
    } else if (payload.type == "CLUS") {
        var t0 = performance.now();
        var resp = data.cluster();
        var t1 = performance.now();
        console.log("CLUS took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            // resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: CLUS done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })
    }
}
