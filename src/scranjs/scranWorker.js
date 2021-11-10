importScripts("./scran.js");

importScripts("https://cdn.jsdelivr.net/npm/d3-dsv@3");
importScripts("https://cdn.jsdelivr.net/npm/d3-scale@4");

const DATA_PATH = "/data";
var wasmModule = null;
var data = null;
var state = null;

onmessage = function (msg) {
    var self = this;
    console.log("in worker");
    console.log(msg.data);

    const payload = msg.data;

    if (payload.type == "LOAD") {
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
    }  else if (payload.type == "RUN") {
        var diff = 0;

        if (!state.get_state()) {
            state.set_state(payload.payload);
        } else {
            var diff = state.diff(payload.payload);
        }

        data.run(diff, state.get_state());
    } else {
        console.log("MIM:::msg type incorrect")
    }
}



