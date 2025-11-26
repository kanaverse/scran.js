#include <emscripten.h>
#include <emscripten/bind.h>

#include <cstdint>
#include <string>
#include <stdexcept>
#include <cstddef>
#include <vector>

#include "utils.h"
#include "read_utils.h"
#include "NumericMatrix.h"

#include "H5Cpp.h"
#include "tatami_hdf5/tatami_hdf5.hpp"

bool is_hdf5_dense(const std::string& path, const std::string& name) {
    H5::H5File handle(path, H5F_ACC_RDONLY);
    return (handle.childObjType(name) == H5O_TYPE_DATASET);
}

emscripten::val extract_hdf5_matrix_details(const std::string& path, const std::string& name) {
    auto output = emscripten::val::object();

    try {
        H5::H5File handle(path, H5F_ACC_RDONLY);

        if (handle.childObjType(name) != H5O_TYPE_DATASET) {
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
                output.set("rows", int2js(dims[0]));
                output.set("columns", int2js(dims[1]));
                output.set("format", "csc");

            } else if (ohandle.attrExists("shape")) { // H5AD 
                auto shandle = ohandle.openAttribute("shape");
                check_shape(shandle);

                hsize_t dims[2];
                shandle.read(H5::PredType::NATIVE_HSIZE, dims);
                // yes, the flip is deliberate, because of how H5AD puts its features in the columns.
                output.set("rows", int2js(dims[1]));
                output.set("columns", int2js(dims[0]));

                if (!ohandle.attrExists("encoding-type")) {
                    throw std::runtime_error("expected an 'encoding-type' attribute for H5AD-like formats");
                }
                auto ehandle = ohandle.openAttribute("encoding-type");
                std::string name;
                H5::StrType stype = ehandle.getStrType();
                ehandle.read(stype, name);

                // yes, the flip is deliberate, see above.
                if (name == std::string("csc_matrix")) {
                    output.set("format", "csr");
                } else {
                    output.set("format", "csc");
                }

            } else {
                throw std::runtime_error("expected a 'shape' attribute or dataset");
            }

            if (!ohandle.exists("data") || ohandle.childObjType("data") != H5O_TYPE_DATASET) {
                throw std::runtime_error("expected a 'data' dataset");
            }
            auto dhandle = ohandle.openDataSet("data");
            output.set("is_integer", dhandle.getDataType().getClass() == H5T_INTEGER);

        } else {
            auto dhandle = handle.openDataSet(name);
            auto dspace = dhandle.getSpace();
            if (dspace.getSimpleExtentNdims() != 2) {
                throw std::runtime_error("expected a 2-dimensional dataset for a dense matrix");
            }

            hsize_t dims[2];
            dspace.getSimpleExtentDims(dims);
            // again, transposed deliberately, as HDF5 rows are typically samples => array columns.
            output.set("rows", int2js(dims[1])); 
            output.set("columns", int2js(dims[0]));
            output.set("is_integer", dhandle.getDataType().getClass() == H5T_INTEGER);
            output.set("format", "dense");
        }
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    return output;
}

template<typename Type_>
NumericMatrix apply_post_processing(
    std::shared_ptr<tatami::Matrix<Type_, MatrixIndex> > mat,
    bool sparse,
    bool layered, 
    bool row_subset, 
    std::uintptr_t row_offset, 
    std::size_t row_length,
    bool col_subset, 
    std::uintptr_t col_offset,
    std::size_t col_length
) {
    if (row_subset) {
        auto offset_ptr = reinterpret_cast<const std::int32_t*>(row_offset);
        check_subset_indices<true>(offset_ptr, row_length, mat->nrow());
        auto smat = tatami::make_DelayedSubset(std::move(mat), std::vector<std::int32_t>(offset_ptr, offset_ptr + row_length), true);
        mat = std::move(smat);
    }

    if (col_subset) {
        auto offset_ptr = reinterpret_cast<const std::int32_t*>(col_offset);
        check_subset_indices<false>(offset_ptr, col_length, mat->ncol());
        auto smat = tatami::make_DelayedSubset(std::move(mat), std::vector<std::int32_t>(offset_ptr, offset_ptr + col_length), false);
        mat = std::move(smat);
    }

    if (sparse) {
        return sparse_from_tatami(*mat, layered);
    } else {
        return NumericMatrix(tatami::convert_to_dense<MatrixValue, MatrixIndex, Type_>(*mat, true, {}));
    }
}

