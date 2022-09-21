import * as utils from "../utils.js";

export function unpack_strings(buffer, lengths) {
    let dec = new TextDecoder();
    let names = [];
    let sofar = 0;
    for (const l of lengths) {
        let view = buffer.slice(sofar, sofar + l);
        names.push(dec.decode(view));
        sofar += l;
    }
    return names;
}

export function repack_strings(x) {
    let buffer;
    let lengths;

    for (const y of x) {
        if (!(typeof y == "string")) {
            throw new Error("all entries of 'x' should be strings for a string HDF5 dataset");
        }
    }

    try {
        lengths = utils.createInt32WasmArray(x.length);
        let lengths_arr = lengths.array();

        let total = 0;
        const enc = new TextEncoder;
        let contents = new Array(x.length);

        x.forEach((y, i) => {
            let e = enc.encode(y);
            lengths_arr[i] = e.length;
            contents[i] = e;
            total += e.length;
        });

        buffer = utils.createUint8WasmArray(total);
        let buffer_arr = buffer.array();
        total = 0;

        contents.forEach(y => {
            buffer_arr.set(y, total);
            total += y.length;
        });
    } catch (e) {
        utils.free(buffer);
        utils.free(lengths);
        throw e;
    }

    return [lengths, buffer];
}
