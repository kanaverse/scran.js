
class App {
    constructor() {

        var self = this;
        // initialize GRID
        // items are draggable
        var grid = new Muuri('.grid', {
            dragEnabled: true,
            dragHandle: ".item-content"
        });

        this.worker = new Worker(
            new URL("../../../scranjs/scranWorker.js", import.meta.url),
        );

        // var app_file_inputs, app_params, app_step_changed, first_run = true;

        // resize grid when elements changed
        function resizeItem(item, width, height) {
            var el = item.getElement();
            var grid = item.getGrid();
            el.style.width = width + 'px';
            el.style.height = height + 'px';
            el.children[0].style.width = width + 'px';
            el.children[0].style.height = height + 'px';
            grid.refreshItems(item);
            grid.layout();
        }

        // resize layout when window size changes
        window.addEventListener('resize', (e) => {
            grid.refreshItems().layout();
        });

        // resize layout when each item size changes
        // should respond to resize events on the bottom right corner
        document.querySelectorAll(".item").forEach(elem => {
            new ResizeObserver(() => {
                grid.refreshItems().layout();
            }).observe(elem);
        })

        // test, double click on the element and it should resize
        document.addEventListener('dblclick', (e) => {
            var itemElement = e.target.closest('.item');
            if (!itemElement) return;

            var item = grid.getItems(itemElement)[0];
            if (!item) return;

            resizeItem(item, item._width, item._height === 200 ? 410 : 200);
        });

        // dom elements to keep track of for variables 
        var files = ["mtx-upload-file", "barcodes-upload-file", "genes-upload-file"];
        var inputs = {
            "qc": ["qc-nmads-input"],
            "fSelection": ["fsel-input"],
            "pca": ["pca-npc-input"],
            "cluster": ["clus-k-input", "clus-res-input"],
            "tsne": ["tsne-input-iter", "tsne-input-perp"],
            "markerGene": []
        }

        // add the RUN event handler
        document.getElementById("run").addEventListener("click", (event) => {
            // first get all params, 
            var app_files_input = files.map(x => document.getElementById(x).files);
            var app_params = {};

            // QC
            app_params["qc"] = {};
            var val = document.getElementById("qc-nmads-input").value;
            if (!val) { val = 3; }
            app_params["qc"]["qc-nmads"] = parseFloat(val);

            // fSelection
            app_params["fSelection"] = {};
            var val = document.getElementById("fsel-input").value;
            if (!val) { val = 0.3; }
            app_params["fSelection"]["fsel-span"] = parseFloat(val);

            // PC
            app_params["pca"] = {};
            var val = document.getElementById("pca-npc-input").value;
            if (!val) { val = 5; }
            app_params["pca"]["pca-npc"] = parseFloat(val);

            // Cluster
            app_params["cluster"] = {};
            var val = document.getElementById("clus-k-input").value;
            if (!val) { val = 10; }
            app_params["cluster"]["clus-k"] = parseFloat(val);

            var val = document.getElementById("clus-res-input").value;
            if (!val) { val = 0.5; }
            app_params["cluster"]["clus-res"] = parseFloat(val);

            // t-SNE
            app_params["tsne"] = {};
            var val = document.getElementById("tsne-input-iter").value;
            if (!val) { val = 200; }
            app_params["tsne"]["tsne-iter"] = parseFloat(val);

            var val = document.getElementById("tsne-input-perp").value;
            if (!val) { val = 30; }
            app_params["tsne"]["tsne-perp"] = parseFloat(val);

            // Marker Gene
            // no inputs
            app_params["markerGene"] = {};

            self.worker.postMessage({
                "type": "RUN",
                "payload": {
                    "files": app_files_input,
                    "params": app_params
                },
                "msg": "not much to pass"
            });
        });

        // msgs from worker
        self.worker.onmessage = function (msg) {
            console.log(msg);
        }

        // need to send an INIT 
        // to the worker thread
        self.worker.postMessage({
            "type": "LOAD",
            "msg": "Initial Load"
        });

        // ACCORDION effect in JS
        // document.querySelectorAll(".accordion").forEach(elem => {
        //     elem.addEventListener("click", function () {
        //         this.classList.toggle("active");

        //         // show/hide panel
        //         var panel = this.nextElementSibling;
        //         if (panel.style.display === "block") {
        //             panel.style.display = "none";
        //         } else {
        //             panel.style.display = "block";
        //         }

        //         // set height to panel
        //         if (panel.style.maxHeight) {
        //             panel.style.maxHeight = null;
        //           } else {
        //             panel.style.maxHeight = panel.scrollHeight + "px";
        //           }
        //     });
        // })
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.app = new App();
});
