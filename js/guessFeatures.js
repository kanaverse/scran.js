/**
 * Guess the identity of the features from their names.
 *
 * @param {Array} features - Array of strings containing feature identifiers, typically Ensembl IDs or gene symbols.
 * Elements may also be `null` or undefined if an identifier is missing.
 * @param {object} [options={}] - Optional parameters.
 * @param {boolean} [options.forceTaxonomy=false] - Whether to force the use of taxonomy IDs for human and mouse.
 * This is `false` for back compatibility.
 *
 * @return {object} An object containing:
 *
 * - `species`, the inferred species as a string.
 *   This can be either `"human"` or `"mouse"`, or an NCBI taxonomy ID (one of 6239, 10116, 9541, 7227, 7955, 9598).
 *   If `forceTaxonomy = true`, human and mouse are replaced with 9606 and 10090, respectively.
 * - `type`: the feature identifier type.
 *   This can either be `"ensembl"` or `"symbol"`.
 * - `confidence`: the percentage of entries in `x` that are consistent with the inferred identity.
 */
export function guessFeatures(features, { forceTaxonomy = false } = {}) {
    let ntotal = features.length;
    let early_threshold = Math.ceil(ntotal / 2);
    let format = payload => {
        payload.confidence /= ntotal;
        return payload;
    };

    // Duplicated entries only count as one match, so as to avoid problems with
    // chromosome positions, feature type specifications, etc. Note that we
    // still need to use the full length to compute 'ntotal', otherwise we
    // wouldn't be penalizing the duplicates properly.
    let unique_features = new Set;
    for (const f of features) {
        if (typeof f == "string") {
            unique_features.add(f);
        }
    }

    let ensembl_human = 0;
    let ensembl_mouse = 0;
    let ensembl_6239 = 0;
    let ensembl_10116 = 0; // Ensembl only, Rat symbols are indistiguishable from mice.
    let ensembl_9541 = 0; // Ensembl only, Mfac symbols are indistiguishable from human.
    let ensembl_7227 = 0; // Ensembl only, fly symbols are crazy.
    let ensembl_7955 = 0;
    let ensembl_9598 = 0; // Ensembl only, Chimp symbols are indistinguishable from human.

    let symbol_human = 0;
    let symbol_mouse = 0;
    let symbol_6239 = 0;
    let symbol_7955 = 0;

    let hsid = (forceTaxonomy ? "9606" : "human");
    let mmid = (forceTaxonomy ? "10090" : "mouse");
    let collected = [];

    // Checking if it's any type of Ensembl.
    let any_ens = 0;
    for (const x of unique_features) {
        if (x && x.match(/^ENS[A-Z]*G[0-9]{11}$/)) {
            any_ens++;
        }
    }

    if (any_ens) {
        for (const x of unique_features) {
            if (x) {
                if (x.startsWith("ENSG")) {
                    ensembl_human++;
                } else if (x.startsWith("ENSMUSG")) {
                    ensembl_mouse++;
                } else if (x.startsWith("ENSRNOG")) {
                    ensembl_10116++;
                } else if (x.startsWith("ENSMFAG")) {
                    ensembl_9541++;
                } else if (x.startsWith("ENSDARG")) {
                    ensembl_7955++;
                } else if (x.startsWith("ENSPTRG")) {
                    ensembl_9598++;
                }
            }
        }

        collected.push({ species: hsid, type: "ensembl", confidence: ensembl_human });
        collected.push({ species: mmid, type: "ensembl", confidence: ensembl_mouse });
        collected.push({ species: "10116", type: "ensembl", confidence: ensembl_10116 });
        collected.push({ species: "9541", type: "ensembl", confidence: ensembl_9541 });
        collected.push({ species: "7955", type: "ensembl", confidence: ensembl_7955 });
        collected.push({ species: "9598", type: "ensembl", confidence: ensembl_9598 });

        // See if we can quit early and avoid the other checks.
        for (const x of collected) {
            if (x.confidence >= early_threshold) {
                return format(x);
            }
        }
    }

    // Human symbol; starts with upper case, no lower case, and not an Ensembl of any kind.
    // We also ignore VEGA gene identifiers, as these are antiquated; and MGI identifiers,
    // which are all-caps and thus confusing.
    for (const x of unique_features) {
        if (x && x.match(/^[A-Z][^a-z]+$/) && !x.match(/^ENS[A-Z]+[0-9]{11}/) && !x.match(/^OTT.{4}[0-9]{11}/) && !x.match(/^MGI:[0-9]+/)) {
            symbol_human++;
        }
    }
    {
        let payload = { species: hsid, type: "symbol", confidence: symbol_human };
        if (payload.confidence >= early_threshold) {
            return format(payload);
        }
        collected.push(payload);
    }

    // Mouse symbol; starts with upper case, but no upper case after that.
    for (const x of unique_features) {
        if (x && x.match(/^[A-Z][^A-Z]+$/)) {
            symbol_mouse++;
        }
    }
    {
        let payload = { species: mmid, type: "symbol", confidence: symbol_mouse };
        if (payload.confidence >= early_threshold) {
            return format(payload);
        }
        collected.push(payload);
    }

    // Worm Ensembl (WormBase).
    for (const x of unique_features) {
        if (x && x.match(/^WBGene[0-9]+$/)) {
            ensembl_6239++;
        }
    }
    {
        let payload = { species: "6239", type: "ensembl", confidence: ensembl_6239 };
        if (payload.confidence >= early_threshold) {
            return format(payload);
        }
        collected.push(payload);
    }

    // Fly Ensembl (FlyBase).
    for (const x of unique_features) {
        if (x && x.match(/^FBgn[0-9]+$/)) {
            ensembl_7227++;
        }
    }
    {
        let payload = { species: "7227", type: "ensembl", confidence: ensembl_7227 };
        if (payload.confidence >= early_threshold) {
            return format(payload);
        }
        collected.push(payload);
    }

    // Worm symbols; at least three lower case with a dash and numbers.
    for (const x of unique_features) {
        if (x && x.match(/^[a-z]{3,}-[0-9]+$/)) {
            symbol_6239++;
        }
    }
    {
        let payload = { species: "6239", type: "symbol", confidence: symbol_6239 };
        if (payload.confidence >= early_threshold) {
            return format(payload);
        }
        collected.push(payload);
    }

    // Zebrafish symbols; at least three lower case letters, no dash, followed by numbers and/or more lower case.
    for (const x of unique_features) {
        if (x && x.match(/^[a-z]{3,}[0-9a-z]+$/)) {
            symbol_7955++;
        }
    }
    {
        let payload = { species: "7955", type: "symbol", confidence: symbol_7955 };
        if (payload.confidence >= early_threshold) {
            return format(payload);
        }
        collected.push(payload);
    }

    // Picking the best.
    let highest = collected[0];
    for (var i = 1; i < collected.length; i++) {
        if (collected[i].confidence > highest.confidence) {
            highest = collected[i];
        }
    }

    return format(highest);
}
