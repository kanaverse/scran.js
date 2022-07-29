export function equalArrays(x, y) {
    if (x.length != y.length) {
        return false;
    }

    for (var i = 0; i < x.length; i++) {
        if (x[i] != y[i]) {
            return false;
        }
    }

    return true;
}

export function equalFloatArrays(x, y, tol = 0.00001) {
    if (x.length != y.length) {
        return false;
    }

    for (var i = 0; i < x.length; i++) {
        if (Math.abs(x[i] - y[i]) > tol * (Math.abs(x[i]) + Math.abs(y[i]))) {
            return false;
        }
    }

    return true;
}

export function areIndicesConsecutive(x, start = 0) {
    for (var i = 0; i < x.length; i++) {
        if (x[i] != start + i) {
            return false;
        }
    }
    return true;
}
