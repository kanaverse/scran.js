#include <emscripten.h>
#include <emscripten/bind.h>

#include "read_utils.h"
#include "NumericMatrix.h"

#include "H5Cpp.h"
#include "tatami/ext/HDF5DenseMatrix.hpp"
#include "tatami/ext/HDF5CompressedSparseMatrix.hpp"

NumericMatrix read_hdf5_matrix(std::string path, std::string name, bool layered) {
    bool is_dense;
    bool csc = true;
    size_t nr, nc;

    try {
        H5::H5File handle(path, H5F_ACC_RDONLY);
        is_dense = (handle.childObjType(name) == H5O_TYPE_DATASET);

        if (!is_dense) {
            auto ohandle = handle.openGroup(name);

            auto check_shape = [](const auto& shandle) -> void {
                auto sspace = shandle.getSpace();
                if (sspace.getSimpleExtentNdims() != 1) {
                    throw std::runtime_error("'shape' must be a 1-dimensional dataset");
                }

                hsize_t shape_dim;
                sspace.getSimpleExtentDims(&shape_dim);
                if (shape_dim != 2) {
                    throw std::runtime_error("'shape' dataset should contain 2 elements");
                }
            };

            if (ohandle.exists("shape")) { // 10x format.
                auto shandle = ohandle.openDataSet("shape");
                check_shape(shandle);

                hsize_t dims[2];
                shandle.read(dims, H5::PredType::NATIVE_HSIZE);
                nr = dims[0];
                nc = dims[1];

            } else if (ohandle.attrExists("shape")) { // H5AD 
                auto shandle = ohandle.openAttribute("shape");
                check_shape(shandle);

                hsize_t dims[2];
                shandle.read(H5::PredType::NATIVE_HSIZE, dims);
                nr = dims[1]; // yes, the flip is deliberate, because of how H5AD puts its features in the columns.
                nc = dims[0];

                if (!ohandle.attrExists("encoding-type")) {
                    throw std::runtime_error("expected an 'encoding-type' attribute for H5AD-like formats");
                }
                auto ehandle = ohandle.openAttribute("encoding-type");
                H5std_string name;
                H5::StrType stype = ehandle.getStrType();
                ehandle.read(stype, name);

                csc = (std::string(name) != std::string("csc_matrix")); // yes, the flip is deliberate, see above.

            } else {
                throw std::runtime_error("expected a 'shape' attribute or dataset");
            }
        }
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    std::shared_ptr<tatami::Matrix<int, int> > mat;
    try {
        if (is_dense) {
            mat.reset(new tatami::HDF5DenseMatrix<int, int, true>(path, name));
        } else if (csc) {
            mat.reset(new tatami::HDF5CompressedSparseMatrix<false, int, int>(nr, nc, path, name + "/data", name + "/indices", name + "/indptr"));
        } else {
            mat.reset(new tatami::HDF5CompressedSparseMatrix<true, int, int>(nr, nc, path, name + "/data", name + "/indices", name + "/indptr"));
        }
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    // The HDF5 library can't handle parallelization, and in any case, it's
    // probably inefficient to lock on each read (especially given that we'd
    // need a large number of small reads to maintain memory usage below its
    // limit across all threads). So we just disable it.
    enable_parallel = false;

    NumericMatrix output;
    try {
        output = sparse_from_tatami(mat.get(), layered);
    } catch (std::exception& e) {
        enable_parallel = false;
        throw e;
    }

    return output;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(read_hdf5_matrix) {
    emscripten::function("read_hdf5_matrix", &read_hdf5_matrix);
}
/**
 * @endcond
 */
