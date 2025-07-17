#include <emscripten/bind.h>
#include "H5Cpp.h"
#include <vector>
#include <string>
#include <cstdint>
#include <cstddef>
#include <algorithm>
#include <unordered_map>

emscripten::val extract_attribute_names(const H5::H5Object& handle) {
    auto output = emscripten::val::array();
    auto num = handle.getNumAttrs();
    for (decltype(num) i = 0; i < num; ++i) {
        auto attr = handle.openAttribute(i);
        output.call<void>("push", emscripten::val(attr.getName()));
    }
    return output;
}

emscripten::val format_integer_type(const H5::IntType& itype) {
    std::string type;

    bool is_unsigned = (itype.getSign() == H5T_SGN_NONE);
    if (is_unsigned) {
        type += "Uint";
    } else {
        type += "Int";
    }

    auto isize = itype.getSize();
    if (isize <= 1) {
        type += "8";
    } else if (isize <= 2) {
        type += "16";
    } else if (isize <= 4) {
        type += "32";
    } else {
        type += "64";
    }

    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("numeric"));
    output.set("type", emscripten::val(type));
    return otuput;
}

emscripten::val format_float_type(const H5::FloatType& ftype) {
    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("numeric"));
    auto fsize = memtype.getSize();
    if (fsize <= 4) {
        output.set("type", emscripten::val("Float32"));
    } else {
        output.set("type", emscripten::val("Float64"));
    }
    return output;
}

emscripten::val format_string_type(const H5::StrType& stype) {
    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("string"));
    if (stype.getCSet() == H5T_CSET_ASCII) {
        output.set("encoding", emscripten::val("ASCII"));
    } else {
        output.set("encoding", emscripten::val("UTF-8"));
    }
    if (stype.isVariableStr()) {
        output.set("length", emscripten::val(-1));
    } else {
        output.set("length", emscripten::val(stype.getSize()));
    }
    return output;
}

template<typename Code_>
emscripten::val format_enum_levels(const H5::EnumType etype) {
    auto output = emscripten::val::object();
    auto nlevels = etype.getNmembers();
    for (decltype(nlevels) l = 0; l < nlevels; ++l) {
        Code_ v;
        etype.getMemberValue(l, &v);
        std::string name = etype.nameOf(&v, 1000); // name better be shorter than 1000 bytes!
        output.set(std::move(name), emscripten::val(v));
    }
    return output;
}

emscripten::val format_enum_type(const H5::EnumType& etype, const H5::IntType& itype) {
    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("enum"));
    output.set("code", format_integer_type(itype));

    bool is_unsigned = (itype.getSign() == H5T_SGN_NONE);
    auto isize = itype.getSize();
    if (isize <= 1) {
        if (is_unsigned) {
            output.set("levels", format_enum_type<uint8_t>(etype));
        } else {
            output.set("levels", format_enum_type<int8_t>(etype));
        }
    } else if (isize <= 2) {
        if (is_unsigned) {
            output.set("levels", format_enum_type<uint16_t>(etype));
        } else {
            output.set("levels", format_enum_type<int16_t>(etype));
        }
    } else if (isize <= 4) {
        if (is_unsigned) {
            output.set("levels", format_enum_type<uint32_t>(etype));
        } else {
            output.set("levels", format_enum_type<int32_t>(etype));
        }
    } else {
        if (is_unsigned) {
            output.set("levels", format_enum_type<uint64_t>(etype));
        } else {
            output.set("levels", format_enum_type<int64_t>(etype));
        }
    }

    return output;
}

