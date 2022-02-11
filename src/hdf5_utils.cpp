#include <emscripten.h>
#include <emscripten/bind.h>
#include "H5Cpp.h"
#include <vector>
#include <string>

/**
 * @file hdf5_utils.cpp
 *
 * @brief Utilities for extracting data from a HDF5 file.
 */

/**
 * @brief Names of objects extracted from the HDF5 file.
 */
struct ExtractedHDF5Names {
    /**
     * @return A `Uint8Array` view containing the concatenated names of all objects inside the file.
     */
    emscripten::val buffer() const {
        return emscripten::val(emscripten::typed_memory_view(buffer_.size(), buffer_.data()));
    }

    /**
     * @return A `Int32Array` view containing the lengths of the names,
     * to be used to index into the view returned by `buffer()`.
     */
    emscripten::val lengths() const {
        return emscripten::val(emscripten::typed_memory_view(runs_.size(), runs_.data()));
    }

    /**
     * @return A `Int32Array` view containing the type of each object.
     * This can be 0 (group), 1 (integer dataset), 2 (float dataset), 3 (string dataset) or 4 (other dataset).
     */
    emscripten::val types() const {
        return emscripten::val(emscripten::typed_memory_view(types_.size(), types_.data()));
    }

    /**
     * @cond
     */
    std::vector<char> buffer_;
    std::vector<int> runs_;
    std::vector<int> types_;
    /**
     * @endcond
     */
};

/**
 * @cond
 */
void extract_hdf5_names_(const H5::Group& current, 
    std::string sofar, 
    std::vector<std::string>& collected, 
    std::vector<int>& types)
{
    size_t num = current.getNumObjs();
    for (size_t i = 0; i < num; ++i) {
        auto child_name = current.getObjnameByIdx(i);
        auto child_type = current.childObjType(child_name);

        if (child_type == H5O_TYPE_GROUP) {
            auto gname = (sofar == "" ? child_name : sofar + "/" + child_name);
            collected.push_back(gname);
            types.push_back(0);
            auto handle = current.openGroup(child_name);
            extract_hdf5_names_(handle, gname, collected, types);

        } else if (child_type == H5O_TYPE_DATASET) {
            auto gname = (sofar == "" ? child_name : sofar + "/" + child_name);
            collected.push_back(gname);

            auto dhandle = current.openDataSet(child_name);
            auto dclass = dhandle.getDataType().getClass();
            if (dclass == H5T_INTEGER) {
                types.push_back(1);
            } else if (dclass == H5T_FLOAT) {
                types.push_back(2);
            } else if (dclass == H5T_STRING) {
                types.push_back(3);
            } else {
                types.push_back(4);
            }
        }
    }
}
/**
 * @cond
 */

/**
 * Extract the names of objects inside a HDF5 file.
 *
 * @param path Path to the HDF5 file.
 *
 * @return A `ExtractedHDF5Names` object that can be queried for the relevant details.
 */
