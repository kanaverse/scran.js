#include <emscripten.h>
#include <emscripten/bind.h>

#include "read_utils.h"
#include "NumericMatrix.h"
#include "parallel.h"

#include "H5Cpp.h"
#include "tatami_hdf5/tatami_hdf5.hpp"

std::string write_sparse_matrix_to_hdf5(const NumericMatrix& mat, std::string path, std::string name, std::string format, bool force_integer) {
    H5::H5File fhandle(path, H5F_ACC_TRUNC);

    tatami_hdf5::WriteSparseMatrixToHdf5Parameters params;
    if (format == "tenx_matrix") {
        params.columnar = tatami_hdf5::WriteSparseMatrixToHdf5Parameters::StorageLayout::COLUMN;
    } else if (format == "csc_matrix") { // yes, the flip is deliberate, rows are columns because H5AD transposes everything.
        params.columnar = tatami_hdf5::WriteSparseMatrixToHdf5Parameters::StorageLayout::ROW;
    } else if (format == "csr_matrix") {
        params.columnar = tatami_hdf5::WriteSparseMatrixToHdf5Parameters::StorageLayout::COLUMN;
    } else {
        throw std::runtime_error("unknown format '" + format + "' ");
    }

    params.force_integer = force_integer;

    auto ghandle = fhandle.createGroup(name);
    tatami_hdf5::write_sparse_matrix_to_hdf5(mat.ptr.get(), ghandle, params);
    return format;
}

EMSCRIPTEN_BINDINGS(write_sparse_matrix_to_hdf5) {
    emscripten::function("write_sparse_matrix_to_hdf5", &write_sparse_matrix_to_hdf5, emscripten::return_value_policy::take_ownership());
}