emscripten::val format_compound_type(const H5::CompType& ctype) {
    auto nmembers = ctype.getNmembers();
    auto outmembers = emscripten::val::object();
    for (decltype(nmembers) m = 0; m < nmembers; ++m) {
        auto memname = ctype.getMemberName(m);
        auto memclass = memtype.getClass();

        emscripten::val type;
        if (memclass == H5T_INTEGER) {
            type = format_integer_type(ctype.getMemberIntType(m));
        } else if (memclass == H5T_FLOAT) {
            type = format_float_type(ctype.getMemberFloatType(m));
        } else if (memclass == H5T_STRING) {
            type = format_string_type(ctype.getMemberStrType(m));
        } else { // other things aren't supported yet.
            type.set("mode", emscripten::val("other"));
            type.set("type", emscripten::val("Other"));
        }

        outmembers.set(std::move(memname), type);
    }

    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("compound"));
    output.set("members", outmembers);
    return output;
}

template<typename Handle_>
emscripten::val format_type(const Handle_& handle) {
    auto dclass = handle.getTypeClass();
    if (dclass == H5T_INTEGER) {
        return format_integer_type(handle.getIntType());
    } else if (dclass == H5T_FLOAT) {
        return format_numeric_type(handle.getFloatType());
    } else if (dclass == H5T_STRING) {
        return format_string_type(handle.getStrType());
    } else if (dclass == H5T_ENUM) {
        return format_enum_type(handle.getEnumType(), handle.getIntType());
    } else if (dclass == H5T_COMPOUND) {
        return format_compound_type(handle.getCompoundType());
    } else {
        auto output = emscripten::val::object();
        output.set("mode", emscripten::val("other"));
        output.set("type", emscripten::val("Other"));
        return output;
    }
}

/************* Unloaded details **************/

class H5GroupDetails {
    H5::H5File my_fhandle;
    H5::Group my_ghandle;

public:
    H5GroupDetails(std::string file, std::string name) : my_fhandle(file, H5F_ACC_RDONLY), my_ghandle(my_fhandle.openGroup(name)) {}

    emscripten::val attributes() {
        return extract_attribute_names(my_ghandle);
    }

    emscripten::val children() {
        my_children = emscripten::val::object();
        auto num = my_ghandle.getNumObjs();
        for (decltype(num) i = 0; i < num; ++i) {
            auto child_name = my_ghandle.getObjnameByIdx(i);
            auto child_type = my_ghandle.childObjType(child_name);
            if (child_type == H5O_TYPE_GROUP) {
                children.set(child_name, emscripten::val("Group"));
            } else if (child_type == H5O_TYPE_DATASET) {
                children.set(child_name, emscripten::val("DataSet"));
            } else {
                children.set(child_name, emscripten::val("Other"));
            }
        }

        return extract_attribute_names(ghandle);
    }
};

class H5DataSetDetails : public H5AttrDetails {
    H5::H5File my_fhandle;
    H5::DataSet my_dhandle;

public:
    H5GroupDetails(std::string file, std::string name) : my_fhandle(file, H5F_ACC_RDONLY), my_dhandle(my_fhandle.openDataSet(name)) {}

    emscripten::val attributes() {
        return extract_attribute_names(my_dhandle);
    }

    emscripten::val shape() const {
        auto dspace = dhandle.getSpace();
        auto ndims = dspace.getSimpleExtentNdims();
        std::vector<hsize_t> dims(ndims);
        dspace.getSimpleExtentDims(dims.data());

        auto output = emscripten::val::array();
        for (auto x : dims) {
            output.call<void>("push", emscripten::val(static_cast<double>(x)); // hopefully it fits, who knows?
        }
        return output;
    }

    emscripten::val type() {
        return format_type(my_dhandle);
    }
};

/************* Loaded details **************/

class LoadedH5Numeric {
protected:
    // Store all the possible numeric types here.
    std::vector<uint8_t> u8_data;
    std::vector<int8_t> i8_data;
    std::vector<uint16_t> u16_data;
    std::vector<int16_t> i16_data;
    std::vector<uint32_t> u32_data;
    std::vector<int32_t> i32_data;
    std::vector<float> f32_data;
    std::vector<double> f64_data;

    // embind can't deal with 64-bit types, see https://github.com/emscripten-core/emscripten/issues/11140.
    std::vector<double> u64_data; 
    std::vector<double> i64_data;

