importScripts("./scran.js");

importScripts("https://cdn.jsdelivr.net/npm/d3-dsv@3");
importScripts("https://cdn.jsdelivr.net/npm/d3-scale@4");

const DATA_PATH = "/data";
var wasmModule = null;
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
    // console.log("in worker");
    // console.log(msg.data);

    const payload = msg.data;

    if (payload.type == "LOAD") {
        // TODO: parcel2 doesn't load inline importScripts
        importScripts("./scran_wasm.js");
        console.log(data);

        Module.onRuntimeInitialized = function load_done_callback() {
            console.log("I'm done loading");
            FS.mkdir(DATA_PATH, 0o777);
            data = new scran({}, Module);

            postMessage({
                type: payload.type,
                msg: `Success: ScranJS/WASM initialized`
            });
        }

    } else if (payload.type == "MOUNT") {
        // barcodes, genes, mtx
        var input = payload.msg;

        if (!data) {
            postMessage({
                type: payload.type,
                msg: `Error: ScranJS/WASM not initialized`
            });
        }

        data.files = input;
        // FS.unmount(mtx_file_path);
        var files_to_load = [];
        data.files.forEach(m => {
            if (m.length > 0) {
                files_to_load.push(m[0]);
            }
        })

        FS.mount(WORKERFS, {
            files: files_to_load
        }, DATA_PATH);

        var mtx_file = input[0];
        const mtx_file_path = `${DATA_PATH}/${mtx_file[0].name}`;
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
        // console.log("Loading mtx file took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            msg: `Success: mtx file loaded in ${(t1 - t0) / 1000} seconds`
        });

        const tsv = d3.dsvFormat("\t");

        var barcode_file = input[1];
        if (barcode_file.length > 0) {
            var t0 = performance.now();
            const barcode_file_path = `${DATA_PATH}/${barcode_file[0].name}`;
            const barcode_str = FS.readFile(barcode_file_path, { "encoding": "utf8" });
            data.barcodes = tsv.parse(barcode_str);
            var t1 = performance.now();
            // console.log("Loading barcodes file took " + (t1 - t0) + " milliseconds.");
            // console.log(data.barcodes);

            postMessage({
                type: payload.type,
                msg: `Success: barcodes file loaded in ${(t1 - t0) / 1000} seconds`
            });
        }


        var genes_file = input[2];
        if (genes_file.length > 0) {
            var t0 = performance.now();
            const genes_file_path = `${DATA_PATH}/${genes_file[0].name}`;
            const genes_str = FS.readFile(genes_file_path, { "encoding": "utf8" });
            data.genes = tsv.parse(genes_str);
            var t1 = performance.now();

            postMessage({
                type: payload.type,
                msg: `Success: genes file loaded in ${(t1 - t0) / 1000} seconds`
            });
        }

        postMessage({
            type: "ODATA",
            resp: `${data.matrix.nrow()} X ${data.matrix.ncol()}`,
            msg: `Success: Data loaded, dimensions: ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })

        postMessage({
            type: payload.type,
            msg: `Success: Data loaded, dimensions: ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })


        var ftime = (t1 - t0) / 1000;
        postMessage({
            type: payload.type,
            resp: `~${ftime.toFixed(2)} sec`,
            msg: 'Done'
        });
    } else if (payload.type == "GENERATE_DATA") {

        data.loadData([], 10000, 1000);

        postMessage({
            type: "ODATA",
            resp: `${data.matrix.nrow()} X ${data.matrix.ncol()}`,
            msg: `Success: Data loaded, dimensions: ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        })

        postMessage({
            type: payload.type,
            msg: `Success: Test data loaded, dimensions: ${data.matrix.nrow()}, ${data.matrix.ncol()}`
        });

        postMessage({
            type: payload.type,
            msg: 'Done'
        });
    } else if (payload.type == "QC") {
        var t0 = performance.now();
        const resp = data.qcMetrics(payload.input[0]);
        var t1 = performance.now();

        postMessage({
            type: "FDATA",
            resp: `${data.filteredMatrix.nrow()} X ${data.filteredMatrix.ncol()}`,
            msg: `Success: Data filtered, dimensions: ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })

        postMessage({
            type: "QC_RESP",
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: QC Complete, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        });

        var ftime = (t1 - t0) / 1000;
        postMessage({
            type: payload.type,
            resp: `~${ftime.toFixed(2)} sec`,
            msg: 'Done'
        });
    } else if (payload.type == "QCThresholds") {
        data.thresholds = payload.input;

        postMessage({
            type: payload.type,
            // resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: QC - Thresholds Sync Complete, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })
    } else if (payload.type == "QCFilter") {
        data.filterCells();

        postMessage({
            type: "FDATA",
            resp: `${data.filteredMatrix.nrow()} X ${data.filteredMatrix.ncol()}`,
            msg: `Success: Data filtered, dimensions: ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })

        postMessage({
            type: payload.type,
            // resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: QC Filter Cells, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })
    } else if (payload.type == "FEATURE_SELECTION") {
        // need a fsel
        var t0 = performance.now();
        var resp = data.fSelection(payload.input[0]);
        var t1 = performance.now();

        postMessage({
            type: 'FSEL_RESP',
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: FSEL done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })

        var ftime = (t1 - t0) / 1000;
        postMessage({
            type: payload.type,
            resp: `~${ftime.toFixed(2)} sec`,
            msg: 'Done'
        });
    } else if (payload.type == "PCA") {
        var t0 = performance.now();
        var resp = data.PCA(payload.input[0]);
        var t1 = performance.now();
        // console.log("PCA took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: PCA done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
        })

        var ftime = (t1 - t0) / 1000;
        postMessage({
            type: payload.type,
            resp: `~${ftime.toFixed(2)} sec`,
            msg: 'Done'
        });
    } else if (payload.type == "TSNE") {
        data.init_tsne = null;
        var t0 = performance.now();
        var resp = data.tsne(payload.input[0], payload.input[1]);
        var t1 = performance.now();
        // console.log("TSNE took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: TSNE done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
        });

        var ftime = (t1 - t0) / 1000;
        postMessage({
            type: payload.type,
            resp: `~${ftime.toFixed(2)} sec`,
            msg: 'Done'
        });
    } else if (payload.type == "CLUS") {
        var t0 = performance.now();
        var resp = data.cluster(payload.input[0], payload.input[1]);
        var t1 = performance.now();
        // console.log("CLUS took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: CLUS done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
        });

        var ftime = (t1 - t0) / 1000;
        postMessage({
            type: payload.type,
            resp: `~${ftime.toFixed(2)} sec`,
            msg: 'Done'
        });
    } else if (payload.type == "MARKER_GENE") {
        var t0 = performance.now();
        var resp = data.markerGenes();
        var t1 = performance.now();
        // console.log("CLUS took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: MARKER_GENE done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
        });

        var ftime = (t1 - t0) / 1000;
        postMessage({
            type: payload.type,
            resp: `~${ftime.toFixed(2)} sec`,
            msg: 'Done'
        });
    } else if (payload.type == "GET_CLUSTER_MARKERS") {
        var t0 = performance.now();
        var resp = data.getClusterMarkers(payload.input[0]);
        var t1 = performance.now();
        // console.log("CLUS took " + (t1 - t0) + " milliseconds.");

        postMessage({
            type: payload.type,
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: GET_MARKER_GENE done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
        });

        // var ftime = (t1 - t0) / 1000;
        // postMessage({
        //     type: payload.type,
        //     resp: `~${ftime.toFixed(2)} sec`,
        //     msg: 'Done'
        // });
    }

}
