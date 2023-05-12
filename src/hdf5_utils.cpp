#include <emscripten.h>
#include <emscripten/bind.h>
#include "H5Cpp.h"
#include <vector>
#include <string>
#include <cstdint>
#include <algorithm>
#include <unordered_map>

struct H5AttrDetails {
    void fill_attribute_names(const H5::H5Object& handle) {
        std::vector<std::string> collected;
        size_t num = handle.getNumAttrs();
        for (size_t i = 0; i < num; ++i) {
            auto attr = handle.openAttribute(i);
            collected.push_back(attr.getName());
        }

        attr_runs_.resize(collected.size());
        size_t n = 0;
        for (size_t i = 0; i < collected.size(); ++i) {
            const auto& x = collected[i];
            n += x.size();
            attr_runs_[i] = x.size();
        }

        attr_buffer_.resize(n);
        size_t i = 0;
        for (const auto& x : collected) {
            for (auto y : x) {
                attr_buffer_[i] = y;
                ++i;
            }
        }
    }

    std::vector<char> attr_buffer_;
    std::vector<int> attr_runs_;
};

template<class Handle>
std::string guess_hdf5_type(const Handle& handle, const H5::DataType& dtype) {
    auto dclass = dtype.getClass();
    std::string type;

    if (dclass == H5T_INTEGER) {
        bool is_unsigned = false;
        if constexpr(std::is_same<Handle, H5::DataSet>::value) {
            H5::IntType itype(handle);
            is_unsigned = (itype.getSign() == H5T_SGN_NONE);
        } else {
            // Assume it's an attribute.
            auto itype = handle.getIntType();
            is_unsigned = (itype.getSign() == H5T_SGN_NONE);
        }

        if (is_unsigned) {
            type += "Uint";
        } else {
            type += "Int";
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
            
    } else if (dclass == H5T_ENUM) {
        type = "Enum";

    } else {
        type = "Other";
    }

    return type;
}

/************* Unloaded details **************/

struct H5GroupDetails : public H5AttrDetails {
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
                child_types_.push_back(0);
            } else if (child_type == H5O_TYPE_DATASET) {
                child_types_.push_back(1);
            } else {
                child_types_.push_back(2);
            }
        }
        
        child_runs_.resize(collected.size());
        size_t n = 0;
        for (size_t i = 0; i < collected.size(); ++i) {
            const auto& x = collected[i];
            n += x.size();
            child_runs_[i] = x.size();
        }

        child_buffer_.resize(n);
        size_t i = 0;
        for (const auto& x : collected) {
            for (auto y : x) {
                child_buffer_[i] = y;
                ++i;
            }
        }

        fill_attribute_names(ghandle);
    }

public:
    emscripten::val child_buffer() const {
        return emscripten::val(emscripten::typed_memory_view(child_buffer_.size(), child_buffer_.data()));
    }

    emscripten::val child_lengths() const {
        return emscripten::val(emscripten::typed_memory_view(child_runs_.size(), child_runs_.data()));
    }

    emscripten::val child_types() const {
        return emscripten::val(emscripten::typed_memory_view(child_types_.size(), child_types_.data()));
    }

    std::vector<char> child_buffer_;
    std::vector<int> child_runs_;
    std::vector<int> child_types_;

public:
    emscripten::val attr_buffer() const {
        return emscripten::val(emscripten::typed_memory_view(attr_buffer_.size(), attr_buffer_.data()));
    }

    emscripten::val attr_lengths() const {
        return emscripten::val(emscripten::typed_memory_view(attr_runs_.size(), attr_runs_.data()));
    }
};

struct H5DataSetDetails : public H5AttrDetails {
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

        fill_attribute_names(dhandle);
        return;
    }

public:
    std::string type() const {
        return type_;
    }

    emscripten::val shape() const {
        return emscripten::val(emscripten::typed_memory_view(shape_.size(), shape_.data()));        
    }

    std::string type_;
    std::vector<int> shape_;

