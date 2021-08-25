import { a as SIZE_UNITS, t as transformGenomicRangeArcToStandard, b as transformGenomicRangeToStandard, S as SchemaProcessor } from './schema-processor-02fdb272.js';
import { b as getViewportForSchema } from './utilities-b398dcce.js';

class FlatQueue {

    constructor() {
        this.ids = [];
        this.values = [];
        this.length = 0;
    }

    clear() {
        this.length = 0;
    }

    push(id, value) {
        let pos = this.length++;
        this.ids[pos] = id;
        this.values[pos] = value;

        while (pos > 0) {
            const parent = (pos - 1) >> 1;
            const parentValue = this.values[parent];
            if (value >= parentValue) break;
            this.ids[pos] = this.ids[parent];
            this.values[pos] = parentValue;
            pos = parent;
        }

        this.ids[pos] = id;
        this.values[pos] = value;
    }

    pop() {
        if (this.length === 0) return undefined;

        const top = this.ids[0];
        this.length--;

        if (this.length > 0) {
            const id = this.ids[0] = this.ids[this.length];
            const value = this.values[0] = this.values[this.length];
            const halfLength = this.length >> 1;
            let pos = 0;

            while (pos < halfLength) {
                let left = (pos << 1) + 1;
                const right = left + 1;
                let bestIndex = this.ids[left];
                let bestValue = this.values[left];
                const rightValue = this.values[right];

                if (right < this.length && rightValue < bestValue) {
                    left = right;
                    bestIndex = this.ids[right];
                    bestValue = rightValue;
                }
                if (bestValue >= value) break;

                this.ids[pos] = bestIndex;
                this.values[pos] = bestValue;
                pos = left;
            }

            this.ids[pos] = id;
            this.values[pos] = value;
        }

        return top;
    }

    peek() {
        if (this.length === 0) return undefined;
        return this.ids[0];
    }

    peekValue() {
        if (this.length === 0) return undefined;
        return this.values[0];
    }
}

const ARRAY_TYPES = [
    Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
    Int32Array, Uint32Array, Float32Array, Float64Array
];

const VERSION = 3; // serialized format version

class Flatbush {

    static from(data) {
        if (!(data instanceof ArrayBuffer)) {
            throw new Error('Data must be an instance of ArrayBuffer.');
        }
        const [magic, versionAndType] = new Uint8Array(data, 0, 2);
        if (magic !== 0xfb) {
            throw new Error('Data does not appear to be in a Flatbush format.');
        }
        if (versionAndType >> 4 !== VERSION) {
            throw new Error(`Got v${versionAndType >> 4} data when expected v${VERSION}.`);
        }
        const [nodeSize] = new Uint16Array(data, 2, 1);
        const [numItems] = new Uint32Array(data, 4, 1);

        return new Flatbush(numItems, nodeSize, ARRAY_TYPES[versionAndType & 0x0f], data);
    }

    constructor(numItems, nodeSize = 16, ArrayType = Float64Array, data) {
        if (numItems === undefined) throw new Error('Missing required argument: numItems.');
        if (isNaN(numItems) || numItems <= 0) throw new Error(`Unpexpected numItems value: ${numItems}.`);

        this.numItems = +numItems;
        this.nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);

        // calculate the total number of nodes in the R-tree to allocate space for
        // and the index of each tree level (used in search later)
        let n = numItems;
        let numNodes = n;
        this._levelBounds = [n * 4];
        do {
            n = Math.ceil(n / this.nodeSize);
            numNodes += n;
            this._levelBounds.push(numNodes * 4);
        } while (n !== 1);

        this.ArrayType = ArrayType || Float64Array;
        this.IndexArrayType = numNodes < 16384 ? Uint16Array : Uint32Array;

        const arrayTypeIndex = ARRAY_TYPES.indexOf(this.ArrayType);
        const nodesByteSize = numNodes * 4 * this.ArrayType.BYTES_PER_ELEMENT;

        if (arrayTypeIndex < 0) {
            throw new Error(`Unexpected typed array class: ${ArrayType}.`);
        }

        if (data && (data instanceof ArrayBuffer)) {
            this.data = data;
            this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
            this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);

