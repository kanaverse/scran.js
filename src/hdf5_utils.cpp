#include <emscripten/bind.h>

#include <vector>
#include <string>
#include <cstdint>
#include <cstddef>
#include <algorithm>
#include <unordered_map>
#include <iostream>

#include "utils.h"

#include "H5Cpp.h"

emscripten::val extract_attribute_names(const H5::H5Object& handle) {
    auto output = emscripten::val::array();
    auto num = handle.getNumAttrs();
    for (I<decltype(num)> i = 0; i < num; ++i) {
        auto attr = handle.openAttribute(i);
        output.call<void>("push", attr.getName());
    }
    return output;
}

// Don't return size_t's directly, instead convert them to doubles so that we get Numbers in javascript.
// Otherwise we have to deal with BigInts and those are a  pain.

template<typename Handle_>
emscripten::val extract_shape(const Handle_& handle) {
    auto dspace = handle.getSpace();
    auto ndims = dspace.getSimpleExtentNdims();
    auto dims = sanisizer::create<std::vector<hsize_t> >(ndims);
    dspace.getSimpleExtentDims(dims.data());

    auto output = emscripten::val::array();
    for (auto x : dims) {
        output.call<void>("push", int2js(x));
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
    output.set("mode", "numeric");
    output.set("type", type);
    return output;
}

emscripten::val format_float_type(const H5::FloatType& ftype) {
    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("numeric"));
    auto fsize = ftype.getSize();
    if (fsize <= 4) {
        output.set("type", "Float32");
    } else {
        output.set("type", "Float64");
    }
    return output;
}

emscripten::val format_string_type(const H5::StrType& stype) {
    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("string"));
    if (stype.getCset() == H5T_CSET_ASCII) {
        output.set("encoding", "ASCII");
    } else {
        output.set("encoding", "UTF-8");
    }
    if (stype.isVariableStr()) {
        output.set("length", int2js(-1));
    } else {
        output.set("length", int2js(stype.getSize()));
    }
    return output;
}

template<typename Code_>
emscripten::val format_enum_levels(const H5::EnumType etype) {
    auto output = emscripten::val::array();
    auto nlevels = etype.getNmembers();
    for (I<decltype(nlevels)> l = 0; l < nlevels; ++l) {
        Code_ v;
        etype.getMemberValue(l, &v);
        std::string name = etype.nameOf(&v, 1000); // name better be shorter than 1000 bytes!
        auto current = emscripten::val::object();
        current.set("name", name);
        current.set("value", int2js(v));
        output.call<void>("push", std::move(current));
    }
    return output;
}

emscripten::val format_enum_type(const H5::EnumType& etype, const H5::IntType& itype) {
    auto output = emscripten::val::object();
    output.set("mode", emscripten::val("enum"));

    const bool is_unsigned = (itype.getSign() == H5T_SGN_NONE);
    const auto isize = itype.getSize();
    if (isize <= 1) {
        if (is_unsigned) {
            output.set("code_type", "Uint8");
            output.set("levels", format_enum_levels<std::uint8_t>(etype));
        } else {
            output.set("code_type", "Int8");
            output.set("levels", format_enum_levels<std::int8_t>(etype));
        }
    } else if (isize <= 2) {
        if (is_unsigned) {
            output.set("code_type", "Uint16");
            output.set("levels", format_enum_levels<std::uint16_t>(etype));
        } else {
            output.set("code_type", "Int16");
            output.set("levels", format_enum_levels<std::int16_t>(etype));
        }
    } else if (isize <= 4) {
        if (is_unsigned) {
            output.set("code_type", "Uint32");
            output.set("levels", format_enum_levels<std::uint32_t>(etype));
        } else {
            output.set("code_type", "Int32");
            output.set("levels", format_enum_levels<std::int32_t>(etype));
        }
    } else {
        if (is_unsigned) {
            output.set("code_type", "Uint64");
            output.set("levels", format_enum_levels<std::uint64_t>(etype));
        } else {
            output.set("code_type", "Int64");
            output.set("levels", format_enum_levels<std::int64_t>(etype));
        }
    }

    return output;
}

emscripten::val format_compound_type(const H5::CompType& ctype) {
    const auto nmembers = ctype.getNmembers();
    auto outmembers = emscripten::val::array();
    for (I<decltype(nmembers)> m = 0; m < nmembers; ++m) {
        auto memname = ctype.getMemberName(m);
        auto memclass = ctype.getMemberClass(m);

        emscripten::val type;
        if (memclass == H5T_INTEGER) {
            type = format_integer_type(ctype.getMemberIntType(m));
        } else if (memclass == H5T_FLOAT) {
            type = format_float_type(ctype.getMemberFloatType(m));
        } else if (memclass == H5T_STRING) {
            type = format_string_type(ctype.getMemberStrType(m));
        } else { // other things aren't supported yet.
            type = emscripten::val::object();
            type.set("mode", emscripten::val("other"));
            type.set("type", emscripten::val("Other"));
        }

        auto current = emscripten::val::object();
        current.set("name", memname);
        current.set("type", type);
        outmembers.call<void>("push", current);
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
        return format_float_type(handle.getFloatType());
    } else if (dclass == H5T_STRING) {
        return format_string_type(handle.getStrType());
    } else if (dclass == H5T_ENUM) {
        return format_enum_type(handle.getEnumType(), handle.getIntType());
    } else if (dclass == H5T_COMPOUND) {
        return format_compound_type(handle.getCompType());
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
        auto children = emscripten::val::object();
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
        return children;
    }
};

