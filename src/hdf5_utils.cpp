#include <emscripten.h>
#include <emscripten/bind.h>
#include "H5Cpp.h"
#include <vector>
#include <string>
#include <cstdint>

/**
 * @file hdf5_utils.cpp
 *
 * @brief Utilities for reading and writing a HDF5 file.
 */

/**
 * @brief Details about a group, including its children. 
 */
struct H5GroupDetails {
    /**
     * @param file Path to a file.
     * @param name Name of a group inside the file.
     */
    H5GroupDetails(std::string file, std::string name) {
        H5::H5File handle(file, H5F_ACC_RDONLY);
        H5::Group ghandle = handle.openGroup(name);

        std::vector<std::string> collected;
        size_t num = ghandle.getNumObjs();
        for (size_t i = 0; i < num; ++i) {
            auto child_name = ghandle.getObjnameByIdx(i);
            collected.push_back(child_name);

            auto child_type = ghandle.childObjType(child_name);
            if (child_type == H5O_TYPE_GROUP) {
                types_.push_back(0);
            } else if (child_type == H5O_TYPE_DATASET) {
                types_.push_back(1);
            } else {
                types_.push_back(2);
            }
        }
        
        runs_.resize(collected.size());
        size_t n = 0;
        for (size_t i = 0; i < collected.size(); ++i) {
            const auto& x = collected[i];
            n += x.size();
            runs_[i] = x.size();
        }

        buffer_.resize(n);
        size_t i = 0;
        for (const auto& x : collected) {
            for (auto y : x) {
                buffer_[i] = y;
                ++i;
            }
        }
    }

    /**
     * @return An `Uint8Array` view containing the concatenated names of all objects inside the file.
     */
    emscripten::val buffer() const {
        return emscripten::val(emscripten::typed_memory_view(buffer_.size(), buffer_.data()));
    }

    /**
     * @return An `Int32Array` view containing the lengths of the names,
     * to be used to index into the view returned by `buffer()`.
     */
    emscripten::val lengths() const {
        return emscripten::val(emscripten::typed_memory_view(runs_.size(), runs_.data()));
    }

    /**
     * @return An `Int32Array` view containing the types for each child.
     * This can either be 0 for a Group, 1 for a DataSet, or 2 for something else.
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

std::string guess_hdf5_type(const H5::DataSet& dhandle, const H5::DataType& dtype) {
    auto dclass = dtype.getClass();
    std::string type;

    if (dclass == H5T_INTEGER) {
        {
            H5::IntType itype(dhandle);
            if (itype.getSign() == H5T_SGN_NONE) {
                type += "Uint";
            } else {
                type += "Int";
            }
        }
        auto isize = dtype.getSize();
        if (isize <= 1) {
            type += "8";
        } else if (isize <= 2) {
            type += "16";
        } else if (isize <= 4) {
            type += "32";
        } else {
            type += "64";
        }

    } else if (dclass == H5T_FLOAT) {
        type += "Float";
        auto isize = dtype.getSize();
        if (isize <= 4) {
            type += "32";
        } else {
            type += "64";
        }

    } else if (dclass == H5T_STRING) {
        type = "String";
    } else {
        type = "Other";
    }

    return type;
}


/**
 * @brief Details about a HDF5 dataset, without loading in the data.
 */
struct H5DataSetDetails {
    /**
     * @param f Path to a file.
     * @param n Name of a dataset inside the file.
     */
    H5DataSetDetails(std::string file, std::string name) {
        H5::H5File handle(file, H5F_ACC_RDONLY);
        auto dhandle = handle.openDataSet(name);

        auto dtype = dhandle.getDataType();
        type_ = guess_hdf5_type(dhandle, dtype);

        auto dspace = dhandle.getSpace();
        int ndims = dspace.getSimpleExtentNdims();
        std::vector<hsize_t> dims(ndims);
        dspace.getSimpleExtentDims(dims.data());
        shape_.insert(shape_.end(), dims.begin(), dims.end());

        return;
    }