template<typename Type_>
NumericMatrix initialize_from_hdf5_dense_internal(
    const std::string& path, 
    const std::string& name, 
    bool trans,
    bool sparse,
    bool layered, 
    bool row_subset, 
    std::uintptr_t row_offset, 
    JsFakeInt row_length_raw,
    bool col_subset, 
    std::uintptr_t col_offset,
    JsFakeInt col_length_raw
) {
    NumericMatrix mat;

    try {
        mat = apply_post_processing<Type_>(
            std::make_shared<tatami_hdf5::DenseMatrix<Type_, std::int32_t> >(path, name, trans),
            sparse,
            layered, 
            row_subset, 
            row_offset, 
            js2int<std::size_t>(row_length_raw), 
            col_subset, 
            col_offset, 
            js2int<std::size_t>(col_length_raw)
        );
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    return mat;
}

NumericMatrix initialize_from_hdf5_dense(
    std::string path, 
    std::string name, 
    bool trans,
    bool force_integer,
    bool sparse,
    bool layered, 
    bool row_subset, 
    std::uintptr_t row_offset, 
    JsFakeInt row_length_raw,
    bool col_subset, 
    std::uintptr_t col_offset,
    JsFakeInt col_length_raw
) {
    bool as_integer = force_integer;
    if (!force_integer) {
        try {
            H5::H5File handle(path, H5F_ACC_RDONLY);
            auto dhandle = handle.openDataSet(name);
            as_integer = dhandle.getTypeClass() == H5T_INTEGER;
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }
    }

    const auto row_length = js2int<std::size_t>(row_length_raw);
    const auto col_length = js2int<std::size_t>(col_length_raw);

    if (as_integer) {
        return initialize_from_hdf5_dense_internal<std::int32_t>(path, name, trans, sparse, layered, row_subset, row_offset, row_length, col_subset, col_offset, col_length);
    } else {
        return initialize_from_hdf5_dense_internal<double>(path, name, trans, sparse, false, row_subset, row_offset, row_length, col_subset, col_offset, col_length);
    }
}

template<typename Type_>
NumericMatrix initialize_from_hdf5_sparse_internal(
    const std::string& path, 
    const std::string& data_name, 
    const std::string& indices_name, 
    const std::string& indptr_name, 
    std::int32_t nr,
    std::int32_t nc,
    bool csc,
    bool layered, 
    bool row_subset, 
    std::uintptr_t row_offset, 
    std::size_t row_length,
    bool col_subset, 
    std::uintptr_t col_offset,
    std::size_t col_length
) {
    NumericMatrix output;

    try {
        std::shared_ptr<tatami::Matrix<Type_, std::int32_t> > mat;
        if (!layered && !csc && !row_subset && !col_subset) {
            // Don't do the same with CSC matrices; there is an implicit
            // expectation that all instances of this function prefer row matrices,
            // and if we did it with CSC, we'd get a column-major matrix instead.
            mat = tatami_hdf5::load_compressed_sparse_matrix<Type_, std::int32_t, std::vector<Type_> >(nr, nc, path, data_name, indices_name, indptr_name, true);
        } else {
            mat.reset(new tatami_hdf5::CompressedSparseMatrix<Type_, std::int32_t>(nr, nc, path, data_name, indices_name, indptr_name, !csc));
        }

        output = apply_post_processing(
            std::move(mat),
            true,
            layered, 
            row_subset, 
            row_offset, 
            row_length, 
            col_subset, 
            col_offset, 
            col_length
        );

    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    return output;
}

NumericMatrix initialize_from_hdf5_sparse(
    std::string path, 
    std::string data_name, 
    std::string indices_name, 
    std::string indptr_name, 
    JsFakeInt nr_raw,
    JsFakeInt nc_raw,
    bool csc,
    bool force_integer, 
    bool layered,
    bool row_subset, 
    std::uintptr_t row_offset, 
    JsFakeInt row_length_raw,
    bool col_subset, 
    std::uintptr_t col_offset,
    JsFakeInt col_length_raw
) {
    bool as_integer = force_integer;
    if (!force_integer) {
        try {
            H5::H5File handle(path, H5F_ACC_RDONLY);
            auto dhandle = handle.openDataSet(data_name);
            as_integer = dhandle.getTypeClass() == H5T_INTEGER;
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }
    }

    const auto nr = js2int<MatrixIndex>(nr_raw);
    const auto nc = js2int<MatrixIndex>(nc_raw);
    const auto row_length = js2int<std::size_t>(row_length_raw);
    const auto col_length = js2int<std::size_t>(col_length_raw);

    if (as_integer) {
        return initialize_from_hdf5_sparse_internal<std::int32_t>(path, data_name, indices_name, indptr_name, nr, nc, csc, layered, row_subset, row_offset, row_length, col_subset, col_offset, col_length);
    } else {
        return initialize_from_hdf5_sparse_internal<double>(path, data_name, indices_name, indptr_name, nr, nc, csc, false, row_subset, row_offset, row_length, col_subset, col_offset, col_length);
    }
}

EMSCRIPTEN_BINDINGS(read_hdf5_matrix) {
    emscripten::function("is_hdf5_dense", &is_hdf5_dense, emscripten::return_value_policy::take_ownership());
    emscripten::function("extract_hdf5_matrix_details", &extract_hdf5_matrix_details, emscripten::return_value_policy::take_ownership());
    emscripten::function("initialize_from_hdf5_dense", &initialize_from_hdf5_dense, emscripten::return_value_policy::take_ownership());
    emscripten::function("initialize_from_hdf5_sparse", &initialize_from_hdf5_sparse, emscripten::return_value_policy::take_ownership());
}