            this._pos = numNodes * 4;
            this.minX = this._boxes[this._pos - 4];
            this.minY = this._boxes[this._pos - 3];
            this.maxX = this._boxes[this._pos - 2];
            this.maxY = this._boxes[this._pos - 1];

        } else {
            this.data = new ArrayBuffer(8 + nodesByteSize + numNodes * this.IndexArrayType.BYTES_PER_ELEMENT);
            this._boxes = new this.ArrayType(this.data, 8, numNodes * 4);
            this._indices = new this.IndexArrayType(this.data, 8 + nodesByteSize, numNodes);
            this._pos = 0;
            this.minX = Infinity;
            this.minY = Infinity;
            this.maxX = -Infinity;
            this.maxY = -Infinity;

            new Uint8Array(this.data, 0, 2).set([0xfb, (VERSION << 4) + arrayTypeIndex]);
            new Uint16Array(this.data, 2, 1)[0] = nodeSize;
            new Uint32Array(this.data, 4, 1)[0] = numItems;
        }

        // a priority queue for k-nearest-neighbors queries
        this._queue = new FlatQueue();
    }

    add(minX, minY, maxX, maxY) {
        const index = this._pos >> 2;
        this._indices[index] = index;
        this._boxes[this._pos++] = minX;
        this._boxes[this._pos++] = minY;
        this._boxes[this._pos++] = maxX;
        this._boxes[this._pos++] = maxY;

        if (minX < this.minX) this.minX = minX;
        if (minY < this.minY) this.minY = minY;
        if (maxX > this.maxX) this.maxX = maxX;
        if (maxY > this.maxY) this.maxY = maxY;

        return index;
    }

    finish() {
        if (this._pos >> 2 !== this.numItems) {
            throw new Error(`Added ${this._pos >> 2} items when expected ${this.numItems}.`);
        }

        if (this.numItems <= this.nodeSize) {
            // only one node, skip sorting and just fill the root box
            this._boxes[this._pos++] = this.minX;
            this._boxes[this._pos++] = this.minY;
            this._boxes[this._pos++] = this.maxX;
            this._boxes[this._pos++] = this.maxY;
            return;
        }

        const width = this.maxX - this.minX;
        const height = this.maxY - this.minY;
        const hilbertValues = new Uint32Array(this.numItems);
        const hilbertMax = (1 << 16) - 1;

        // map item centers into Hilbert coordinate space and calculate Hilbert values
        for (let i = 0; i < this.numItems; i++) {
            let pos = 4 * i;
            const minX = this._boxes[pos++];
            const minY = this._boxes[pos++];
            const maxX = this._boxes[pos++];
            const maxY = this._boxes[pos++];
            const x = Math.floor(hilbertMax * ((minX + maxX) / 2 - this.minX) / width);
            const y = Math.floor(hilbertMax * ((minY + maxY) / 2 - this.minY) / height);
            hilbertValues[i] = hilbert(x, y);
        }

        // sort items by their Hilbert value (for packing later)
        sort(hilbertValues, this._boxes, this._indices, 0, this.numItems - 1, this.nodeSize);

        // generate nodes at each tree level, bottom-up
        for (let i = 0, pos = 0; i < this._levelBounds.length - 1; i++) {
            const end = this._levelBounds[i];

            // generate a parent node for each block of consecutive <nodeSize> nodes
            while (pos < end) {
                const nodeIndex = pos;

                // calculate bbox for the new node
                let nodeMinX = Infinity;
                let nodeMinY = Infinity;
                let nodeMaxX = -Infinity;
                let nodeMaxY = -Infinity;
                for (let i = 0; i < this.nodeSize && pos < end; i++) {
                    nodeMinX = Math.min(nodeMinX, this._boxes[pos++]);
                    nodeMinY = Math.min(nodeMinY, this._boxes[pos++]);
                    nodeMaxX = Math.max(nodeMaxX, this._boxes[pos++]);
                    nodeMaxY = Math.max(nodeMaxY, this._boxes[pos++]);
                }

                // add the new node to the tree data
                this._indices[this._pos >> 2] = nodeIndex;
                this._boxes[this._pos++] = nodeMinX;
                this._boxes[this._pos++] = nodeMinY;
                this._boxes[this._pos++] = nodeMaxX;
                this._boxes[this._pos++] = nodeMaxY;
            }
        }
    }

    search(minX, minY, maxX, maxY, filterFn) {
        if (this._pos !== this._boxes.length) {
            throw new Error('Data not yet indexed - call index.finish().');
        }

        let nodeIndex = this._boxes.length - 4;
        const queue = [];
        const results = [];

        while (nodeIndex !== undefined) {
            // find the end index of the node
            const end = Math.min(nodeIndex + this.nodeSize * 4, upperBound(nodeIndex, this._levelBounds));

            // search through child nodes
            for (let pos = nodeIndex; pos < end; pos += 4) {
                const index = this._indices[pos >> 2] | 0;

                // check if node bbox intersects with query bbox
                if (maxX < this._boxes[pos]) continue; // maxX < nodeMinX
                if (maxY < this._boxes[pos + 1]) continue; // maxY < nodeMinY
                if (minX > this._boxes[pos + 2]) continue; // minX > nodeMaxX
                if (minY > this._boxes[pos + 3]) continue; // minY > nodeMaxY

                if (nodeIndex < this.numItems * 4) {
                    if (filterFn === undefined || filterFn(index)) {
                        results.push(index); // leaf item
                    }

                } else {
                    queue.push(index); // node; add it to the search queue
                }
            }

            nodeIndex = queue.pop();
        }

        return results;
    }

    neighbors(x, y, maxResults = Infinity, maxDistance = Infinity, filterFn) {
        if (this._pos !== this._boxes.length) {
            throw new Error('Data not yet indexed - call index.finish().');
        }

        let nodeIndex = this._boxes.length - 4;
        const q = this._queue;
        const results = [];
        const maxDistSquared = maxDistance * maxDistance;

        while (nodeIndex !== undefined) {
            // find the end index of the node
            const end = Math.min(nodeIndex + this.nodeSize * 4, upperBound(nodeIndex, this._levelBounds));

            // add child nodes to the queue
            for (let pos = nodeIndex; pos < end; pos += 4) {
                const index = this._indices[pos >> 2] | 0;

                const dx = axisDist(x, this._boxes[pos], this._boxes[pos + 2]);
                const dy = axisDist(y, this._boxes[pos + 1], this._boxes[pos + 3]);
                const dist = dx * dx + dy * dy;

                if (nodeIndex < this.numItems * 4) { // leaf node
                    if (filterFn === undefined || filterFn(index)) {
                        // put a negative index if it's an item rather than a node, to recognize later
                        q.push(-index - 1, dist);
                    }
                } else {
                    q.push(index, dist);
                }
            }

            // pop items from the queue
            while (q.length && q.peek() < 0) {
                const dist = q.peekValue();
                if (dist > maxDistSquared) {
                    q.clear();
                    return results;
                }
                results.push(-q.pop() - 1);

                if (results.length === maxResults) {
                    q.clear();
                    return results;
                }
            }

            nodeIndex = q.pop();
        }

        q.clear();
        return results;
    }
}

function axisDist(k, min, max) {
    return k < min ? min - k : k <= max ? 0 : k - max;
}

// binary search for the first value in the array bigger than the given
function upperBound(value, arr) {
    let i = 0;
    let j = arr.length - 1;
    while (i < j) {
        const m = (i + j) >> 1;
        if (arr[m] > value) {
            j = m;
        } else {
            i = m + 1;
        }
    }
    return arr[i];
}

// custom quicksort that partially sorts bbox data alongside the hilbert values
function sort(values, boxes, indices, left, right, nodeSize) {
    if (Math.floor(left / nodeSize) >= Math.floor(right / nodeSize)) return;

    const pivot = values[(left + right) >> 1];
    let i = left - 1;
    let j = right + 1;

    while (true) {
        do i++; while (values[i] < pivot);
        do j--; while (values[j] > pivot);
        if (i >= j) break;
        swap(values, boxes, indices, i, j);
    }

    sort(values, boxes, indices, left, j, nodeSize);
    sort(values, boxes, indices, j + 1, right, nodeSize);
}

// swap two values and two corresponding boxes
function swap(values, boxes, indices, i, j) {
    const temp = values[i];
    values[i] = values[j];
    values[j] = temp;

    const k = 4 * i;
    const m = 4 * j;

    const a = boxes[k];
    const b = boxes[k + 1];
    const c = boxes[k + 2];
    const d = boxes[k + 3];
    boxes[k] = boxes[m];
    boxes[k + 1] = boxes[m + 1];
    boxes[k + 2] = boxes[m + 2];
    boxes[k + 3] = boxes[m + 3];
    boxes[m] = a;
    boxes[m + 1] = b;
    boxes[m + 2] = c;
    boxes[m + 3] = d;

    const e = indices[i];
    indices[i] = indices[j];
    indices[j] = e;
}

// Fast Hilbert curve algorithm by http://threadlocalmutex.com/
// Ported from C++ https://github.com/rawrunprotected/hilbert_curves (public domain)
function hilbert(x, y) {
    let a = x ^ y;
    let b = 0xFFFF ^ a;
    let c = 0xFFFF ^ (x | y);
    let d = x & (y ^ 0xFFFF);

    let A = a | (b >> 1);
    let B = (a >> 1) ^ a;
    let C = ((c >> 1) ^ (b & (d >> 1))) ^ c;
    let D = ((a & (c >> 1)) ^ (d >> 1)) ^ d;

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 2)) ^ (b & (b >> 2)));
    B = ((a & (b >> 2)) ^ (b & ((a ^ b) >> 2)));
    C ^= ((a & (c >> 2)) ^ (b & (d >> 2)));
    D ^= ((b & (c >> 2)) ^ ((a ^ b) & (d >> 2)));

    a = A; b = B; c = C; d = D;
    A = ((a & (a >> 4)) ^ (b & (b >> 4)));
    B = ((a & (b >> 4)) ^ (b & ((a ^ b) >> 4)));
    C ^= ((a & (c >> 4)) ^ (b & (d >> 4)));
    D ^= ((b & (c >> 4)) ^ ((a ^ b) & (d >> 4)));

    a = A; b = B; c = C; d = D;
    C ^= ((a & (c >> 8)) ^ (b & (d >> 8)));
    D ^= ((b & (c >> 8)) ^ ((a ^ b) & (d >> 8)));

    a = C ^ (C >> 1);
    b = D ^ (D >> 1);

    let i0 = x ^ y;
    let i1 = b | (0xFFFF ^ (i0 | a));

    i0 = (i0 | (i0 << 8)) & 0x00FF00FF;
    i0 = (i0 | (i0 << 4)) & 0x0F0F0F0F;
    i0 = (i0 | (i0 << 2)) & 0x33333333;
    i0 = (i0 | (i0 << 1)) & 0x55555555;

    i1 = (i1 | (i1 << 8)) & 0x00FF00FF;
    i1 = (i1 | (i1 << 4)) & 0x0F0F0F0F;
    i1 = (i1 | (i1 << 2)) & 0x33333333;
    i1 = (i1 | (i1 << 1)) & 0x55555555;

    return ((i1 << 1) | i0) >>> 0;
}