public:
    emscripten::val attr_buffer() const {
        return emscripten::val(emscripten::typed_memory_view(attr_buffer_.size(), attr_buffer_.data()));
    }

    emscripten::val attr_lengths() const {
        return emscripten::val(emscripten::typed_memory_view(attr_runs_.size(), attr_runs_.data()));
    }
};

/************* Loaded details **************/

struct LoadedH5Base {
    std::string type_;
    std::vector<int> shape_;

    // Store all the possible numeric types here.
    std::vector<uint8_t> u8_data;
    std::vector<int8_t> i8_data;
    std::vector<uint16_t> u16_data;
    std::vector<int16_t> i16_data;
    std::vector<uint32_t> u32_data;
    std::vector<int32_t> i32_data;
    std::vector<float> f32_data;
    std::vector<double> f64_data;
    std::vector<char> str_data;

    // embind can't deal with 64-bit types, see https://github.com/emscripten-core/emscripten/issues/11140.
    std::vector<double> u64_data; 
    std::vector<double> i64_data;

    // For strings.
    std::vector<int32_t> lengths_;

    // For enums.
    std::string enum_type;

protected:
    emscripten::val numeric_values_(const std::string& t) const {
        if (t == "Uint8") {
            return emscripten::val(emscripten::typed_memory_view(u8_data.size(), u8_data.data()));
        } else if (t == "Int8") {
            return emscripten::val(emscripten::typed_memory_view(i8_data.size(), i8_data.data()));
        } else if (t == "Uint16") {
            return emscripten::val(emscripten::typed_memory_view(u16_data.size(), u16_data.data()));
        } else if (t == "Int16") {
            return emscripten::val(emscripten::typed_memory_view(i16_data.size(), i16_data.data()));
        } else if (t == "Uint32") {
            return emscripten::val(emscripten::typed_memory_view(u32_data.size(), u32_data.data()));
        } else if (t == "Int32") {
            return emscripten::val(emscripten::typed_memory_view(i32_data.size(), i32_data.data()));
        } else if (t == "Uint64") {
            return emscripten::val(emscripten::typed_memory_view(u64_data.size(), u64_data.data()));
        } else if (t == "Int64") {
            return emscripten::val(emscripten::typed_memory_view(i64_data.size(), i64_data.data()));
        } else if (type_ == "Float32") {
            return emscripten::val(emscripten::typed_memory_view(f32_data.size(), f32_data.data()));
        } else { // a.k.a. if (type_ == "Float64") {
            return emscripten::val(emscripten::typed_memory_view(f64_data.size(), f64_data.data()));
        } 
    }

    emscripten::val numeric_values_() const {
        if (type_ == "Enum") {
            return numeric_values_(enum_type);
        } else {
            return numeric_values_(type_);
        }
    }

    emscripten::val string_buffer_() const {
        return emscripten::val(emscripten::typed_memory_view(str_data.size(), str_data.data()));
    }

    emscripten::val string_lengths_() const {
        return emscripten::val(emscripten::typed_memory_view(lengths_.size(), lengths_.data()));
    }

private:
    template<typename T, typename Tout>
    void fill_enum_levels(const H5::EnumType& etype, std::vector<Tout>& index) {
        int nlevels = etype.getNmembers();
        std::unordered_map<Tout, Tout> mapping;

        for (int l = 0; l < nlevels; ++l) {
            T v;
            etype.getMemberValue(l, &v);
            std::string name = etype.nameOf(&v, 1000); // name better be shorter than 1000 bytes!
            str_data.insert(str_data.end(), name.begin(), name.end());
            lengths_.push_back(name.size());
            mapping[v] = l;
        }

        for (auto& i : index) {
            auto it = mapping.find(i);
            if (it != mapping.end()) { 
                i = it->second;
            } else {
                i = nlevels; // some kind of fail flag here.
            }
        }
    }

