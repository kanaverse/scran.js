importScripts("./scran.js");

importScripts("https://cdn.jsdelivr.net/npm/d3-dsv@3");
importScripts("https://cdn.jsdelivr.net/npm/d3-scale@4");

const DATA_PATH = "/data";
var wasmModule = null;
var data = null;
var state = null;

function run_steps(step, state) {
    var self = this;
    const state_list = ["load", "qc", "fSelection", "pca", "cluster", "tsne", "markerGene"];

    switch (step) {
        case 0:
            var t0 = performance.now();
            data.mountFiles(state.files);
            var t1 = performance.now();
            
            postMessage({
                type: `${state_list[step]}_DIMS`,
                resp: `${data.matrix.nrow()} X ${data.matrix.ncol()}`,
                msg: `Success: Data loaded, dimensions: ${data.matrix.nrow()}, ${data.matrix.ncol()}`
            });

            step++;
        case 1:
            var t0 = performance.now();
            var resp = data.qcMetrics(state.params.qc["qc-nmads"]);
            var t1 = performance.now();

            postMessage({
                type: `${state_list[step]}_DIMS`,
                resp: `${data.filteredMatrix.nrow()} X ${data.filteredMatrix.ncol()}`,
                msg: `Success: Data filtered, dimensions: ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
            });

            postMessage({
                type: `${state_list[step]}_DATA`,
                resp: JSON.parse(JSON.stringify(resp)),
                msg: `Success: QC Complete, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
            });

            step++;
        case 2:
            var t0 = performance.now();
            var resp = data.fSelection(state.params.fSelection["fsel-span"]);
            postMessage({
                type: `${state_list[step]}_DATA`,
                resp: JSON.parse(JSON.stringify(resp)),
                msg: `Success: FSEL done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
            });
            step++;
        case 3:
            var t0 = performance.now();
            var resp = data.PCA(state.params.pca["pca-npc"]);
            var t1 = performance.now();

            postMessage({
                type: `${state_list[step]}_DATA`,
                resp: JSON.parse(JSON.stringify(resp)),
                msg: `Success: PCA done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
            });
            step++;
        case 4:
            var t0 = performance.now();
            var resp = data.cluster(state.params.cluster["clus-k"], state.params.cluster["clus-res"]);
            var t1 = performance.now();

            postMessage({
                type: `${state_list[step]}_DATA`,
                resp: JSON.parse(JSON.stringify(resp)),
                msg: `Success: CLUS done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
            });
            step++;
        case 5:
            var t0 = performance.now();
            var resp = data.tsne(state.params.tsne["tsne-perp"], state.params.tsne["tsne-iter"]);
            postMessage({
                type: `${state_list[step]}_DATA`,
                resp: JSON.parse(JSON.stringify(resp)),
                msg: `Success: TSNE done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
            });
            step++;
        case 6:
            var t0 = performance.now();
            var resp = data.markerGenes();
            var t1 = performance.now();

            postMessage({
                type: `${state_list[step]}_DATA`,
                resp: JSON.parse(JSON.stringify(resp)),
                msg: `Success: MARKER_GENE done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
            });
            step++;
        default:
            console.log(`${step} invalid`);
            break;
    }
}

onmessage = function (msg) {
    var self = this;
    console.log("in worker");
    console.log(msg.data);

    const payload = msg.data;

    if (payload.type == "INIT") {
        // TODO: parcel2 doesn't load inline importScripts
        importScripts("./scran_wasm.js");

        Module.onRuntimeInitialized = function load_done_callback() {
            FS.mkdir(DATA_PATH, 0o777);
            data = new scran({}, Module);
            state = new scranSTATE();

            postMessage({
                type: payload.type,
                msg: `Success: ScranJS/WASM initialized`
            });
        }
    } else if (payload.type == "RUN") {
        var diff = 0;

        if (!state.get_state()) {
            state.set_state(payload.payload);
        } else {
            var diff = state.diff(payload.payload);
        }

        run_steps(diff, state.get_state());
    } 
    // custom events from UI
    else if (payload.type == "setQCThresholds") {
        data.thresholds = payload.input;

        postMessage({
            type: "qc_DIMS",
            resp: `${data.filteredMatrix.nrow()} X ${data.filteredMatrix.ncol()}`,
            msg: `Success: QC - Thresholds Sync Complete, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}`
        })
    } else if (payload.type == "getMarkersForCluster") {
        var t0 = performance.now();
        var resp = data.getClusterMarkers(payload.input[0]);
        var t1 = performance.now();

        postMessage({
            type: "setMarkersForCluster",
            resp: JSON.parse(JSON.stringify(resp)),
            msg: `Success: GET_MARKER_GENE done, ${data.filteredMatrix.nrow()}, ${data.filteredMatrix.ncol()}` + " took " + (t1 - t0) + " milliseconds."
        });
    } else {
        console.log("MIM:::msg type incorrect")
    }
}