/**
 * @module helpers
 */
/**
 * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
 *
 * @name feature
 * @param {Geometry} geometry input geometry
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature} a GeoJSON Feature
 * @example
 * var geometry = {
 *   "type": "Point",
 *   "coordinates": [110, 50]
 * };
 *
 * var feature = turf.feature(geometry);
 *
 * //=feature
 */
function feature(geom, properties, options) {
    if (options === void 0) { options = {}; }
    var feat = { type: "Feature" };
    if (options.id === 0 || options.id) {
        feat.id = options.id;
    }
    if (options.bbox) {
        feat.bbox = options.bbox;
    }
    feat.properties = properties || {};
    feat.geometry = geom;
    return feat;
}
/**
 * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
 *
 * @name polygon
 * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
 * @param {Object} [properties={}] an Object of key-value pairs to add as properties
 * @param {Object} [options={}] Optional Parameters
 * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
 * @param {string|number} [options.id] Identifier associated with the Feature
 * @returns {Feature<Polygon>} Polygon Feature
 * @example
 * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
 *
 * //=polygon
 */
function polygon(coordinates, properties, options) {
    if (options === void 0) { options = {}; }
    for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
        var ring = coordinates_1[_i];
        if (ring.length < 4) {
            throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
        }
        for (var j = 0; j < ring[ring.length - 1].length; j++) {
            // Check if first point of Polygon contains two numbers
            if (ring[ring.length - 1][j] !== ring[0][j]) {
                throw new Error("First and last Position are not equivalent.");
            }
        }
    }
    var geom = {
        type: "Polygon",
        coordinates: coordinates,
    };
    return feature(geom, properties, options);
}
/**
 * isObject
 *
 * @param {*} input variable to validate
 * @returns {boolean} true/false
 * @example
 * turf.isObject({elevation: 10})
 * //=true
 * turf.isObject('foo')
 * //=false
 */
function isObject(input) {
    return !!input && input.constructor === Object;
}

/**
 * Unwrap a coordinate from a Point Feature, Geometry or a single coordinate.
 *
 * @name getCoord
 * @param {Array<number>|Geometry<Point>|Feature<Point>} coord GeoJSON Point or an Array of numbers
 * @returns {Array<number>} coordinates
 * @example
 * var pt = turf.point([10, 10]);
 *
 * var coord = turf.getCoord(pt);
 * //= [10, 10]
 */
function getCoord(coord) {
    if (!coord) {
        throw new Error("coord is required");
    }
    if (!Array.isArray(coord)) {
        if (coord.type === "Feature" &&
            coord.geometry !== null &&
            coord.geometry.type === "Point") {
            return coord.geometry.coordinates;
        }
        if (coord.type === "Point") {
            return coord.coordinates;
        }
    }
    if (Array.isArray(coord) &&
        coord.length >= 2 &&
        !Array.isArray(coord[0]) &&
        !Array.isArray(coord[1])) {
        return coord;
    }
    throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
/**
 * Unwrap coordinates from a Feature, Geometry Object or an Array
 *
 * @name getCoords
 * @param {Array<any>|Geometry|Feature} coords Feature, Geometry Object or an Array
 * @returns {Array<any>} coordinates
 * @example
 * var poly = turf.polygon([[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]);
 *
 * var coords = turf.getCoords(poly);
 * //= [[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]
 */
function getCoords(coords) {
    if (Array.isArray(coords)) {
        return coords;
    }
    // Feature
    if (coords.type === "Feature") {
        if (coords.geometry !== null) {
            return coords.geometry.coordinates;
        }
    }
    else {
        // Geometry
        if (coords.coordinates) {
            return coords.coordinates;
        }
    }
    throw new Error("coords must be GeoJSON Feature, Geometry Object or an Array");
}
/**
 * Get Geometry from Feature or Geometry Object
 *
 * @param {Feature|Geometry} geojson GeoJSON Feature or Geometry Object
 * @returns {Geometry|null} GeoJSON Geometry Object
 * @throws {Error} if geojson is not a Feature or Geometry Object
 * @example
 * var point = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [110, 40]
 *   }
 * }
 * var geom = turf.getGeom(point)
 * //={"type": "Point", "coordinates": [110, 40]}
 */
function getGeom(geojson) {
    if (geojson.type === "Feature") {
        return geojson.geometry;
    }
    return geojson;
}
/**
 * Get GeoJSON object's type, Geometry type is prioritize.
 *
 * @param {GeoJSON} geojson GeoJSON object
 * @param {string} [name="geojson"] name of the variable to display in error message (unused)
 * @returns {string} GeoJSON type
 * @example
 * var point = {
 *   "type": "Feature",
 *   "properties": {},
 *   "geometry": {
 *     "type": "Point",
 *     "coordinates": [110, 40]
 *   }
 * }
 * var geom = turf.getType(point)
 * //="Point"
 */
function getType(geojson, _name) {
    if (geojson.type === "FeatureCollection") {
        return "FeatureCollection";
    }
    if (geojson.type === "GeometryCollection") {
        return "GeometryCollection";
    }
    if (geojson.type === "Feature" && geojson.geometry !== null) {
        return geojson.geometry.type;
    }
    return geojson.type;
}

// http://en.wikipedia.org/wiki/Even%E2%80%93odd_rule
// modified from: https://github.com/substack/point-in-polygon/blob/master/index.js
// which was modified from http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
/**
 * Takes a {@link Point} and a {@link Polygon} or {@link MultiPolygon} and determines if the point
 * resides inside the polygon. The polygon can be convex or concave. The function accounts for holes.
 *
 * @name booleanPointInPolygon
 * @param {Coord} point input point
 * @param {Feature<Polygon|MultiPolygon>} polygon input polygon or multipolygon
 * @param {Object} [options={}] Optional parameters
 * @param {boolean} [options.ignoreBoundary=false] True if polygon boundary should be ignored when determining if
 * the point is inside the polygon otherwise false.
 * @returns {boolean} `true` if the Point is inside the Polygon; `false` if the Point is not inside the Polygon
 * @example
 * var pt = turf.point([-77, 44]);
 * var poly = turf.polygon([[
 *   [-81, 41],
 *   [-81, 47],
 *   [-72, 47],
 *   [-72, 41],
 *   [-81, 41]
 * ]]);
 *
 * turf.booleanPointInPolygon(pt, poly);
 * //= true
 */
function booleanPointInPolygon(point, polygon, options) {
    if (options === void 0) { options = {}; }
    // validation
    if (!point) {
        throw new Error("point is required");
    }
    if (!polygon) {
        throw new Error("polygon is required");
    }
    var pt = getCoord(point);
    var geom = getGeom(polygon);
    var type = geom.type;
    var bbox = polygon.bbox;
    var polys = geom.coordinates;
    // Quick elimination if point is not inside bbox
    if (bbox && inBBox(pt, bbox) === false) {
        return false;
    }
    // normalize to multipolygon
    if (type === "Polygon") {
        polys = [polys];
    }
    var insidePoly = false;
    for (var i = 0; i < polys.length && !insidePoly; i++) {
        // check if it is in the outer ring first
        if (inRing(pt, polys[i][0], options.ignoreBoundary)) {
            var inHole = false;
            var k = 1;
            // check for the point in any of the holes
            while (k < polys[i].length && !inHole) {
                if (inRing(pt, polys[i][k], !options.ignoreBoundary)) {
                    inHole = true;
                }
                k++;
            }
            if (!inHole) {
                insidePoly = true;
            }
        }
    }
    return insidePoly;
}
/**
 * inRing
 *
 * @private
 * @param {Array<number>} pt [x,y]
 * @param {Array<Array<number>>} ring [[x,y], [x,y],..]
 * @param {boolean} ignoreBoundary ignoreBoundary
 * @returns {boolean} inRing
 */
function inRing(pt, ring, ignoreBoundary) {
    var isInside = false;
    if (ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1]) {
        ring = ring.slice(0, ring.length - 1);
    }
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0];
        var yi = ring[i][1];
        var xj = ring[j][0];
        var yj = ring[j][1];
        var onBoundary = pt[1] * (xi - xj) + yi * (xj - pt[0]) + yj * (pt[0] - xi) === 0 &&
            (xi - pt[0]) * (xj - pt[0]) <= 0 &&
            (yi - pt[1]) * (yj - pt[1]) <= 0;
        if (onBoundary) {
            return !ignoreBoundary;
        }
        var intersect = yi > pt[1] !== yj > pt[1] &&
            pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
        if (intersect) {
            isInside = !isInside;
        }
    }
    return isInside;
}
/**
 * inBBox
 *
 * @private
 * @param {Position} pt point [x,y]
 * @param {BBox} bbox BBox [west, south, east, north]
 * @returns {boolean} true/false if point is inside BBox
 */
