#include <emscripten.h>
#include <emscripten/bind.h>

#include "utils.h"
#include "read_utils.h"
#include "NumericMatrix.h"
#include "parallel.h"

#include "H5Cpp.h"
#include "tatami_hdf5/tatami_hdf5.hpp"

struct Hdf5MatrixDetails {
    bool is_dense;
    bool csc = true;
    bool is_integer;
    size_t nr, nc;
};

Hdf5MatrixDetails extract_hdf5_matrix_details_internal(const std::string& path, const std::string& name) {
    Hdf5MatrixDetails output;
    auto& is_dense = output.is_dense;
    auto& csc = output.csc;
    auto& nr = output.nr;
    auto& nc = output.nc;

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

            if (!ohandle.exists("data") || ohandle.childObjType("data") != H5O_TYPE_DATASET) {
                throw std::runtime_error("expected a 'data' dataset");
            }
            auto dhandle = ohandle.openDataSet("data");
            output.is_integer = dhandle.getDataType().getClass() == H5T_INTEGER;

        } else {
            auto dhandle = handle.openDataSet(name);
            auto dspace = dhandle.getSpace();
            if (dspace.getSimpleExtentNdims() != 2) {
                throw std::runtime_error("expected a 2-dimensional dataset for a dense matrix");
            }

            hsize_t dims[2];
            dspace.getSimpleExtentDims(dims);
            nr = dims[1]; // transposed deliberately, as HDF5 rows are typically samples => array columns.
            nc = dims[0];
            output.is_integer = dhandle.getDataType().getClass() == H5T_INTEGER;
        }
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    return output;
}

void extract_hdf5_matrix_details(std::string path, std::string name, uintptr_t ptr) {
    auto details = extract_hdf5_matrix_details_internal(path, name);
    auto output = reinterpret_cast<int32_t*>(ptr);
    output[0] = details.is_dense;
    output[1] = details.csc;
    output[2] = details.nr;
    output[3] = details.nc;
    output[4] = details.is_integer;
    return;
}

template<typename T>
NumericMatrix read_hdf5_matrix_internal(
    size_t nr, 
    size_t nc, 
    bool is_dense, 
    bool csc, 
    const std::string& path, 
    const std::string name, 
    bool layered, 
    bool row_subset, 
    uintptr_t row_offset, 
    int row_length,
    bool col_subset, 
    uintptr_t col_offset,
    int col_length)
{
    if (!is_dense && !csc && !layered && !row_subset && !col_subset) {
        return NumericMatrix(new tatami::CompressedSparseRowMatrix<double, int, std::vector<T> >(
            tatami_hdf5::load_hdf5_compressed_sparse_matrix<true, double, int, std::vector<T> >(nr, nc, path, name + "/data", name + "/indices", name + "/indptr")
        ));

    } else {
        std::shared_ptr<tatami::Matrix<T, int> > mat;
        try {
            if (is_dense) {
                mat.reset(new tatami_hdf5::Hdf5DenseMatrix<T, int, true>(path, name));
            } else if (csc) {
                mat.reset(new tatami_hdf5::Hdf5CompressedSparseMatrix<false, T, int>(nr, nc, path, name + "/data", name + "/indices", name + "/indptr"));
            } else {
                mat.reset(new tatami_hdf5::Hdf5CompressedSparseMatrix<true, T, int>(nr, nc, path, name + "/data", name + "/indices", name + "/indptr"));
            }

        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }

        if (row_subset) {
            auto offset_ptr = reinterpret_cast<const int*>(row_offset);
            check_subset_indices<true>(offset_ptr, row_length, mat->nrow());
            auto smat = tatami::make_DelayedSubset<0>(std::move(mat), std::vector<int>(offset_ptr, offset_ptr + row_length));
            mat = std::move(smat);
        }

        if (col_subset) {
            auto offset_ptr = reinterpret_cast<const int*>(col_offset);
            check_subset_indices<false>(offset_ptr, col_length, mat->ncol());
            auto smat = tatami::make_DelayedSubset<1>(std::move(mat), std::vector<int>(offset_ptr, offset_ptr + col_length));
            mat = std::move(smat);
        }

        return sparse_from_tatami(mat.get(), layered);
    }
}

NumericMatrix read_hdf5_matrix(
    std::string path, 
    std::string name, 
    bool force_integer, 
    bool layered,
    bool row_subset, 
    uintptr_t row_offset, 
    int row_length,
    bool col_subset, 
    uintptr_t col_offset,
    int col_length)
{
    auto details = extract_hdf5_matrix_details_internal(path, name);
    const auto& is_dense = details.is_dense;
    const auto& csc = details.csc;
    const auto& nr = details.nr;
    const auto& nc = details.nc;

    if (force_integer || details.is_integer) {
        return read_hdf5_matrix_internal<int>(nr, nc, is_dense, csc, path, name, layered, row_subset, row_offset, row_length, col_subset, col_offset, col_length);
    } else {
        return read_hdf5_matrix_internal<double>(nr, nc, is_dense, csc, path, name, false, row_subset, row_offset, row_length, col_subset, col_offset, col_length);
    }
}

EMSCRIPTEN_BINDINGS(read_hdf5_matrix) {
    emscripten::function("read_hdf5_matrix", &read_hdf5_matrix);
    emscripten::function("extract_hdf5_matrix_details", &extract_hdf5_matrix_details);
}