    /**
     * @return Type of the dataset - `"string"`, `"integer"`, `"float"` or `"other"`.
     */
    std::string type() const {
        return type_;
    }

    /**
     * @return An `Int32Array` view of a vector containing the dimensions.
     */
    emscripten::val shape() const {
        return emscripten::val(emscripten::typed_memory_view(shape_.size(), shape_.data()));        
    }

    /**
     * @cond
     */
    std::string type_;
    std::vector<int> shape_;
    /**
     * @endcond
     */
};

/**
 * @brief Contents of a loaded HDF5 dataset.
 */
struct LoadedH5DataSet {
    /**
     * @cond
     */
    std::string type_;
    std::vector<int> shape_;

    // Store all the possible types here.
    std::vector<uint8_t> u8_data;
    std::vector<int8_t> i8_data;
    std::vector<uint16_t> u16_data;
    std::vector<int16_t> i16_data;
    std::vector<uint32_t> u32_data;
    std::vector<int32_t> i32_data;
    std::vector<uint64_t> u64_data;
    std::vector<int64_t> i64_data;
    std::vector<float> f32_data;
    std::vector<double> f64_data;
    std::vector<char> str_data;

    // For strings.
    std::vector<int> lengths_;
    /**
     * @endcond
     */

    /**
     * @return Type of the dataset - integer, float, string or other.
     */
    std::string type() const {
        return type_;
    }

    /**
     * @return An `Int32Array` view of a vector containing the dimensions.
     */
    emscripten::val shape() const {
        return emscripten::val(emscripten::typed_memory_view(shape_.size(), shape_.data()));        
    }