    template<class Reader, class Handle>
    void fill_numeric_contents(const Handle& handle, const std::string& curtype, hsize_t full_length) {
        if (curtype == "Uint8") {
            u8_data.resize(full_length);
            Reader::read(handle, u8_data.data(), H5::PredType::NATIVE_UINT8);

        } else if (curtype == "Int8") {
            i8_data.resize(full_length);
            Reader::read(handle, i8_data.data(), H5::PredType::NATIVE_INT8);

        } else if (curtype == "Uint16") {
            u16_data.resize(full_length);
            Reader::read(handle, u16_data.data(), H5::PredType::NATIVE_UINT16);

        } else if (curtype == "Int16") {
            i16_data.resize(full_length);
            Reader::read(handle, i16_data.data(), H5::PredType::NATIVE_INT16);

        } else if (curtype == "Uint32") {
            u32_data.resize(full_length);
            Reader::read(handle, u32_data.data(), H5::PredType::NATIVE_UINT32);

        } else if (curtype == "Int32") {
            i32_data.resize(full_length);
            Reader::read(handle, i32_data.data(), H5::PredType::NATIVE_INT32);

        } else if (curtype == "Uint64") {
            u64_data.resize(full_length);
            Reader::read(handle, u64_data.data(), H5::PredType::NATIVE_DOUBLE); // see comments above about embind.

        } else if (curtype == "Int64") {
            i64_data.resize(full_length);
            Reader::read(handle, i64_data.data(), H5::PredType::NATIVE_DOUBLE); // see comments above about embind.

        } else if (curtype == "Float32") {
            f32_data.resize(full_length);
            Reader::read(handle, f32_data.data(), H5::PredType::NATIVE_FLOAT);

        } else if (curtype == "Float64") {
            f64_data.resize(full_length);
            Reader::read(handle, f64_data.data(), H5::PredType::NATIVE_DOUBLE);
        }
    }

protected:
    template<class Reader, class Handle>
    void fill_contents(const Handle& handle) {
        auto dtype = handle.getDataType();
        type_ = guess_hdf5_type(handle, dtype);

        auto dspace = handle.getSpace();
        int ndims = dspace.getSimpleExtentNdims();
        std::vector<hsize_t> dims(ndims);
        dspace.getSimpleExtentDims(dims.data());
        shape_.insert(shape_.end(), dims.begin(), dims.end());

        // Full length defaults to 1 for scalars when 'dims' is empty.
        hsize_t full_length = 1;
        for (auto d : dims) {
            full_length *= d;
        }

        if (type_ == "Enum") {
            H5::IntType itype;
            H5::EnumType etype;
            if constexpr(std::is_same<Handle, H5::DataSet>::value) {
                itype = H5::IntType(handle);
                etype = H5::EnumType(handle);
            } else {
                itype = handle.getIntType(); // Assume it's an attribute.
                etype = handle.getEnumType(); // Assume it's an attribute.
            }
            enum_type = guess_hdf5_type(handle, itype);
            fill_numeric_contents<Reader>(handle, enum_type, full_length);

            if (enum_type == "Uint8") {
                fill_enum_levels<uint8_t>(etype, u8_data);
            } else if (enum_type == "Int8") {
                fill_enum_levels<int8_t>(etype, i8_data);
            } else if (enum_type == "Uint16") {
                fill_enum_levels<uint16_t>(etype, u16_data);
            } else if (enum_type == "Int16") {
                fill_enum_levels<int16_t>(etype, i16_data);
            } else if (enum_type == "Uint32") {
                fill_enum_levels<uint32_t>(etype, u32_data);
            } else if (enum_type == "Int32") {
                fill_enum_levels<int32_t>(etype, i32_data);
            } else if (enum_type == "Uint64") {
                fill_enum_levels<uint64_t>(etype, u64_data);
            } else if (enum_type == "Int64") {
                fill_enum_levels<int64_t>(etype, i64_data);
            } else {
                throw std::runtime_error("unrecognized enum level type '" + enum_type + "'");
            }

        } else if (type_ == "String") {
            lengths_.resize(full_length);

            if (dtype.isVariableStr()) {
                std::vector<char*> buffer(full_length);
                Reader::read(handle, buffer.data(), dtype);

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
                Reader::read(handle, buffer.data(), dtype);

                str_data.reserve(buffer.size()); // guessing that each string is of length 'len'.
                auto start = buffer.data();
                for (size_t i = 0; i < full_length; ++i, start += len) {
                    size_t j = 0;
                    for (; j < len && start[j] != '\0'; ++j) {}
                    lengths_[i] = j;
                    str_data.insert(str_data.end(), start, start + j);
                }
            }

        } else if (type_ != "Other") { // don't fail outright; we want to be able to construct the LoadedH5Dataset so that users can call type().
            fill_numeric_contents<Reader>(handle, type_, full_length);
        }
    }
};

