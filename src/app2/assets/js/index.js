
class App {
    constructor() {

        var self = this;

        self.qcBoxPlots = {};
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
            if (!val) { val = 500; }
            app_params["tsne"]["tsne-iter"] = parseFloat(val);
            self.tsne_cluster_iterations = parseFloat(val);

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
            // console.log(msg);

            const payload = msg.data;

            // TODO: logger in a central place
            // self._logger(payload);

            if (payload.type == "load_DIMS") {

                var cont = document.getElementById("load-data-stats");
                cont.innerHTML = payload.resp;

            } else if (payload.type == "qc_DIMS") {

                var cont = document.getElementById("load-data-qc-stats");
                cont.innerHTML = payload.resp;

            } else if (payload.type == "qc_DATA") {
                // 
                ["sums", "detected", "proportion"].forEach(key => {
                    var cont = document.getElementById("qc_charts");
                    const eid = `qc_${key}`;
                    var threshold = payload.resp["thresholds"][key];
                    var vec = Object.values(payload.resp[key]);

                    if (key != "proportion") {
                        // vec = vec.map((m) => Math.log2(m + 1));
                        // threshold = Math.log2(threshold + 1)
                    } else {
                        threshold = Math.min([threshold, 100]);
                    }

                    if (!cont.querySelector("#" + eid)) {
                        var elem = document.createElement("div");
                        elem.id = eid;
                        // elem.className = "uk-width-auto";
                        cont.appendChild(elem);

                        var plot = new boxPlot(elem, elem.id, {});
                        plot.threshold = threshold;

                        self.qcBoxPlots[eid] = plot;

                        elem.addEventListener("threshold", (e) => {
                            window.app.worker.postMessage({
                                "type": "setQCThresholds",
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
                            "x": key != "proportion" ? "log-" + key : key,
                            "range": payload.resp["ranges"][key]
                        };

                        var xlabel = key;
                        plot.draw(pData, "", 'x', 'y', threshold, xlabel);
                    }
                });
            } else if (payload.type == "fSelection_DATA") {
                const payload = msg.data;
                var keys = ["genes", "means", "vars", "fitted", "resids"];
                var isGene = false // payload.resp["genes"] != null;
                var table = [];

                for (var i = 0; i < 10; i++) {
                    var tr = isGene ? `<td>${payload.resp["genes"][i]["gene"]}</td>` : `<td>Gene-${i}</td>`;
                    tr += `<td>${payload.resp["means"][i]}</td><td>${payload.resp["vars"][i]}</td><td>${payload.resp["fitted"][i]}</td><td>${payload.resp["resids"][i]}</td>`
                    table.push(`<tr>${tr}</tr>`);
                }

                var columns = isGene ? keys : keys.slice(1);
                var clusterize = new Clusterize({
                    rows: table,
                    scrollId: 'scrollArea',
                    contentId: 'contentArea'
                });
            } else if (payload.type == "pca_DATA") {

                const payload = msg.data;
                var x = [];
                var key = "var_exp";
                var cont = document.getElementById("pca_charts");
                cont.innerHTML = "";
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
            } else if (payload.type == "tsne_DATA" || payload.type == "tsne_iter") {
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
                // var payload_vals = Object.values(payload.resp["tsne"]);
                var tsne1 = Object.values(payload.resp["tsne1"]);
                var tsne2 = Object.values(payload.resp["tsne2"]);

                self.final_cluster_colors_array =
                    self.cluster_mappings.map(x => "#" + self.cluster_colors_gradients[x].colorAt(payload.resp["iteration"]));

                var iter = parseInt(payload.resp["iteration"]);
                var y0 = 400 / self.tsne_cluster_iterations;
                var y1 = -1.43; // Math.max(y0 * (self.tsne_cluster_iterations - iter), 2);

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
                            // "sample": sample,
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
                            // "sample": sample,
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

            } else if (payload.type == "cluster_DATA") {
                const payload = msg.data;
                var x = {};
                var key = "clusters";
                var cont = document.getElementById("clus_charts");

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

                self._cluster_size = Object.keys(x).length;
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
            } else if (payload.type == "markerGene_DATA") {
                var container = document.getElementById("mg_charts");
                container.style.display = "block";

                var selectCont = document.getElementById("mg_clus_selection");
                var select = document.createElement("select");
                select.id = "md-cluster-select";

                for (var i = 0; i < self._cluster_size; i++) {
                    var option = document.createElement("option");
                    option.value = i;
                    // if (i==0) {
                    //     option.selected = "selected";
                    // }
                    option.text = "CLUS_" + i;
                    select.add(option);
                }

                selectCont.appendChild(select);

                select.addEventListener('change', (event) => {
                    const cluster = event.target.value;

                    self.worker.postMessage({
                        "type": "getMarkersForCluster",
                        "input": [parseInt(cluster)],
                        "msg": "not much to pass"
                    });
                });
            } else if (payload.type == "setMarkersForCluster") {

                var cont = document.getElementById("mg_top_markers");
                cont.innerHTML = "";
                // console.log(payload.msg);

                var text = payload.resp["cohen"].map(x => "GENE_" + x).join(" , ");
                cont.innerHTML = "Top Markers : " + text;

            }

        }

        // need to send an INIT 
        // to the worker thread
        self.worker.postMessage({
            "type": "INIT",
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