function inBBox(pt, bbox) {
    return (bbox[0] <= pt[0] && bbox[1] <= pt[1] && bbox[2] >= pt[0] && bbox[3] >= pt[1]);
}

// To-Do => Improve Typescript GeoJSON handling
/**
 * Removes redundant coordinates from any GeoJSON Geometry.
 *
 * @name cleanCoords
 * @param {Geometry|Feature} geojson Feature or Geometry
 * @param {Object} [options={}] Optional parameters
 * @param {boolean} [options.mutate=false] allows GeoJSON input to be mutated
 * @returns {Geometry|Feature} the cleaned input Feature/Geometry
 * @example
 * var line = turf.lineString([[0, 0], [0, 2], [0, 5], [0, 8], [0, 8], [0, 10]]);
 * var multiPoint = turf.multiPoint([[0, 0], [0, 0], [2, 2]]);
 *
 * turf.cleanCoords(line).geometry.coordinates;
 * //= [[0, 0], [0, 10]]
 *
 * turf.cleanCoords(multiPoint).geometry.coordinates;
 * //= [[0, 0], [2, 2]]
 */
function cleanCoords(geojson, options) {
    if (options === void 0) { options = {}; }
    // Backwards compatible with v4.0
    var mutate = typeof options === "object" ? options.mutate : options;
    if (!geojson)
        throw new Error("geojson is required");
    var type = getType(geojson);
    // Store new "clean" points in this Array
    var newCoords = [];
    switch (type) {
        case "LineString":
            newCoords = cleanLine(geojson);
            break;
        case "MultiLineString":
        case "Polygon":
            getCoords(geojson).forEach(function (line) {
                newCoords.push(cleanLine(line));
            });
            break;
        case "MultiPolygon":
            getCoords(geojson).forEach(function (polygons) {
                var polyPoints = [];
                polygons.forEach(function (ring) {
                    polyPoints.push(cleanLine(ring));
                });
                newCoords.push(polyPoints);
            });
            break;
        case "Point":
            return geojson;
        case "MultiPoint":
            var existing = {};
            getCoords(geojson).forEach(function (coord) {
                var key = coord.join("-");
                if (!existing.hasOwnProperty(key)) {
                    newCoords.push(coord);
                    existing[key] = true;
                }
            });
            break;
        default:
            throw new Error(type + " geometry not supported");
    }
    // Support input mutation
    if (geojson.coordinates) {
        if (mutate === true) {
            geojson.coordinates = newCoords;
            return geojson;
        }
        return { type: type, coordinates: newCoords };
    }
    else {
        if (mutate === true) {
            geojson.geometry.coordinates = newCoords;
            return geojson;
        }
        return feature({ type: type, coordinates: newCoords }, geojson.properties, {
            bbox: geojson.bbox,
            id: geojson.id,
        });
    }
}
/**
 * Clean Coords
 *
 * @private
 * @param {Array<number>|LineString} line Line
 * @returns {Array<number>} Cleaned coordinates
 */
function cleanLine(line) {
    var points = getCoords(line);
    // handle "clean" segment
    if (points.length === 2 && !equals(points[0], points[1]))
        return points;
    var newPoints = [];
    var secondToLast = points.length - 1;
    var newPointsLength = newPoints.length;
    newPoints.push(points[0]);
    for (var i = 1; i < secondToLast; i++) {
        var prevAddedPoint = newPoints[newPoints.length - 1];
        if (points[i][0] === prevAddedPoint[0] &&
            points[i][1] === prevAddedPoint[1])
            continue;
        else {
            newPoints.push(points[i]);
            newPointsLength = newPoints.length;
            if (newPointsLength > 2) {
                if (isPointOnLineSegment(newPoints[newPointsLength - 3], newPoints[newPointsLength - 1], newPoints[newPointsLength - 2]))
                    newPoints.splice(newPoints.length - 2, 1);
            }
        }
    }
    newPoints.push(points[points.length - 1]);
    newPointsLength = newPoints.length;
    if (equals(points[0], points[points.length - 1]) && newPointsLength < 4)
        throw new Error("invalid polygon");
    if (isPointOnLineSegment(newPoints[newPointsLength - 3], newPoints[newPointsLength - 1], newPoints[newPointsLength - 2]))
        newPoints.splice(newPoints.length - 2, 1);
    return newPoints;
}
/**
 * Compares two points and returns if they are equals
 *
 * @private
 * @param {Position} pt1 point
 * @param {Position} pt2 point
 * @returns {boolean} true if they are equals
 */
