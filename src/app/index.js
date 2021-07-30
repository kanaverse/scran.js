// import scran from '../scranjs/scran.js';

class App {

    constructor() {
        this.worker = new Worker(
            new URL("../scranjs/worker.js", import.meta.url),
            // { type: "classic" }
        );

        this.worker.onmessage = function (msg) {
            console.log(msg.data);
            const payload = msg.data;

            if (payload.type == "QC") {
                for (var key in payload.resp) {

                    var cont = document.getElementById("qc_charts");
                    var elem = document.createElement("div");
                    elem.id = `qc_${key}`;
                    cont.appendChild(elem);

                    var data = [{
                        type: 'violin',
                        y: Object.values(payload.resp[key]),
                        points: 'all',
                        box: {
                            visible: true
                        },
                        boxpoints: false,
                        line: {
                            color: 'black'
                        },
                        fillcolor: '#8dd3c7',
                        opacity: 0.6,
                        meanline: {
                            visible: true
                        },
                        x0: key
                    }]

                    var layout = {
                        title: key,
                        yaxis: {
                            zeroline: false
                        }
                    }

                    Plotly.newPlot(elem.id, data, layout);
                }
            } else if (payload.type == "PCA") {
                const payload = msg.data;
                var x = [];
                var key = "var_exp";
                var cont = document.getElementById("pca_charts");
                var elem = document.createElement("div");
                elem.id = `pca_${key}`;
                cont.appendChild(elem);

                for (var i = 0; i < Object.keys(payload.resp[key]).length; i++) {
                    x.push("PC" + i);
                }
                var data = [
                    {
                        x: x,
                        y: Object.values(payload.resp[key]),
                        type: 'bar'
                    }
                ];

                var layout = {
                    title: key
                }

                Plotly.newPlot(elem.id, data, layout);
            } else if (payload.type == "CLUS") {
                const payload = msg.data;
                var x = {};
                var key = "clusters";
                var cont = document.getElementById("clus_charts");
                var elem = document.createElement("div");
                elem.id = `clus_${key}`;
                cont.appendChild(elem);

                for (var i = 0; i < Object.values(payload.resp[key]).length; i++) {
                    var clus = Object.values(payload.resp[key])[i];
                    if ("CLUS_" + clus in x) {
                        x["CLUS_" + clus]++;
                    } else {
                        x["CLUS_" + clus] = 0;
                    } 
                }
                var data = [
                    {
                        x: Object.keys(x),
                        y: Object.values(x),
                        type: 'bar'
                    }
                ];

                var layout = {
                    title: "Cells per cluster"
                }

                Plotly.newPlot(elem.id, data, layout);
            }
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
        var mtx = document.getElementById("mtx-upload-file").files;
        var barcodes = document.getElementById("barcodes-upload-file").files;
        var genes = document.getElementById("genes-upload-file").files;

        window.app.worker.postMessage({
            "type": "MOUNT",
            "msg": [barcodes, genes, mtx]
        });
    });

    document.getElementById("run-qc").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "QC",
            "msg": "not much to pass"
        });
    });

    document.getElementById("run-fsel").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "FEATURE_SELECTION",
            "msg": "not much to pass"
        });
    });

    document.getElementById("run-pca").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "PCA",
            "msg": "not much to pass"
        });
    });

    document.getElementById("run-clus").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "CLUS",
            "msg": "not much to pass"
        });
    });
});