class H5DataSetDetails {
    H5::H5File my_fhandle;
    H5::DataSet my_dhandle;

public:
    H5DataSetDetails(std::string file, std::string name) : my_fhandle(file, H5F_ACC_RDONLY), my_dhandle(my_fhandle.openDataSet(name)) {}

    emscripten::val attributes() {
        return extract_attribute_names(my_dhandle);
    }

    emscripten::val shape() const {
        return extract_shape(my_dhandle);
    }

    emscripten::val type() {
        return format_type(my_dhandle);
    }
};

/************* Loaded details **************/

template<typename Handle_>
hsize_t get_full_length(const Handle_& handle) {
    auto dspace = handle.getSpace();
    auto ndims = dspace.getSimpleExtentNdims();
    std::vector<hsize_t> dims(ndims);
    dspace.getSimpleExtentDims(dims.data());
    hsize_t total = 1;
    for (auto d : dims) {
        total *= d;
    }
    return total;
}

class LoadedH5Numeric {
protected:
    // Store all the possible numeric types here.
    std::vector<std::uint8_t> u8_data;
    std::vector<std::int8_t> i8_data;
    std::vector<std::uint16_t> u16_data;
    std::vector<std::int16_t> i16_data;
    std::vector<std::uint32_t> u32_data;
    std::vector<std::int32_t> i32_data;
    std::vector<float> f32_data;
    std::vector<double> f64_data;

    // embind can't deal with 64-bit types, see https://github.com/emscripten-core/emscripten/issues/11140.
    std::vector<double> u64_data; 
    std::vector<double> i64_data;

    enum class NumericType : char { U8, I8, U16, I16, U32, I32, U64, I64, F32, F64 };
    NumericType numtype;

public:
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

    template<class Reader_, class Handle_>
    void fill_numeric_contents(const Handle_& handle) {
        auto full_length = get_full_length(handle);
        auto dtype = handle.getDataType();
        auto dclass = dtype.getClass();

        if (dclass == H5T_INTEGER || dclass == H5T_ENUM) {
            auto itype = handle.getIntType();
            bool is_unsigned = (itype.getSign() == H5T_SGN_NONE);
            auto isize = itype.getSize();

            if (isize <= 1) {
                if (is_unsigned) {
                    u8_data.resize(full_length);
                    Reader_::read(handle, u8_data.data(), H5::PredType::NATIVE_UINT8);
                    numtype = NumericType::U8;
                } else {
                    i8_data.resize(full_length);
                    Reader_::read(handle, i8_data.data(), H5::PredType::NATIVE_INT8);
                    numtype = NumericType::I8;
                }

            } else if (isize <= 2) {
                if (is_unsigned) {
                    u16_data.resize(full_length);
                    Reader_::read(handle, u16_data.data(), H5::PredType::NATIVE_UINT16);
                    numtype = NumericType::U16;
                } else {
                    i16_data.resize(full_length);
                    Reader_::read(handle, i16_data.data(), H5::PredType::NATIVE_INT16);
                    numtype = NumericType::I16;
                }

            } else if (isize <= 4) {
                if (is_unsigned) {
                    u32_data.resize(full_length);
                    Reader_::read(handle, u32_data.data(), H5::PredType::NATIVE_UINT32);
                    numtype = NumericType::U32;
                } else {
                    i32_data.resize(full_length);
                    Reader_::read(handle, i32_data.data(), H5::PredType::NATIVE_INT32);
                    numtype = NumericType::I32;
                }

            } else {
                if (is_unsigned) {
                    u64_data.resize(full_length);
                    Reader_::read(handle, u64_data.data(), H5::PredType::NATIVE_DOUBLE); // see comments above about embind.
                    numtype = NumericType::U64;
                } else {
                    i64_data.resize(full_length);
                    Reader_::read(handle, i64_data.data(), H5::PredType::NATIVE_DOUBLE); // see comments above about embind.
                    numtype = NumericType::I64;
                }
            }

        } else {
            auto ftype = handle.getFloatType();
            if (ftype.getSize() == 4) {
                f32_data.resize(full_length);
                Reader_::read(handle, f32_data.data(), H5::PredType::NATIVE_FLOAT);
                numtype = NumericType::F32;

            } else {
                f64_data.resize(full_length);
                Reader_::read(handle, f64_data.data(), H5::PredType::NATIVE_DOUBLE);
                numtype = NumericType::F64;
            }
        }
    }
};

