#include <emscripten.h>
#include <emscripten/bind.h>

#include "read_utils.h"
#include "NumericMatrix.h"

#include "H5Cpp.h"
#include "tatami_hdf5/tatami_hdf5.hpp"

#include <string>
#include <filesystem>

void js_write_sparse_matrix_to_hdf5(const NumericMatrix& mat, std::string path, std::string name, bool csc, bool force_integer, bool overwrite) {
    auto omode = H5F_ACC_TRUNC;
    if (!overwrite && std::filesystem::exists(path)) {
        omode = H5F_ACC_RDWR;
    }
    H5::H5File fhandle(path, omode);

    tatami_hdf5::WriteCompressedSparseMatrixOptions params;
    if (csc) {
        params.columnar = tatami_hdf5::WriteStorageLayout::COLUMN;
    } else {
        params.columnar = tatami_hdf5::WriteStorageLayout::ROW;
    }
    params.force_integer = force_integer;

    auto ghandle = fhandle.createGroup(name);
    tatami_hdf5::write_compressed_sparse_matrix(mat.ptr().get(), ghandle, params);
}

EMSCRIPTEN_BINDINGS(write_sparse_matrix_to_hdf5) {
    emscripten::function("write_sparse_matrix_to_hdf5", &js_write_sparse_matrix_to_hdf5, emscripten::return_value_policy::take_ownership());
}