function equals(pt1, pt2) {
    return pt1[0] === pt2[0] && pt1[1] === pt2[1];
}
/**
 * Returns if `point` is on the segment between `start` and `end`.
 * Borrowed from `@turf/boolean-point-on-line` to speed up the evaluation (instead of using the module as dependency)
 *
 * @private
 * @param {Position} start coord pair of start of line
 * @param {Position} end coord pair of end of line
 * @param {Position} point coord pair of point to check
 * @returns {boolean} true/false
 */
function isPointOnLineSegment(start, end, point) {
    var x = point[0], y = point[1];
    var startX = start[0], startY = start[1];
    var endX = end[0], endY = end[1];
    var dxc = x - startX;
    var dyc = y - startY;
    var dxl = endX - startX;
    var dyl = endY - startY;
    var cross = dxc * dyl - dyc * dxl;
    if (cross !== 0)
        return false;
    else if (Math.abs(dxl) >= Math.abs(dyl))
        return dxl > 0 ? startX <= x && x <= endX : endX <= x && x <= startX;
    else
        return dyl > 0 ? startY <= y && y <= endY : endY <= y && y <= startY;
}

/**
 * Returns a cloned copy of the passed GeoJSON Object, including possible 'Foreign Members'.
 * ~3-5x faster than the common JSON.parse + JSON.stringify combo method.
 *
 * @name clone
 * @param {GeoJSON} geojson GeoJSON Object
 * @returns {GeoJSON} cloned GeoJSON Object
 * @example
 * var line = turf.lineString([[-74, 40], [-78, 42], [-82, 35]], {color: 'red'});
 *
 * var lineCloned = turf.clone(line);
 */
function clone(geojson) {
    if (!geojson) {
        throw new Error("geojson is required");
    }
    switch (geojson.type) {
        case "Feature":
            return cloneFeature(geojson);
        case "FeatureCollection":
            return cloneFeatureCollection(geojson);
        case "Point":
        case "LineString":
        case "Polygon":
        case "MultiPoint":
        case "MultiLineString":
        case "MultiPolygon":
        case "GeometryCollection":
            return cloneGeometry(geojson);
        default:
            throw new Error("unknown GeoJSON type");
    }
}
/**
 * Clone Feature
 *
 * @private
 * @param {Feature<any>} geojson GeoJSON Feature
 * @returns {Feature<any>} cloned Feature
 */
function cloneFeature(geojson) {
    var cloned = { type: "Feature" };
    // Preserve Foreign Members
    Object.keys(geojson).forEach(function (key) {
        switch (key) {
            case "type":
            case "properties":
            case "geometry":
                return;
            default:
                cloned[key] = geojson[key];
        }
    });
    // Add properties & geometry last
    cloned.properties = cloneProperties(geojson.properties);
    cloned.geometry = cloneGeometry(geojson.geometry);
    return cloned;
}
/**
 * Clone Properties
 *
 * @private
 * @param {Object} properties GeoJSON Properties
 * @returns {Object} cloned Properties
 */
function cloneProperties(properties) {
    var cloned = {};
    if (!properties) {
        return cloned;
    }
    Object.keys(properties).forEach(function (key) {
        var value = properties[key];
        if (typeof value === "object") {
            if (value === null) {
                // handle null
                cloned[key] = null;
            }
            else if (Array.isArray(value)) {
                // handle Array
                cloned[key] = value.map(function (item) {
                    return item;
                });
            }
            else {
                // handle generic Object
                cloned[key] = cloneProperties(value);
            }
        }
        else {
            cloned[key] = value;
        }
    });
    return cloned;
}
/**
 * Clone Feature Collection
 *
 * @private
 * @param {FeatureCollection<any>} geojson GeoJSON Feature Collection
 * @returns {FeatureCollection<any>} cloned Feature Collection
 */
function cloneFeatureCollection(geojson) {
    var cloned = { type: "FeatureCollection" };
    // Preserve Foreign Members
    Object.keys(geojson).forEach(function (key) {
        switch (key) {
            case "type":
            case "features":
                return;
            default:
                cloned[key] = geojson[key];
        }
    });
    // Add features
    cloned.features = geojson.features.map(function (feature) {
        return cloneFeature(feature);
    });
    return cloned;
}
/**
 * Clone Geometry
 *
 * @private
 * @param {Geometry<any>} geometry GeoJSON Geometry
 * @returns {Geometry<any>} cloned Geometry
 */
function cloneGeometry(geometry) {
    var geom = { type: geometry.type };
    if (geometry.bbox) {
        geom.bbox = geometry.bbox;
    }
    if (geometry.type === "GeometryCollection") {
        geom.geometries = geometry.geometries.map(function (g) {
            return cloneGeometry(g);
        });
        return geom;
    }
    geom.coordinates = deepSlice(geometry.coordinates);
    return geom;
}
/**
 * Deep Slice coordinates
 *
 * @private
 * @param {Coordinates} coords Coordinates
 * @returns {Coordinates} all coordinates sliced
 */
function deepSlice(coords) {
    var cloned = coords;
    if (typeof cloned[0] !== "object") {
        return cloned.slice();
    }
    return cloned.map(function (coord) {
        return deepSlice(coord);
    });
}

/**
 * Callback for geomEach
 *
 * @callback geomEachCallback
 * @param {Geometry} currentGeometry The current Geometry being processed.
 * @param {number} featureIndex The current index of the Feature being processed.
 * @param {Object} featureProperties The current Feature Properties being processed.
 * @param {Array<number>} featureBBox The current Feature BBox being processed.
 * @param {number|string} featureId The current Feature Id being processed.
 */

/**
 * Iterate over each geometry in any GeoJSON object, similar to Array.forEach()
 *
 * @name geomEach
 * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
 * @param {Function} callback a method that takes (currentGeometry, featureIndex, featureProperties, featureBBox, featureId)
 * @returns {void}
 * @example
 * var features = turf.featureCollection([
 *     turf.point([26, 37], {foo: 'bar'}),
 *     turf.point([36, 53], {hello: 'world'})
 * ]);
 *
 * turf.geomEach(features, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
 *   //=currentGeometry
 *   //=featureIndex
 *   //=featureProperties
 *   //=featureBBox
 *   //=featureId
 * });
 */
