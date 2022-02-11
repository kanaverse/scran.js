#include <emscripten.h>
#include <emscripten/bind.h>
#include "H5Cpp.h"
#include <vector>
#include <string>

/**
 * @brief Names of objects extracted from the HDF5 file.
 *
 * This contains the names and types of the various groups/datasets inside a HDF5 file.
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

    std::vector<char> buffer_;
    std::vector<int> runs_;
    std::vector<int> types_;
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
    H5::H5File handle(path, H5F_ACC_RDONLY);

    ExtractedHDF5Names output;
    std::vector<std::string> collected;
    extract_hdf5_names_(handle, "", collected, output.types_);

    size_t n = 0;
    for (const auto& x : collected) {
        n += x.size();
        output.runs_.push_back(x.size());
    }

    output.buffer_.resize(n);
    size_t i = 0;
    for (const auto& x : collected) {
        for (auto y : x) {
            output.buffer_[i] = y;
            ++i;
        }
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
}
/**
 * @endcond
 */
