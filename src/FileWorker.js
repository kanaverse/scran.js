// TODO: needs compilation with -lworkerfs.js
importScripts("scram_wasm.js");

onmessage = function(e) {
    console.log("in worker");
    console.log(e);

    // modify this for different types

    var files = e.data.files;

    FS.mount(WORKERFS, {
        files: files.filter(f => f.file instanceof File).map(f => f.file)
    }, "/data");
};