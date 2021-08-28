// import scran from '../scranjs/scran.js';

class App {

    constructor() {
        this.worker = new Worker(
            new URL("../scranjs/worker.js", import.meta.url),
        );

        this.qcBoxPlots = {};

        var self = this;

        this.worker.onmessage = function (msg) {
            // console.log(msg.data);
            const payload = msg.data;

            // logger
            self._logger(payload);
            // var log_cont = document.getElementById("logs");

            if (payload.type == "ODATA") {
                var output_cont = document.getElementById("load-data-output");
                output_cont.style.display = "block";
                // output_cont.insertAdjacentHTML('beforeend',
                //     `<p>${payload.msg}</p>`);

                var cont = document.getElementById("load-data-stats");
                cont.innerHTML = payload.resp;

            } else if (payload.type == "FDATA") {
                var output_cont = document.getElementById("qc-output");
                output_cont.style.display = "block";

                var cont = document.getElementById("qc-stats");
                cont.innerHTML = payload.resp;

                // document.getElementById("qc-data-btn").setAttribute("data-content", "✓");
            } else if (payload.type == "MOUNT" || payload.type == "GENERATE_DATA") {

                if (payload.msg.startsWith("Done")) {
                    //  switch to output tab
                    // var tab = document.querySelector('#load-data-tabs button[data-bs-target="#load-data-output"]');
                    // var ttab = new bootstrap.Tab(tab)
                    // ttab.show();

                    var container = document.getElementById("load-data-status");
                    container.querySelector("#load-data-notrun").style.display = "none";
                    container.querySelector("#load-data-spinner").style.display = "none";
                    container.querySelector("#load-data-success").style.display = "block";

                    // timer
                    document.getElementById("load-data-timer").style.display = "block";
                    document.getElementById("load-data-timer").innerHTML = payload.resp;

                    // show QC Step
                    // document.getElementById("qc-accordion").style.display = "block";
                }

            } else if (payload.type == "QC_RESP") {
                // "sums", "detected", "proportion"
                [].forEach(key => {
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
                    // var tab = document.querySelector('#qc-tabs button[data-bs-target="#qc-output"]');
                    // var ttab = new bootstrap.Tab(tab)
                    // ttab.show();

                    var container = document.getElementById("qc-status");
                    container.querySelector("#qc-notrun").style.display = "none";
                    container.querySelector("#qc-spinner").style.display = "none";
                    container.querySelector("#qc-success").style.display = "block";

                    // timer
                    document.getElementById("qc-timer").style.display = "block";
                    document.getElementById("qc-timer").innerHTML = payload.resp;

                    // show FSEL Step
                    // document.getElementById("fsel-accordion").style.display = "block";
                }
            } else if (payload.type == "FSEL_RESP") {
                const payload = msg.data;
                // var keys = ["genes", "means", "vars", "fitted", "resids"];
                // var isGene = false // payload.resp["genes"] != null;
                // var table = [];

                // for (var i = 0; i < 10; i++) {
                //     var tr = isGene ? `<td>${payload.resp["genes"][i]["gene"]}</td>` : `<td>Gene-${i}</td>`;
                //     tr += `<td>${payload.resp["means"][i]}</td><td>${payload.resp["vars"][i]}</td><td>${payload.resp["fitted"][i]}</td><td>${payload.resp["resids"][i]}</td>`
                //     table.push(`<tr>${tr}</tr>`);
                // }

                // var columns = isGene ? keys : keys.slice(1);
                // var clusterize = new Clusterize({
                //     rows: table,
                //     scrollId: 'scrollArea',
                //     contentId: 'contentArea'
                // });
            } else if (payload.type == "FEATURE_SELECTION") {
                if (payload.msg.startsWith("Done")) {
                    //  switch to output tab
                    // var tab = document.querySelector('#fsel-tabs button[data-bs-target="#fsel-output"]');
                    // var ttab = new bootstrap.Tab(tab)
                    // ttab.show();

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

                if (payload.msg.startsWith("Done")) {
                    //  switch to output tab
                    // var tab = document.querySelector('#qc-tabs button[data-bs-target="#qc-output"]');
                    // var ttab = new bootstrap.Tab(tab)
                    // ttab.show();

                    var container = document.getElementById("pca-status");
                    container.querySelector("#pca-notrun").style.display = "none";
                    container.querySelector("#pca-spinner").style.display = "none";
                    container.querySelector("#pca-success").style.display = "block";

                    // timer
                    document.getElementById("pca-timer").style.display = "block";
                    document.getElementById("pca-timer").innerHTML = payload.resp;

                    // show FSEL Step
                    // document.getElementById("fsel-accordion").style.display = "block";
                } else {
                    var x = [];
                    var key = "var_exp";
                    var cont = document.getElementById("pca_charts");
                    // cont.innerHTML = "";
                    if (cont.querySelector(`pca_${key}`)) {
                        cont.querySelector(`pca_${key}`).remove();
                    }
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
                        title: "% variance explained"
                    }

                    Plotly.newPlot(elem.id, data, layout);
                }
            } else if (payload.type == "TSNE") {

                // setTimeout(() => {
                const payload = msg.data;
                // console.log(payload);

                if (!self.cluster_mappings) {
                    self.cluster_mappings = Object.values(payload.resp["clusters"]);
                    self.cluster_count = Math.max(...self.cluster_mappings);
                    self.cluster_colors = randomColor({ luminosity: 'dark', count: self.cluster_count + 1 });
                    self.cluster_colors_gradients = [];
                    for (var i = 0; i < self.cluster_count + 1; i++) {
                        var gradient = new Rainbow();
                        gradient.setSpectrum("grey", self.cluster_colors[i]);
                        gradient.setNumberRange(0, self.tsne_cluster_iterations);
                        self.cluster_colors_gradients.push(gradient);
                    }
                }

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

                self.final_cluster_colors_array =
                    self.cluster_mappings.map(x => "#" + self.cluster_colors_gradients[x].colorAt(payload.resp["iteration"]));

                var iter = parseInt(payload.resp["iteration"]);
                var y0 = 400 / self.tsne_cluster_iterations;
                var y1 = Math.max(y0 * (self.tsne_cluster_iterations - iter), 1);

                if (!self.tsneViz) {
                    var cont = document.getElementById("tsne_charts");
                    cont.innerHTML = "";

                    var elem = document.createElement("div");
                    elem.class = ".tsne"
                    elem.style.width = "500px";
                    elem.style.height = "500px";
                    cont.appendChild(elem);

                    const visualization = new WebGLVis(elem);
                    visualization.addToDom();
                    visualization.setSpecification({
                        defaultData: {
                            "tsne1": tsne1,
                            "tsne2": tsne2,
                            "sample": sample,
                            "colors": self.final_cluster_colors_array
                        },
                        "labels": [
                            {
                                "y": y1,
                                "x": 0,
                                "text": "Iteration " + iter,
                                "fixedX": true
                            }
                        ],
                        xAxis: 'none',
                        yAxis: 'none',
                        tracks: [
                            {
                                "mark": "point",
                                "x": {
                                    "attribute": "tsne1",
                                    "type": "quantitative",
                                    "domain": [Math.min(...tsne1), Math.max(...tsne1)]
                                },
                                "y": {
                                    "attribute": "tsne2",
                                    "type": "quantitative",
                                    "domain": [Math.min(...tsne2), Math.max(...tsne2)]
                                },
                                "color": {
                                    // "value": "blue",
                                    "attribute": "colors",
                                    "type": "inline"
                                },
                                "size": { "value": 2 },
                                "opacity": { "value": 0.65 }
                            },
                        ],
                    });

                    self.tsneViz = visualization;
                } else {
                    self.tsneViz.setSpecification({
                        defaultData: {
                            "tsne1": tsne1,
                            "tsne2": tsne2,
                            "sample": sample,
                            "colors": self.final_cluster_colors_array
                        },
                        "labels": [
                            {
                                "y": y1,
                                "x": 0,
                                "text": "Iteration " + payload.resp["iteration"],
                                "fixedX": true
                            }
                        ],
                        xAxis: 'none',
                        yAxis: 'none',
                        tracks: [
                            {
                                "mark": "point",
                                "x": {
                                    "attribute": "tsne1",
                                    "type": "quantitative",
                                    "domain": [Math.min(...tsne1), Math.max(...tsne1)]
                                },
                                "y": {
                                    "attribute": "tsne2",
                                    "type": "quantitative",
                                    "domain": [Math.min(...tsne2), Math.max(...tsne2)]
                                },
                                "color": {
                                    // "value": "blue",
                                    "attribute": "colors",
                                    "type": "inline"
                                },
                                "size": { "value": 2 },
                                "opacity": { "value": 0.65 }
                            },
                        ],
                    });
                }

                // }, 10000);
            } else if (payload.type == "CLUS") {

                const payload = msg.data;
                var x = {};
                var key = "clusters";
                var cont = document.getElementById("clus_charts");

                // var elem2 = document.createElement("div");
                // elem2.style.width = "450px";
                // elem2.style.height = "450px";
                // cont.appendChild(elem2);

                // var tsne1 = [], tsne2 = [];
                // var payload_vals = Object.values(payload.resp["tsne"]);
                // var min = 1000, max = -1000;
                // for (var i = 0; i < payload_vals.length; i++) {
                //     if (i % 2 == 0) {
                //         tsne1.push(payload_vals[i]);
                //     }
                //     else {
                //         tsne2.push(payload_vals[i]);
                //         // sample.push("sample");
                //     }
                // }

                // var samples = Object.values(payload.resp["clusters"]);

                // const visualization = new WebGLVis(elem2);
                // visualization.addToDom();
                // visualization.setSchema({
                //     defaultData: {
                //         "tsne1": tsne1,
                //         "tsne2": tsne2,
                //         "sample": samples
                //     },
                //     xAxis: 'none',
                //     yAxis: 'none',
                //     tracks: [
                //         {
                //             "mark": "point",
                //             "x": {
                //                 "attribute": "tsne1",
                //                 "type": "quantitative",
                //                 "domain": [Math.min(...tsne1), Math.max(...tsne1)]
                //             },
                //             "y": {
                //                 "attribute": "tsne2",
                //                 "type": "quantitative",
                //                 "domain": [Math.min(...tsne2), Math.max(...tsne2)]
                //             },
                //             "color": {
                //                 "attribute": "sample",
                //                 "type": "categorical",
                //                 "cardinality": Math.max(...samples),
                //                 "colorScheme": "interpolateRainbow"
                //             },
                //             "size": { "value": 2 },
                //             "opacity": { "value": 1 }
                //         },
                //     ],
                // });


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


            }
        }

        this.worker.postMessage({
            "type": "LOAD",
            "msg": "Initial Load"
        });

        var self = this;
    }

    _logger(payload) {
        var log_cont = null;
        if (payload.type == "MOUNT" || payload.type == "GENERATE_DATA") {
            log_cont = document.getElementById("load-data-logger");
        } else if (payload.type == "QC") {
            log_cont = document.getElementById("qc-logger");
        } else if (payload.type == "FSEL") {
            log_cont = document.getElementById("fsel-logger");
        } else if (payload.type == "PCA") {
            log_cont = document.getElementById("pca-logger");
        } else if (payload.type == "TSNE") {
            log_cont = document.getElementById("tsne-logger");
        }

        if (log_cont) {
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
        // var tab = document.querySelector('#load-data-tabs button[data-bs-target="#load-data-logger"]');
        // var ttab = new bootstrap.Tab(tab)
        // ttab.show();
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
        // var tab = document.querySelector('#qc-tabs button[data-bs-target="#qc-logger"]');
        // var ttab = new bootstrap.Tab(tab)
        // ttab.show();
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

        // // switch to log tab
        // var tab = document.querySelector('#fsel-tabs button[data-bs-target="#fsel-logger"]');
        // var ttab = new bootstrap.Tab(tab)
        // ttab.show();
    });

    document.getElementById("pca-submit").addEventListener("click", (event) => {

        document.getElementById("tsne_charts").innerHTML = "";
        document.getElementById("clus_charts").innerHTML = "";

        var val = document.getElementById("pca-npc-input").value;
        if (!val) { val = 5; }
        window.app.worker.postMessage({
            "type": "PCA",
            "input": [parseInt(val)],
            "msg": "not much to pass"
        });
    });

    document.getElementById("clus-submit").addEventListener("click", (event) => {
        document.getElementById("clus_charts").innerHTML = "";

        var k = document.getElementById("clus-k-input").value;
        var res = document.getElementById("clus-res-input").value;

        if (!k) { k = 10; }
        if (!res) { res = 0.5; }

        window.app.worker.postMessage({
            "type": "CLUS",
            "input": [parseInt(k), parseInt(res)],
            "msg": "not much to pass"
        });
    });

    document.getElementById("tsne-submit").addEventListener("click", (event) => {

        document.getElementById("tsne_charts").innerHTML = "";
        window.app.tsneViz = null;

        var iter = document.getElementById("tsne-input-iter").value;
        var perp = document.getElementById("tsne-input-perp").value;

        if (!iter) { iter = 200; }
        if (!perp) { perp = 30; }

        window.app.tsne_cluster_iterations = parseInt(iter);
        window.app.worker.postMessage({
            "type": "TSNE",
            "input": [parseInt(perp), parseInt(iter)],
            "msg": "not much to pass"
        });
    });

    document.getElementById("mg-submit").addEventListener("click", (event) => {
        window.app.worker.postMessage({
            "type": "MARKER_GENE",
            "msg": "not much to pass"
        });
    });
});
