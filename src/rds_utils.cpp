#include <emscripten.h>
#include <emscripten/bind.h>

#include "rds_utils.h"
#include "rds2cpp/rds2cpp.hpp"
#include "byteme/SomeBufferReader.hpp"

class LoadedRds {
public:
    LoadedRds(rds2cpp::Parsed f) : full(std::move(f)) {}

    RdsObject load() {
        return RdsObject(full.object.get());
    }

    int32_t format_version() const {
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

LoadedRds parse_rds_from_buffer(uintptr_t buffer, int32_t size) {
    byteme::SomeBufferReader reader(reinterpret_cast<const uint8_t*>(buffer), size);
    return LoadedRds(rds2cpp::parse_rds(reader));
}

LoadedRds parse_rds_from_file(std::string path) {
    return LoadedRds(rds2cpp::parse_rds(path));
}

EMSCRIPTEN_BINDINGS(rds_utils) {
    emscripten::class_<LoadedRds>("LoadedRds")
        .function("load", &LoadedRds::load, emscripten::return_value_policy::take_ownership())
        .function("format_version", &LoadedRds::format_version, emscripten::return_value_policy::take_ownership())
        .function("writer_version", &LoadedRds::writer_version, emscripten::return_value_policy::take_ownership())
        .function("reader_version", &LoadedRds::reader_version, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::class_<RdsObject>("RdsObject")
        .function("type", &RdsObject::type, emscripten::return_value_policy::take_ownership())
        .function("numeric_vector", &RdsObject::numeric_vector, emscripten::return_value_policy::take_ownership())
        .function("fill_string_vector", &RdsObject::fill_string_vector, emscripten::return_value_policy::take_ownership())
        .function("string_vector_buffer", &RdsObject::string_vector_buffer, emscripten::return_value_policy::take_ownership())
        .function("string_vector_length", &RdsObject::string_vector_lengths, emscripten::return_value_policy::take_ownership())
        .function("fill_attribute_names", &RdsObject::fill_attribute_names, emscripten::return_value_policy::take_ownership())
        .function("attribute_names_buffer", &RdsObject::attribute_names_buffer, emscripten::return_value_policy::take_ownership())
        .function("attribute_names_length", &RdsObject::attribute_names_lengths, emscripten::return_value_policy::take_ownership())
        .function("find_attribute", &RdsObject::find_attribute, emscripten::return_value_policy::take_ownership())
        .function("load_attribute_by_name", &RdsObject::load_attribute_by_name, emscripten::return_value_policy::take_ownership())
        .function("load_attribute_by_index", &RdsObject::load_attribute_by_index, emscripten::return_value_policy::take_ownership())
        .function("load_list_element", &RdsObject::load_list_element, emscripten::return_value_policy::take_ownership())
        .function("class_name", &RdsObject::class_name, emscripten::return_value_policy::take_ownership())
        .function("package_name", &RdsObject::package_name, emscripten::return_value_policy::take_ownership())
        .function("size", &RdsObject::size, emscripten::return_value_policy::take_ownership())
        ;

    emscripten::function("parse_rds_from_buffer", &parse_rds_from_buffer, emscripten::return_value_policy::take_ownership());
    emscripten::function("parse_rds_from_file", &parse_rds_from_file, emscripten::return_value_policy::take_ownership());
}