struct LoadedH5DataSet : public LoadedH5Base, public H5AttrDetails {
    struct Internal {
        template<class Handle, typename T, class MemType>
        static void read(const Handle& dhandle, T* buffer, const MemType& mem_type) {
            dhandle.read(buffer, mem_type);            
        }
    };

    LoadedH5DataSet(std::string path, std::string name) {
        try {
            H5::H5File handle(path, H5F_ACC_RDONLY);
            auto dhandle = handle.openDataSet(name);
            fill_contents<Internal>(dhandle);
            fill_attribute_names(dhandle);
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }
        return;
    }

public:
    std::string type() const {
        return type_;
    }

    emscripten::val shape() const {
        return emscripten::val(emscripten::typed_memory_view(shape_.size(), shape_.data()));        
    }

    emscripten::val string_lengths() const {
        return string_lengths_();
    }

    emscripten::val string_buffer() const {
        return string_buffer_();
    }

    emscripten::val numeric_values() const {
        return numeric_values_();
    }

public:
    emscripten::val attr_buffer() const {
        return emscripten::val(emscripten::typed_memory_view(attr_buffer_.size(), attr_buffer_.data()));
    }

    emscripten::val attr_lengths() const {
        return emscripten::val(emscripten::typed_memory_view(attr_runs_.size(), attr_runs_.data()));
    }
};

struct LoadedH5Attr : public LoadedH5Base {
    struct Internal {
        template<class Handle, typename T, class MemType>
        static void read(const Handle& ahandle, T* buffer, const MemType& mem_type) {
            ahandle.read(mem_type, buffer);
        } 
    };

    LoadedH5Attr(std::string path, std::string name, std::string attr) {
        try {
            H5::H5File handle(path, H5F_ACC_RDONLY);

            auto child_type = handle.childObjType(name);
            if (child_type == H5O_TYPE_GROUP) {
                auto ghandle = handle.openGroup(name);
                auto ahandle = ghandle.openAttribute(attr);
                fill_contents<Internal>(ahandle);
            } else if (child_type == H5O_TYPE_DATASET) {
                auto dhandle = handle.openDataSet(name);
                auto ahandle = dhandle.openAttribute(attr);
                fill_contents<Internal>(ahandle);
            } else {
                throw std::runtime_error("cannot fetch attribute from unknown HDF5 object '" + name + "'");
            }

        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }

        return;
    }

public:
    std::string type() const {
        return type_;
    }

    emscripten::val shape() const {
        return emscripten::val(emscripten::typed_memory_view(shape_.size(), shape_.data()));        
    }

    emscripten::val string_lengths() const {
        return string_lengths_();
    }

    emscripten::val string_buffer() const {
        return string_buffer_();
    }

    emscripten::val numeric_values() const {
        return numeric_values_();
    }
};

/************* File creators **************/

void create_hdf5_file(std::string path) {
    H5::H5File handle(path, H5F_ACC_TRUNC);
    return;
}

void create_hdf5_group(std::string path, std::string name) {
    H5::H5File handle(path, H5F_ACC_RDWR);
    handle.createGroup(name);
    return;
}

/************* Writing utilities **************/

std::vector<hsize_t> process_shape(int nshape, uintptr_t shape) {
    std::vector<hsize_t> dims(nshape);
    auto sptr = reinterpret_cast<const int32_t*>(shape);
    std::copy(sptr, sptr + nshape, dims.begin());
    return dims;
}