template<typename Func_>
struct CleanUp {
    CleanUp(Func_ f) : f(std::move(f)) {}
    ~CleanUp() { f(); }
    Func_ f;
};

template<class Reader_, class Handle_>
emscripten::val extract_compound_values(const Handle_& handle) {
    auto ctype = handle.getCompType();
    const auto nmembers = ctype.getNmembers();

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

    for (I<decltype(nmembers)> m = 0; m < nmembers; ++m) {
        auto memname = ctype.getMemberName(m);
        auto memcls = ctype.getMemberClass(m);
        if (memcls == H5T_STRING) {
            auto stype = ctype.getMemberStrType(m);
            members.emplace_back(std::move(memname), stype.getSize(), true, stype.isVariableStr());
            has_variable = has_variable || stype.isVariableStr();
            h5types.push_back(std::move(stype));
        } else if (memcls == H5T_INTEGER || memcls == H5T_FLOAT) {
            // Just convert integers to doubles here, it'll get cast to +/-Inf if it doesn't fit.
            members.emplace_back(std::move(memname), 8, false, false);
            h5types.push_back(H5::PredType::NATIVE_DOUBLE);
        } else {
            throw std::runtime_error("unsupported member type in compound data type");
        }
        offset += h5types.back().getSize();
    }

    H5::CompType ctype2(offset);
    offset = 0;
    for (I<decltype(nmembers)> m = 0; m < nmembers; ++m) {
        ctype2.insertMember(members[m].name, offset, h5types[m]);
        offset += h5types[m].getSize();
    }

    const auto full_length = get_full_length(handle);
    std::vector<unsigned char> unified_buffer(full_length * offset);
    Reader_::read(handle, unified_buffer.data(), ctype2);
    CleanUp tmp([&]() -> void {
        if (has_variable) {
            H5Dvlen_reclaim(ctype.getId(), handle.getSpace().getId(), H5P_DEFAULT, unified_buffer.data());
        }
    });

    auto comp_data = emscripten::val::array();
    offset = 0;
    std::string bufstr;
    for (I<decltype(full_length)> i = 0; i < full_length; ++i) {
        emscripten::val obj = emscripten::val::object();

        for (const auto& member : members) {
            auto start = unified_buffer.data() + offset;

            if (!member.is_string) {
                double num;
                std::copy_n(start, sizeof(decltype(num)), reinterpret_cast<unsigned char*>(&num));
                obj.set(member.name, num);

            } else if (!member.is_variable) {
                auto cstart = reinterpret_cast<const char*>(start);
                bufstr.clear();
                for (I<decltype(member.size)> i = 0; i < member.size; ++i) {
                    if (cstart[i] == 0) {
                        break;
                    }
                    bufstr += cstart[i];
                }
                obj.set(member.name, bufstr);

            } else {
                char* ptr;
                std::copy_n(start, sizeof(decltype(ptr)), reinterpret_cast<unsigned char*>(&ptr));
                bufstr.clear();
                bufstr.insert(0, ptr);
                obj.set(member.name, bufstr);
            }

            offset += member.size;
        }

        comp_data.call<void>("push", obj);
    }

    return comp_data;
}

template<class Reader_, class Handle_>
emscripten::val extract_string_values(const Handle_& handle) {
    auto dtype = handle.getDataType();
    auto dspace = handle.getSpace();
    auto output = emscripten::val::array();
    auto full_length = get_full_length(handle);

    std::string bufstr;
    if (dtype.isVariableStr()) {
        std::vector<char*> buffer(full_length);
        Reader_::read(handle, buffer.data(), dtype);
        CleanUp tmp([&]() -> void {
            H5Dvlen_reclaim(dtype.getId(), dspace.getId(), H5P_DEFAULT, buffer.data());
        });
        for (I<decltype(full_length)> i = 0; i < full_length; ++i) {
            bufstr.clear();
            bufstr.insert(0, buffer[i]);
            output.call<void>("push", bufstr);
        }

    } else {
        auto strlen = dtype.getSize();
        std::vector<char> buffer(strlen * full_length);
        Reader_::read(handle, buffer.data(), dtype);
        auto start = buffer.data();
        for (I<decltype(full_length)> i = 0; i < full_length; ++i) {
            I<decltype(strlen)> j = 0;
            for (; j < strlen && start[j] != '\0'; ++j) {}
            bufstr.clear();
            bufstr.insert(bufstr.end(), start, start + j);
            output.call<void>("push", bufstr);
            start += strlen;
        }
    }

    return output;
}

class LoadedH5DataSet {
    struct Internal {
        template<class Handle_, typename Type_, class MemType_>
        static void read(const Handle_& dhandle, Type_* buffer, const MemType_& mem_type) {
            dhandle.read(buffer, mem_type);            
        }
    };