function geomEach(geojson, callback) {
  var i,
    j,
    g,
    geometry,
    stopG,
    geometryMaybeCollection,
    isGeometryCollection,
    featureProperties,
    featureBBox,
    featureId,
    featureIndex = 0,
    isFeatureCollection = geojson.type === "FeatureCollection",
    isFeature = geojson.type === "Feature",
    stop = isFeatureCollection ? geojson.features.length : 1;

  // This logic may look a little weird. The reason why it is that way
  // is because it's trying to be fast. GeoJSON supports multiple kinds
  // of objects at its root: FeatureCollection, Features, Geometries.
  // This function has the responsibility of handling all of them, and that
  // means that some of the `for` loops you see below actually just don't apply
  // to certain inputs. For instance, if you give this just a
  // Point geometry, then both loops are short-circuited and all we do
  // is gradually rename the input until it's called 'geometry'.
  //
  // This also aims to allocate as few resources as possible: just a
  // few numbers and booleans, rather than any temporary arrays as would
  // be required with the normalization approach.
  for (i = 0; i < stop; i++) {
    geometryMaybeCollection = isFeatureCollection
      ? geojson.features[i].geometry
      : isFeature
      ? geojson.geometry
      : geojson;
    featureProperties = isFeatureCollection
      ? geojson.features[i].properties
      : isFeature
      ? geojson.properties
      : {};
    featureBBox = isFeatureCollection
      ? geojson.features[i].bbox
      : isFeature
      ? geojson.bbox
      : undefined;
    featureId = isFeatureCollection
      ? geojson.features[i].id
      : isFeature
      ? geojson.id
      : undefined;
    isGeometryCollection = geometryMaybeCollection
      ? geometryMaybeCollection.type === "GeometryCollection"
      : false;
    stopG = isGeometryCollection
      ? geometryMaybeCollection.geometries.length
      : 1;

    for (g = 0; g < stopG; g++) {
      geometry = isGeometryCollection
        ? geometryMaybeCollection.geometries[g]
        : geometryMaybeCollection;

      // Handle null Geometry
      if (geometry === null) {
        if (
          callback(
            null,
            featureIndex,
            featureProperties,
            featureBBox,
            featureId
          ) === false
        )
          return false;
        continue;
      }
      switch (geometry.type) {
        case "Point":
        case "LineString":
        case "MultiPoint":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon": {
          if (
            callback(
              geometry,
              featureIndex,
              featureProperties,
              featureBBox,
              featureId
            ) === false
          )
            return false;
          break;
        }
        case "GeometryCollection": {
          for (j = 0; j < geometry.geometries.length; j++) {
            if (
              callback(
                geometry.geometries[j],
                featureIndex,
                featureProperties,
                featureBBox,
                featureId
              ) === false
            )
              return false;
          }
          break;
        }
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
    // Only increase `featureIndex` per each feature
    featureIndex++;
  }
}

/*
 (c) 2013, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/

// to suit your point format, run search/replace for '.x' and '.y';
// for 3D version, see 3d branch (configurability would draw significant performance overhead)

// square distance between 2 points
function getSqDist(p1, p2) {
  var dx = p1.x - p2.x,
    dy = p1.y - p2.y;

  return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getSqSegDist(p, p1, p2) {
  var x = p1.x,
    y = p1.y,
    dx = p2.x - x,
    dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;

  return dx * dx + dy * dy;
}
// rest of the code doesn't care about point format

// basic distance-based simplification
function simplifyRadialDist(points, sqTolerance) {
  var prevPoint = points[0],
    newPoints = [prevPoint],
    point;

  for (var i = 1, len = points.length; i < len; i++) {
    point = points[i];

    if (getSqDist(point, prevPoint) > sqTolerance) {
      newPoints.push(point);
      prevPoint = point;
    }
  }

  if (prevPoint !== point) newPoints.push(point);

  return newPoints;
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
  var maxSqDist = sqTolerance,
    index;

  for (var i = first + 1; i < last; i++) {
    var sqDist = getSqSegDist(points[i], points[first], points[last]);

    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    if (index - first > 1)
      simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1)
      simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points, sqTolerance) {
  var last = points.length - 1;

  var simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);

  return simplified;
}

// both algorithms combined for awesome performance
function simplify(points, tolerance, highestQuality) {
  if (points.length <= 2) return points;

  var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

  points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
  points = simplifyDouglasPeucker(points, sqTolerance);

  return points;
}

/**
 * Takes a {@link GeoJSON} object and returns a simplified version. Internally uses
 * [simplify-js](http://mourner.github.io/simplify-js/) to perform simplification using the Ramer-Douglas-Peucker algorithm.
 *
 * @name simplify
 * @param {GeoJSON} geojson object to be simplified
 * @param {Object} [options={}] Optional parameters
 * @param {number} [options.tolerance=1] simplification tolerance
 * @param {boolean} [options.highQuality=false] whether or not to spend more time to create a higher-quality simplification with a different algorithm
 * @param {boolean} [options.mutate=false] allows GeoJSON input to be mutated (significant performance increase if true)
 * @returns {GeoJSON} a simplified GeoJSON
 * @example
 * var geojson = turf.polygon([[
 *   [-70.603637, -33.399918],
 *   [-70.614624, -33.395332],
 *   [-70.639343, -33.392466],
 *   [-70.659942, -33.394759],
 *   [-70.683975, -33.404504],
 *   [-70.697021, -33.419406],
 *   [-70.701141, -33.434306],
 *   [-70.700454, -33.446339],
 *   [-70.694274, -33.458369],
 *   [-70.682601, -33.465816],
 *   [-70.668869, -33.472117],
 *   [-70.646209, -33.473835],
 *   [-70.624923, -33.472117],
 *   [-70.609817, -33.468107],
 *   [-70.595397, -33.458369],
 *   [-70.587158, -33.442901],
 *   [-70.587158, -33.426283],
 *   [-70.590591, -33.414248],
 *   [-70.594711, -33.406224],
 *   [-70.603637, -33.399918]
 * ]]);
 * var options = {tolerance: 0.01, highQuality: false};
 * var simplified = turf.simplify(geojson, options);
 *
 * //addToMap
 * var addToMap = [geojson, simplified]
 */
function simplify$1(geojson, options) {
  // Optional parameters
  options = options || {};
  if (!isObject(options)) throw new Error("options is invalid");
  var tolerance = options.tolerance !== undefined ? options.tolerance : 1;
  var highQuality = options.highQuality || false;
  var mutate = options.mutate || false;

  if (!geojson) throw new Error("geojson is required");
  if (tolerance && tolerance < 0) throw new Error("invalid tolerance");

  // Clone geojson to avoid side effects
  if (mutate !== true) geojson = clone(geojson);

  geomEach(geojson, function (geom) {
    simplifyGeom(geom, tolerance, highQuality);
  });
  return geojson;
}

/**
 * Simplifies a feature's coordinates
 *
 * @private
 * @param {Geometry} geometry to be simplified
 * @param {number} [tolerance=1] simplification tolerance
 * @param {boolean} [highQuality=false] whether or not to spend more time to create a higher-quality simplification with a different algorithm
 * @returns {Geometry} output
 */
function simplifyGeom(geometry, tolerance, highQuality) {
  var type = geometry.type;

  // "unsimplyfiable" geometry types
  if (type === "Point" || type === "MultiPoint") return geometry;

  // Remove any extra coordinates
  cleanCoords(geometry, true);

  var coordinates = geometry.coordinates;
  switch (type) {
    case "LineString":
      geometry["coordinates"] = simplifyLine(
        coordinates,
        tolerance,
        highQuality
      );
      break;
    case "MultiLineString":
      geometry["coordinates"] = coordinates.map(function (lines) {
        return simplifyLine(lines, tolerance, highQuality);
      });
      break;
    case "Polygon":
      geometry["coordinates"] = simplifyPolygon(
        coordinates,
        tolerance,
        highQuality
      );
      break;
    case "MultiPolygon":
      geometry["coordinates"] = coordinates.map(function (rings) {
        return simplifyPolygon(rings, tolerance, highQuality);
      });
  }
  return geometry;
}

/**
 * Simplifies the coordinates of a LineString with simplify-js
 *
 * @private
 * @param {Array<number>} coordinates to be processed
 * @param {number} tolerance simplification tolerance
 * @param {boolean} highQuality whether or not to spend more time to create a higher-quality
 * @returns {Array<Array<number>>} simplified coords
 */
function simplifyLine(coordinates, tolerance, highQuality) {
  return simplify(
    coordinates.map(function (coord) {
      return { x: coord[0], y: coord[1], z: coord[2] };
    }),
    tolerance,
    highQuality
  ).map(function (coords) {
    return coords.z ? [coords.x, coords.y, coords.z] : [coords.x, coords.y];
  });
}

/**
 * Simplifies the coordinates of a Polygon with simplify-js
 *
 * @private
 * @param {Array<number>} coordinates to be processed
 * @param {number} tolerance simplification tolerance
 * @param {boolean} highQuality whether or not to spend more time to create a higher-quality
 * @returns {Array<Array<Array<number>>>} simplified coords
 */
function simplifyPolygon(coordinates, tolerance, highQuality) {
  return coordinates.map(function (ring) {
    var pts = ring.map(function (coord) {
      return { x: coord[0], y: coord[1] };
    });
    if (pts.length < 4) {
      throw new Error("invalid polygon");
    }
    var simpleRing = simplify(pts, tolerance, highQuality).map(function (
      coords
    ) {
      return [coords.x, coords.y];
    });
    //remove 1 percent of tolerance until enough points to make a triangle
    while (!checkValidity(simpleRing)) {
      tolerance -= tolerance * 0.01;
      simpleRing = simplify(pts, tolerance, highQuality).map(function (
        coords
      ) {
        return [coords.x, coords.y];
      });
    }
    if (
      simpleRing[simpleRing.length - 1][0] !== simpleRing[0][0] ||
      simpleRing[simpleRing.length - 1][1] !== simpleRing[0][1]
    ) {
      simpleRing.push(simpleRing[0]);
    }
    return simpleRing;
  });
}

/**
 * Returns true if ring has at least 3 coordinates and its first coordinate is the same as its last
 *
 * @private
 * @param {Array<number>} ring coordinates to be checked
 * @returns {boolean} true if valid
 */
function checkValidity(ring) {
  if (ring.length < 3) return false;
  //if the last point is the same as the first, it's not a triangle
  return !(
    ring.length === 3 &&
    ring[2][0] === ring[0][0] &&
    ring[2][1] === ring[0][1]
  );
}

class GeometryMapper {
  /**
   * A class meant to modify data points from the getNextDataPoint method of the {@link Track} object
   * to geometries that coincide with their visibility on the canvas i.e. with a proper width, height,
   * x and y. This class is NOT meant to be used by the WebGLDrawer for rendering. It is solely used
   * by the DataProcessor to properly index the data.
   *
   * @param {SchemaProcessor} schemaObject of the visualization for these geometries
   * @param {Track} trackObject containing track info for track that these geometries are a part of
   */
  constructor(schemaObject, trackObject) {
    this.schemaObject = schemaObject;
    this.trackObject = trackObject;
    this.track = trackObject.track;
    this.xScale = this.schemaObject.xScale;
    this.yScale = this.schemaObject.yScale;

    const viewportForSchema = getViewportForSchema(schemaObject.schema);
    if (schemaObject.xScale.isGenomeScale) {
      this.xDomainWidth = 2 / 2;
    } else {
      this.xDomainWidth = (viewportForSchema[1] - viewportForSchema[0]) / 2;
    }

    if (schemaObject.yScale.isGenomeScale) {
      this.yDomainHeight = 2 / 2;
    } else {
      this.yDomainHeight = (viewportForSchema[3] - viewportForSchema[2]) / 2;
    }
  }

  /**
   * Modifies a geometry object in place based on the schema.
   *
   * @param {Object} geometry an object of the form {dimensions: Array(2), coordinates: Array(2)}
   */
  modifyGeometry(geometry) {
    if (this.xScale.isGenomeScale) {
      // transforms x part into a standard format
      if (this.trackObject.track.x.type === "genomicRange") {
        this._modifyGenomicRangeX(geometry);
      }
      geometry.coordinates[0] = this.xScale(geometry.coordinates[0]);
    }
    this._modifyStandardX(geometry);

    if (this.yScale.isGenomeScale) {
      // transforms y part into a standard format
      if (this.trackObject.track.y.type === "genomicRange") {
        this._modifyGenomicRangeY(geometry);
      }
      geometry.coordinates[1] = this.yScale(geometry.coordinates[1]);
    }
    this._modifyStandardY(geometry);
  }

  _modifyStandardX(geometry) {
    if (geometry.dimensions[0]) {
      // Transform width from the data point into visible width on the canvas
      geometry.dimensions[0] *= this.xDomainWidth * SIZE_UNITS;
    }

    // If there is no width, give very small width for flatbush indexing
    geometry.dimensions[0] = geometry.dimensions[0] || 1e-10;
  }

  _modifyStandardY(geometry) {
    if (geometry.dimensions[1]) {
      // Transform height from the data point into visible height on the canvas
      geometry.dimensions[1] *= this.yDomainHeight * SIZE_UNITS;
    }

    // If there is no height, give very small height for flatbush indexing
    geometry.dimensions[1] = geometry.dimensions[1] || 1e-10;
  }

  _modifyGenomicRangeX(geometry) {
    if (this.trackObject.track.mark === "arc") {
      /**
       * Geometry is in the form
       * {
       *   coordinates: [[[chr1,gene1], [chr2,gene2]], <y-coord handled in _modifyGenomicRangeY>]
       *   dimensions: [[[chr3,gene3], [chr3,gene3]], <height handled in _modifyGenomicRangeY>]
       * }
       *
       * and is transformed to
       * {
       *   coordinates: [x-coord between -1 and 1, <y handled elsewhere>]
       *   dimensions: [width, <height handled elsewhere>]
       * }
       */
      const standardized = transformGenomicRangeArcToStandard(
        {
          x: geometry.coordinates[0],
          y: 0,
          width: geometry.dimensions[0],
          height: 0,
        },
        this.schemaObject.xScale,
        this.schemaObject.yScale
      );

      geometry.coordinates[0] = standardized.x;
      geometry.dimensions[0] = standardized.width;
    } else {
      /**
       * Geometry is in the form
       * {
       *   coordinates: [[[chr1,gene1], [chr2,gene2]], <y-coord handled in _modifyGenomicRangeY>]
       *   dimensions: [<ignored value>, <height handled elsewhere>]
       * }
       *
       * and is transformed to
       * {
       *   coordinates: [x-coord between -1 and 1, <y handled elsewhere>]
       *   dimensions: [width, <height handled elsewhere>]
       * }
       */

      const standardized = transformGenomicRangeToStandard(
        {
          x: geometry.coordinates[0],
          y: 0,
        },
        this.schemaObject.xScale,
        this.schemaObject.yScale
      );
      geometry.coordinates[0] = standardized.x;
      geometry.dimensions[0] = standardized.width;
    }
  }

  _modifyGenomicRangeY(geometry) {
    // See comments in _modifyGenomicRangeX

    if (this.trackObject.track.mark === "arc") {
      const standardized = transformGenomicRangeArcToStandard(
        {
          x: 0,
          y: geometry.coordinates[1],
          width: 0,
          height: geometry.coordinates[1],
        },
        this.schemaObject.xScale,
        this.schemaObject.yScale
      );

      geometry.coordinates[1] = standardized.y;
      geometry.dimensions[1] = standardized.height;
    } else {
      const standardized = transformGenomicRangeToStandard(
        {
          x: 0,
          y: geometry.coordinates[1],
        },
        this.schemaObject.xScale,
        this.schemaObject.yScale
      );
      geometry.coordinates[1] = standardized.y;
      geometry.dimensions[1] = standardized.height;
    }
  }
}

class DataProcessor {
  /**
   * A class meant to handle processing of data used in the scatterplot.
   *
   * @param {Array} data the processor is meant to handle and index
   */
  constructor(schema) {
    this.schema = schema;

    // console.log("Loading data...");

    new SchemaProcessor(schema, this.indexData.bind(this));
  }

  /**
   * Callback function that occurs after the schema processor has loaded the appropriate data
   *
   * @param {SchemaProcessor} schemaHelper that is built in the constructor
   */
  indexData(schemaHelper) {
    let totalPoints = 0;

    for (const track of schemaHelper.tracks) {
      if (!track.hasOwnData) {
        // index at 1 means a header needs to be skipped
        totalPoints +=
          track.index === 1 ? track.data.length - 1 : track.data.length;
        break;
      }
    }
    schemaHelper.tracks
      .filter((track) => track.hasOwnData)
      .forEach(
        (track) =>
          (totalPoints +=
            track.index === 1 ? track.data.length - 1 : track.data.length)
      );

    this.index = new Flatbush(totalPoints);
    this.data = [];
    // console.log("Reading data...");

    // Process the global data in the schema processor
    if (schemaHelper.data) {
      for (let track of schemaHelper.tracks) {
        if (!track.hasOwnData) {
          const geometryMapper = new GeometryMapper(schemaHelper, track);

          let currentPoint = track.getNextDataPoint();
          while (currentPoint) {
            geometryMapper.modifyGeometry(currentPoint.geometry);

            this.data[
              this.index.add(
                currentPoint.geometry.coordinates[0],
                currentPoint.geometry.coordinates[1],
                currentPoint.geometry.coordinates[0] +
                  currentPoint.geometry.dimensions[0],
                currentPoint.geometry.coordinates[1] +
                  currentPoint.geometry.dimensions[1]
              )
            ] = currentPoint;

            currentPoint = track.getNextDataPoint();
          }
          break;
        }
      }
    }

    // Process the data that is local to each track
    schemaHelper.tracks
      .filter((track) => track.hasOwnData)
      .forEach((track) => {
        const geometryMapper = new GeometryMapper(schemaHelper, track);

        let currentPoint = track.getNextDataPoint();
        while (currentPoint) {
          geometryMapper.modifyGeometry(currentPoint.geometry);

          this.data[
            this.index.add(
              currentPoint.geometry.coordinates[0],
              currentPoint.geometry.coordinates[1],
              currentPoint.geometry.coordinates[0] +
                currentPoint.geometry.dimensions[0],
              currentPoint.geometry.coordinates[1] +
                currentPoint.geometry.dimensions[1]
            )
          ] = currentPoint;

          currentPoint = track.getNextDataPoint();
        }
      });

    // console.log("Indexing data...");
    this.index.finish();

    // console.log("Data processing complete.");
  }

  /**
   * Find the closest point in the data to a given point. Only finds point if it is
   * sufficiently close.
   *
   * @param {Array} point of two floats to find closest point to
   * @returns closest point or undefined
   */
  getClosestPoint(point) {
    return this.data[this.index.neighbors(point[0], point[1], 1)];
  }

  /**
   * Get points within a bounding box.
   *
   * @param {Array} points Bounding rectangle in the format of [x1, y1, x2, y2]
   * @returns points in bounding box
   */
  selectBox(points) {
    const smallerX = Math.min(points[0], points[2]);
    const smallerY = Math.min(points[1], points[3]);
    const largerX = Math.max(points[0], points[2]);
    const largerY = Math.max(points[1], points[3]);

    return this.index
      .search(smallerX, smallerY, largerX, largerY)
      .map((i) => this.data[i]);
  }

  /**
   * Select points inside a given polygon. Simplify polygon with {@link @turf/simplify}
   * which may cause precision issues with very complex polygons. Uses {@link turf}
   * to determine what points are in polygon.
   *
   * @param {Array} points of a polygon to select points format: [x1,y1,x2,y2,x3,y3,...]
   * @returns points inside lasso
   */
  selectLasso(points) {
    let smallestX = Number.POSITIVE_INFINITY;
    let largestX = Number.NEGATIVE_INFINITY;
    let smallestY = Number.POSITIVE_INFINITY;
    let largestY = Number.NEGATIVE_INFINITY;
    const polygonPoints = [];
    for (let i = 0; i < points.length; i += 2) {
      if (points[i] < smallestX) smallestX = points[i];
      if (points[i] > largestX) largestX = points[i];
      if (points[i + 1] < smallestY) smallestY = points[i + 1];
      if (points[i + 1] > largestY) largestY = points[i + 1];
      polygonPoints.push([points[i], points[i + 1]]);
    }

    polygonPoints.push([...polygonPoints[0]]); // First and last must be same position

    const candidatePoints = this.selectBox([
      smallestX,
      smallestY,
      largestX,
      largestY,
    ]);

    const boundingPolygon = polygon([polygonPoints]);

    const simplifiedBoundingPolygon = simplify$1(boundingPolygon, {
      tolerance: 0.01,
      highQuality: false,
    });

    return candidatePoints.filter((point) => {
      return booleanPointInPolygon(
        point.geometry.coordinates,
        simplifiedBoundingPolygon
      );
    });
  }
}

/**
 * The data processor worker is meant to be an interface between the main thread
 * containing the {@link WebGLVis} a {@link DataProcessor}. It's main purpose
 * is to receive messages from the WebGLVis, call the appropriate method of
 * the DataProcessor, then post a message of the results of the method back to
 * the WebGLVis.
 */

self.onmessage = (message) => {
  switch (message.data.type) {
    case "init":
      self.processor = new DataProcessor(message.data.schema);
      break;
    case "selectBox":
      postMessage({
        type: message.data.type,
        selection: self.processor.selectBox(message.data.points),
        bounds: message.data.points,
      });
      break;
    case "selectLasso":
      postMessage({
        type: message.data.type,
        selection: self.processor.selectLasso(message.data.points),
        bounds: message.data.points,
      });
      break;
    case "getClosestPoint":
      postMessage({
        type: message.data.type,
        point: self.processor.getClosestPoint(message.data.point),
      });
      break;
    default:
      console.error(`Received unknown message type: ${message.type}`);
  }
};
