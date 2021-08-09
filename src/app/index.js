// import scran from '../scranjs/scran.js';

class App {

    constructor() {
        this.worker = new Worker(
            new URL("../scranjs/worker.js", import.meta.url),
        );

        this.qcBoxPlots = {};

        var self = this;

        this.worker.onmessage = function (msg) {
            console.log(msg.data);
            const payload = msg.data;

            var log_cont = document.getElementById("logs");
            if (payload.msg.startsWith("Success")) {
                log_cont.insertAdjacentHTML('beforeend',
                    `<pre data-prefix="~"><code>${payload.msg}</code></pre>`);
            } else if (payload.msg.startsWith("Error")) {
                log_cont.insertAdjacentHTML('beforeend',
                    `<pre data-prefix="~"><code>${payload.msg}</code></pre>`);
            } else {
                log_cont.insertAdjacentHTML('beforeend',
                    `<pre data-prefix="~"><code>${payload.msg}</code></pre>`);
            }

            if (payload.type == "ODATA") {
                var cont = document.getElementById("odata");
                elem = cont.querySelector(".stat-value");
                elem.innerHTML = payload.resp;

                document.getElementById("load-data-btn").setAttribute("data-content", "✓");
            } else if (payload.type == "FDATA") {
                var cont = document.getElementById("fdata");
                elem = cont.querySelector(".stat-value");
                elem.innerHTML = payload.resp;

                document.getElementById("qc-data-btn").setAttribute("data-content", "✓");
            } else if (payload.type == "MOUNT" || payload.type == "GENERATE_DATA") {
            } else if (payload.type == "QC") {
                ["sums", "detected", "proportion"].forEach(key => {
                    var cont = document.getElementById("qc_charts");
                    const eid = `qc_${key}`;
                    var threshold = payload.resp["thresholds"][key];
                    var vec = Object.values(payload.resp[key]);

                    if (key != "proportion") {
                        vec = vec.map((m) => Math.log2(m + 1));
                        threshold = Math.log2(threshold + 1)
                    } else {
                        threshold = Math.min([threshold, 100]);
                    }

                    if (!cont.querySelector("#" + eid)) {
                        var elem = document.createElement("div");
                        elem.id = eid;
                        elem.className = "uk-width-auto";
                        cont.appendChild(elem);

                        var plot = new boxPlot(elem, elem.id, {});
                        plot.threshold = threshold;

                        self.qcBoxPlots[eid] = plot;

                        elem.addEventListener("threshold", (e) => {
                            window.app.worker.postMessage({
                                "type": "QCThresholds",
                                "input": [
                                    self.qcBoxPlots['qc_sums'].threshold,
                                    self.qcBoxPlots['qc_detected'].threshold,
                                    Math.min([self.qcBoxPlots['qc_proportion'].threshold], 100)
                                ], // sums, detected & threshold 
                                "msg": "not much to pass"
                            });
                        })

                        var plot = self.qcBoxPlots[eid];
                        plot.threshold = threshold;
    
                        var pData = {
                            "y": vec,
                            "x": key != "proportion" ? "log-" + key : key
                        };
    
                        plot.draw(pData, "", 'x', 'y', threshold);
                    }
                });
            } else if (payload.type == "FEATURE_SELECTION") {
                const payload = msg.data;
                var keys = ["genes", "means", "vars", "fitted", "resids"];
                var isGene = payload.resp["genes"] != null;
                var table = [];
                // Object.keys(payload.resp["means"]).length
                for (var i = 0; i < 100; i++) {
                    // var tr = isGene ? [payload.resp["genes"][i]] : []
                    // tr.push(payload.resp["means"][i], payload.resp["vars"][i], 
                    //     payload.resp["fitted"][i], payload.resp["resids"][i]);
                    var tr = isGene ? `<td>${payload.resp["genes"][i]["gene"]}</td>` : "<td>-</td>";
                    tr += `<td>${payload.resp["means"][i]}</td><td>${payload.resp["vars"][i]}</td><td>${payload.resp["fitted"][i]}</td><td>${payload.resp["resids"][i]}</td>`
                    table.push(`<tr>${tr}</tr>`);
                }

                var columns = isGene ? keys : keys.slice(1);

                // columns.forEach(m => {
                //     document.getElementById("row_header").insertAdjacentHTML(
                //         'beforeend',
                //         `<th>${m}</th>`
                //     )
                // });

                var clusterize = new Clusterize({
                    rows: table,
                    scrollId: 'scrollArea',
                    contentId: 'contentArea'
                });
                // const grid = new Grid({
                //     columns: columns,
                //     pagination: {
                //         limit: 10
                //       },
                //     data: table
                //   }).render(document.getElementById("fsel_charts"));
                document.getElementById("fsel-data-btn").setAttribute("data-content", "✓");

            } else if (payload.type == "PCA") {
                const payload = msg.data;
                var x = [];
                var key = "var_exp";
                var cont = document.getElementById("pca_charts");
                var elem = document.createElement("div");
                elem.id = `pca_${key}`;
                cont.appendChild(elem);

                for (var i = 0; i < Object.keys(payload.resp[key]).length; i++) {
                    x.push("PC" + (i + 1));
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
                var cont = document.getElementById("cluster_charts");
                var elem = document.createElement("div");
                elem.id = `cluster_${key}`;
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

                // Plotly.newPlot(elem.id, data, layout);
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
            "msg": [mtx, barcodes, genes]
        });
    });

    document.getElementById("mtx-generate-submit").addEventListener("click", (event) => {
        var mtx = document.getElementById("mtx-upload-file").files;
        var barcodes = document.getElementById("barcodes-upload-file").files;
        var genes = document.getElementById("genes-upload-file").files;

        window.app.worker.postMessage({
            "type": "GENERATE_DATA",
            "msg": []
        });
    });

    document.getElementById("qc-submit").addEventListener("click", (event) => {
        var val = document.getElementById("qc-nmads-input").value;
        window.app.worker.postMessage({
            "type": "QC",
            "input": [parseFloat(val)], // sums, detected & threshold 
            "msg": "not much to pass"
        });
    });

    document.getElementById("qc-nmads-input").addEventListener("change", (event) => {
        var val = document.getElementById("qc-nmads-input").value;
        window.app.worker.postMessage({
            "type": "QC",
            "input": [parseFloat(val)], // sums, detected & threshold 
            "msg": "not much to pass"
        });
    });

    document.getElementById("qc-filter-submit").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "QCFilter",
            // "input": [0, 0, 0], // sums, detected & threshold 
            "msg": "not much to pass"
        });
    });

    document.getElementById("fsel-submit").addEventListener("click", (event) => {
        var val = document.getElementById("fsel-input").value;
        if (!val) { val = 0.3; }
        window.app.worker.postMessage({
            "type": "FEATURE_SELECTION",
            "input": [parseFloat(val)],
            "msg": "not much to pass"
        });
    });

    document.getElementById("pca-submit").addEventListener("click", (event) => {
        var val = document.getElementById("pcs-input").value;
        if (!val) { val = 5; }
        window.app.worker.postMessage({
            "type": "PCA",
            "input": [parseInt(val)],
            "msg": "not much to pass"
        });
    });

    document.getElementById("cluster-submit").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "CLUS",
            "msg": "not much to pass"
        });
    });
});
