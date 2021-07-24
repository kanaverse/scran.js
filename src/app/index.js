// import scran from '../scranjs/scran.js';

class App {

    constructor() {
        this.worker = new Worker(
            new URL("../scranjs/worker.js", import.meta.url),
            // { type: "classic" }
        );

        this.worker.onmessage = function (msg) {
            console.log(msg.data);
        }

        this.worker.postMessage({
            "type": "LOAD",
            "msg": "Initial Load"
        });

        var self = this;
    }

}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new App();

    document.getElementById("mtx-upload-submit").addEventListener("click", (event) => {
        var files = document.getElementById("mtx-upload-file").files;
        window.app.worker.postMessage({
            "type": "MOUNT",
            "msg": files
        });
    });
});
