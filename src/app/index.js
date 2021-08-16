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

            // logger
            self._logger(payload);
            // var log_cont = document.getElementById("logs");

            if (payload.type == "ODATA") {
                var output_cont = document.getElementById("load-data-output");
                output_cont.insertAdjacentHTML('beforeend',
                    `<p>${payload.msg}</p>`);

            } else if (payload.type == "FDATA") {
                // var cont = document.getElementById("fdata");
                // elem = cont.querySelector(".stat-value");
                // elem.innerHTML = payload.resp;

                // document.getElementById("qc-data-btn").setAttribute("data-content", "✓");
            } else if (payload.type == "MOUNT" || payload.type == "GENERATE_DATA") {

                if (payload.msg.startsWith("Done")) {
                    //  switch to output tab
                    var tab = document.querySelector('#load-data-tabs button[data-bs-target="#load-data-output"]');
                    var ttab = new bootstrap.Tab(tab)
                    ttab.show();

                    var container = document.getElementById("load-data-status");
                    container.querySelector("#load-data-notrun").style.display = "none";
                    container.querySelector("#load-data-spinner").style.display = "none";
                    container.querySelector("#load-data-success").style.display = "block";

                    // timer
                    document.getElementById("load-data-timer").style.display = "block";
                    document.getElementById("load-data-timer").innerHTML = payload.resp;

                    // show QC Step
                    document.getElementById("qc-accordion").style.display = "block";
                }

            } else if (payload.type == "QC_RESP") {
                // add output plots
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
                                    Math.pow(2, self.qcBoxPlots['qc_sums'].threshold),
                                    Math.pow(2, self.qcBoxPlots['qc_detected'].threshold),
                                    Math.pow(2, Math.min([self.qcBoxPlots['qc_proportion'].threshold], 100))
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
            } else if (payload.type == "QC") {

                if (payload.msg.startsWith("Done")) {
                    //  switch to output tab
                    var tab = document.querySelector('#qc-tabs button[data-bs-target="#qc-output"]');
                    var ttab = new bootstrap.Tab(tab)
                    ttab.show();

                    var container = document.getElementById("qc-status");
                    container.querySelector("#qc-notrun").style.display = "none";
                    container.querySelector("#qc-spinner").style.display = "none";
                    container.querySelector("#qc-success").style.display = "block";

                    // timer
                    document.getElementById("qc-timer").style.display = "block";
                    document.getElementById("qc-timer").innerHTML = payload.resp;

                    // show FSEL Step
                    document.getElementById("fsel-accordion").style.display = "block";
                }
            } else if (payload.type == "FSEL_RESP") {
                const payload = msg.data;
                var keys = ["genes", "means", "vars", "fitted", "resids"];
                var isGene = payload.resp["genes"] != null;
                var table = [];
                for (var i = 0; i < 100; i++) {
                    var tr = isGene ? `<td>${payload.resp["genes"][i]["gene"]}</td>` : "<td>-</td>";
                    tr += `<td>${payload.resp["means"][i]}</td><td>${payload.resp["vars"][i]}</td><td>${payload.resp["fitted"][i]}</td><td>${payload.resp["resids"][i]}</td>`
                    table.push(`<tr>${tr}</tr>`);
                }

                var columns = isGene ? keys : keys.slice(1);
                var clusterize = new Clusterize({
                    rows: table,
                    scrollId: 'scrollArea',
                    contentId: 'contentArea'
                });
            } else if (payload.type == "FEATURE_SELECTION") {
                if (payload.msg.startsWith("Done")) {
                    //  switch to output tab
                    var tab = document.querySelector('#fsel-tabs button[data-bs-target="#fsel-output"]');
                    var ttab = new bootstrap.Tab(tab)
                    ttab.show();

                    var container = document.getElementById("fsel-status");
                    container.querySelector("#fsel-notrun").style.display = "none";
                    container.querySelector("#fsel-spinner").style.display = "none";
                    container.querySelector("#fsel-success").style.display = "block";

                    // timer
                    document.getElementById("fsel-timer").style.display = "block";
                    document.getElementById("fsel-timer").innerHTML = payload.resp;

                    // show PCA Step
                    // document.getElementById("fsel-accordion").style.display = "block";
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
            } else if (payload.type == "TSNE") {
                const payload = msg.data;
                console.log(payload);

                var cont = document.getElementById("tsne_charts");
                var elem = document.createElement("div");
                elem.style.width = "500px";
                elem.style.height = "500px";
                cont.appendChild(elem);

                var tsne1 = [], tsne2 = [], sample = [];
                var payload_vals = Object.values(payload.resp["tsne"]);
                var min = 1000, max = -1000;
                for (var i = 0; i < payload_vals.length; i++) {
                    if (i % 2 == 0) {
                        tsne1.push(payload_vals[i]);
                    }
                    else {
                        tsne2.push(payload_vals[i]);
                        sample.push("sample");
                    }
                }

                const visualization = new WebGLVis(elem);
                visualization.addToDom();
                visualization.setSchema({
                    defaultData: {
                        "tsne1": tsne1,
                        "tsne2": tsne2,
                        "sample": sample
                    },
                    "labels": [
                        {
                            "y": -1.3,
                            "x": 0,
                            "text": "Iteration " + payload.resp["iteration"],
                            "fixedX": true
                        }
                    ],
                    tracks: [
                        {
                            "mark": "point",
                            "x": {
                                "attribute": "tsne1",
                                "type": "quantitative",
                                "domain": [-500, 500]// [Math.min(...tsne1), Math.max(...tsne1)]
                            },
                            "y": {
                                "attribute": "tsne2",
                                "type": "quantitative",
                                "domain": [-500, 500] //[Math.min(...tsne2), Math.max(...tsne2)]
                            },
                            "color": {
                                "value": "blue",
                            },
                            "opacity": { "value": 0.6 }
                        },
                    ],
                });

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

                Plotly.newPlot(elem.id, data, layout);

                var elem2 = document.createElement("div");
                elem2.style.width = "500px";
                elem2.style.height = "500px";
                cont.appendChild(elem2);

                var tsne1 = [], tsne2 = [];
                var payload_vals = Object.values(payload.resp["tsne"]);
                var min = 1000, max = -1000;
                for (var i = 0; i < payload_vals.length; i++) {
                    if (i % 2 == 0) {
                        tsne1.push(payload_vals[i]);
                    }
                    else {
                        tsne2.push(payload_vals[i]);
                        // sample.push("sample");
                    }
                }

                var samples = Object.values(payload.resp["clusters"]);

                const visualization = new WebGLVis(elem2);
                visualization.addToDom();
                visualization.setSchema({
                    defaultData: {
                        "tsne1": tsne1,
                        "tsne2": tsne2,
                        "sample": samples
                    },
                    tracks: [
                        {
                            "mark": "point",
                            "x": {
                                "attribute": "tsne1",
                                "type": "quantitative",
                                "domain": [-500, 500] //[Math.min(...tsne1), Math.max(...tsne1)]
                            },
                            "y": {
                                "attribute": "tsne2",
                                "type": "quantitative",
                                "domain": [-500, 500]  //[Math.min(...tsne2), Math.max(...tsne2)]
                            },
                            "color": {
                                "attribute": "sample",
                                "type": "categorical",
                                "cardinality": Math.max(...samples),
                                "colorScheme": "interpolateRainbow"
                            },
                            "opacity": { "value": 0.6 }
                        },
                    ],
                });
            }
        }

        this.worker.postMessage({
            "type": "LOAD",
            "msg": "Initial Load"
        });

        var self = this;
    }

    _logger(payload) {
        if (payload.type == "MOUNT" || payload.type == "GENERATE_DATA") {
            var log_cont = document.getElementById("load-data-logger");
            if (payload.msg.startsWith("Success")) {
                log_cont.insertAdjacentHTML('beforeend',
                    `<p>${payload.msg}</p>`);
            } else if (payload.msg.startsWith("Error")) {
                log_cont.insertAdjacentHTML('beforeend',
                    `<p>${payload.msg}</p>`);
            } else {
                log_cont.insertAdjacentHTML('beforeend',
                    `<p>${payload.msg}</p>`);
            }
        } else if (payload.type == "QC") {
            var log_cont = document.getElementById("qc-logger");
            if (payload.msg.startsWith("Success")) {
                log_cont.insertAdjacentHTML('beforeend',
                    `<p>${payload.msg}</p>`);
            } else if (payload.msg.startsWith("Error")) {
                log_cont.insertAdjacentHTML('beforeend',
                    `<p>${payload.msg}</p>`);
            } else {
                log_cont.insertAdjacentHTML('beforeend',
                    `<p>${payload.msg}</p>`);
            }
        }
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

        // logs/status
        var container = document.getElementById("load-data-status");
        container.querySelector("#load-data-notrun").style.display = "none";
        container.querySelector("#load-data-spinner").style.display = "block";

        // switch to log tab
        var tab = document.querySelector('#load-data-tabs button[data-bs-target="#load-data-logger"]');
        var ttab = new bootstrap.Tab(tab)
        ttab.show();
    });

    document.getElementById("mtx-generate-submit").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "GENERATE_DATA",
            "msg": []
        });
    });

    document.getElementById("qc-submit").addEventListener("click", (event) => {
        var val = document.getElementById("qc-nmads-input").value;
        if (!val) { val = 3; }
        window.app.worker.postMessage({
            "type": "QC",
            "input": [parseFloat(val)], // sums, detected & threshold 
            "msg": "not much to pass"
        });

        // logs/status
        var container = document.getElementById("qc-status");
        container.querySelector("#qc-notrun").style.display = "none";
        container.querySelector("#qc-spinner").style.display = "block";

        // switch to log tab
        var tab = document.querySelector('#qc-tabs button[data-bs-target="#qc-logger"]');
        var ttab = new bootstrap.Tab(tab)
        ttab.show();
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

        // logs/status
        var container = document.getElementById("fsel-status");
        container.querySelector("#fsel-notrun").style.display = "none";
        container.querySelector("#fsel-spinner").style.display = "block";

        // switch to log tab
        var tab = document.querySelector('#fsel-tabs button[data-bs-target="#fsel-logger"]');
        var ttab = new bootstrap.Tab(tab)
        ttab.show();
    });

    document.getElementById("pca-submit").addEventListener("click", (event) => {

        document.getElementById("tsne_charts").innerHTML = "";
        document.getElementById("cluster_charts").innerHTML = "";

        var val = document.getElementById("pcs-input").value;
        if (!val) { val = 5; }
        window.app.worker.postMessage({
            "type": "PCA",
            "input": [parseInt(val)],
            "msg": "not much to pass"
        });
    });

    document.getElementById("tsne-submit").addEventListener("click", (event) => {

        document.getElementById("tsne_charts").innerHTML = "";
        document.getElementById("cluster_charts").innerHTML = "";

        var iter = document.getElementById("tsne-input-iterations").value;
        var perp = document.getElementById("tsne-input-perplexity").value;

        if (!iter) { iter = 200; }
        if (!perp) { perp = 30; }
        window.app.worker.postMessage({
            "type": "TSNE",
            "input": [parseInt(perp), parseInt(iter)],
            "msg": "not much to pass"
        });
    });

    document.getElementById("cluster-submit").addEventListener("click", (event) => {

        document.getElementById("cluster_charts").innerHTML = "";

        window.app.worker.postMessage({
            "type": "CLUS",
            "msg": "not much to pass"
        });
    });
});
