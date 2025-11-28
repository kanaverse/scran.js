#ifndef RDS_UTILS_H
#define RDS_UTILS_H

#include <emscripten.h>

#include <optional>
#include <string>
#include <stdexcept>
#include <vector>
#include <cstddef>

#include "utils.h"

#include "rds2cpp/rds2cpp.hpp"

class RdsObject {
    const rds2cpp::RObject* my_ptr;

public:
    RdsObject(const rds2cpp::RObject* ptr) : my_ptr(ptr) {}

    const rds2cpp::RObject* ptr() const {
        return my_ptr;
    }

    std::string js_type() const {
        switch (my_ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return "integer";
            case rds2cpp::SEXPType::REAL:
                return "double";
            case rds2cpp::SEXPType::STR:
                return "string";
            case rds2cpp::SEXPType::LGL:
                return "boolean";
            case rds2cpp::SEXPType::VEC:
                return "vector";
            case rds2cpp::SEXPType::S4:
                return "S4";
            case rds2cpp::SEXPType::NIL:
                return "null";
            default:
                break;
        }
        return "other";
    }

private:
    template<class Vector_>
    JsFakeInt size() const {
        auto xptr = static_cast<const Vector_*>(my_ptr);
        return int2js(xptr->data.size());
    }

public:
    JsFakeInt js_size() const {
        switch (my_ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return size<rds2cpp::IntegerVector>();
            case rds2cpp::SEXPType::REAL:
                return size<rds2cpp::DoubleVector>();
            case rds2cpp::SEXPType::STR:
                return size<rds2cpp::StringVector>();
            case rds2cpp::SEXPType::LGL:
                return size<rds2cpp::LogicalVector>();
            case rds2cpp::SEXPType::VEC:
                return size<rds2cpp::GenericVector>();
            default:
                break;
        }
        return -1;
    }

private:
    template<class Vector_>
    emscripten::val numeric_vector() const {
        auto xptr = static_cast<const Vector_*>(my_ptr);
        return emscripten::val(emscripten::typed_memory_view(xptr->data.size(), xptr->data.data()));
    }

public:
    emscripten::val js_numeric_vector() const {
        switch (my_ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return numeric_vector<rds2cpp::IntegerVector>();
            case rds2cpp::SEXPType::REAL:
                return numeric_vector<rds2cpp::DoubleVector>();
            case rds2cpp::SEXPType::LGL:
                return numeric_vector<rds2cpp::LogicalVector>();
            default:
                break;
        }
        throw std::runtime_error("cannot obtain numeric values for non-numeric RObject type");
        return numeric_vector<rds2cpp::IntegerVector>(); // avoid compiler warning.
    }

private:
    static emscripten::val extract_strings(const std::vector<std::string>& values) {
        auto output = emscripten::val::array(); 
        for (const auto& s : values) {
            output.call<void>("push", emscripten::val(s));
        }
        return output;
    }

public:
    emscripten::val js_string_vector() const {
        if (my_ptr->type() != rds2cpp::SEXPType::STR) {
            throw std::runtime_error("cannot return string values for non-string RObject type");
        }
        auto sptr = static_cast<const rds2cpp::StringVector*>(my_ptr);
        return extract_strings(sptr->data);
    }

private:
    template<class AttrClass>
    emscripten::val extract_attribute_names() {
        auto aptr = static_cast<const AttrClass*>(my_ptr);
        return extract_strings(aptr->attributes.names);
    }

public:
    emscripten::val js_attribute_names() {
        switch (my_ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return extract_attribute_names<rds2cpp::IntegerVector>();
            case rds2cpp::SEXPType::REAL:
                return extract_attribute_names<rds2cpp::DoubleVector>();
            case rds2cpp::SEXPType::LGL:
                return extract_attribute_names<rds2cpp::LogicalVector>();
            case rds2cpp::SEXPType::STR:
                return extract_attribute_names<rds2cpp::StringVector>();
            case rds2cpp::SEXPType::VEC:
                return extract_attribute_names<rds2cpp::GenericVector>();
            case rds2cpp::SEXPType::S4:
                return extract_attribute_names<rds2cpp::S4Object>();
            default:
                return emscripten::val::array();
        }
    }

private:
    template<class Attr_>
    std::optional<std::size_t> find_attribute_raw(const std::string& name) const {
        auto aptr = static_cast<const Attr_*>(my_ptr);
        const auto& attr_names = aptr->attributes.names;
        const auto nattr = attr_names.size();
        for (I<decltype(nattr)> i = 0; i < nattr; ++i) {
            if (attr_names[i] == name) {
                return sanisizer::cast<std::size_t>(i);
            }
        }
        return {};
    }

