// Parcel breaks postCSS, need to fix this
// TODO: update to parcel2 is the solution according
// to github issue, but parcel2 is not stable (currently alpha)
// wait for full version of parcel2 release instead.
// import "./styles.css";

import {scran} from "./scran.js";
// Easier for Development, but in the future use parcel
// import Module from "./target.js";

// Step1: Load Dataset, currently generates a random matrix
// TODO: this will be replaced by either 
// ----> load State() or 
// ----> load Data from input
function generateRandomData() {

    var obj = new scran([], 10, 10, {}, Module);

    // console.log(obj);

    window.scObj = obj;

    document.querySelector(".data-info").innerHTML = "generated a typed array of size " + window.scObj.data.vector.length;
}

// Step2: QC metrics
function performQC() {
    var instance =  window.scObj.getNumMatrix();
    window.scObj.QC();
}


// Again easy for development
// TODO: use parcel instead
window.generateRandomData = generateRandomData;
window.performQC = performQC;