H5::DataType choose_numeric_data_type(const std::string& type) {
    if (type == "Uint8") {
        return H5::PredType::NATIVE_UINT8;
    } else if (type == "Int8") {
        return H5::PredType::NATIVE_INT8;
    } else if (type == "Uint16") {
        return H5::PredType::NATIVE_UINT16;
    } else if (type == "Int16") {
        return H5::PredType::NATIVE_INT16;
    } else if (type == "Uint32") {
        return H5::PredType::NATIVE_UINT32;
    } else if (type == "Int32") {
        return H5::PredType::NATIVE_INT32;
    } else if (type == "Uint64") {
        return H5::PredType::NATIVE_UINT64;
    } else if (type == "Int64") {
        return H5::PredType::NATIVE_INT64;
    } else if (type == "Float32") {
        return H5::PredType::NATIVE_FLOAT;
   } else { // a.k.a. if (type == "Float64") {
        return H5::PredType::NATIVE_DOUBLE;
   }
}

H5::DataType choose_string_data_type(int max_str_len) {
    return H5::StrType(0, std::max(1, max_str_len)); // Make sure that is at least of length 1.
}

H5::DataType choose_enum_data_type(size_t nlevels, uintptr_t level_lengths, uintptr_t level_buffer) {
    auto buf_ptr = reinterpret_cast<const uint8_t*>(level_buffer); 
    auto len_ptr = reinterpret_cast<const int32_t*>(level_lengths);
    H5::EnumType dtype(H5::PredType::NATIVE_UINT32);

    std::vector<uint8_t> name_buffer;
    for (size_t i = 0; i < nlevels; ++i) {
        name_buffer.resize(len_ptr[i] + 1);
        std::copy(buf_ptr, buf_ptr + len_ptr[i], name_buffer.data());
        name_buffer.back() = 0; // set null terminator.

        uint32_t type = i;
        dtype.insert(reinterpret_cast<char*>(name_buffer.data()), &type);
        buf_ptr += len_ptr[i];
    }
    
    return dtype;
}

template<class Reader, class Handle>
void write_numeric_hdf5_base(Handle& handle, const std::string& type, uintptr_t data) {
    if (type == "Uint8WasmArray") {
        Reader::write(handle, reinterpret_cast<const uint8_t*>(data), H5::PredType::NATIVE_UINT8);
    } else if (type == "Int8WasmArray") {
        Reader::write(handle, reinterpret_cast<const int8_t*>(data), H5::PredType::NATIVE_INT8);
    } else if (type == "Uint16WasmArray") {
        Reader::write(handle, reinterpret_cast<const uint16_t*>(data), H5::PredType::NATIVE_UINT16);
    } else if (type == "Int16WasmArray") {
        Reader::write(handle, reinterpret_cast<const int16_t*>(data), H5::PredType::NATIVE_INT16);
    } else if (type == "Uint32WasmArray") {
        Reader::write(handle, reinterpret_cast<const uint32_t*>(data), H5::PredType::NATIVE_UINT32);
    } else if (type == "Int32WasmArray") {
        Reader::write(handle, reinterpret_cast<const int32_t*>(data), H5::PredType::NATIVE_INT32);
    } else if (type == "Uint64WasmArray") {
        Reader::write(handle, reinterpret_cast<const double*>(data), H5::PredType::NATIVE_UINT64);
    } else if (type == "Int64WasmArray") {
        Reader::write(handle, reinterpret_cast<const double*>(data), H5::PredType::NATIVE_INT64);
    } else if (type == "Float32WasmArray") {
        Reader::write(handle, reinterpret_cast<const float*>(data), H5::PredType::NATIVE_FLOAT);
    } else if (type == "Float64WasmArray") {
        Reader::write(handle, reinterpret_cast<const double*>(data), H5::PredType::NATIVE_DOUBLE);
    } else {
        throw std::runtime_error(std::string("unknown supported type '") + type + "' for HDF5 writing");
    }
}