    enum class NumericType : char { U8, I8, U16, I16, U32, I32, U64, I64, F32, F64 };
    NumericType numtype;

protected:
    emscripten::val numeric_values() const {
        switch(numtype) {
            case NumericType::U8:
                return emscripten::val(emscripten::typed_memory_view(u8_data.size(), u8_data.data()));
            case NumericType::I8:
                return emscripten::val(emscripten::typed_memory_view(i8_data.size(), i8_data.data()));
            case NumericType::U16:
                return emscripten::val(emscripten::typed_memory_view(u16_data.size(), u16_data.data()));
            case NumericType::I16:
                return emscripten::val(emscripten::typed_memory_view(i16_data.size(), i16_data.data()));
            case NumericType::U32:
                return emscripten::val(emscripten::typed_memory_view(u32_data.size(), u32_data.data()));
            case NumericType::I32:
                return emscripten::val(emscripten::typed_memory_view(i32_data.size(), i32_data.data()));
            case NumericType::U64:
                return emscripten::val(emscripten::typed_memory_view(u64_data.size(), u64_data.data()));
            case NumericType::I64:
                return emscripten::val(emscripten::typed_memory_view(i64_data.size(), i64_data.data()));
            case NumericType::F32:
                return emscripten::val(emscripten::typed_memory_view(f32_data.size(), f32_data.data()));
            default: // a.k.a. if (type_ == "Float64") {
                return emscripten::val(emscripten::typed_memory_view(f64_data.size(), f64_data.data()));
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

    template<class Reader, class Handle>
    void fill_compound_data(const Handle& handle, hsize_t full_length) {
        auto ctype = handle.getCompType();
        int nmembers = ctype.getNmembers();

        struct Member {
            Member() = default;
            Member(std::string name, std::size_t size, bool is_string, bool is_variable) :
                name(std::move(name)), size(size), is_string(is_string), is_variable(is_variable) {}
            std::string name;
            std::size_t size;
            bool is_string;
            bool is_variable;
        };
        std::vector<Member> members;
        members.reserve(nmembers);
        std::vector<H5::DataType> h5types;
        h5types.reserve(nmembers);
        bool has_variable = false;
        std::size_t offset = 0;

        for (decltype(nmembers) m = 0; m < nmembers; ++m) {
            auto memname = ctype.getMemberName(m);
            auto memcls = ctype.getMemberClass(m);
            if (memcls == H5T_STRING) {
                auto stype = ctype.getMemberStrType(m);
                members.emplace_back(std::move(memname), stype.getSize(), true, stype.isVariableStr());
                has_variable = has_variable || stype.isVariableStr();
                h5types.push_back(std::move(stype));
            } else if (memcls == H5T_INTEGER || memcls == H5T_FLOAT) {
                members.emplace_back(std::move(memname), 8, false, false);
                h5types.push_back(H5::PredType::NATIVE_DOUBLE);
            } else {
                throw std::runtime_error("unsupported member type in compound data type");
            }
            offset += h5types.back().getSize();
        }

        H5::CompType ctype2(offset);
        offset = 0;
        for (decltype(nmembers) m = 0; m < nmembers; ++m) {
            ctype2.insertMember(members[m].name, offset, h5types[m]);
            offset += h5types[m].getSize();
        }

        std::vector<unsigned char> unified_buffer(full_length * offset);
        Reader::read(handle, unified_buffer.data(), ctype2);
        comp_data = emscripten::val::array();

        offset = 0;
        std::string val;
        for (decltype(full_length) i = 0; i < full_length; ++i) {
            emscripten::val obj = emscripten::val::object();

            for (const auto& member : members) {
                auto start = unified_buffer.data() + offset;

                if (!member.is_string) {
                    double val;
                    std::copy_n(start, sizeof(decltype(val)), reinterpret_cast<unsigned char*>(&val));
                    obj.set(member.name, val);

                } else if (!member.is_variable) {
                    auto cstart = reinterpret_cast<const char*>(start);
                    val.clear();
                    for (decltype(member.size) i = 0; i < member.size; ++i) {
                        if (cstart[i] == 0) {
                            break;
                        }
                        val += cstart[i];
                    }
                    obj.set(member.name, val);

                } else {
                    char* ptr;
                    std::copy_n(start, sizeof(decltype(ptr)), reinterpret_cast<unsigned char*>(&ptr));
                    val.clear();
                    val.insert(0, ptr);
                    obj.set(member.name, val);
                }

                offset += member.size;
            }

            comp_data.call<void>("push", obj);
        }

        if (has_variable) {
            H5Dvlen_reclaim(ctype.getId(), handle.getSpace().getId(), H5P_DEFAULT, unified_buffer.data());
        }
    }

protected:
    template<class Reader, class Handle>
    void fill_contents(const Handle& handle) {
        auto dtype = handle.getDataType();
        type_ = guess_hdf5_type(handle, dtype);
        if (type_ == "Compound") {
            comptype_ = guess_hdf5_type(handle, handle.getCompType());
        }

        auto dspace = handle.getSpace();
        int32_t ndims = dspace.getSimpleExtentNdims();
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
            enum_type = guess_hdf5_type(itype);
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

        } else if (type_ == "Compound") {
            fill_compound_data<Reader>(handle, full_length);

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
    emscripten::val type() const {
        return LoadedH5Base::type();
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

    emscripten::val compound_values() const {
        return compound_values_();
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
    emscripten::val type() const {
        return LoadedH5Base::type();
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

    emscripten::val compound_values() const {
        return compound_values_();
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

std::vector<hsize_t> process_shape(int32_t nshape, uintptr_t shape) {
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

H5::DataType choose_string_data_type(int32_t max_str_len) {
    return H5::StrType(0, std::max(1, max_str_len)); // Make sure that is at least of length 1.
}

H5::DataType choose_enum_data_type(size_t nlevels, uintptr_t level_lengths, uintptr_t level_buffer) {
    auto buf_ptr = reinterpret_cast<const uint8_t*>(level_buffer); 
    auto len_ptr = reinterpret_cast<const int32_t*>(level_lengths);
    H5::EnumType dtype(H5::PredType::NATIVE_INT32);

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

template<class Reader, class Handle>
void write_compound_hdf5_base(Handle& handle, size_t n, const emscripten::val& data) {
    auto dtype = handle.getCompType();
    auto nmembers = dtype.getNmembers();

    struct H5MemberDetails {
        std::string name;
        H5::DataType dtype;
        std::size_t offset;
    };
    std::vector<H5MemberDetails> h5_members(nmembers);

    struct CompactDetails {
        std::string name;
        bool is_string = false;
        bool is_variable = false;
        std::size_t strlen = 0;
    };
    std::vector<CompactDetails> compact_members(nmembers);

    std::size_t offset = 0;
    decltype(nmembers) num_vstrings = 0;
    for (decltype(nmembers) m = 0; m < nmembers; ++m) {
        auto& current = h5_members[m];
        current.name = dtype.getMemberName(m);
        current.offset = offset;
        auto cls = dtype.getMemberClass(m);
        compact_members[m].name = current.name;

        if (cls == H5T_STRING) {
            auto stype = dtype.getMemberStrType(m);
            current.dtype = stype;
            compact_members[m].is_string = true;
            if (stype.isVariableStr()) {
                compact_members[m].is_variable = true;
                ++num_vstrings;
            } else {
                compact_members[m].strlen = stype.getSize();
            }
        } else if (cls == H5T_INTEGER || cls == H5T_FLOAT) {
            auto dbtype = H5::PredType::NATIVE_DOUBLE;
            current.dtype = dbtype;
        } else {
            throw std::runtime_error("only numbers and strings are supported in compound data types");
        }

        offset += current.dtype.getSize();
    }

    H5::CompType ctype(offset);
    for (const auto& x : h5_members) {
        ctype.insertMember(x.name, x.offset, x.dtype);
    }
    h5_members.clear();

    std::vector<unsigned char> payload;
    payload.reserve(n * ctype.getSize());
    std::vector<std::string> vstrings;
    vstrings.reserve(n * num_vstrings);

    for (const auto& entry : data) {
        for (const auto& member : compact_members) {
            auto res = entry[member.name];
            if (member.is_string) {
                auto str = res.template as<std::string>();
                if (member.is_variable) {
                    vstrings.push_back(std::move(str));
                    auto ptr = vstrings.back().c_str();
                    auto start = reinterpret_cast<const unsigned char*>(&ptr);
                    payload.insert(payload.end(), start, start + sizeof(decltype(ptr)));
                } else {
                    auto ptr = str.c_str();
                    auto start = reinterpret_cast<const unsigned char*>(ptr);
                    auto to_copy = std::min(str.size(), member.strlen);
                    payload.insert(payload.end(), start, start + to_copy);
                    payload.insert(payload.end(), member.strlen - to_copy, '\0');
                }
            } else {
                auto dbl = res.template as<double>();
                auto start = reinterpret_cast<const unsigned char*>(&dbl);
                payload.insert(payload.end(), start, start + sizeof(decltype(dbl)));
            }
        }
    }

    Reader::write(handle, payload.data(), ctype);
}

void configure_dataset_parameters(H5::DataSpace& dspace, int32_t nshape, uintptr_t shape, H5::DSetCreatPropList& plist, int32_t deflate_level, uintptr_t chunks) {
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

H5::CompType translate_compound_type_for_create(const emscripten::val& named_type_info, int32_t max_str_len) {
    struct MemberType {
        MemberType() = default;
        MemberType(std::string name, std::size_t offset, H5::DataType dtype) : name(std::move(name)), offset(offset), dtype(std::move(dtype)) {}
        std::string name;
        std::size_t offset;
        H5::DataType dtype;
    };
    std::vector<MemberType> all_types;
    std::size_t offset = 0;

    for (const auto& member_info : named_type_info) {
        auto name = member_info["name"].as<std::string>();
        auto type = member_info["type"].as<std::string>();
        if (type == "String") {
            auto dtype = choose_string_data_type(max_str_len);
            all_types.emplace_back(std::move(name), offset, std::move(dtype));
        } else if (type.rfind("Int", 0) == 0 || type.rfind("Uint", 0) == 0 || type.rfind("Float", 0) == 0) {
            auto dtype = choose_numeric_data_type(type);
            all_types.emplace_back(std::move(name), offset, std::move(dtype));
        } else {
            throw std::runtime_error("only numbers and strings are supported in compound data types");
        }
        offset += all_types.back().dtype.getSize();
    }

    H5::CompType ctype(offset);
    for (auto& x : all_types) {
        ctype.insertMember(std::move(x.name), x.offset, std::move(x.dtype));
    }
    return ctype;
}

/************* Dataset writers **************/

void create_hdf5_dataset(const std::string& path, const std::string& name, const H5::DataType& dtype, int32_t nshape, uintptr_t shape, int32_t deflate_level, uintptr_t chunks) {
    H5::H5File handle(path, H5F_ACC_RDWR);

    H5::DataSpace dspace;
 	H5::DSetCreatPropList plist;
    configure_dataset_parameters(dspace, nshape, shape, plist, deflate_level, chunks);
    handle.createDataSet(name, dtype, dspace, plist);
}

void create_numeric_hdf5_dataset(std::string path, std::string name, int32_t nshape, uintptr_t shape, int32_t deflate_level, uintptr_t chunks, std::string type) {
    H5::DataType dtype = choose_numeric_data_type(type);
    create_hdf5_dataset(path, name, dtype, nshape, shape, deflate_level, chunks);
    return;
}

void create_string_hdf5_dataset(std::string path, std::string name, int32_t nshape, uintptr_t shape, int32_t deflate_level, uintptr_t chunks, int32_t max_str_len) {
    H5::DataType dtype = choose_string_data_type(max_str_len);
    create_hdf5_dataset(path, name, dtype, nshape, shape, deflate_level, chunks);
    return;
}

void create_enum_hdf5_dataset(std::string path, std::string name, int32_t nshape, uintptr_t shape, int32_t deflate_level, uintptr_t chunks, size_t nlevels, uintptr_t levlen, uintptr_t levbuffer) {
    H5::DataType dtype = choose_enum_data_type(nlevels, levlen, levbuffer);
    create_hdf5_dataset(path, name, dtype, nshape, shape, deflate_level, chunks);
    return;
}

void create_compound_hdf5_dataset(std::string path, std::string name, int32_t nshape, uintptr_t shape, int32_t deflate_level, uintptr_t chunks, const emscripten::val& type_info, int32_t max_str_len) {
    auto ctype = translate_compound_type_for_create(type_info, max_str_len);
    create_hdf5_dataset(path, name, ctype, nshape, shape, deflate_level, chunks);
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
    DataSetHandleWriter::write(dhandle, reinterpret_cast<const int32_t*>(data), dhandle.getDataType());
    return;
}

void write_compound_hdf5_dataset(std::string path, std::string name, size_t n, const emscripten::val& data) {
    H5::H5File handle(path, H5F_ACC_RDWR);
    auto dhandle = handle.openDataSet(name);
    write_compound_hdf5_base<DataSetHandleWriter>(dhandle, n, data);
}

/************* Attribute writers **************/

void create_hdf5_attribute(const std::string& path, const std::string& name, const std::string& attr, const H5::DataType& dtype, int32_t nshape, uintptr_t shape) {
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

void create_numeric_hdf5_attribute(std::string path, std::string name, std::string attr, int32_t nshape, uintptr_t shape, std::string type) {
    H5::DataType dtype = choose_numeric_data_type(type);
    create_hdf5_attribute(path, name, attr, dtype, nshape, shape);
    return;
}

void create_string_hdf5_attribute(std::string path, std::string name, std::string attr, int32_t nshape, uintptr_t shape, int32_t max_str_len) {
    H5::DataType dtype = choose_string_data_type(max_str_len);
    create_hdf5_attribute(path, name, attr, dtype, nshape, shape);
    return;
}

void create_enum_hdf5_attribute(std::string path, std::string name, std::string attr, int32_t nshape, uintptr_t shape, size_t nlevels, uintptr_t levlen, uintptr_t levbuffer) {
    H5::DataType dtype = choose_enum_data_type(nlevels, levlen, levbuffer);
    create_hdf5_attribute(path, name, attr, dtype, nshape, shape);
    return;
}

void create_compound_hdf5_attribute(std::string path, std::string name, std::string attr, int32_t nshape, uintptr_t shape, const emscripten::val& type_info, int32_t max_str_len) {
    auto ctype = translate_compound_type_for_create(type_info, max_str_len);
    create_hdf5_attribute(path, name, attr, ctype, nshape, shape);
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
        auto ahandle = ghandle.openAttribute(attr);
        writer(ahandle);
    } else if (child_type == H5O_TYPE_DATASET) {
        auto dhandle = handle.openDataSet(name);
        auto ahandle = dhandle.openAttribute(attr);
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
        AttributeHandleWriter::write(ahandle, reinterpret_cast<const int32_t*>(data), ahandle.getDataType());
    });
}

void write_compound_hdf5_attribute(std::string path, std::string name, std::string attr, size_t n, const emscripten::val& data) {
    write_hdf5_attribute(path, name, attr, [&](auto& ahandle) -> void {
        write_compound_hdf5_base<AttributeHandleWriter>(ahandle, n, data);
    });
}

/************* Emscripten bindings **************/

EMSCRIPTEN_BINDINGS(hdf5_utils) {
    emscripten::class_<H5GroupDetails>("H5GroupDetails")
        .constructor<std::string, std::string>()
        .function("child_buffer", &H5GroupDetails::child_buffer, emscripten::return_value_policy::take_ownership())
        .function("child_lengths", &H5GroupDetails::child_lengths, emscripten::return_value_policy::take_ownership())
        .function("child_types", &H5GroupDetails::child_types, emscripten::return_value_policy::take_ownership())
        .function("attr_buffer", &H5GroupDetails::attr_buffer, emscripten::return_value_policy::take_ownership())
        .function("attr_lengths", &H5GroupDetails::attr_lengths, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::class_<H5DataSetDetails>("H5DataSetDetails")
        .constructor<std::string, std::string>()
        .function("type", &H5DataSetDetails::type, emscripten::return_value_policy::take_ownership())
        .function("shape", &H5DataSetDetails::shape, emscripten::return_value_policy::take_ownership())
        .function("attr_buffer", &H5DataSetDetails::attr_buffer, emscripten::return_value_policy::take_ownership())
        .function("attr_lengths", &H5DataSetDetails::attr_lengths, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::class_<LoadedH5DataSet>("LoadedH5DataSet")
        .constructor<std::string, std::string>()
        .function("type", &LoadedH5DataSet::type, emscripten::return_value_policy::take_ownership())
        .function("shape", &LoadedH5DataSet::shape, emscripten::return_value_policy::take_ownership())
        .function("numeric_values", &LoadedH5DataSet::numeric_values, emscripten::return_value_policy::take_ownership())
        .function("compound_values", &LoadedH5DataSet::compound_values, emscripten::return_value_policy::take_ownership())
        .function("string_buffer", &LoadedH5DataSet::string_buffer, emscripten::return_value_policy::take_ownership())
        .function("string_lengths", &LoadedH5DataSet::string_lengths, emscripten::return_value_policy::take_ownership())
        .function("attr_buffer", &LoadedH5DataSet::attr_buffer, emscripten::return_value_policy::take_ownership())
        .function("attr_lengths", &LoadedH5DataSet::attr_lengths, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::class_<LoadedH5Attr>("LoadedH5Attr")
        .constructor<std::string, std::string, std::string>()
        .function("type", &LoadedH5Attr::type, emscripten::return_value_policy::take_ownership())
        .function("shape", &LoadedH5Attr::shape, emscripten::return_value_policy::take_ownership())
        .function("numeric_values", &LoadedH5Attr::numeric_values, emscripten::return_value_policy::take_ownership())
        .function("compound_values", &LoadedH5Attr::compound_values, emscripten::return_value_policy::take_ownership())
        .function("string_buffer", &LoadedH5Attr::string_buffer, emscripten::return_value_policy::take_ownership())
        .function("string_lengths", &LoadedH5Attr::string_lengths, emscripten::return_value_policy::take_ownership())
        ;

   emscripten::function("create_hdf5_file", &create_hdf5_file, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_hdf5_group", &create_hdf5_group, emscripten::return_value_policy::take_ownership());

   emscripten::function("create_numeric_hdf5_dataset", &create_numeric_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_numeric_hdf5_dataset", &write_numeric_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_string_hdf5_dataset", &create_string_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_string_hdf5_dataset", &write_string_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_enum_hdf5_dataset", &create_enum_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_enum_hdf5_dataset", &write_enum_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_compound_hdf5_dataset", &create_compound_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_compound_hdf5_dataset", &write_compound_hdf5_dataset, emscripten::return_value_policy::take_ownership());

   emscripten::function("create_numeric_hdf5_attribute", &create_numeric_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_numeric_hdf5_attribute", &write_numeric_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_string_hdf5_attribute", &create_string_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_string_hdf5_attribute", &write_string_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_enum_hdf5_attribute", &create_enum_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_enum_hdf5_attribute", &write_enum_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_compound_hdf5_attribute", &create_compound_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_compound_hdf5_attribute", &write_compound_hdf5_attribute, emscripten::return_value_policy::take_ownership());
}