    std::optional<std::size_t> find_attribute_internal(std::string name) const {
        switch (my_ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return find_attribute_raw<rds2cpp::IntegerVector>(name);
            case rds2cpp::SEXPType::REAL:
                return find_attribute_raw<rds2cpp::DoubleVector>(name);
            case rds2cpp::SEXPType::LGL:
                return find_attribute_raw<rds2cpp::LogicalVector>(name);
            case rds2cpp::SEXPType::STR:
                return find_attribute_raw<rds2cpp::StringVector>(name);
            case rds2cpp::SEXPType::VEC:
                return find_attribute_raw<rds2cpp::GenericVector>(name);
            case rds2cpp::SEXPType::S4:
                return find_attribute_raw<rds2cpp::S4Object>(name);
            default:
                break;
        }
        return {};
    }

public:
    JsFakeInt js_find_attribute(const std::string& name) const {
        auto found = find_attribute_internal(name);
        if (found.has_value()) {
            return int2js(*found);
        } else {
            return -1;
        }
    }

private:
    template<class Attr_>
    RdsObject load_attribute_raw(std::size_t i) const {
        auto aptr = static_cast<const Attr_*>(my_ptr);
        if (i >= aptr->attributes.values.size()) {
            throw std::runtime_error("requested attribute index " + std::to_string(i) + " is out of range");
        }
        const auto& chosen = aptr->attributes.values[i];
        return RdsObject(chosen.get());
    }

    RdsObject load_attribute_by_index_internal(std::size_t i) const {
        switch (my_ptr->type()) {
            case rds2cpp::SEXPType::INT:
                return load_attribute_raw<rds2cpp::IntegerVector>(i);
            case rds2cpp::SEXPType::REAL:
                return load_attribute_raw<rds2cpp::IntegerVector>(i);
            case rds2cpp::SEXPType::LGL:
                return load_attribute_raw<rds2cpp::LogicalVector>(i);
            case rds2cpp::SEXPType::STR:
                return load_attribute_raw<rds2cpp::StringVector>(i);
            case rds2cpp::SEXPType::VEC:
                return load_attribute_raw<rds2cpp::GenericVector>(i);
            case rds2cpp::SEXPType::S4:
                return load_attribute_raw<rds2cpp::S4Object>(i);
            default:
                break;
        }
        throw std::runtime_error("unsupported R object type");
        return load_attribute_raw<rds2cpp::S4Object>(i); // avoid compiler warnings.
    }

public:
    RdsObject js_load_attribute_by_index(JsFakeInt i_raw) const {
        const auto i = js2int<std::size_t>(i_raw);
        return load_attribute_by_index_internal(i);
    }

    RdsObject js_load_attribute_by_name(std::string n) const {
        auto i = find_attribute_internal(n);
        if (!i.has_value()) {
            throw std::runtime_error("no attribute named '" + n + "'");
        }
        return load_attribute_by_index_internal(*i);
    }

public:
    RdsObject js_load_list_element(JsFakeInt i_raw) const {
        if (my_ptr->type() != rds2cpp::SEXPType::VEC) {
            throw std::runtime_error("cannot return list element for non-list R object");
        }
        auto lptr = static_cast<const rds2cpp::GenericVector*>(my_ptr);
        auto i = js2int<I<decltype(lptr->data.size())> >(i_raw);
        return RdsObject(lptr->data[i].get());
    }

public:
    std::string js_class_name() const {
        if (my_ptr->type() != rds2cpp::SEXPType::S4) {
            throw std::runtime_error("cannot return class name for non-S4 R object");
        }
        auto sptr = static_cast<const rds2cpp::S4Object*>(my_ptr);
        return sptr->class_name;
    }

    std::string js_package_name() const {
        if (my_ptr->type() != rds2cpp::SEXPType::S4) {
            throw std::runtime_error("cannot return class name for non-S4 R object");
        }
        auto sptr = static_cast<const rds2cpp::S4Object*>(my_ptr);
        return sptr->package_name;
    }

public:
};

#endif