template<class Reader, class Handle>
void write_string_hdf5_base(Handle& handle, size_t n, uintptr_t lengths, uintptr_t buffer) {
    auto buf_ptr = reinterpret_cast<const uint8_t*>(buffer);
    auto len_ptr = reinterpret_cast<const int32_t*>(lengths);

    auto stype = handle.getStrType();
    if (stype.isVariableStr()) {
        throw std::runtime_error("writing variable-length strings is not yet supported");
    }

    int32_t max_len = stype.getSize();
    std::vector<char> temp(max_len * n);
    auto it = temp.data();
    for (size_t i = 0; i < n; ++i, it += max_len) {
        std::copy(buf_ptr, buf_ptr + std::min(len_ptr[i], max_len), it);
        buf_ptr += len_ptr[i];
    }

    Reader::write(handle, temp.data(), stype);
    return;
}

void configure_dataset_parameters(H5::DataSpace& dspace, int nshape, uintptr_t shape, H5::DSetCreatPropList& plist, int deflate_level, uintptr_t chunks) {
    if (nshape == 0) { // if zero, it's a scalar, and the default DataSpace is correct.
        return;
    }

    auto dims = process_shape(nshape, shape);
    dspace = H5::DataSpace(nshape, dims.data());

    // Checking for non-zero length, otherwise chunking will fail.
    bool all_nonzero = true;
    for (auto d : dims) {
        if (d == 0) {
            all_nonzero = false;
            break;
        }
    }

    if (deflate_level >= 0 && all_nonzero) {
        plist.setDeflate(deflate_level);
        auto cptr = reinterpret_cast<const int32_t*>(chunks);
        std::copy(cptr, cptr + nshape, dims.begin());
        plist.setChunk(nshape, dims.data());
    }
}

/************* Dataset writers **************/

void create_hdf5_dataset(const std::string& path, const std::string& name, const H5::DataType& dtype, int nshape, uintptr_t shape, int deflate_level, uintptr_t chunks) {
    H5::H5File handle(path, H5F_ACC_RDWR);

    H5::DataSpace dspace;
 	H5::DSetCreatPropList plist;
    configure_dataset_parameters(dspace, nshape, shape, plist, deflate_level, chunks);
    handle.createDataSet(name, dtype, dspace, plist);
}

void create_numeric_hdf5_dataset(std::string path, std::string name, int nshape, uintptr_t shape, int deflate_level, uintptr_t chunks, std::string type) {
    H5::DataType dtype = choose_numeric_data_type(type);
    create_hdf5_dataset(path, name, dtype, nshape, shape, deflate_level, chunks);
    return;
}

void create_string_hdf5_dataset(std::string path, std::string name, int nshape, uintptr_t shape, int deflate_level, uintptr_t chunks, int max_str_len) {
    H5::DataType dtype = choose_string_data_type(max_str_len);
    create_hdf5_dataset(path, name, dtype, nshape, shape, deflate_level, chunks);
    return;
}

void create_enum_hdf5_dataset(std::string path, std::string name, int nshape, uintptr_t shape, int deflate_level, uintptr_t chunks, size_t nlevels, uintptr_t levlen, uintptr_t levbuffer) {
    H5::DataType dtype = choose_enum_data_type(nlevels, levlen, levbuffer);
    create_hdf5_dataset(path, name, dtype, nshape, shape, deflate_level, chunks);
    return;
}

struct DataSetHandleWriter {
    template<class Handle, typename T, class MemType>
    static void write(Handle& handle, T* data, const MemType& memtype) {
        handle.write(data, memtype);
    }
};

void write_numeric_hdf5_dataset(std::string path, std::string name, std::string type, uintptr_t data) {
    H5::H5File handle(path, H5F_ACC_RDWR);
    auto dhandle = handle.openDataSet(name);
    write_numeric_hdf5_base<DataSetHandleWriter>(dhandle, type, data);
    return;
}