    /**
     * @return A `TypedArray` view containing an integer dataset, a floating-point dataset,
     * or a `Uint8Array` buffer with concatenated strings (see `lengths()`).
     */
    emscripten::val values() const {
        if (type_ == "Uint8") {
            return emscripten::val(emscripten::typed_memory_view(u8_data.size(), u8_data.data()));
        } else if (type_ == "Int8") {
            return emscripten::val(emscripten::typed_memory_view(i8_data.size(), i8_data.data()));
        } else if (type_ == "Uint16") {
            return emscripten::val(emscripten::typed_memory_view(u16_data.size(), u16_data.data()));
        } else if (type_ == "Int16") {
            return emscripten::val(emscripten::typed_memory_view(i16_data.size(), i16_data.data()));
        } else if (type_ == "Uint32") {
            return emscripten::val(emscripten::typed_memory_view(u32_data.size(), u32_data.data()));
        } else if (type_ == "Int32") {
            return emscripten::val(emscripten::typed_memory_view(i32_data.size(), i32_data.data()));
        } else if (type_ == "Uint64") {
            return emscripten::val(emscripten::typed_memory_view(u64_data.size(), u64_data.data()));
        } else if (type_ == "Int64") {
            return emscripten::val(emscripten::typed_memory_view(i64_data.size(), i64_data.data()));
        } else if (type_ == "Float32") {
            return emscripten::val(emscripten::typed_memory_view(f32_data.size(), f32_data.data()));
        } else if (type_ == "Float64") {
            return emscripten::val(emscripten::typed_memory_view(f64_data.size(), f64_data.data()));
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

    /**
     * @param path Path to the HDF5 file.
     * @param name Name of a dataset inside the HDF5 file.
     */
    LoadedH5DataSet(std::string path, std::string name) {
        try {
            H5::H5File handle(path, H5F_ACC_RDONLY);

            auto dhandle = handle.openDataSet(name);
            auto dspace = dhandle.getSpace();
            auto dtype = dhandle.getDataType();
            type_ = guess_hdf5_type(dhandle, dtype);

            int ndims = dspace.getSimpleExtentNdims();
            std::vector<hsize_t> dims(ndims);
            dspace.getSimpleExtentDims(dims.data());
            shape_.insert(shape_.end(), dims.begin(), dims.end());

            hsize_t full_length = 1;
            for (auto d : dims) {
                full_length *= d;
            }

            if (type_ == "Uint8") {
                u8_data.resize(full_length);
                dhandle.read(u8_data.data(), H5::PredType::NATIVE_UINT8);

            } else if (type_ == "Int8") {
                i8_data.resize(full_length);
                dhandle.read(i8_data.data(), H5::PredType::NATIVE_INT8);

            } else if (type_ == "Uint16") {
                u16_data.resize(full_length);
                dhandle.read(u16_data.data(), H5::PredType::NATIVE_UINT16);

            } else if (type_ == "Int16") {
                i16_data.resize(full_length);
                dhandle.read(i16_data.data(), H5::PredType::NATIVE_INT16);

            } else if (type_ == "Uint32") {
                u32_data.resize(full_length);
                dhandle.read(u32_data.data(), H5::PredType::NATIVE_UINT32);

            } else if (type_ == "Int32") {
                i32_data.resize(full_length);
                dhandle.read(i32_data.data(), H5::PredType::NATIVE_INT32);

            } else if (type_ == "Uint64") {
                u64_data.resize(full_length);
                dhandle.read(u64_data.data(), H5::PredType::NATIVE_UINT64);

            } else if (type_ == "Int64") {
                i64_data.resize(full_length);
                dhandle.read(i64_data.data(), H5::PredType::NATIVE_INT64);

            } else if (type_ == "Float32") {
                f32_data.resize(full_length);
                dhandle.read(f32_data.data(), H5::PredType::NATIVE_FLOAT);

            } else if (type_ == "Float64") {
                f64_data.resize(full_length);
                dhandle.read(f64_data.data(), H5::PredType::NATIVE_DOUBLE);

            } else if (type_ == "String") {
                lengths_.resize(full_length);

                if (dtype.isVariableStr()) {
                    std::vector<char*> buffer(full_length);
                    dhandle.read(buffer.data(), dtype);

                    str_data.reserve(full_length); // guessing that each string is of at least length 1.
                    for (size_t i = 0; i < full_length; ++i) {
                        std::string current(buffer[i]);
                        lengths_[i] = current.size();
                        str_data.insert(str_data.end(), current.begin(), current.end());
                    }

                    H5Dvlen_reclaim(dtype.getId(), dspace.getId(), H5P_DEFAULT, buffer.data());

                } else {
                    size_t len = dtype.getSize();
                    std::vector<char> buffer(len * full_length);
                    dhandle.read(buffer.data(), dtype);

                    str_data.reserve(buffer.size()); // guessing that each string is of length 'len'.
                    auto start = buffer.data();
                    for (size_t i = 0; i < full_length; ++i, start += len) {
                        size_t j = 0;
                        for (; j < len && start[j] != '\0'; ++j) {}
                        lengths_[i] = j;
                        str_data.insert(str_data.end(), start, start + j);
                    }
                }
            }

        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }

        return;
    }
};

/**
 * @cond
 */
EMSCRIPTEN_BINDINGS(hdf5_utils) {
    emscripten::class_<H5GroupDetails>("H5GroupDetails")
        .constructor<std::string, std::string>()
        .function("buffer", &H5GroupDetails::buffer)
        .function("lengths", &H5GroupDetails::lengths)
        .function("types", &H5GroupDetails::types)
        ;

    emscripten::class_<H5DataSetDetails>("H5DataSetDetails")
        .constructor<std::string, std::string>()
        .function("type", &H5DataSetDetails::type)
        .function("shape", &H5DataSetDetails::shape)
        ;

    emscripten::class_<LoadedH5DataSet>("LoadedH5DataSet")
        .constructor<std::string, std::string>()
        .function("type", &LoadedH5DataSet::type)
        .function("shape", &LoadedH5DataSet::shape)
        .function("values", &LoadedH5DataSet::values)
        .function("lengths", &LoadedH5DataSet::lengths)
        ;
}
/**
 * @endcond
 */