ExtractedHDF5Names extract_hdf5_names(std::string path) {
    ExtractedHDF5Names output;
    std::vector<std::string> collected;

    try {
        H5::H5File handle(path, H5F_ACC_RDONLY);
        extract_hdf5_names_(handle, "", collected, output.types_);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    auto& lengths = output.runs_;
    lengths.resize(collected.size());
    size_t n = 0;
    for (size_t i = 0; i < collected.size(); ++i) {
        const auto& x = collected[i];
        n += x.size();
        lengths[i] = x.size();
    }

    auto& buffer = output.buffer_;
    buffer.resize(n);
    size_t i = 0;
    for (const auto& x : collected) {
        for (auto y : x) {
            buffer[i] = y;
            ++i;
        }
    }

    return output;
}

/**
 * @brief Contents of a loaded HDF5 dataset.
 */
struct LoadedHDF5Dataset {
    /**
     * @cond
     */
    int type_;
    std::vector<int> dimensions_;

    // Store all the possible types here.
    std::vector<int> int_data;
    std::vector<double> flt_data;
    std::vector<char> str_data;

    // For strings.
    std::vector<int> lengths_;
    /**
     * @endcond
     */

    /**
     * @return Type of the dataset - 1 (integer), 2 (floating-point) or 3 (string).
     */
    int type() const {
        return type_;
    }

    /**
     * @return An `Int32Array` view containing the dimensions of the dataset.
     */
    emscripten::val dimensions() const {
        return emscripten::val(emscripten::typed_memory_view(dimensions_.size(), dimensions_.data()));
    }

    /**
     * @return A `TypedArray` view containing an integer dataset, a floating-point dataset,
     * or a `Uint8Array` buffer with concatenated strings (see `lengths()`).
     */
    emscripten::val values() const {
        if (type_ == 1) {
            return emscripten::val(emscripten::typed_memory_view(int_data.size(), int_data.data()));
        } else if (type_ == 2) {
            return emscripten::val(emscripten::typed_memory_view(flt_data.size(), flt_data.data()));
        } else {
            return emscripten::val(emscripten::typed_memory_view(str_data.size(), str_data.data()));
        }
    }

    /**
     * @return An `Int32Array` view containing the lengths of strings in the concatenated buffer returned by `values()`.
     * Only useful when `type()` indicates a string dataset.
     */
    emscripten::val lengths() const {
        return emscripten::val(emscripten::typed_memory_view(lengths_.size(), lengths_.data()));
    }
};

/**
 * Extract the contents of a dataset inside a HDF5 file.
 *
 * @param path Path to the HDF5 file.
 * @param name Name of a dataset inside the HDF5 file.
 *
 * @return A `LoadedHDF5Dataset` object that can be queried for the dataset details.
 */
LoadedHDF5Dataset load_hdf5_dataset(std::string path, std::string name) {
    LoadedHDF5Dataset output;

    try {
        H5::H5File handle(path, H5F_ACC_RDONLY);

        auto dhandle = handle.openDataSet(name);
        auto dspace = dhandle.getSpace();
        auto dtype = dhandle.getDataType();
        auto dclass = dtype.getClass();

        int ndims = dspace.getSimpleExtentNdims();
        std::vector<hsize_t> dims(ndims);
        dspace.getSimpleExtentDims(dims.data());
        output.dimensions_.resize(ndims);
        std::copy(dims.begin(), dims.end(), output.dimensions_.data());

        hsize_t full_length = 1;
        for (auto d : dims) {
            full_length *= d;
        }

        if (dclass == H5T_INTEGER) {
            output.type_ = 1;
            output.int_data.resize(full_length);
            dhandle.read(output.int_data.data(), H5::PredType::NATIVE_INT);

        } else if (dclass == H5T_FLOAT) {
            output.type_ = 2;
            output.flt_data.resize(full_length);
            dhandle.read(output.flt_data.data(), H5::PredType::NATIVE_DOUBLE);

        } else if (dclass == H5T_STRING) {
            output.type_ = 3;
            output.lengths_.resize(full_length);

            if (dtype.isVariableStr()) {
                std::vector<char*> buffer(full_length);
                dhandle.read(buffer.data(), dtype);

                output.str_data.reserve(full_length); // guessing that each string is of at least length 1.
                for (size_t i = 0; i < full_length; ++i) {
                    std::string current(buffer[i]);
                    output.lengths_[i] = current.size();
                    output.str_data.insert(output.str_data.end(), current.begin(), current.end());
                }

                H5Dvlen_reclaim(dtype.getId(), dspace.getId(), H5P_DEFAULT, buffer.data());

            } else {
                size_t len = dtype.getSize();
                std::vector<char> buffer(len * full_length);
                dhandle.read(buffer.data(), dtype);

                output.str_data.reserve(buffer.size()); // guessing that each string is of length 'len'.
                auto start = buffer.data();
                for (size_t i = 0; i < full_length; ++i, start += len) {
                    size_t j = 0;
                    for (; j < len && start[j] != '\0'; ++j) {}
                    output.lengths_[i] = j; 
                    output.str_data.insert(output.str_data.end(), start, start + j);
                }
            }
        }

    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }

    return output;
}

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(hdf5_utils) {
    emscripten::class_<ExtractedHDF5Names>("ExtractedHDF5Names")
        .function("buffer", &ExtractedHDF5Names::buffer)
        .function("lengths", &ExtractedHDF5Names::lengths)
        .function("types", &ExtractedHDF5Names::types)
        ;

    emscripten::function("extract_hdf5_names", &extract_hdf5_names);

    emscripten::class_<LoadedHDF5Dataset>("LoadedHDF5Dataset")
        .function("values", &LoadedHDF5Dataset::values)
        .function("lengths", &LoadedHDF5Dataset::lengths)
        .function("type", &LoadedHDF5Dataset::type)
        .function("dimensions", &LoadedHDF5Dataset::dimensions)
        ;

    emscripten::function("load_hdf5_dataset", &load_hdf5_dataset);
}
/**
 * @endcond
 */
