#include <emscripten.h>
#include <emscripten/bind.h>

#include "parallel.h"
#include "rds_utils.h"
#include "rds2cpp/rds2cpp.hpp"
#include "byteme/SomeBufferReader.hpp"

class LoadedRds {
public:
    LoadedRds(rds2cpp::Parsed f) : full(std::move(f)) {}

    RdsObject load() {
        return RdsObject(full.object.get());
    }

    int format_version() const {
        return full.format_version;
    }

    emscripten::val writer_version() const {
        return emscripten::val(emscripten::typed_memory_view(full.writer_version.size(), full.writer_version.data()));
    }

    emscripten::val reader_version() const {
        return emscripten::val(emscripten::typed_memory_view(full.reader_version.size(), full.reader_version.data()));
    }

    rds2cpp::Parsed full;
};

LoadedRds parse_rds_from_buffer(uintptr_t buffer, int size) {
    byteme::SomeBufferReader reader(reinterpret_cast<const uint8_t*>(buffer), size);
    return LoadedRds(rds2cpp::parse_rds(reader));
}

LoadedRds parse_rds_from_file(std::string path) {
    return LoadedRds(rds2cpp::parse_rds(path));
}

EMSCRIPTEN_BINDINGS(hdf5_utils) {
    emscripten::class_<LoadedRds>("LoadedRds")
        .function("load", &LoadedRds::load)
        .function("format_version", &LoadedRds::format_version)
        .function("writer_version", &LoadedRds::writer_version)
        .function("reader_version", &LoadedRds::reader_version)
        ;

    emscripten::class_<RdsObject>("RdsObject")
        .function("type", &RdsObject::type)
        .function("numeric_vector", &RdsObject::numeric_vector)
        .function("fill_string_vector", &RdsObject::fill_string_vector)
        .function("string_vector_buffer", &RdsObject::string_vector_buffer)
        .function("string_vector_length", &RdsObject::string_vector_lengths)
        .function("fill_attribute_names", &RdsObject::fill_attribute_names)
        .function("attribute_names_buffer", &RdsObject::attribute_names_buffer)
        .function("attribute_names_length", &RdsObject::attribute_names_lengths)
        .function("find_attribute", &RdsObject::find_attribute)
        .function("load_attribute", &RdsObject::load_attribute)
        .function("load_list_element", &RdsObject::load_list_element)
        .function("class_name", &RdsObject::class_name)
        .function("package_name", &RdsObject::package_name)
        ;

    emscripten::function("parse_rds_from_buffer", &parse_rds_from_buffer);
    emscripten::function("parse_rds_from_file", &parse_rds_from_file);
}