    H5::H5File my_fhandle;
    H5::DataSet my_dhandle;
    LoadedH5Numeric my_numeric;

public:
    LoadedH5DataSet(std::string path, std::string name) : my_fhandle(path, H5F_ACC_RDONLY), my_dhandle(my_fhandle.openDataSet(name)) {}

    emscripten::val numeric_values() {
        try {
            my_numeric.template fill_numeric_contents<Internal>(my_dhandle);
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        } 
        return my_numeric.numeric_values();
    }

    emscripten::val compound_values() const {
        try {
            return extract_compound_values<Internal>(my_dhandle);
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        } 
    }

    emscripten::val string_values() const {
        try {
            return extract_string_values<Internal>(my_dhandle);
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        } 
    }
};

class LoadedH5Attr {
    struct Internal {
        template<class Handle_, typename Type_, class MemType_>
        static void read(const Handle_& ahandle, Type_* buffer, const MemType_& mem_type) {
            ahandle.read(mem_type, buffer);
        } 
    };

    H5::H5File my_fhandle;
    H5::DataSet my_dhandle;
    H5::Group my_ghandle;
    H5::Attribute my_ahandle;
    LoadedH5Numeric my_numeric;

public:
    LoadedH5Attr(std::string path, std::string name, std::string attr) : my_fhandle(path, H5F_ACC_RDONLY) {
        auto child_type = my_fhandle.childObjType(name);
        if (child_type == H5O_TYPE_GROUP) {
            my_ghandle = my_fhandle.openGroup(name);
            my_ahandle = my_ghandle.openAttribute(attr);
        } else if (child_type == H5O_TYPE_DATASET) {
            my_dhandle = my_fhandle.openDataSet(name);
            my_ahandle = my_dhandle.openAttribute(attr);
        } else {
            throw std::runtime_error("cannot fetch attribute from unknown HDF5 object '" + name + "'");
        }
    }

    emscripten::val numeric_values() {
        try {
            my_numeric.template fill_numeric_contents<Internal>(my_ahandle);
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }
        return my_numeric.numeric_values();
    }

    emscripten::val compound_values() const {
        try {
            return extract_compound_values<Internal>(my_ahandle);
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }
    }

    emscripten::val string_values() const {
        try {
            return extract_string_values<Internal>(my_ahandle);
        } catch (H5::Exception& e) {
            throw std::runtime_error(e.getCDetailMsg());
        }
    }

    emscripten::val shape() const {
        return extract_shape(my_ahandle);
    }