void write_string_hdf5_dataset(std::string path, std::string name, size_t n, uintptr_t lengths, uintptr_t buffer) {
    H5::H5File handle(path, H5F_ACC_RDWR);
    auto dhandle = handle.openDataSet(name);
    write_string_hdf5_base<DataSetHandleWriter>(dhandle, n, lengths, buffer);
}

void write_enum_hdf5_dataset(std::string path, std::string name, uintptr_t data) {
    H5::H5File handle(path, H5F_ACC_RDWR);
    auto dhandle = handle.openDataSet(name);
    DataSetHandleWriter::write(dhandle, reinterpret_cast<const uint32_t*>(data), H5::PredType::NATIVE_UINT32);
    return;
}

/************* Attribute writers **************/

void create_hdf5_attribute(const std::string& path, const std::string& name, const std::string& attr, const H5::DataType& dtype, int nshape, uintptr_t shape) {
    try {
        H5::H5File handle(path, H5F_ACC_RDWR);

        auto creator = [&](const H5::H5Object& handle) -> void {
            H5::DataSpace dspace;
            if (nshape) { // if zero, it's a scalar.
                auto dims = process_shape(nshape, shape);
                dspace = H5::DataSpace(nshape, dims.data());
            }
            handle.createAttribute(attr, dtype, dspace);
        };

        auto child_type = handle.childObjType(name);
        if (child_type == H5O_TYPE_GROUP) {
            auto ghandle = handle.openGroup(name);
            creator(ghandle);
        } else if (child_type == H5O_TYPE_DATASET) {
            auto dhandle = handle.openDataSet(name);
            creator(dhandle);
        } else {
            throw std::runtime_error("cannot fetch attribute from unknown HDF5 object '" + name + "'");
        }
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
} 

void create_numeric_hdf5_attribute(std::string path, std::string name, std::string attr, int nshape, uintptr_t shape, std::string type) {
    H5::DataType dtype = choose_numeric_data_type(type);
    create_hdf5_attribute(path, name, attr, dtype, nshape, shape);
    return;
}

void create_string_hdf5_attribute(std::string path, std::string name, std::string attr, int nshape, uintptr_t shape, int max_str_len) {
    H5::DataType dtype = choose_string_data_type(max_str_len);
    create_hdf5_attribute(path, name, attr, dtype, nshape, shape);
    return;
}

void create_enum_hdf5_attribute(std::string path, std::string name, std::string attr, int nshape, uintptr_t shape, size_t nlevels, uintptr_t levlen, uintptr_t levbuffer) {
    H5::DataType dtype = choose_enum_data_type(nlevels, levlen, levbuffer);
    create_hdf5_attribute(path, name, attr, dtype, nshape, shape);
    return;
}

struct AttributeHandleWriter {
    template<class Handle, typename T, class MemType>
    static void write(Handle& handle, T* data, const MemType& memtype) {
        handle.write(memtype, data);
    }
};

template<class Function>
void write_hdf5_attribute(const std::string& path, const std::string& name, const std::string& attr, Function writer) {
    H5::H5File handle(path, H5F_ACC_RDWR);

    auto child_type = handle.childObjType(name);
    if (child_type == H5O_TYPE_GROUP) {
        auto ghandle = handle.openGroup(name);
        auto ahandle = handle.openAttribute(attr);
        writer(ahandle);
    } else if (child_type == H5O_TYPE_DATASET) {
        auto dhandle = handle.openDataSet(name);
        auto ahandle = handle.openAttribute(attr);
        writer(ahandle);
    } else {
        throw std::runtime_error("cannot fetch attribute from unknown HDF5 object '" + name + "'");
    }
}

void write_numeric_hdf5_attribute(std::string path, std::string name, std::string attr, std::string type, uintptr_t data) {
    write_hdf5_attribute(path, name, attr, [&](auto& ahandle) -> void {
        write_numeric_hdf5_base<AttributeHandleWriter>(ahandle, type, data);
    });
}

void write_string_hdf5_attribute(std::string path, std::string name, std::string attr, size_t n, uintptr_t lengths, uintptr_t buffer) {
    write_hdf5_attribute(path, name, attr, [&](auto& ahandle) -> void {
        write_string_hdf5_base<AttributeHandleWriter>(ahandle, n, lengths, buffer);
    });
}

void write_enum_hdf5_attribute(std::string path, std::string name, std::string attr, uintptr_t data) {
    write_hdf5_attribute(path, name, attr, [&](auto& ahandle) -> void {
        AttributeHandleWriter::write(ahandle, reinterpret_cast<const uint32_t*>(data), H5::PredType::NATIVE_UINT32);
    });
}

/************* Emscripten bindings **************/

EMSCRIPTEN_BINDINGS(hdf5_utils) {
    emscripten::class_<H5GroupDetails>("H5GroupDetails")
        .constructor<std::string, std::string>()
        .function("child_buffer", &H5GroupDetails::child_buffer)
        .function("child_lengths", &H5GroupDetails::child_lengths)
        .function("child_types", &H5GroupDetails::child_types)
        .function("attr_buffer", &H5GroupDetails::attr_buffer)
        .function("attr_lengths", &H5GroupDetails::attr_lengths)
        ;

    emscripten::class_<H5DataSetDetails>("H5DataSetDetails")
        .constructor<std::string, std::string>()
        .function("type", &H5DataSetDetails::type)
        .function("shape", &H5DataSetDetails::shape)
        .function("attr_buffer", &H5DataSetDetails::attr_buffer)
        .function("attr_lengths", &H5DataSetDetails::attr_lengths)
        ;

    emscripten::class_<LoadedH5DataSet>("LoadedH5DataSet")
        .constructor<std::string, std::string>()
        .function("type", &LoadedH5DataSet::type)
        .function("shape", &LoadedH5DataSet::shape)
        .function("numeric_values", &LoadedH5DataSet::numeric_values)
        .function("string_buffer", &LoadedH5DataSet::string_buffer)
        .function("string_lengths", &LoadedH5DataSet::string_lengths)
        .function("attr_buffer", &LoadedH5DataSet::attr_buffer)
        .function("attr_lengths", &LoadedH5DataSet::attr_lengths)
        ;

    emscripten::class_<LoadedH5Attr>("LoadedH5Attr")
        .constructor<std::string, std::string, std::string>()
        .function("type", &LoadedH5Attr::type)
        .function("shape", &LoadedH5Attr::shape)
        .function("numeric_values", &LoadedH5Attr::numeric_values)
        .function("string_buffer", &LoadedH5Attr::string_buffer)
        .function("string_lengths", &LoadedH5Attr::string_lengths)
        ;

   emscripten::function("create_hdf5_file", &create_hdf5_file);
   emscripten::function("create_hdf5_group", &create_hdf5_group);

   emscripten::function("create_numeric_hdf5_dataset", &create_numeric_hdf5_dataset);
   emscripten::function("write_numeric_hdf5_dataset", &write_numeric_hdf5_dataset);
   emscripten::function("create_string_hdf5_dataset", &create_string_hdf5_dataset);
   emscripten::function("write_string_hdf5_dataset", &write_string_hdf5_dataset);
   emscripten::function("create_enum_hdf5_dataset", &create_enum_hdf5_dataset);
   emscripten::function("write_enum_hdf5_dataset", &write_enum_hdf5_dataset);

   emscripten::function("create_numeric_hdf5_attribute", &create_numeric_hdf5_attribute);
   emscripten::function("write_numeric_hdf5_attribute", &write_numeric_hdf5_attribute);
   emscripten::function("create_string_hdf5_attribute", &create_string_hdf5_attribute);
   emscripten::function("write_string_hdf5_attribute", &write_string_hdf5_attribute);
   emscripten::function("create_enum_hdf5_attribute", &create_enum_hdf5_attribute);
   emscripten::function("write_enum_hdf5_attribute", &write_enum_hdf5_attribute);
}