    emscripten::val type() {
        return format_type(my_ahandle);
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

/************* Creation utilities **************/

std::vector<hsize_t> array_to_vector(const emscripten::val& input) {
    std::vector<hsize_t> dims;
    for (auto x : input) {
        auto d = x.template as<double>();
        dims.push_back(js2int<hsize_t>(d));
    }
    return dims;
}

H5::PredType choose_numeric_type(const std::string& type) {
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
    } else if (type != "Float64") {
        throw std::runtime_error("unknown type '" + type + "' for numeric data");
    } else {
        return H5::PredType::NATIVE_DOUBLE;
    }
}

H5::StrType choose_string_type(const std::string& encoding, JsFakeInt strlen_or_var) {
    H5::StrType stype;
    if (strlen_or_var < 0) {
        stype = H5::StrType(0, H5T_VARIABLE);
    } else {
        stype = H5::StrType(0, std::max(static_cast<std::size_t>(1), js2int<std::size_t>(strlen_or_var))); // Make sure that is at least of length 1.
    }
    if (encoding == "ASCII") {
        stype.setCset(H5T_CSET_ASCII);
    } else {
        stype.setCset(H5T_CSET_UTF8);
    }
    return stype;
}

H5::EnumType choose_enum_type(const std::string& code_type, const emscripten::val& levels) {
    H5::IntType itype;
    if (code_type == "Uint8") {
        itype = H5::PredType::NATIVE_UINT8;
    } else if (code_type == "Int8") {
        itype = H5::PredType::NATIVE_INT8;
    } else if (code_type == "Uint16") {
        itype = H5::PredType::NATIVE_UINT16;
    } else if (code_type == "Int16") {
        itype = H5::PredType::NATIVE_INT16;
    } else if (code_type == "Uint32") {
        itype = H5::PredType::NATIVE_UINT32;
    } else if (code_type == "Int32") {
        itype = H5::PredType::NATIVE_INT32;
    } else if (code_type == "Uint64") {
        itype = H5::PredType::NATIVE_UINT64;
    } else if (code_type == "Int64") {
        itype = H5::PredType::NATIVE_INT64;
    } else {
        throw std::runtime_error("unsupported type '" + code_type + "' for enum codes");
    }

    H5::EnumType etype(itype);
    for (auto x : levels) {
        auto str = x["name"].template as<std::string>();
        double raw_val = x["value"].template as<double>();
        if (code_type == "Uint8") {
            std::uint8_t val = raw_val;
            etype.insert(str, &val);
        } else if (code_type == "Int8") {
            std::int8_t val = raw_val;
            etype.insert(str, &val);
        } else if (code_type == "Uint16") {
            std::uint16_t val = raw_val;
            etype.insert(str, &val);
        } else if (code_type == "Int16") {
            std::int16_t val = raw_val;
            etype.insert(str, &val);
        } else if (code_type == "Uint32") {
            std::uint32_t val = raw_val;
            etype.insert(str, &val);
        } else if (code_type == "Int32") {
            std::int8_t val = raw_val;
            etype.insert(str, &val);
        } else if (code_type == "Uint64") {
            std::uint64_t val = raw_val;
            etype.insert(str, &val);
        } else if (code_type == "Int64") {
            std::int64_t val = raw_val;
            etype.insert(str, &val);
        }
    }

    return etype;
}

H5::CompType choose_compound_type(const emscripten::val& members) {
    struct MemberType {
        MemberType() = default;
        MemberType(std::string name, std::size_t offset, H5::DataType dtype) : name(std::move(name)), offset(offset), dtype(std::move(dtype)) {}
        std::string name;
        std::size_t offset;
        H5::DataType dtype;
    };
    std::vector<MemberType> all_types;
    std::size_t offset = 0;

    for (const auto& x : members) {
        auto name = x["name"].template as<std::string>();
        auto type = x["type"];
        auto mode = type["mode"].template as<std::string>();
        if (mode == "string") {
            auto encoding = type["encoding"].template as<std::string>(); 
            auto str_len = type["length"].template as<double>(); 
            all_types.emplace_back(std::move(name), offset, choose_string_type(encoding, str_len));
        } else if (mode == "numeric") {
            auto type2 = type["type"].template as<std::string>(); 
            all_types.emplace_back(std::move(name), offset, choose_numeric_type(type2));
        } else {
            throw std::runtime_error("only numbers and strings are currently supported in compound data types");
        }
        offset += all_types.back().dtype.getSize();
    }

    H5::CompType ctype(offset);
    for (auto& x : all_types) {
        ctype.insertMember(std::move(x.name), x.offset, std::move(x.dtype));
    }
    return ctype;
}

/************* Dataset creation **************/

void create_hdf5_dataset(const std::string& path, const std::string& name, const H5::DataType& dtype, const emscripten::val& shape, JsFakeInt deflate_level, const emscripten::val& chunks) {
    H5::DataSpace dspace;
    auto dims = array_to_vector(shape);
    if (!dims.empty()) { // if zero, it's a scalar, and the default DataSpace is correct.
        dspace = H5::DataSpace(dims.size(), dims.data());
    }

    // Checking for non-zero length, otherwise chunking will fail.
    bool all_nonzero = true;
    for (auto d : dims) {
        if (d == 0) {
            all_nonzero = false;
            break;
        }
    }

 	H5::DSetCreatPropList plist;
    if (deflate_level >= 0 && dims.size() > 0 && all_nonzero) {
        plist.setDeflate(js2int<int>(deflate_level));
        auto chunkdim = array_to_vector(chunks);
        plist.setChunk(chunkdim.size(), chunkdim.data());
    }

    H5::H5File handle(path, H5F_ACC_RDWR);
    handle.createDataSet(name, dtype, dspace, plist);
}

void create_numeric_hdf5_dataset(std::string path, std::string name, emscripten::val shape, JsFakeInt deflate_level, emscripten::val chunks, std::string type) {
    try {
        create_hdf5_dataset(path, name, choose_numeric_type(type), shape, deflate_level, chunks);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void create_string_hdf5_dataset(std::string path, std::string name, emscripten::val shape, JsFakeInt deflate_level, emscripten::val chunks, std::string encoding, JsFakeInt strlen_or_var) {
    try {
        create_hdf5_dataset(path, name, choose_string_type(encoding, strlen_or_var), shape, deflate_level, chunks);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void create_enum_hdf5_dataset(std::string path, std::string name, emscripten::val shape, JsFakeInt deflate_level, emscripten::val chunks, std::string code_type, emscripten::val levels) {
    try {
        create_hdf5_dataset(path, name, choose_enum_type(code_type, levels), shape, deflate_level, chunks);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void create_compound_hdf5_dataset(std::string path, std::string name, emscripten::val shape, JsFakeInt deflate_level, emscripten::val chunks, emscripten::val members) {
    try {
        create_hdf5_dataset(path, name, choose_compound_type(members), shape, deflate_level, chunks);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

/************* Attribute creation **************/

void create_hdf5_attribute(const std::string& path, const std::string& name, const std::string& attr, const H5::DataType& dtype, emscripten::val shape) {
    H5::H5File handle(path, H5F_ACC_RDWR);

    auto creator = [&](const H5::H5Object& handle) -> void {
        H5::DataSpace dspace;
        auto dims = array_to_vector(shape);
        if (!dims.empty()) { // if zero, it's a scalar, and the default DataSpace is correct.
            dspace = H5::DataSpace(dims.size(), dims.data());
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
} 

void create_numeric_hdf5_attribute(std::string path, std::string name, std::string attr, emscripten::val shape, std::string type) {
    try {
        create_hdf5_attribute(path, name, attr, choose_numeric_type(type), shape);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void create_string_hdf5_attribute(std::string path, std::string name, std::string attr, emscripten::val shape, std::string encoding, JsFakeInt strlen_or_var) {
    try {
        create_hdf5_attribute(path, name, attr, choose_string_type(encoding, strlen_or_var), shape);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void create_enum_hdf5_attribute(std::string path, std::string name, std::string attr, emscripten::val shape, std::string code_type, emscripten::val levels) {
    try {
        create_hdf5_attribute(path, name, attr, choose_enum_type(code_type, levels), shape);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void create_compound_hdf5_attribute(std::string path, std::string name, std::string attr, emscripten::val shape, emscripten::val members) {
    try {
        create_hdf5_attribute(path, name, attr, choose_compound_type(members), shape);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

/************* Writing utilities **************/

template<class Reader_, class Handle_>
void write_numeric_hdf5_base(Handle_& handle, const std::string& type, JsFakeInt data_raw) {
    const auto data = js2int<std::uintptr_t>(data_raw);
    if (type == "Uint8WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::uint8_t*>(data), H5::PredType::NATIVE_UINT8);
    } else if (type == "Int8WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::int8_t*>(data), H5::PredType::NATIVE_INT8);
    } else if (type == "Uint16WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::uint16_t*>(data), H5::PredType::NATIVE_UINT16);
    } else if (type == "Int16WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::int16_t*>(data), H5::PredType::NATIVE_INT16);
    } else if (type == "Uint32WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::uint32_t*>(data), H5::PredType::NATIVE_UINT32);
    } else if (type == "Int32WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::int32_t*>(data), H5::PredType::NATIVE_INT32);
    } else if (type == "Uint64WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::uint64_t*>(data), H5::PredType::NATIVE_UINT64);
    } else if (type == "Int64WasmArray") {
        Reader_::write(handle, reinterpret_cast<const std::int64_t*>(data), H5::PredType::NATIVE_INT64);
    } else if (type == "Float32WasmArray") {
        Reader_::write(handle, reinterpret_cast<const float*>(data), H5::PredType::NATIVE_FLOAT);
    } else if (type == "Float64WasmArray") {
        Reader_::write(handle, reinterpret_cast<const double*>(data), H5::PredType::NATIVE_DOUBLE);
    } else {
        throw std::runtime_error(std::string("unknown supported type '") + type + "' for HDF5 writing");
    }
}

template<class Writer_, class Handle_>
void write_string_hdf5_base(Handle_& handle, const emscripten::val& data) {
    auto full_length = get_full_length(handle);
    auto stype = handle.getStrType();

    if (stype.isVariableStr()) {
        std::vector<std::string> all_strings;
        all_strings.reserve(full_length);
        std::vector<const char*> ptrs;
        ptrs.reserve(full_length);

        for (auto x : data) {
            all_strings.emplace_back(x.template as<std::string>());
            ptrs.emplace_back(all_strings.back().c_str());
        }

        Writer_::write(handle, ptrs.data(), stype);

    } else {
        auto max_len = stype.getSize();
        std::vector<char> temp(sanisizer::product<typename std::vector<char>::size_type>(max_len, full_length), '\0');
        auto it = temp.data();
        for (auto x : data) {
            auto current = x.template as<std::string>();
            std::copy_n(current.data(), std::min(current.size(), max_len), it);
            it += max_len;
        }

        Writer_::write(handle, temp.data(), stype);
    }
}

template<class Writer_, class Handle_>
void write_enum_hdf5_base(Handle_& handle, JsFakeInt data_raw) {
    const auto data = js2int<std::uintptr_t>(data_raw);
    auto itype = handle.getIntType();
    const bool is_unsigned = (itype.getSign() == H5T_SGN_NONE);
    const auto isize = itype.getSize();

    if (isize <= 1) {
        if (is_unsigned) {
            Writer_::write(handle, reinterpret_cast<std::uint8_t*>(data), handle.getDataType());
        } else {
            Writer_::write(handle, reinterpret_cast<std::int8_t*>(data), handle.getDataType());
        }
    } else if (isize <= 2) {
        if (is_unsigned) {
            Writer_::write(handle, reinterpret_cast<std::uint16_t*>(data), handle.getDataType());
        } else {
            Writer_::write(handle, reinterpret_cast<std::int16_t*>(data), handle.getDataType());
        }
    } else if (isize <= 4) {
        if (is_unsigned) {
            Writer_::write(handle, reinterpret_cast<std::uint32_t*>(data), handle.getDataType());
        } else {
            Writer_::write(handle, reinterpret_cast<std::int32_t*>(data), handle.getDataType());
        }
    } else {
        // Probably can't be reached yet, but we'll just stick it in.
        if (is_unsigned) {
            Writer_::write(handle, reinterpret_cast<std::uint64_t*>(data), handle.getDataType());
        } else {
            Writer_::write(handle, reinterpret_cast<std::int64_t*>(data), handle.getDataType());
        }
    }
}

template<class Writer_, class Handle_>
void write_compound_hdf5_base(Handle_& handle, const emscripten::val& data) {
    const auto full_length = get_full_length(handle);
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
    I<decltype(nmembers)> num_vstrings = 0;
    for (I<decltype(nmembers)> m = 0; m < nmembers; ++m) {
        auto& current = h5_members[m];
        current.name = dtype.getMemberName(m);
        current.offset = offset;
        auto cls = dtype.getMemberClass(m);
        compact_members[m].name = current.name;

        if (cls == H5T_STRING) {
            compact_members[m].is_string = true;
            auto stype = dtype.getMemberStrType(m);
            if (stype.isVariableStr()) {
                compact_members[m].is_variable = true;
                ++num_vstrings;
            } else {
                compact_members[m].strlen = stype.getSize();
            }
            current.dtype = dtype.getMemberDataType(m);
        } else if (cls == H5T_INTEGER || cls == H5T_FLOAT) {
            current.dtype = H5::PredType::NATIVE_DOUBLE;
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
    payload.reserve(sanisizer::product<I<decltype(payload.size())> >(full_length, ctype.getSize()));
    std::vector<std::string> vstrings;
    vstrings.reserve(sanisizer::product<I<decltype(vstrings.size())> >(full_length , num_vstrings));

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

    Writer_::write(handle, payload.data(), ctype);
}

/************* Dataset writers **************/

struct DataSetHandleWriter {
    template<class Handle, typename T, class MemType>
    static void write(Handle& handle, T* data, const MemType& memtype) {
        handle.write(data, memtype);
    }
};

void write_numeric_hdf5_dataset(std::string path, std::string name, std::string type, JsFakeInt data) {
    try {
        H5::H5File handle(path, H5F_ACC_RDWR);
        auto dhandle = handle.openDataSet(name);
        write_numeric_hdf5_base<DataSetHandleWriter>(dhandle, type, data);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void write_string_hdf5_dataset(std::string path, std::string name, emscripten::val data) {
    try {
        H5::H5File handle(path, H5F_ACC_RDWR);
        auto dhandle = handle.openDataSet(name);
        write_string_hdf5_base<DataSetHandleWriter>(dhandle, data);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void write_enum_hdf5_dataset(std::string path, std::string name, JsFakeInt data) {
    try {
        H5::H5File handle(path, H5F_ACC_RDWR);
        auto dhandle = handle.openDataSet(name);
        write_enum_hdf5_base<DataSetHandleWriter>(dhandle, data);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void write_compound_hdf5_dataset(std::string path, std::string name, const emscripten::val& data) {
    try {
        H5::H5File handle(path, H5F_ACC_RDWR);
        auto dhandle = handle.openDataSet(name);
        write_compound_hdf5_base<DataSetHandleWriter>(dhandle, data);
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

/************* Attribute writers **************/

struct AttributeHandleWriter {
    template<class Handle_, typename Type_, class MemType_>
    static void write(Handle_& handle, Type_* data, const MemType_& memtype) {
        handle.write(memtype, data);
    }
};

template<class Function_>
void write_hdf5_attribute(const std::string& path, const std::string& name, const std::string& attr, Function_ writer) {
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

void write_numeric_hdf5_attribute(std::string path, std::string name, std::string attr, std::string type, JsFakeInt data) {
    try {
        write_hdf5_attribute(
            path,
            name,
            attr,
            [&](auto& ahandle) -> void {
                write_numeric_hdf5_base<AttributeHandleWriter>(ahandle, type, data);
            }
        );
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void write_string_hdf5_attribute(std::string path, std::string name, std::string attr, emscripten::val data) {
    try {
        write_hdf5_attribute(
            path,
            name,
            attr,
            [&](auto& ahandle) -> void {
                write_string_hdf5_base<AttributeHandleWriter>(ahandle, data);
            }
        );
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void write_enum_hdf5_attribute(std::string path, std::string name, std::string attr, JsFakeInt data) {
    try {
        write_hdf5_attribute(
            path,
            name,
            attr,
            [&](auto& ahandle) -> void {
                write_enum_hdf5_base<AttributeHandleWriter>(ahandle, data);
            }
        );
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

void write_compound_hdf5_attribute(std::string path, std::string name, std::string attr, const emscripten::val& data) {
    try {
        write_hdf5_attribute(
            path,
            name,
            attr,
            [&](auto& ahandle) -> void {
                write_compound_hdf5_base<AttributeHandleWriter>(ahandle, data);
            }
        );
    } catch (H5::Exception& e) {
        throw std::runtime_error(e.getCDetailMsg());
    }
}

/************* String length guessers **************/

JsFakeInt get_max_str_len(emscripten::val x) {
    std::size_t strlen = 0;
    for (auto y : x) {
        if (y.isString()) {
            auto current = y.template as<std::string>();
            if (current.size() > strlen) {
                strlen = current.size();
            }
        }
    }
    return int2js(strlen);
}

emscripten::val get_max_str_len_compound(emscripten::val x, emscripten::val fields) {
    std::vector<std::pair<std::string, std::size_t> > to_access; 
    for (auto f : fields) {
        to_access.emplace_back(f.template as<std::string>(), 0);
    }

    for (auto y : x) {
        for (auto& t : to_access) {
            auto current_raw = y[t.first];
            if (current_raw.isString()) {
                auto current = current_raw.template as<std::string>();
                if (current.size() > t.second) {
                    t.second = current.size();
                }
            }
        }
    }

    auto output = emscripten::val::array();
    for (const auto& t : to_access) {
        output.call<void>("push", int2js(t.second));
    }
    return output;
}

/************* Emscripten bindings **************/

EMSCRIPTEN_BINDINGS(hdf5_utils) {
    emscripten::class_<H5GroupDetails>("H5GroupDetails")
        .constructor<std::string, std::string>()
        .function("children", &H5GroupDetails::children, emscripten::return_value_policy::take_ownership())
        .function("attributes", &H5GroupDetails::attributes, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::class_<H5DataSetDetails>("H5DataSetDetails")
        .constructor<std::string, std::string>()
        .function("type", &H5DataSetDetails::type, emscripten::return_value_policy::take_ownership())
        .function("shape", &H5DataSetDetails::shape, emscripten::return_value_policy::take_ownership())
        .function("attributes", &H5DataSetDetails::attributes, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::class_<LoadedH5DataSet>("LoadedH5DataSet")
        .constructor<std::string, std::string>()
        .function("numeric_values", &LoadedH5DataSet::numeric_values, emscripten::return_value_policy::take_ownership())
        .function("string_values", &LoadedH5DataSet::string_values, emscripten::return_value_policy::take_ownership())
        .function("compound_values", &LoadedH5DataSet::compound_values, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::class_<LoadedH5Attr>("LoadedH5Attr")
        .constructor<std::string, std::string, std::string>()
        .function("type", &LoadedH5Attr::type, emscripten::return_value_policy::take_ownership())
        .function("shape", &LoadedH5Attr::shape, emscripten::return_value_policy::take_ownership())
        .function("numeric_values", &LoadedH5Attr::numeric_values, emscripten::return_value_policy::take_ownership())
        .function("string_values", &LoadedH5Attr::string_values, emscripten::return_value_policy::take_ownership())
        .function("compound_values", &LoadedH5Attr::compound_values, emscripten::return_value_policy::take_ownership())
        ;

   emscripten::function("create_hdf5_file", &create_hdf5_file, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_hdf5_group", &create_hdf5_group, emscripten::return_value_policy::take_ownership());

   emscripten::function("create_numeric_hdf5_dataset", &create_numeric_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_string_hdf5_dataset", &create_string_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_enum_hdf5_dataset", &create_enum_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_compound_hdf5_dataset", &create_compound_hdf5_dataset, emscripten::return_value_policy::take_ownership());

   emscripten::function("create_numeric_hdf5_attribute", &create_numeric_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_string_hdf5_attribute", &create_string_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_enum_hdf5_attribute", &create_enum_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("create_compound_hdf5_attribute", &create_compound_hdf5_attribute, emscripten::return_value_policy::take_ownership());

   emscripten::function("write_numeric_hdf5_dataset", &write_numeric_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_string_hdf5_dataset", &write_string_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_enum_hdf5_dataset", &write_enum_hdf5_dataset, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_compound_hdf5_dataset", &write_compound_hdf5_dataset, emscripten::return_value_policy::take_ownership());

   emscripten::function("write_numeric_hdf5_attribute", &write_numeric_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_string_hdf5_attribute", &write_string_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_enum_hdf5_attribute", &write_enum_hdf5_attribute, emscripten::return_value_policy::take_ownership());
   emscripten::function("write_compound_hdf5_attribute", &write_compound_hdf5_attribute, emscripten::return_value_policy::take_ownership());

   emscripten::function("get_max_str_len", &get_max_str_len, emscripten::return_value_policy::take_ownership());
   emscripten::function("get_max_str_len_compound", &get_max_str_len_compound, emscripten::return_value_policy::take_ownership());
}
